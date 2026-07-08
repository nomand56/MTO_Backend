import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoversService } from './movers.service';
import { MoversController } from './movers.controller';
import { MoverProfile } from './entities/mover-profile.entity';
import { RequestsModule } from '../requests/requests.module';
import { QuotesModule } from '../quotes/quotes.module';
import { BookingsModule } from '../bookings/bookings.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MoverProfile]),
    RequestsModule,
    QuotesModule,
    BookingsModule,
    TrackingModule,
  ],
  controllers: [MoversController],
  providers: [MoversService],
  exports: [MoversService, TypeOrmModule],
})
export class MoversModule {}
