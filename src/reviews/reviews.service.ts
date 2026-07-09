import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { BookingsService } from '../bookings/bookings.service';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(customerId: string, bookingId: string, dto: CreateReviewDto) {
    const booking = await this.bookingsService.findById(bookingId);

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status !== BookingStatus.Completed) {
      throw new BadRequestException('Reviews can only be submitted for completed bookings');
    }

    if (!booking.moverId) {
      throw new BadRequestException('Booking does not have an assigned mover');
    }

    const existing = await this.reviewRepository.findOne({
      where: { bookingId },
    });
    if (existing) {
      throw new ConflictException('Review already submitted for this booking');
    }

    const review = this.reviewRepository.create({
      bookingId,
      customerId,
      moverId: booking.moverId,
      rating: dto.rating,
      comment: dto.comment,
    });

    const saved = await this.reviewRepository.save(review);

    await this.notificationsService.create(
      booking.moverId!,
      NotificationType.Review,
      'New review received',
      `You received a ${dto.rating}-star review.`,
      { bookingId, reviewId: saved.id },
    );

    return saved;
  }

  async findByBooking(bookingId: string) {
    const review = await this.reviewRepository.findOne({
      where: { bookingId },
      relations: { customer: { customerProfile: true } },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async reportReview(reviewId: string) {
    const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.isReported = true;
    return this.reviewRepository.save(review);
  }
}
