import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vehicle_types')
export class VehicleType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pricePerKm: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  maxWeightKg: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  maxVolumeM3: number;

  @Column({ type: 'int', default: 1 })
  moverCapacity: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
