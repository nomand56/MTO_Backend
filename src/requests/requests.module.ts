import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsService } from './requests.service';
import { MovingRequest } from './entities/moving-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MovingRequest])],
  providers: [RequestsService],
  exports: [RequestsService, TypeOrmModule],
})
export class RequestsModule {}
