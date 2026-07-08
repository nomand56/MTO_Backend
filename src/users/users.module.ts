import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CustomerProfile } from './entities/customer-profile.entity';
import { MoverProfile } from '../movers/entities/mover-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, CustomerProfile, MoverProfile])],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
