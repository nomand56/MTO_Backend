import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendMessage(senderId: string, bookingId: string, dto: SendMessageDto) {
    const booking = await this.bookingsService.findById(bookingId);

    if (booking.customerId !== senderId && booking.moverId !== senderId) {
      throw new ForbiddenException('Access denied');
    }

    const message = this.messageRepository.create({
      bookingId,
      senderId,
      content: dto.content,
    });

    const saved = await this.messageRepository.save(message);

    const recipientId =
      booking.customerId === senderId ? booking.moverId : booking.customerId;

    await this.notificationsService.create(
      recipientId,
      NotificationType.Message,
      'New message',
      dto.content.slice(0, 100),
      { bookingId, messageId: saved.id },
    );

    return saved;
  }

  async getMessages(bookingId: string, userId: string, roles: UserRole[]) {
    await this.bookingsService.findByIdForUser(bookingId, userId, roles);

    return this.messageRepository.find({
      where: { bookingId },
      relations: { sender: true },
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
}
