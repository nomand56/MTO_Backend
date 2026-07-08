import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MovingRequestStatus } from '../../common/enums/moving-request-status.enum';
import { Quote } from '../../quotes/entities/quote.entity';

@Entity('moving_requests')
export class MovingRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pickupAddress: string;

  @Column()
  destinationAddress: string;

  @Column()
  movingDate: Date;

  @Column({ type: 'jsonb', default: [] })
  items: any[];

  @Column({ type: 'text', nullable: true })
  additionalNotes?: string;

  @Column({
    type: 'enum',
    enum: MovingRequestStatus,
    default: MovingRequestStatus.Pending,
  })
  status: MovingRequestStatus;

  @Column()
  customerId: string;

  @ManyToOne(() => User, (user) => user.movingRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @OneToMany(() => Quote, (quote) => quote.request)
  quotes: Quote[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
