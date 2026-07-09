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
  ResolveDisputeDto,
} from './dto/admin.dto';
import { UsersService } from '../users/users.service';
import { MoversService } from '../movers/movers.service';
import { BookingsService } from '../bookings/bookings.service';
import { DisputeStatus } from '../common/enums/dispute-status.enum';
import { AuditAction } from '../common/enums/audit-action.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';

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
        booking: true,
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

    const dispute = this.disputeRepository.create({
      bookingId,
      raisedById: userId,
      reason: dto.reason,
      status: DisputeStatus.Open,
    });

    return this.disputeRepository.save(dispute);
  }

  async resolveDispute(
    adminId: string,
    disputeId: string,
    dto: ResolveDisputeDto,
  ) {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: { raisedBy: true },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    dispute.status = DisputeStatus.Resolved;
    dispute.resolution = dto.resolution;
    const saved = await this.disputeRepository.save(dispute);

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        adminId,
        action: AuditAction.DisputeResolved,
        entityType: 'dispute',
        entityId: disputeId,
        metadata: { resolution: dto.resolution },
      }),
    );

    await this.notificationsService.create(
      dispute.raisedById,
      NotificationType.Admin,
      'Dispute resolved',
      dto.resolution,
      { disputeId },
    );

    return saved;
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
}
