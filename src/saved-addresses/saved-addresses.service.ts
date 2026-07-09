import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateSavedAddressDto,
  UpdateSavedAddressDto,
} from './dto/saved-address.dto';
import { SavedAddress } from './entities/saved-address.entity';

@Injectable()
export class SavedAddressesService {
  constructor(
    @InjectRepository(SavedAddress)
    private readonly savedAddressRepository: Repository<SavedAddress>,
  ) {}

  findAll(userId: string) {
    return this.savedAddressRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateSavedAddressDto) {
    const address = this.savedAddressRepository.create({ ...dto, userId });
    const saved = await this.savedAddressRepository.save(address);

    if (dto.isDefault) {
      await this.setDefault(userId, saved.id);
      return this.findOne(userId, saved.id);
    }

    return saved;
  }

  async update(userId: string, id: string, dto: UpdateSavedAddressDto) {
    const address = await this.findOne(userId, id);
    await this.savedAddressRepository.update(address.id, dto);

    if (dto.isDefault) {
      await this.setDefault(userId, id);
    }

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string) {
    const address = await this.findOne(userId, id);
    await this.savedAddressRepository.remove(address);
    return { message: 'Saved address deleted' };
  }

  async getDefault(userId: string) {
    const address = await this.savedAddressRepository.findOne({
      where: { userId, isDefault: true },
    });

    if (!address) {
      throw new NotFoundException('Default saved address not found');
    }

    return address;
  }

  async setDefault(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.savedAddressRepository.update({ userId }, { isDefault: false });
    await this.savedAddressRepository.update(
      { id, userId },
      { isDefault: true },
    );
    return this.findOne(userId, id);
  }

  private async findOne(userId: string, id: string) {
    const address = await this.savedAddressRepository.findOne({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Saved address not found');
    }

    return address;
  }
}
