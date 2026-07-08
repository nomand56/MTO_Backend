import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesService } from './quotes.service';
import { Quote } from './entities/quote.entity';
import { QuoteCounteroffer } from './entities/quote-counteroffer.entity';
import { RequestsModule } from '../requests/requests.module';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteCounteroffer]),
    RequestsModule,
    forwardRef(() => BookingsModule),
    NotificationsModule,
  ],
  providers: [QuotesService],
  exports: [QuotesService, TypeOrmModule],
})
export class QuotesModule {}
