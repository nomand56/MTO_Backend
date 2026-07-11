import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MoverProfile } from './entities/mover-profile.entity';
import { MoverVehicleType } from './entities/mover-vehicle-type.entity';
import { UpsertMoverProfileDto } from './dto/upsert-mover-profile.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import {
  NearbyMoversQueryDto,
  NearbyMoversSortBy,
} from './dto/nearby-movers-query.dto';
import { Review } from '../reviews/entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { VehicleType } from '../vehicles/entities/vehicle-type.entity';
import { ZonesService } from '../zones/zones.service';
import { UserRole } from '../common/enums/user-role.enum';

const LOCATION_STALE_MS = 10 * 60 * 1000;
const AVG_SPEED_KMH = 30;

type NearbyMoverResult = {
  id: string;
  businessName: string;
  avatarUrl?: string;
  vehicleTypes: { id: string; name: string }[];
  latitude: number;
  longitude: number;
  distanceKm: number;
  estimatedFrom: number;
  estimatedMinutes: number;
  averageRating: number;
  completedMoves: number;
};

@Injectable()
export class MoversService {
  constructor(
    @InjectRepository(MoverProfile)
    private readonly moverProfileRepository: Repository<MoverProfile>,
    @InjectRepository(MoverVehicleType)
    private readonly moverVehicleTypeRepository: Repository<MoverVehicleType>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly zonesService: ZonesService,
  ) {}

  async upsertProfile(userId: string, dto: UpsertMoverProfileDto) {
    let profile = await this.moverProfileRepository.findOne({
      where: { userId },
    });

    const { vehicleTypeIds, ...profileData } = dto;

    if (profile) {
      Object.assign(profile, {
        ...profileData,
        documents:
          dto.documents?.map((doc) => ({
            ...doc,
            status: 'pending',
          })) ?? profile.documents,
      });
    } else {
      profile = this.moverProfileRepository.create({
        userId,
        ...profileData,
        documents:
          dto.documents?.map((doc) => ({
            ...doc,
            status: 'pending',
          })) ?? [],
        serviceAreas: dto.serviceAreas ?? [],
        isVerified: false,
        isOnline: false,
      });
    }

    const saved = await this.moverProfileRepository.save(profile);

    if (vehicleTypeIds) {
      await this.syncVehicleTypes(saved.id, vehicleTypeIds);
    }

    return this.getProfile(userId);
  }

  private async syncVehicleTypes(
    moverProfileId: string,
    vehicleTypeIds: string[],
  ) {
    await this.moverVehicleTypeRepository.delete({ moverProfileId });

    if (!vehicleTypeIds.length) {
      return;
    }

    const rows = vehicleTypeIds.map((vehicleTypeId, index) =>
      this.moverVehicleTypeRepository.create({
        moverProfileId,
        vehicleTypeId,
        isPrimary: index === 0,
      }),
    );

    await this.moverVehicleTypeRepository.save(rows);
  }

  async getProfile(userId: string) {
    const profile = await this.moverProfileRepository.findOne({
      where: { userId },
      relations: { user: true, vehicleTypes: { vehicleType: true } },
    });

    if (!profile) {
      throw new NotFoundException('Mover profile not found');
    }

    return profile;
  }

  async updatePresence(userId: string, dto: UpdatePresenceDto) {
    const profile = await this.moverProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Mover profile not found');
    }

    const now = new Date();

    if (dto.isOnline) {
      if (dto.latitude == null || dto.longitude == null) {
        throw new BadRequestException(
          'Latitude and longitude are required when going online',
        );
      }
      profile.latitude = dto.latitude;
      profile.longitude = dto.longitude;
      profile.locationUpdatedAt = now;
    }

    profile.isOnline = dto.isOnline;
    profile.lastSeenAt = now;

