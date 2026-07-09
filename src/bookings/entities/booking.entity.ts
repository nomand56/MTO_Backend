import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MovingRequest } from '../../requests/entities/moving-request.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { BookingStatusHistory } from './booking-status-history.entity';
import { BookingItem } from './booking-item.entity';
import { BookingShare } from './booking-share.entity';
import { Message } from '../../messaging/entities/message.entity';
import { TrackingEvent } from '../../tracking/entities/tracking-event.entity';
import { Review } from '../../reviews/entities/review.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Dispute } from '../../admin/entities/dispute.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  scheduledDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedPrice?: number;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.Draft,
  })
  status: BookingStatus;

  @Column({ type: 'jsonb', nullable: true })
  pickupAddress?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  destinationAddress?: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  vehicleTypeId?: string;

  @Column({ type: 'jsonb', nullable: true })
  pricingBreakdown?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'varchar', nullable: true })
  shareToken?: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLatitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  currentLongitude?: number;

  @Column({ type: 'varchar', nullable: true })
  requestId?: string;

  @OneToOne(() => MovingRequest, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'requestId' })
  request?: MovingRequest;

  @Column({ type: 'varchar', nullable: true })
  moverId?: string;

  @ManyToOne(() => User, (user) => user.moverBookings, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'moverId' })
  mover?: User;

  @Column()
  customerId: string;

  @ManyToOne(() => User, (user) => user.customerBookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column({ type: 'varchar', nullable: true })
  quoteId?: string;

  @OneToOne(() => Quote, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'quoteId' })
  quote?: Quote;

  @OneToMany(() => BookingItem, (item) => item.booking, { cascade: true })
  items: BookingItem[];

  @OneToMany(() => BookingShare, (share) => share.booking)
  shares: BookingShare[];

  @OneToMany(() => BookingStatusHistory, (history) => history.booking)
  statusHistory: BookingStatusHistory[];

  @OneToMany(() => Message, (message) => message.booking)
  messages: Message[];

  @OneToMany(() => TrackingEvent, (event) => event.booking)
  trackingEvents: TrackingEvent[];

  @OneToOne(() => Review, (review) => review.booking)
  review?: Review;

  @OneToMany(() => Payment, (payment) => payment.booking)
  payments: Payment[];

  @OneToMany(() => Dispute, (dispute) => dispute.booking)
  disputes: Dispute[];

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
