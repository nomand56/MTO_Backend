import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MovingRequest } from '../../requests/entities/moving-request.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  scheduledDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.Confirmed,
  })
  status: BookingStatus;

  @Column()
  requestId: string;

  @OneToOne(() => MovingRequest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requestId' })
  request: MovingRequest;

  @Column()
  moverId: string;

  @ManyToOne(() => User, (user) => user.moverBookings, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'moverId' })
  mover: User;

  @Column()
  customerId: string;

  @ManyToOne(() => User, (user) => user.customerBookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column()
  quoteId: string;

  @OneToOne(() => Quote, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'quoteId' })
  quote: Quote;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
