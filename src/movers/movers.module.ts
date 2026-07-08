import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MoversService } from './movers.service';
import { MoverProfile } from './entities/mover-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MoverProfile])],
  providers: [MoversService],
  exports: [MoversService, TypeOrmModule],
})
export class MoversModule {}
