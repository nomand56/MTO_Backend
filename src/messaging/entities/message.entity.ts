import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';
import { MessageType } from '../../common/enums/message-type.enum';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column()
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.Text,
  })
  messageType: MessageType;

  @Column({ type: 'varchar', nullable: true })
  attachmentUrl?: string | null;

  @Column({ type: 'varchar', nullable: true })
  attachmentMimeType?: string | null;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isSystem: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
