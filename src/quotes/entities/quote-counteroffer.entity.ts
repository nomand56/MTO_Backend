import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Quote } from '../../quotes/entities/quote.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { CounterofferStatus } from '../../common/enums/counteroffer-status.enum';

@Entity('quote_counteroffers')
export class QuoteCounteroffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  quoteId: string;

  @ManyToOne(() => Quote, (quote) => quote.counteroffers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quoteId' })
  quote: Quote;

  @Column()
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'enum', enum: UserRole })
  authorRole: UserRole;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: CounterofferStatus,
    default: CounterofferStatus.Pending,
  })
  status: CounterofferStatus;

  @CreateDateColumn()
  createdAt: Date;
}
