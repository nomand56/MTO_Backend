import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MoverProfile } from './entities/mover-profile.entity';
import { UpsertMoverProfileDto } from './dto/upsert-mover-profile.dto';

@Injectable()
export class MoversService {
  constructor(
    @InjectRepository(MoverProfile)
    private readonly moverProfileRepository: Repository<MoverProfile>,
  ) {}

  async upsertProfile(userId: string, dto: UpsertMoverProfileDto) {
    let profile = await this.moverProfileRepository.findOne({
      where: { userId },
    });

    if (profile) {
      Object.assign(profile, {
        ...dto,
        documents:
          dto.documents?.map((doc) => ({
            ...doc,
            status: 'pending',
          })) ?? profile.documents,
      });
    } else {
      profile = this.moverProfileRepository.create({
        userId,
        ...dto,
        documents:
          dto.documents?.map((doc) => ({
            ...doc,
            status: 'pending',
          })) ?? [],
        serviceAreas: dto.serviceAreas ?? [],
        isVerified: false,
      });
    }

    return this.moverProfileRepository.save(profile);
  }

  async getProfile(userId: string) {
    const profile = await this.moverProfileRepository.findOne({
      where: { userId },
      relations: { user: true },
    });

    if (!profile) {
      throw new NotFoundException('Mover profile not found');
    }

    return profile;
  }

  async verifyMover(userId: string) {
    const profile = await this.moverProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Mover profile not found');
    }

    if (!profile.documents?.length) {
      throw new BadRequestException('Mover has not submitted documents');
    }

    profile.isVerified = true;
    profile.documents = profile.documents.map((doc) => ({
      ...doc,
      status: 'verified',
    }));

    return this.moverProfileRepository.save(profile);
  }

  async ensureVerified(moverId: string) {
    const profile = await this.moverProfileRepository.findOne({
      where: { userId: moverId },
    });

    if (!profile?.isVerified) {
      throw new BadRequestException(
        'Mover profile must be verified to perform this action',
      );
    }

    return profile;
  }
}
