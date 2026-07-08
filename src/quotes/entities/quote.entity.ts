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
import { MovingRequest } from '../../requests/entities/moving-request.entity';
import { QuoteStatus } from '../../common/enums/quote-status.enum';
import { QuoteCounteroffer } from './quote-counteroffer.entity';

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', nullable: true })
  estimatedHours?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: QuoteStatus,
    default: QuoteStatus.Pending,
  })
  status: QuoteStatus;

  @Column()
  requestId: string;

  @ManyToOne(() => MovingRequest, (request) => request.quotes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requestId' })
  request: MovingRequest;

  @Column()
  moverId: string;

  @ManyToOne(() => User, (user) => user.moverQuotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'moverId' })
  mover: User;

  @OneToMany(() => QuoteCounteroffer, (counteroffer) => counteroffer.quote)
  counteroffers: QuoteCounteroffer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
