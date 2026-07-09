import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { BookingShare } from './entities/booking-share.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { RequestsModule } from '../requests/requests.module';
import { QuotesModule } from '../quotes/quotes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ZonesModule } from '../zones/zones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingItem,
      BookingShare,
      BookingStatusHistory,
    ]),
    RequestsModule,
    forwardRef(() => QuotesModule),
    NotificationsModule,
    VehiclesModule,
    ZonesModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService, TypeOrmModule],
})
export class BookingsModule {}
