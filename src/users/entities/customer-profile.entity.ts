import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('customer_profiles')
export class CustomerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'jsonb', nullable: true })
  address?: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  preferences: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'en' })
  language: string;

  @Column({ type: 'jsonb', default: {} })
  notificationSettings: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  privacy: Record<string, unknown>;

  @Column()
  userId: string;

  @OneToOne(() => User, (user) => user.customerProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
