import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';
import { DisputeStatus } from '../../common/enums/dispute-status.enum';

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.disputes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column()
  raisedById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raisedById' })
  raisedBy: User;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', array: true, default: [] })
  evidenceUrls: string[];

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.Open,
  })
  status: DisputeStatus;

  @Column({ type: 'text', nullable: true })
  resolution?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  refundAmount?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
