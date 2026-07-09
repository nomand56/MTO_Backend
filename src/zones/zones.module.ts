import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeakHourConfig } from './entities/peak-hour-config.entity';
import { Zone } from './entities/zone.entity';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Zone, PeakHourConfig])],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService, TypeOrmModule],
})
export class ZonesModule {}
