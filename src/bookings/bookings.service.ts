import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { randomBytes } from 'crypto';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { BookingShare } from './entities/booking-share.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { MovingRequest } from '../requests/entities/moving-request.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { MovingRequestStatus } from '../common/enums/moving-request-status.enum';
import {
  CancelBookingDto,
  UpdateBookingStatusDto,
} from './dto/update-booking-status.dto';
import {
  BookingEstimateDto,
  BookingItemDto,
  BookingPreviewDto,
  CreateBookingDto,
  RescheduleBookingDto,
  ShareBookingDto,
  UpdateBookingDto,
  UpdateBookingItemDto,
} from './dto/booking.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { VehiclesService } from '../vehicles/vehicles.service';
import { ZonesService } from '../zones/zones.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingItem)
    private readonly bookingItemRepository: Repository<BookingItem>,
    @InjectRepository(BookingShare)
    private readonly bookingShareRepository: Repository<BookingShare>,
    @InjectRepository(BookingStatusHistory)
    private readonly historyRepository: Repository<BookingStatusHistory>,
    private readonly notificationsService: NotificationsService,
    private readonly vehiclesService: VehiclesService,
    private readonly zonesService: ZonesService,
  ) {}

  async createFromQuote(
    quote: Quote,
    request: MovingRequest,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(Booking)
      : this.bookingRepository;
    const historyRepo = manager
      ? manager.getRepository(BookingStatusHistory)
      : this.historyRepository;

    const booking = repo.create({
      requestId: request.id,
      quoteId: quote.id,
      customerId: request.customerId,
      moverId: quote.moverId,
      scheduledDate: request.movingDate,
      price: quote.price,
      estimatedPrice: quote.price,
      pickupAddress: { street: request.pickupAddress },
      destinationAddress: { street: request.destinationAddress },
      status: BookingStatus.Confirmed,
    });

    const saved = await repo.save(booking);

    const requestItems = Array.isArray(request.items) ? request.items : [];
    if (requestItems.length > 0) {
      const itemRepo = manager
        ? manager.getRepository(BookingItem)
        : this.bookingItemRepository;
      await itemRepo.save(
        requestItems.map((item: Record<string, unknown>) =>
          itemRepo.create({
            bookingId: saved.id,
            name: String(item.name ?? 'Item'),
            quantity: Number(item.quantity ?? item.qty ?? 1),
            description:
              typeof item.description === 'string'
                ? item.description
                : undefined,
          }),
        ),
      );
    }

    await historyRepo.save(
      historyRepo.create({
        bookingId: saved.id,
        status: BookingStatus.Confirmed,
        note: 'Booking created from accepted quote',
      }),
    );

    return saved;
  }

  async create(customerId: string, dto: CreateBookingDto) {
    const pricing = await this.buildPricing(dto);
    const booking = this.bookingRepository.create({
      customerId,
      scheduledDate: new Date(dto.scheduledDate),
      pickupAddress: { ...dto.pickupAddress },
      destinationAddress: { ...dto.destinationAddress },
      vehicleTypeId: pricing.vehicleType?.id ?? dto.vehicleTypeId,
      price: pricing.total,
      estimatedPrice: pricing.total,
      pricingBreakdown: pricing,
      notes: dto.notes,
      status: BookingStatus.Open,
    });

    const saved = await this.bookingRepository.save(booking);
    await this.bookingItemRepository.save(
      dto.items.map((item) =>
        this.bookingItemRepository.create({ ...item, bookingId: saved.id }),
      ),
    );
    await this.recordStatusHistory(
      saved.id,
      BookingStatus.Open,
      'Booking created and opened for movers',
      customerId,
    );

    return this.findById(saved.id);
  }

  async estimate(_customerId: string, dto: BookingEstimateDto) {
    return this.buildPricing(dto);
  }

  async preview(customerId: string, dto: BookingPreviewDto) {
    const pricing = await this.buildPricing(dto);
    return {
      customerId,
      scheduledDate: dto.scheduledDate,
      pickupAddress: dto.pickupAddress,
      destinationAddress: dto.destinationAddress,
      items: dto.items,
      pricing,
    };
  }

  async findByCustomer(customerId: string) {
    return this.bookingRepository.find({
      where: { customerId },
      relations: {
        mover: { moverProfile: true },
        request: true,
        quote: true,
        review: true,
        items: true,
        payments: true,
        disputes: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findByMover(moverId: string) {
    return this.bookingRepository.find({
      where: { moverId },
      relations: {
        customer: { customerProfile: true },
        request: true,
        quote: true,
        items: true,
        payments: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll() {
    return this.bookingRepository.find({
      relations: {
        customer: { customerProfile: true },
        mover: { moverProfile: true },
        request: true,
        items: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: {
        customer: { customerProfile: true },
        mover: { moverProfile: true },
        request: true,
        quote: true,
        statusHistory: true,
        trackingEvents: true,
        review: true,
        payments: true,
        items: true,
        shares: true,
        disputes: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async findByIdForUser(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findById(id);

    const isCustomer =
      roles.includes(UserRole.Customer) && booking.customerId === userId;
    const isMover =
      roles.includes(UserRole.Mover) && booking.moverId === userId;
    const isAdmin = roles.includes(UserRole.Admin);

    if (!isCustomer && !isMover && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    return booking;
  }

  async update(
    id: string,
    userId: string,
    roles: UserRole[],
    dto: UpdateBookingDto,
  ) {
    const booking = await this.findByIdForUser(id, userId, roles);

    if (![BookingStatus.Draft, BookingStatus.Open].includes(booking.status)) {
      throw new BadRequestException(
        'Only draft or open bookings can be updated',
      );
    }

    if (dto.pickupAddress) booking.pickupAddress = { ...dto.pickupAddress };
    if (dto.destinationAddress)
      booking.destinationAddress = { ...dto.destinationAddress };
    if (dto.scheduledDate) booking.scheduledDate = new Date(dto.scheduledDate);
    if (dto.notes !== undefined) booking.notes = dto.notes;
    if (dto.vehicleTypeId) booking.vehicleTypeId = dto.vehicleTypeId;

    if (dto.items) {
      await this.bookingItemRepository.delete({ bookingId: booking.id });
      booking.items = dto.items.map((item) =>
        this.bookingItemRepository.create({ ...item, bookingId: booking.id }),
      );
    }

    if (
      dto.pickupAddress ||
      dto.destinationAddress ||
      dto.items ||
      dto.distanceKm !== undefined
    ) {
      const pricing = await this.buildPricing({
        pickupAddress:
          booking.pickupAddress as unknown as CreateBookingDto['pickupAddress'],
        destinationAddress:
          booking.destinationAddress as unknown as CreateBookingDto['destinationAddress'],
        scheduledDate: booking.scheduledDate.toISOString(),
        items: (booking.items ?? []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          weightKg: item.weightKg ? Number(item.weightKg) : undefined,
          volumeM3: item.volumeM3 ? Number(item.volumeM3) : undefined,
          description: item.description,
        })),
        vehicleTypeId: booking.vehicleTypeId,
        distanceKm: dto.distanceKm,
      });
      booking.price = pricing.total;
      booking.estimatedPrice = pricing.total;
      booking.pricingBreakdown = pricing;
    }

    await this.bookingRepository.save(booking);
    return this.findById(booking.id);
  }

  async remove(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findByIdForUser(id, userId, roles);

    if (booking.status !== BookingStatus.Draft) {
      throw new BadRequestException('Only draft bookings can be deleted');
    }

    await this.bookingRepository.remove(booking);
    return { message: 'Booking deleted' };
  }

  async cancel(
    id: string,
    userId: string,
    roles: UserRole[],
    dto: CancelBookingDto,
  ) {
    const booking = await this.findByIdForUser(id, userId, roles);

    if (booking.status === BookingStatus.Completed) {
      throw new BadRequestException('Completed bookings cannot be cancelled');
    }
    if (booking.status === BookingStatus.Cancelled) {
      throw new BadRequestException('Booking is already cancelled');
    }

    booking.status = BookingStatus.Cancelled;
    booking.cancellationReason = dto.reason;
    await this.bookingRepository.save(booking);

    await this.recordStatusHistory(
      booking.id,
      BookingStatus.Cancelled,
      dto.reason,
      userId,
    );

    if (booking.moverId) {
      const recipientId =
        booking.customerId === userId ? booking.moverId : booking.customerId;

      await this.notificationsService.create(
        recipientId,
        NotificationType.BookingStatus,
        'Booking cancelled',
        `Booking ${booking.id} was cancelled.`,
        { bookingId: booking.id },
      );
    }

    return booking;
  }

  async reschedule(
    id: string,
    userId: string,
    roles: UserRole[],
    dto: RescheduleBookingDto,
  ) {
    const booking = await this.findByIdForUser(id, userId, roles);

    if (
      [BookingStatus.Completed, BookingStatus.Cancelled].includes(
        booking.status,
      )
    ) {
      throw new BadRequestException('Booking cannot be rescheduled');
    }

    booking.scheduledDate = new Date(dto.scheduledDate);
    await this.bookingRepository.save(booking);
    await this.recordStatusHistory(
      booking.id,
      booking.status,
      dto.note ?? 'Booking rescheduled',
      userId,
    );

    return this.findById(booking.id);
  }

  async duplicate(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findByIdForUser(id, userId, roles);
    const duplicate = this.bookingRepository.create({
      customerId: booking.customerId,
      scheduledDate: booking.scheduledDate,
      pickupAddress: booking.pickupAddress,
      destinationAddress: booking.destinationAddress,
      vehicleTypeId: booking.vehicleTypeId,
      price: booking.price,
      estimatedPrice: booking.estimatedPrice,
      pricingBreakdown: booking.pricingBreakdown,
      notes: booking.notes,
      status: BookingStatus.Draft,
      items: (booking.items ?? []).map((item) =>
        this.bookingItemRepository.create({
          name: item.name,
          quantity: item.quantity,
          weightKg: item.weightKg,
          volumeM3: item.volumeM3,
          description: item.description,
          photoUrl: item.photoUrl,
        }),
      ),
    });

    const saved = await this.bookingRepository.save(duplicate);
    await this.recordStatusHistory(
      saved.id,
      BookingStatus.Draft,
      'Duplicated booking',
      userId,
    );
    return this.findById(saved.id);
  }

  async rebook(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findByIdForUser(id, userId, roles);
    const rebook = this.bookingRepository.create({
      customerId: booking.customerId,
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      pickupAddress: booking.pickupAddress,
      destinationAddress: booking.destinationAddress,
      vehicleTypeId: booking.vehicleTypeId,
      price: booking.price,
      estimatedPrice: booking.estimatedPrice,
      pricingBreakdown: booking.pricingBreakdown,
      notes: booking.notes,
      status: BookingStatus.Open,
      items: (booking.items ?? []).map((item) =>
        this.bookingItemRepository.create({
          name: item.name,
          quantity: item.quantity,
          weightKg: item.weightKg,
          volumeM3: item.volumeM3,
          description: item.description,
          photoUrl: item.photoUrl,
        }),
      ),
    });

    const saved = await this.bookingRepository.save(rebook);
    await this.recordStatusHistory(
      saved.id,
      BookingStatus.Open,
      'Rebooked move',
      userId,
    );
    return this.findById(saved.id);
  }

  async getStatus(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findByIdForUser(id, userId, roles);
    return {
      bookingId: booking.id,
      status: booking.status,
      scheduledDate: booking.scheduledDate,
      updatedAt: booking.updatedAt,
    };
  }

  async getTimeline(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findByIdForUser(id, userId, roles);
    return {
      statusHistory: booking.statusHistory ?? [],
      trackingEvents: booking.trackingEvents ?? [],
    };
  }

  async getLocation(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findByIdForUser(id, userId, roles);
    return {
      bookingId: booking.id,
      latitude: booking.currentLatitude,
      longitude: booking.currentLongitude,
      pickupAddress: booking.pickupAddress,
      destinationAddress: booking.destinationAddress,
      updatedAt: booking.updatedAt,
    };
  }

  async getTracking(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findByIdForUser(id, userId, roles);
    const events = [...(booking.trackingEvents ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const latestWithCoords = [...events]
      .reverse()
      .find(
        (event) =>
          event.latitude != null &&
          event.longitude != null &&
          !Number.isNaN(Number(event.latitude)) &&
          !Number.isNaN(Number(event.longitude)),
      );

    let latitude =
      booking.currentLatitude != null
        ? Number(booking.currentLatitude)
        : undefined;
    let longitude =
      booking.currentLongitude != null
        ? Number(booking.currentLongitude)
        : undefined;

    if (latitude == null && latestWithCoords) {
      latitude = Number(latestWithCoords.latitude);
      longitude = Number(latestWithCoords.longitude);
    }

    if (
      latitude == null &&
      booking.mover?.moverProfile?.latitude != null &&
      booking.mover?.moverProfile?.longitude != null
    ) {
      latitude = Number(booking.mover.moverProfile.latitude);
      longitude = Number(booking.mover.moverProfile.longitude);
    }

    return {
      bookingId: booking.id,
      status: booking.status,
      currentLocation: {
        latitude,
        longitude,
      },
      lastUpdatedAt:
        latestWithCoords?.createdAt ?? booking.updatedAt ?? booking.createdAt,
      pickupAddress: booking.pickupAddress,
      destinationAddress: booking.destinationAddress,
      price: Number(booking.price),
      scheduledDate: booking.scheduledDate,
      mover: booking.mover
        ? {
            id: booking.mover.id,
            businessName: booking.mover.moverProfile?.businessName,
            phone: booking.mover.moverProfile?.phone,
            bio: booking.mover.moverProfile?.bio,
            avatarUrl: booking.mover.moverProfile?.avatarUrl,
          }
        : undefined,
      events,
    };
  }

  async updateCurrentLocation(
    bookingId: string,
    latitude: number,
    longitude: number,
  ) {
    await this.bookingRepository.update(bookingId, {
      currentLatitude: latitude,
      currentLongitude: longitude,
    });
  }

  async shareBooking(
    id: string,
    userId: string,
    roles: UserRole[],
    dto: ShareBookingDto,
  ) {
    const booking = await this.findByIdForUser(id, userId, roles);
    const shareToken = randomBytes(16).toString('hex');
    const expiresAt = dto.expiresInHours
      ? new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000)
      : undefined;

    booking.shareToken = shareToken;
    await this.bookingRepository.save(booking);

    const share = await this.bookingShareRepository.save(
      this.bookingShareRepository.create({
        bookingId: booking.id,
        shareToken,
        sharedWithEmail: dto.sharedWithEmail,
        expiresAt,
        createdById: userId,
      }),
    );

    return {
      shareToken,
      shareUrl: `/bookings/${booking.id}/tracking?token=${shareToken}`,
      share,
    };
  }

  async listItems(id: string, userId: string, roles: UserRole[]) {
    const booking = await this.findByIdForUser(id, userId, roles);
    return booking.items ?? [];
  }

  async addItem(
    id: string,
    userId: string,
    roles: UserRole[],
    dto: BookingItemDto,
  ) {
    const booking = await this.findByIdForUser(id, userId, roles);
    const item = await this.bookingItemRepository.save(
      this.bookingItemRepository.create({ ...dto, bookingId: booking.id }),
    );
    return item;
  }

  async updateItem(
    bookingId: string,
    itemId: string,
    userId: string,
    roles: UserRole[],
    dto: UpdateBookingItemDto,
  ) {
    await this.findByIdForUser(bookingId, userId, roles);
    const item = await this.bookingItemRepository.findOne({
      where: { id: itemId, bookingId },
    });
    if (!item) {
      throw new NotFoundException('Booking item not found');
    }
    await this.bookingItemRepository.update(item.id, dto);
    return this.bookingItemRepository.findOne({ where: { id: item.id } });
  }

  async removeItem(
    bookingId: string,
    itemId: string,
    userId: string,
    roles: UserRole[],
  ) {
    await this.findByIdForUser(bookingId, userId, roles);
    const item = await this.bookingItemRepository.findOne({
      where: { id: itemId, bookingId },
    });
    if (!item) {
      throw new NotFoundException('Booking item not found');
    }
    await this.bookingItemRepository.remove(item);
    return { message: 'Booking item deleted' };
  }

  async addItemPhoto(
    bookingId: string,
    userId: string,
    roles: UserRole[],
    photoUrl: string,
    itemId?: string,
    label = 'Photo attachment',
  ) {
    await this.findByIdForUser(bookingId, userId, roles);

    if (itemId) {
      const item = await this.bookingItemRepository.findOne({
        where: { id: itemId, bookingId },
      });
      if (!item) {
        throw new NotFoundException('Booking item not found');
      }
      item.photoUrl = photoUrl;
      return this.bookingItemRepository.save(item);
    }

    return this.bookingItemRepository.save(
      this.bookingItemRepository.create({
        bookingId,
        name: label,
        quantity: 1,
        photoUrl,
      }),
    );
  }

  async updateStatus(id: string, moverId: string, dto: UpdateBookingStatusDto) {
    const booking = await this.findById(id);

    if (booking.moverId !== moverId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status === BookingStatus.Cancelled) {
      throw new BadRequestException('Cancelled bookings cannot be updated');
    }

    const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.Draft]: [BookingStatus.Open, BookingStatus.Cancelled],
      [BookingStatus.Open]: [BookingStatus.Confirmed, BookingStatus.Cancelled],
      [BookingStatus.Confirmed]: [
        BookingStatus.InProgress,
        BookingStatus.Cancelled,
      ],
      [BookingStatus.InProgress]: [
        BookingStatus.Completed,
        BookingStatus.Cancelled,
      ],
      [BookingStatus.Completed]: [],
      [BookingStatus.Cancelled]: [],
    };

    if (!allowedTransitions[booking.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${booking.status} to ${dto.status}`,
      );
    }

    if (dto.status === BookingStatus.Completed) {
      const proofPhotos = (booking.items ?? []).filter(
        (item) => item.photoUrl && item.name === 'Delivery proof',
      );
      if (!proofPhotos.length) {
        throw new BadRequestException(
          'Upload at least one delivery proof photo before marking completed',
        );
      }
    }

    booking.status = dto.status;
    await this.bookingRepository.save(booking);

    await this.recordStatusHistory(booking.id, dto.status, dto.note, moverId);

    if (dto.status === BookingStatus.Completed && booking.requestId) {
      await this.bookingRepository.manager.update(
        MovingRequest,
        booking.requestId,
        {
          status: MovingRequestStatus.Completed,
        },
      );
    }

    await this.notificationsService.create(
      booking.customerId,
      NotificationType.BookingStatus,
      'Booking status updated',
      `Your booking status is now ${dto.status}.`,
      { bookingId: booking.id, status: dto.status },
    );

    return booking;
  }

  async acceptBooking(moverId: string, bookingId: string) {
    const booking = await this.findById(bookingId);

    if (booking.moverId !== moverId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status !== BookingStatus.Confirmed) {
      throw new BadRequestException('Booking cannot be accepted');
    }

    return this.updateStatus(bookingId, moverId, {
      status: BookingStatus.InProgress,
      note: 'Mover accepted and started the job',
    });
  }

  private async buildPricing(dto: BookingEstimateDto) {
    const pickup = dto.pickupAddress;
    const destination = dto.destinationAddress;
    const distanceKm =
      dto.distanceKm ??
      this.estimateDistanceKm(
        pickup.latitude,
        pickup.longitude,
        destination.latitude,
        destination.longitude,
      );

    const vehicleRecommendation =
      await this.vehiclesService.calculateRecommendation({
        items: dto.items,
        distanceKm,
      });

    const zonePricing =
      pickup.latitude !== undefined && pickup.longitude !== undefined
        ? await this.zonesService.getPricing({
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            distanceKm,
            scheduledAt: dto.scheduledDate,
          })
        : null;

    const vehiclePrice = vehicleRecommendation.estimatedPrice;
    const zoneTotal = zonePricing?.total ?? 0;
    const total = Number((vehiclePrice + zoneTotal).toFixed(2));

    return {
      distanceKm,
      vehicleType: vehicleRecommendation.vehicleType,
      vehiclePrice,
      zonePricing,
      total,
    };
  }

  private estimateDistanceKm(
    pickupLat?: number,
    pickupLng?: number,
    destinationLat?: number,
    destinationLng?: number,
  ) {
    if (
      pickupLat === undefined ||
      pickupLng === undefined ||
      destinationLat === undefined ||
      destinationLng === undefined
    ) {
      return 10;
    }

    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(destinationLat - pickupLat);
    const dLng = toRad(destinationLng - pickupLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(pickupLat)) *
        Math.cos(toRad(destinationLat)) *
        Math.sin(dLng / 2) ** 2;
    return Number(
      (earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(
        2,
      ),
    );
  }

  private async recordStatusHistory(
    bookingId: string,
    status: BookingStatus,
    note?: string,
    updatedById?: string,
  ) {
    await this.historyRepository.save(
      this.historyRepository.create({
        bookingId,
        status,
        note,
        updatedById,
      }),
    );
  }
}
