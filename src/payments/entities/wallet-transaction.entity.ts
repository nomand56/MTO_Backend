import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { WalletAccountType } from '../../common/enums/wallet-account-type.enum';
import { WalletTransactionType } from '../../common/enums/wallet-transaction-type.enum';

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: WalletAccountType,
  })
  accountType: WalletAccountType;

  @Column({
    type: 'enum',
    enum: WalletTransactionType,
  })
  type: WalletTransactionType;

  @Column({ type: 'varchar', length: 8 })
  direction: 'credit' | 'debit';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  balanceAfter?: number | null;

  @Column({ type: 'varchar', nullable: true })
  bookingId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  disputeId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  counterpartyId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  counterpartyName?: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  sourceLabel?: string | null;

  @Column({ type: 'varchar', nullable: true })
  destinationLabel?: string | null;

  @Column({ type: 'varchar', nullable: true })
  reference?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