    return this.moverProfileRepository.save(profile);
  }

  async findNearbyMovers(query: NearbyMoversQueryDto) {
    const radiusKm = query.radiusKm ?? 25;
    const sortBy = query.sortBy ?? NearbyMoversSortBy.Distance;
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const staleBefore = new Date(Date.now() - LOCATION_STALE_MS);

    const profiles = await this.moverProfileRepository
      .createQueryBuilder('profile')
      .innerJoinAndSelect('profile.user', 'user')
      .leftJoinAndSelect('profile.vehicleTypes', 'moverVehicle')
      .leftJoinAndSelect('moverVehicle.vehicleType', 'vehicleType')
      .where('profile.isVerified = :verified', { verified: true })
      .andWhere('profile.isOnline = :online', { online: true })
      .andWhere('profile.latitude IS NOT NULL')
      .andWhere('profile.longitude IS NOT NULL')
      .andWhere('profile.locationUpdatedAt >= :staleBefore', { staleBefore })
      .andWhere('user.isActive = :active', { active: true })
      .andWhere('user.isVerified = :userVerified', { userVerified: true })
      .andWhere(':moverRole = ANY(user.roles)', { moverRole: UserRole.Mover })
      .getMany();

    const tripDistanceKm = this.resolveTripDistanceKm(query);
    const moverIds = profiles.map((profile) => profile.userId);
    const [ratingMap, completedMap] = await Promise.all([
      this.loadRatingStats(moverIds),
      this.loadCompletedStats(moverIds),
    ]);

    let movers: NearbyMoverResult[] = [];

    for (const profile of profiles) {
      const latitude = Number(profile.latitude);
      const longitude = Number(profile.longitude);
      const distanceKm = this.zonesService.distanceKm(
        query.latitude,
        query.longitude,
        latitude,
        longitude,
      );

      if (distanceKm > radiusKm) {
        continue;
      }

      const vehicleTypes = (profile.vehicleTypes ?? [])
        .map((entry) => entry.vehicleType)
        .filter((vehicleType): vehicleType is VehicleType => !!vehicleType)
        .map((vehicleType) => ({ id: vehicleType.id, name: vehicleType.name }));

      if (query.vehicleTypeId) {
        const matchesVehicle = vehicleTypes.some(
          (vehicleType) => vehicleType.id === query.vehicleTypeId,
        );
        if (!matchesVehicle) {
          continue;
        }
      }

      const primaryVehicle =
        profile.vehicleTypes?.find((entry) => entry.isPrimary)?.vehicleType ??
        profile.vehicleTypes?.[0]?.vehicleType;

      const estimatedFrom = await this.estimatePrice(
        primaryVehicle,
        tripDistanceKm,
        query.latitude,
        query.longitude,
      );
      const estimatedMinutes = Math.max(
        1,
        Math.round((distanceKm / AVG_SPEED_KMH) * 60),
      );
      const stats = ratingMap.get(profile.userId);
      const completedMoves = completedMap.get(profile.userId) ?? 0;

      movers.push({
        id: profile.userId,
        businessName: profile.businessName,
        avatarUrl: profile.avatarUrl,
        vehicleTypes,
        latitude,
        longitude,
        distanceKm: Number(distanceKm.toFixed(2)),
        estimatedFrom,
        estimatedMinutes,
        averageRating: stats?.averageRating ?? 0,
        completedMoves,
      });
    }

    movers = this.sortNearbyMovers(movers, sortBy);
    const page = movers.slice(offset, offset + limit);
    const averageArrivalMinutes = page.length
      ? Math.round(
          page.reduce((sum, mover) => sum + mover.estimatedMinutes, 0) /
            page.length,
        )
      : 0;

    return {
      summary: {
        total: movers.length,
        onlineCount: movers.length,
        averageArrivalMinutes,
      },
      movers: page,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < movers.length,
      },
    };
  }

  private resolveTripDistanceKm(query: NearbyMoversQueryDto) {
    if (
      query.destinationLatitude != null &&
      query.destinationLongitude != null
    ) {
      return this.zonesService.distanceKm(
        query.latitude,
        query.longitude,
        query.destinationLatitude,
        query.destinationLongitude,
      );
    }
    return 10;
  }

  private async estimatePrice(
    vehicleType: VehicleType | undefined,
    tripDistanceKm: number,
    latitude: number,
    longitude: number,
  ) {
    const basePrice = Number(vehicleType?.basePrice ?? 89);
    const pricePerKm = Number(vehicleType?.pricePerKm ?? 2.5);

    try {
      const pricing = await this.zonesService.getPricing({
        latitude,
        longitude,
        distanceKm: tripDistanceKm,
      });
      const zoneTotal = Number(pricing.total);
      const catalogTotal = basePrice + pricePerKm * tripDistanceKm;
      return Math.round(Math.max(zoneTotal, catalogTotal));
    } catch {
      return Math.round(basePrice + pricePerKm * tripDistanceKm);
    }
  }

  private sortNearbyMovers(
    movers: NearbyMoverResult[],
    sortBy: NearbyMoversSortBy,
  ) {
    const sorted = [...movers];
    switch (sortBy) {
      case NearbyMoversSortBy.Price:
        return sorted.sort((a, b) => a.estimatedFrom - b.estimatedFrom);
      case NearbyMoversSortBy.Rating:
        return sorted.sort((a, b) => b.averageRating - a.averageRating);
      case NearbyMoversSortBy.Arrival:
        return sorted.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
      case NearbyMoversSortBy.Distance:
      default:
        return sorted.sort((a, b) => a.distanceKm - b.distanceKm);
    }
  }

  private async loadRatingStats(moverIds: string[]) {
    const map = new Map<string, { averageRating: number; reviewCount: number }>();
    if (!moverIds.length) {
      return map;
    }

    const rows = await this.reviewRepository
      .createQueryBuilder('review')
      .select('review.moverId', 'moverId')
      .addSelect('AVG(review.rating)', 'averageRating')
      .addSelect('COUNT(review.id)', 'reviewCount')
      .where('review.isVisible = :visible', { visible: true })
      .andWhere('review.moverId IN (:...moverIds)', { moverIds })
      .groupBy('review.moverId')
      .getRawMany<{
        moverId: string;
        averageRating: string;
        reviewCount: string;
      }>();

    for (const row of rows) {
      map.set(row.moverId, {
        averageRating: Number(Number(row.averageRating).toFixed(1)),
        reviewCount: Number(row.reviewCount),
      });
    }

    return map;
  }

  private async loadCompletedStats(moverIds: string[]) {
    const map = new Map<string, number>();
    if (!moverIds.length) {
      return map;
    }

    const rows = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('booking.moverId', 'moverId')
      .addSelect('COUNT(booking.id)', 'completedMoves')
      .where('booking.status = :status', { status: BookingStatus.Completed })
      .andWhere('booking.moverId IN (:...moverIds)', { moverIds })
      .groupBy('booking.moverId')
      .getRawMany<{ moverId: string; completedMoves: string }>();

    for (const row of rows) {
      map.set(row.moverId, Number(row.completedMoves));
    }

    return map;
  }

  async verifyMover(userId: string) {
    const profile = await this.moverProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Mover profile not found');
    }

    if (!profile.documents?.length) {
      throw new BadRequestException('Mover has not submitted documents');
    }

    profile.isVerified = true;
    profile.documents = profile.documents.map((doc) => ({
      ...doc,
      status: 'verified',
    }));

    return this.moverProfileRepository.save(profile);
  }

  async ensureVerified(moverId: string) {
    const profile = await this.moverProfileRepository.findOne({
      where: { userId: moverId },
    });

    if (!profile?.isVerified) {
      throw new BadRequestException(
        'Mover profile must be verified to perform this action',
      );
    }

    return profile;
  }
}
