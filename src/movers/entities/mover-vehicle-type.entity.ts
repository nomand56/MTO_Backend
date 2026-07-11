import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VehicleType } from '../../vehicles/entities/vehicle-type.entity';
import { MoverProfile } from './mover-profile.entity';

@Entity('mover_vehicle_types')
export class MoverVehicleType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  moverProfileId: string;

  @ManyToOne(() => MoverProfile, (profile) => profile.vehicleTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'moverProfileId' })
  moverProfile: MoverProfile;

  @Column()
  vehicleTypeId: string;

  @ManyToOne(() => VehicleType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleTypeId' })
  vehicleType: VehicleType;

  @Column({ default: false })
  isPrimary: boolean;
}
