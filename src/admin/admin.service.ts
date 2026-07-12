import {

  Injectable,

  NotFoundException,

  BadRequestException,

} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';

import { Booking } from '../bookings/entities/booking.entity';

import { Dispute } from './entities/dispute.entity';

import { Promotion } from './entities/promotion.entity';

import { AuditLog } from './entities/audit-log.entity';

import {

  CreateDisputeDto,
  CreatePromotionDto,
  RefundDisputeDto,
  ResolveDisputeDto,
} from './dto/admin.dto';
import { MessageType } from '../common/enums/message-type.enum';

import { UsersService } from '../users/users.service';

import { MoversService } from '../movers/movers.service';

import { BookingsService } from '../bookings/bookings.service';

import { DisputeStatus } from '../common/enums/dispute-status.enum';

import { AuditAction } from '../common/enums/audit-action.enum';

import { NotificationsService } from '../notifications/notifications.service';

import { NotificationType } from '../common/enums/notification-type.enum';

import { MessagingService } from '../messaging/messaging.service';

import { PaymentsService } from '../payments/payments.service';



@Injectable()

export class AdminService {

  constructor(

    @InjectRepository(User)

    private readonly userRepository: Repository<User>,

    @InjectRepository(Dispute)

    private readonly disputeRepository: Repository<Dispute>,

    @InjectRepository(Promotion)

    private readonly promotionRepository: Repository<Promotion>,

    @InjectRepository(AuditLog)

    private readonly auditLogRepository: Repository<AuditLog>,

    private readonly usersService: UsersService,

    private readonly moversService: MoversService,

    private readonly bookingsService: BookingsService,

    private readonly notificationsService: NotificationsService,

    private readonly messagingService: MessagingService,

    private readonly paymentsService: PaymentsService,

  ) {}



  async listUsers() {

    return this.userRepository.find({

      relations: { customerProfile: true, moverProfile: true },

      order: { createdAt: 'DESC' },

    });

  }



  async verifyUser(adminId: string, userId: string) {

    const user = await this.usersService.findById(userId);

    if (!user) {

      throw new NotFoundException('User not found');

    }



    user.isVerified = true;

    await this.userRepository.save(user);



    if (user.moverProfile) {

      await this.moversService.verifyMover(userId);

    }



    await this.auditLogRepository.save(

      this.auditLogRepository.create({

        adminId,

        action: AuditAction.UserVerified,

        entityType: 'user',

        entityId: userId,

      }),

    );



    await this.notificationsService.create(

      userId,

      NotificationType.Admin,

      'Account verified',

      'Your account has been verified by an administrator.',

      { userId },

    );



    return user;

  }



  async listBookings() {

    return this.bookingsService.findAll();

  }



  async listDisputes() {

    return this.disputeRepository.find({

      relations: {

        booking: {

          customer: { customerProfile: true },

          mover: { moverProfile: true },

        },

        raisedBy: { customerProfile: true, moverProfile: true },

      },

      order: { createdAt: 'DESC' },

    });

  }



  async createDispute(

    userId: string,

    bookingId: string,

    dto: CreateDisputeDto,

  ) {

    const booking = await this.bookingsService.findById(bookingId);



    if (booking.customerId !== userId && booking.moverId !== userId) {

      throw new BadRequestException(

        'You cannot raise a dispute for this booking',

      );

    }



    const existingOpen = await this.disputeRepository.findOne({

      where: { bookingId, status: DisputeStatus.Open },

    });

    if (existingOpen) {

      throw new BadRequestException(

        'An open dispute already exists for this booking',

      );

    }



    const dispute = this.disputeRepository.create({
      bookingId,
      raisedById: userId,
      reason: dto.reason,
      evidenceUrls: dto.evidenceUrls ?? [],
      status: DisputeStatus.Open,
    });

    const saved = await this.disputeRepository.save(dispute);

    const raiserLabel =
      booking.customerId === userId ? 'Customer' : 'Mover';

    await this.messagingService.postSystemMessage(
      bookingId,
      `Dispute opened by ${raiserLabel}. Customer, admin, and mover can discuss the issue here. Reason: ${dto.reason}`,
    );

    for (const url of saved.evidenceUrls ?? []) {
      await this.messagingService.sendMessage(userId, bookingId, {
        content: 'Dispute evidence photo',
        messageType: MessageType.Image,
        attachmentUrl: url,
      });
    }



    const notifyIds = new Set<string>([booking.customerId]);

    if (booking.moverId) notifyIds.add(booking.moverId);



    await Promise.all(

      [...notifyIds].map((recipientId) =>

        this.notificationsService.create(

          recipientId,

          NotificationType.Admin,

          'Dispute opened',

          'A dispute was filed for your move. Join the dispute room to discuss with admin.',

          { disputeId: saved.id, bookingId },

        ),

      ),

    );



    return saved;

  }



