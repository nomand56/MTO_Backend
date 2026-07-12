import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomerProfile } from '../users/entities/customer-profile.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { MoverProfile } from '../movers/entities/mover-profile.entity';
import { Dispute } from '../admin/entities/dispute.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, CustomerProfile, MoverProfile, Dispute, WalletTransaction]),
    BookingsModule,
    NotificationsModule,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
