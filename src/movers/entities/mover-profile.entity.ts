import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MoverVehicleType } from './mover-vehicle-type.entity';

@Entity('mover_profiles')
export class MoverProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessName: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ nullable: true, type: 'text' })
  bio?: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'jsonb', default: [] })
  serviceAreas: string[];

  @Column({ type: 'jsonb', default: [] })
  documents: { type: string; url: string; status: string }[];

  @Column({ type: 'jsonb', nullable: true })
  availability?: { days: string[]; hours: string };

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude?: number;

  @Column({ type: 'timestamptz', nullable: true })
  locationUpdatedAt?: Date;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt?: Date;

  @OneToMany(() => MoverVehicleType, (vehicleType) => vehicleType.moverProfile)
  vehicleTypes: MoverVehicleType[];

  @Column()
  userId: string;

  @OneToOne(() => User, (user) => user.moverProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
