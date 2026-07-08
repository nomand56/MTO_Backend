import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { MovingRequest } from '../requests/entities/moving-request.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { MovingRequestStatus } from '../common/enums/moving-request-status.enum';
import {
  CancelBookingDto,
  UpdateBookingStatusDto,
} from './dto/update-booking-status.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingStatusHistory)
    private readonly historyRepository: Repository<BookingStatusHistory>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createFromQuote(
    quote: Quote,
    request: MovingRequest,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Booking) : this.bookingRepository;
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
      status: BookingStatus.Confirmed,
    });

    const saved = await repo.save(booking);

    await historyRepo.save(
      historyRepo.create({
        bookingId: saved.id,
        status: BookingStatus.Confirmed,
        note: 'Booking created from accepted quote',
      }),
    );

    return saved;
  }

  async findByCustomer(customerId: string) {
    return this.bookingRepository.find({
      where: { customerId },
      relations: {
        mover: { moverProfile: true },
        request: true,
        quote: true,
        review: true,
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

  async cancel(id: string, userId: string, roles: UserRole[], dto: CancelBookingDto) {
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

    const recipientId =
      booking.customerId === userId ? booking.moverId : booking.customerId;

    await this.notificationsService.create(
      recipientId,
      NotificationType.BookingStatus,
      'Booking cancelled',
      `Booking ${booking.id} was cancelled.`,
      { bookingId: booking.id },
    );

    return booking;
  }

  async updateStatus(
    id: string,
    moverId: string,
    dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.findById(id);

    if (booking.moverId !== moverId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status === BookingStatus.Cancelled) {
      throw new BadRequestException('Cancelled bookings cannot be updated');
    }

    const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.Confirmed]: [BookingStatus.InProgress, BookingStatus.Cancelled],
      [BookingStatus.InProgress]: [BookingStatus.Completed, BookingStatus.Cancelled],
      [BookingStatus.Completed]: [],
      [BookingStatus.Cancelled]: [],
    };

    if (!allowedTransitions[booking.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${booking.status} to ${dto.status}`,
      );
    }

    booking.status = dto.status;
    await this.bookingRepository.save(booking);

    await this.recordStatusHistory(booking.id, dto.status, dto.note, moverId);

    if (dto.status === BookingStatus.Completed) {
      await this.bookingRepository.manager.update(MovingRequest, booking.requestId, {
        status: MovingRequestStatus.Completed,
      });
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
