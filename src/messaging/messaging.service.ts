import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageType } from '../common/enums/message-type.enum';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { Dispute } from '../admin/entities/dispute.entity';
import { User } from '../users/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';

const MESSAGABLE_STATUSES = new Set<BookingStatus>([
  BookingStatus.Open,
  BookingStatus.Confirmed,
  BookingStatus.InProgress,
  BookingStatus.Completed,
]);

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async bookingHasDispute(bookingId: string) {
    const count = await this.disputeRepository.count({ where: { bookingId } });
    return count > 0;
  }

  private async assertChatAccess(
    booking: Booking,
    userId: string,
    roles: UserRole[],
  ) {
    const isCustomer = booking.customerId === userId;
    const isMover = booking.moverId === userId;
    const isAdmin =
      roles.includes(UserRole.Admin) &&
      (await this.bookingHasDispute(booking.id));

    if (!isCustomer && !isMover && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async findSystemSenderId() {
    const admin = await this.userRepository
      .createQueryBuilder('user')
      .where(':role = ANY(user.roles)', { role: UserRole.Admin })
      .orderBy('user.createdAt', 'ASC')
      .getOne();

    if (!admin) {
      throw new NotFoundException('No admin account available for system messages');
    }

    return admin.id;
  }

  private async notifyChatParticipants(
    booking: Booking,
    senderId: string,
    content: string,
    bookingId: string,
    messageId: string,
  ) {
    const recipients = new Set<string>();
    if (booking.customerId && booking.customerId !== senderId) {
      recipients.add(booking.customerId);
    }
    if (booking.moverId && booking.moverId !== senderId) {
      recipients.add(booking.moverId);
    }

    const admins = await this.userRepository
      .createQueryBuilder('user')
      .where(':role = ANY(user.roles)', { role: UserRole.Admin })
      .getMany();

    for (const admin of admins) {
      if (admin.id !== senderId) {
        recipients.add(admin.id);
      }
    }

    await Promise.all(
      [...recipients].map((recipientId) =>
        this.notificationsService.create(
          recipientId,
          NotificationType.Message,
          'Dispute room message',
          content.slice(0, 100),
          { bookingId, messageId },
        ),
      ),
    );
  }

  async sendMessage(
    senderId: string,
    bookingId: string,
    dto: SendMessageDto,
    roles: UserRole[] = [],
  ) {
    const booking = await this.bookingsService.findById(bookingId);
    await this.assertChatAccess(booking, senderId, roles);

    const messageType = dto.messageType ?? (dto.attachmentUrl ? MessageType.Image : MessageType.Text);
    const content =
      dto.content?.trim() ||
      (messageType === MessageType.Voice
        ? 'Voice message'
        : messageType === MessageType.Image
          ? 'Photo'
          : '');

    if (!content && !dto.attachmentUrl) {
      throw new BadRequestException('Message must include text or an attachment');
    }

    const message = this.messageRepository.create({
      bookingId,
      senderId,
      content,
      messageType,
      attachmentUrl: dto.attachmentUrl ?? null,
      attachmentMimeType: dto.attachmentMimeType ?? null,
    });

    const saved = await this.messageRepository.save(message);

    const notifyBody =
      messageType === MessageType.Voice
        ? 'Voice message'
        : messageType === MessageType.Image
          ? 'Photo'
          : content;

    const hasDispute = await this.bookingHasDispute(bookingId);
    if (hasDispute) {
      await this.notifyChatParticipants(
        booking,
        senderId,
        notifyBody,
        bookingId,
        saved.id,
      );
      return saved;
    }

    const recipientId =
      booking.customerId === senderId ? booking.moverId : booking.customerId;

    if (recipientId) {
      await this.notificationsService.create(
        recipientId,
        NotificationType.Message,
        'New message',
        notifyBody.slice(0, 100),
        { bookingId, messageId: saved.id },
      );
    }

    return saved;
  }

  async postSystemMessage(bookingId: string, content: string) {
    const booking = await this.bookingsService.findById(bookingId);
    const senderId = await this.findSystemSenderId();

    const message = this.messageRepository.create({
      bookingId,
      senderId,
      content,
      isSystem: true,
    });

    const saved = await this.messageRepository.save(message);

    await this.notifyChatParticipants(
      booking,
      senderId,
      content,
      bookingId,
      saved.id,
    );

    return saved;
  }

  async getMessages(bookingId: string, userId: string, roles: UserRole[]) {
    const booking = await this.bookingsService.findById(bookingId);
    await this.assertChatAccess(booking, userId, roles);

    return this.messageRepository.find({
      where: { bookingId },
      relations: {
        sender: { customerProfile: true, moverProfile: true },
      },
      order: { createdAt: 'ASC' },
    });
  }

  async markAsRead(bookingId: string, userId: string) {
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('bookingId = :bookingId', { bookingId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('isRead = false')
      .execute();
    return { message: 'Messages marked as read' };
  }

  private formatRoute(booking: Booking) {
    const pickup =
      (booking.pickupAddress as { street?: string } | null)?.street ??
      booking.request?.pickupAddress ??
      'Pickup';
    const destination =
      (booking.destinationAddress as { street?: string } | null)?.street ??
      booking.request?.destinationAddress ??
      'Drop-off';
    return `${pickup} → ${destination}`;
  }

  private partnerForBooking(booking: Booking, userId: string, roles: UserRole[]) {
    if (roles.includes(UserRole.Admin)) {
      const customerName = booking.customer?.customerProfile
        ? `${booking.customer.customerProfile.firstName ?? ''} ${booking.customer.customerProfile.lastName ?? ''}`.trim()
        : booking.customer?.email;
      const moverName =
        booking.mover?.moverProfile?.businessName ?? booking.mover?.email;
      return {
        user: booking.customer ?? booking.mover ?? null,
        name: [customerName, moverName].filter(Boolean).join(' · ') || 'Dispute',
        subtitle: 'Dispute room',
      };
    }

    if (booking.customerId === userId) {
      const mover = booking.mover;
      return {
        user: mover ?? null,
        name:
          mover?.moverProfile?.businessName ??
          mover?.email ??
          'Mover',
        subtitle: this.formatRoute(booking),
      };
    }

    const customer = booking.customer;
    const fullName = customer?.customerProfile
      ? `${customer.customerProfile.firstName ?? ''} ${customer.customerProfile.lastName ?? ''}`.trim()
      : '';
    return {
      user: customer ?? null,
      name: fullName || customer?.email || 'Customer',
      subtitle: this.formatRoute(booking),
    };
  }

  private async getAccessibleBookings(userId: string, roles: UserRole[]) {
    if (roles.includes(UserRole.Admin)) {
      const disputes = await this.disputeRepository.find({
        relations: {
          booking: {
            customer: { customerProfile: true },
            mover: { moverProfile: true },
            request: true,
          },
        },
      });
      const seen = new Set<string>();
      return disputes
        .map((d) => d.booking)
        .filter((booking) => {
          if (!booking || seen.has(booking.id)) return false;
          seen.add(booking.id);
          return true;
        });
    }

    const bookings: Booking[] = [];
    if (roles.includes(UserRole.Customer)) {
      bookings.push(...(await this.bookingsService.findByCustomer(userId)));
    }
    if (roles.includes(UserRole.Mover)) {
      bookings.push(...(await this.bookingsService.findByMover(userId)));
    }

    const seen = new Set<string>();
    return bookings.filter((booking) => {
      if (seen.has(booking.id)) return false;
      seen.add(booking.id);
      return true;
    });
  }

  async listConversations(userId: string, roles: UserRole[]) {
    const bookings = await this.getAccessibleBookings(userId, roles);
    if (!bookings.length) return [];

    const bookingIds = bookings.map((b) => b.id);
    const lastMessages = await this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('sender.customerProfile', 'customerProfile')
      .leftJoinAndSelect('sender.moverProfile', 'moverProfile')
      .where('message.bookingId IN (:...bookingIds)', { bookingIds })
      .orderBy('message.createdAt', 'DESC')
      .getMany();

    const lastByBooking = new Map<string, Message>();
    for (const message of lastMessages) {
      if (!lastByBooking.has(message.bookingId)) {
        lastByBooking.set(message.bookingId, message);
      }
    }

    const unreadRows = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.bookingId', 'bookingId')
      .addSelect('COUNT(*)', 'count')
      .where('message.bookingId IN (:...bookingIds)', { bookingIds })
      .andWhere('message.senderId != :userId', { userId })
      .andWhere('message.isRead = false')
      .groupBy('message.bookingId')
      .getRawMany<{ bookingId: string; count: string }>();

    const unreadByBooking = new Map(
      unreadRows.map((row) => [row.bookingId, Number(row.count)]),
    );

    const conversations = [];

    for (const booking of bookings) {
      try {
        await this.assertChatAccess(booking, userId, roles);
      } catch {
        continue;
      }

      const hasDispute = await this.bookingHasDispute(booking.id);
      const openDispute = hasDispute
        ? await this.disputeRepository.findOne({
            where: { bookingId: booking.id },
            order: { createdAt: 'DESC' },
          })
        : null;
      const lastMessage = lastByBooking.get(booking.id) ?? null;
      const hasMessages = !!lastMessage;
      const isMessagable =
        !!booking.moverId && MESSAGABLE_STATUSES.has(booking.status);

      if (!hasMessages && !isMessagable && !hasDispute) {
        continue;
      }

      const partner = this.partnerForBooking(booking, userId, roles);

      conversations.push({
        bookingId: booking.id,
        partner: partner.user,
        partnerName: partner.name,
        routePreview: partner.subtitle,
        bookingStatus: booking.status,
        hasDispute,
        disputeId: openDispute?.id ?? null,
        unreadCount: unreadByBooking.get(booking.id) ?? 0,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              isSystem: lastMessage.isSystem,
              createdAt: lastMessage.createdAt,
            }
          : null,
        updatedAt:
          lastMessage?.createdAt?.toISOString() ??
          booking.updatedAt?.toISOString() ??
          booking.createdAt?.toISOString(),
      });
    }

    return conversations.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
}
