import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/entities/user.entity';
import { MovingRequest } from '../requests/entities/moving-request.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { Review } from '../reviews/entities/review.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Dispute } from '../admin/entities/dispute.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      MovingRequest,
      Booking,
      Quote,
      Review,
      Payment,
      Dispute,
    ]),
  ],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
