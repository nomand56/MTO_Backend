import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { MovingRequest } from '../requests/entities/moving-request.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { Review } from '../reviews/entities/review.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Dispute } from '../admin/entities/dispute.entity';
import { DisputeStatus } from '../common/enums/dispute-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MovingRequest)
    private readonly requestRepository: Repository<MovingRequest>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalCustomers,
      totalMovers,
      totalRequests,
      totalBookings,
      completedBookings,
      totalQuotes,
      totalReviews,
      openDisputes,
      payments,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository
        .createQueryBuilder('user')
        .where(':role = ANY(user.roles)', { role: UserRole.Customer })
        .getCount(),
      this.userRepository
        .createQueryBuilder('user')
        .where(':role = ANY(user.roles)', { role: UserRole.Mover })
        .getCount(),
      this.requestRepository.count(),
      this.bookingRepository.count(),
      this.bookingRepository.count({
        where: { status: BookingStatus.Completed },
      }),
      this.quoteRepository.count(),
      this.reviewRepository.count(),
      this.disputeRepository.count({ where: { status: DisputeStatus.Open } }),
      this.paymentRepository.find({
        where: { status: PaymentStatus.Completed },
      }),
    ]);

    const totalRevenue = payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const totalCommission = payments.reduce(
      (sum, payment) => sum + Number(payment.platformCommission),
      0,
    );

    const avgRatingResult = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .getRawOne<{ avg: string | null }>();

    return {
      users: {
        total: totalUsers,
        customers: totalCustomers,
        movers: totalMovers,
      },
      marketplace: {
        requests: totalRequests,
        quotes: totalQuotes,
        bookings: totalBookings,
        completedBookings,
      },
      revenue: {
        totalRevenue,
        totalCommission,
      },
      quality: {
        totalReviews,
        averageRating: Number(avgRatingResult?.avg ?? 0),
        openDisputes,
      },
    };
  }
}