  async resolveDispute(

    adminId: string,

    disputeId: string,

    dto: ResolveDisputeDto,

  ) {

    const dispute = await this.disputeRepository.findOne({

      where: { id: disputeId },

      relations: {

        raisedBy: true,

        booking: true,

      },

    });



    if (!dispute) {

      throw new NotFoundException('Dispute not found');

    }



    if (dispute.status === DisputeStatus.Resolved) {

      throw new BadRequestException('Dispute is already resolved');

    }



    let refundResult: {
      balance: number;
      refundedAmount: number;
      moverDeduction?: number;
      moverBalance?: number | null;
    } | null = null;

    const refundAmount = dto.refundAmount ?? 0;



    if (refundAmount > 0) {

      refundResult = await this.paymentsService.refundDisputeToWallet(

        dispute.booking.customerId,

        dispute.bookingId,

        refundAmount,

        disputeId,

      );

      dispute.refundAmount = refundAmount;

    }



    dispute.status = DisputeStatus.Resolved;

    dispute.resolution = dto.resolution;

    const saved = await this.disputeRepository.save(dispute);



    const refundLine =
      refundAmount > 0
        ? ` A refund of $${refundAmount.toFixed(2)} was credited to the customer's wallet.${
            refundResult?.moverDeduction
              ? ` $${refundResult.moverDeduction.toFixed(2)} was deducted from the mover's wallet.`
              : ''
          }`
        : '';



    await this.messagingService.postSystemMessage(

      dispute.bookingId,

      `Dispute resolved by admin.${refundLine} Resolution: ${dto.resolution}`,

    );



    await this.auditLogRepository.save(

      this.auditLogRepository.create({

        adminId,

        action: AuditAction.DisputeResolved,

        entityType: 'dispute',

        entityId: disputeId,

        metadata: { resolution: dto.resolution, refundAmount },

      }),

    );



    const notifyIds = new Set<string>([

      dispute.raisedById,

      dispute.booking.customerId,

    ]);

    if (dispute.booking.moverId) notifyIds.add(dispute.booking.moverId);



    await Promise.all(

      [...notifyIds].map((recipientId) =>

        this.notificationsService.create(

          recipientId,

          NotificationType.Admin,

          refundAmount > 0 ? 'Dispute resolved with refund' : 'Dispute resolved',

          refundAmount > 0

            ? `${dto.resolution} $${refundAmount.toFixed(2)} was added to the customer wallet.`

            : dto.resolution,

          { disputeId, refundAmount, walletBalance: refundResult?.balance },

        ),

      ),

    );



    return saved;
  }

  async issueDisputeRefund(
    adminId: string,
    disputeId: string,
    dto: RefundDisputeDto,
  ) {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: { booking: true },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const refundResult = await this.paymentsService.refundDisputeToWallet(
      dispute.booking.customerId,
      dispute.bookingId,
      dto.amount,
      disputeId,
    );

    const previous = Number(dispute.refundAmount ?? 0);
    dispute.refundAmount = Number((previous + dto.amount).toFixed(2));
    const saved = await this.disputeRepository.save(dispute);

    const note = dto.note?.trim();
    const moverLine =
      (refundResult.moverDeduction ?? 0) > 0
        ? ` $${refundResult.moverDeduction!.toFixed(2)} was deducted from the mover's wallet.`
        : '';
    await this.messagingService.postSystemMessage(
      dispute.bookingId,
      `Admin issued a refund of $${dto.amount.toFixed(2)} to the customer's wallet.${moverLine}${note ? ` Note: ${note}` : ''}`,
    );

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        adminId,
        action: AuditAction.DisputeResolved,
        entityType: 'dispute',
        entityId: disputeId,
        metadata: { refundAmount: dto.amount, note, partial: true },
      }),
    );

    await this.notificationsService.create(
      dispute.booking.customerId,
      NotificationType.Payment,
      'Dispute refund received',
      `$${dto.amount.toFixed(2)} was added to your wallet.${note ? ` ${note}` : ''}`,
      { disputeId, balance: refundResult.balance },
    );

    return { dispute: saved, ...refundResult };
  }

  async createPromotion(adminId: string, dto: CreatePromotionDto) {

    const promotion = this.promotionRepository.create({

      ...dto,

      validFrom: new Date(dto.validFrom),

      validTo: new Date(dto.validTo),

      code: dto.code.toUpperCase(),

    });



    const saved = await this.promotionRepository.save(promotion);



    await this.auditLogRepository.save(

      this.auditLogRepository.create({

        adminId,

        action: AuditAction.PromotionCreated,

        entityType: 'promotion',

        entityId: saved.id,

      }),

    );



    return saved;

  }



  async listPromotions() {

    return this.promotionRepository.find({ order: { createdAt: 'DESC' } });

  }

}


