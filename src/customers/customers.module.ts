import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { RequestsModule } from '../requests/requests.module';
import { QuotesModule } from '../quotes/quotes.module';
import { BookingsModule } from '../bookings/bookings.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    RequestsModule,
    QuotesModule,
    BookingsModule,
    ReviewsModule,
    PaymentsModule,
    AdminModule,
  ],
  controllers: [CustomersController],
})
export class CustomersModule {}
