import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CheckZoneDto,
  CreateZoneDto,
  UpdateZoneDto,
  ZoneAvailabilityQueryDto,
  ZonePricingQueryDto,
} from './dto/zone.dto';
import { PeakHourConfig } from './entities/peak-hour-config.entity';
import { Zone } from './entities/zone.entity';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,
    @InjectRepository(PeakHourConfig)
    private readonly peakHourRepository: Repository<PeakHourConfig>,
  ) {}

  findAll() {
    return this.zoneRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateZoneDto) {
    const zone = this.zoneRepository.create(dto);
    return this.zoneRepository.save(zone);
  }

  async update(id: string, dto: UpdateZoneDto) {
    const zone = await this.findById(id);
    await this.zoneRepository.update(zone.id, dto);
    return this.findById(id);
  }

  async remove(id: string) {
    const zone = await this.findById(id);
    await this.zoneRepository.remove(zone);
    return { message: 'Zone deleted' };
  }

  async checkCoverage(dto: CheckZoneDto) {
    const zones = await this.findAll();
    const matches = zones.filter((zone) =>
      this.isPointInZone(dto.latitude, dto.longitude, zone),
    );

    return {
      covered: matches.length > 0,
      zones: matches,
    };
  }

  async getPricing(dto: ZonePricingQueryDto) {
    const coverage = await this.checkCoverage(dto);
    if (!coverage.covered || coverage.zones.length === 0) {
      throw new BadRequestException('Location is outside service zones');
    }

    const zone = coverage.zones[0];
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();
    const peakMultiplier = await this.getPeakMultiplier(scheduledAt);
    const distanceKm = dto.distanceKm ?? 0;
    const zoneMultiplier = Number(zone.basePriceMultiplier);
    const baseFee = Number(zone.baseFee);
    const subtotal = baseFee + distanceKm * 2.5;
    const total = subtotal * zoneMultiplier * peakMultiplier;

    return {
      zone,
      distanceKm,
      peakMultiplier,
      zoneMultiplier,
      baseFee,
      subtotal,
      total,
    };
  }

  async getAvailability(dto: ZoneAvailabilityQueryDto) {
    const coverage = await this.checkCoverage(dto);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();
    const peakMultiplier = await this.getPeakMultiplier(scheduledAt);

    return {
      available: coverage.covered && coverage.zones.some((zone) => zone.isAvailable),
      zones: coverage.zones,
      peakMultiplier,
      scheduledAt,
    };
  }

  private async findById(id: string) {
    const zone = await this.zoneRepository.findOne({ where: { id } });
    if (!zone) {
      throw new NotFoundException('Zone not found');
    }
    return zone;
  }

  private async getPeakMultiplier(date: Date) {
    const dayOfWeek = date.getDay();
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;

    const configs = await this.peakHourRepository.find({
      where: { dayOfWeek, isActive: true },
    });

    const active = configs.find(
      (config) => time >= config.startTime && time <= config.endTime,
    );

    return active ? Number(active.multiplier) : 1;
  }

  private isPointInZone(lat: number, lng: number, zone: Zone) {
    if (zone.boundary.type === 'circle') {
      const center = zone.boundary.coordinates as {
        lat: number;
        lng: number;
        radiusKm: number;
      };
      return this.haversineKm(lat, lng, center.lat, center.lng) <= center.radiusKm;
    }

    const polygon = zone.boundary.coordinates as number[][];
    return this.isPointInPolygon(lat, lng, polygon);
  }

  private isPointInPolygon(lat: number, lng: number, polygon: number[][]) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      const intersect =
        yi > lng !== yj > lng &&
        lat < ((xj - xi) * (lng - yi)) / (yj - yi + Number.EPSILON) + xi;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
