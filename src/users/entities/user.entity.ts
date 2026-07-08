import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { CustomerProfile } from './customer-profile.entity';
import { MoverProfile } from '../../movers/entities/mover-profile.entity';
import { MovingRequest } from '../../requests/entities/moving-request.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', select: false, nullable: true })
  password?: string;

  @Column({
    type: 'text',
    array: true,
    default: [UserRole.Customer],
  })
  roles: UserRole[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'varchar', nullable: true, select: false })
  emailVerificationToken?: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  emailVerificationExpires?: Date | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  passwordResetToken?: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  passwordResetExpires?: Date | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  refreshTokenHash?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => CustomerProfile, (profile) => profile.user, {
    cascade: true,
    nullable: true,
  })
  customerProfile?: CustomerProfile;

  @OneToOne(() => MoverProfile, (profile) => profile.user, {
    cascade: true,
    nullable: true,
  })
  moverProfile?: MoverProfile;

  @OneToMany(() => MovingRequest, (request) => request.customer)
  movingRequests?: MovingRequest[];

  @OneToMany(() => Quote, (quote) => quote.mover)
  moverQuotes?: Quote[];

  @OneToMany(() => Booking, (booking) => booking.customer)
  customerBookings?: Booking[];

  @OneToMany(() => Booking, (booking) => booking.mover)
  moverBookings?: Booking[];
}
