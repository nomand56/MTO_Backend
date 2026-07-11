import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoversService } from './movers.service';
import { MoversController } from './movers.controller';
import { MoversDiscoveryController } from './movers-discovery.controller';
import { MoverProfile } from './entities/mover-profile.entity';
import { MoverVehicleType } from './entities/mover-vehicle-type.entity';
import { RequestsModule } from '../requests/requests.module';
import { QuotesModule } from '../quotes/quotes.module';
import { BookingsModule } from '../bookings/bookings.module';
import { TrackingModule } from '../tracking/tracking.module';
import { Review } from '../reviews/entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { VehicleType } from '../vehicles/entities/vehicle-type.entity';
import { ZonesModule } from '../zones/zones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MoverProfile,
      MoverVehicleType,
      Review,
      Booking,
      VehicleType,
    ]),
    RequestsModule,
    QuotesModule,
    BookingsModule,
    TrackingModule,
    ZonesModule,
  ],
  controllers: [MoversController, MoversDiscoveryController],
  providers: [MoversService],
  exports: [MoversService, TypeOrmModule],
})
export class MoversModule {}
