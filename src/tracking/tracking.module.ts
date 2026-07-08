import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingService } from './tracking.service';
import { TrackingEvent } from './entities/tracking-event.entity';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [TypeOrmModule.forFeature([TrackingEvent]), BookingsModule],
  providers: [TrackingService],
  exports: [TrackingService, TypeOrmModule],
})
export class TrackingModule {}
