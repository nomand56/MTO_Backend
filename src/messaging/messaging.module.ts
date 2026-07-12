import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { ConversationsController } from './conversations.controller';
import { MessagingGateway } from './messaging.gateway';
import { Message } from './entities/message.entity';
import { Dispute } from '../admin/entities/dispute.entity';
import { User } from '../users/entities/user.entity';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Dispute, User]),
    BookingsModule,
    NotificationsModule,
    JwtModule,
    ConfigModule,
  ],
  controllers: [MessagingController, ConversationsController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService, TypeOrmModule],
})
export class MessagingModule {}
