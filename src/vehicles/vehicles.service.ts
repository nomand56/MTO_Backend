import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { CalculateVehicleRecommendationDto } from './dto/vehicle.dto';
import { VehicleType } from './entities/vehicle-type.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleType)
    private readonly vehicleTypeRepository: Repository<VehicleType>,
  ) {}

  findVehicleTypes() {
    return this.vehicleTypeRepository.find({
      where: { isActive: true },
      order: { maxVolumeM3: 'ASC', maxWeightKg: 'ASC' },
    });
  }

  async findVehicleType(id: string) {
    const vehicleType = await this.vehicleTypeRepository.findOne({
      where: { id, isActive: true },
    });

    if (!vehicleType) {
      throw new NotFoundException('Vehicle type not found');
    }

    return vehicleType;
  }

  async getRecommendations() {
    const vehicleTypes = await this.findVehicleTypes();
    return vehicleTypes.map((vehicleType) => ({
      vehicleType,
      bestFor: this.describeVehicleUse(vehicleType),
    }));
  }

  async calculateRecommendation(dto: CalculateVehicleRecommendationDto) {
    const totals = dto.items.reduce(
      (sum, item) => {
        const quantity = item.quantity ?? 1;
        return {
          weightKg: sum.weightKg + (item.weightKg ?? 0) * quantity,
          volumeM3: sum.volumeM3 + (item.volumeM3 ?? 0) * quantity,
        };
      },
      { weightKg: 0, volumeM3: 0 },
    );

    const candidates = await this.vehicleTypeRepository.find({
      where: {
        isActive: true,
        maxWeightKg: MoreThanOrEqual(totals.weightKg),
        maxVolumeM3: MoreThanOrEqual(totals.volumeM3),
      },
      order: { maxVolumeM3: 'ASC', maxWeightKg: 'ASC' },
    });

    const vehicleType = candidates[0] ?? (await this.findFallbackVehicle());
    const distanceKm = dto.distanceKm ?? 0;

    return {
      totals,
      vehicleType,
      estimatedPrice: Number(vehicleType.basePrice) + Number(vehicleType.pricePerKm) * distanceKm,
      alternatives: candidates.slice(1, 4),
    };
  }

  private async findFallbackVehicle() {
    const vehicle = await this.vehicleTypeRepository.findOne({
      where: { isActive: true, maxVolumeM3: LessThanOrEqual(999999) },
      order: { maxVolumeM3: 'DESC', maxWeightKg: 'DESC' },
    });

    if (!vehicle) {
      throw new NotFoundException('No active vehicle types are configured');
    }

    return vehicle;
  }

  private describeVehicleUse(vehicleType: VehicleType) {
    if (Number(vehicleType.maxVolumeM3) <= 8) {
      return 'Small apartments, boxes, and light furniture';
    }
    if (Number(vehicleType.maxVolumeM3) <= 20) {
      return 'One-bedroom to two-bedroom moves';
    }
    return 'Large homes, bulky furniture, and high-volume moves';
  }
}
