import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MovingRequest } from './entities/moving-request.entity';
import { CreateMovingRequestDto } from './dto/create-moving-request.dto';
import { MovingRequestStatus } from '../common/enums/moving-request-status.enum';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(MovingRequest)
    private readonly requestRepository: Repository<MovingRequest>,
  ) {}

  async create(customerId: string, dto: CreateMovingRequestDto) {
    const request = this.requestRepository.create({
      ...dto,
      movingDate: new Date(dto.movingDate),
      customerId,
      status: MovingRequestStatus.Pending,
    });
    return this.requestRepository.save(request);
  }

  async findAllByCustomer(customerId: string) {
    return this.requestRepository.find({
      where: { customerId },
      relations: { quotes: { mover: { moverProfile: true } } },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdForCustomer(id: string, customerId: string) {
    const request = await this.findById(id, {
      quotes: { mover: { moverProfile: true }, counteroffers: true },
    });
    if (request.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }
    return request;
  }

  async findAvailableForMovers() {
    return this.requestRepository.find({
      where: {
        status: In([MovingRequestStatus.Pending, MovingRequestStatus.Active]),
      },
      relations: { customer: { customerProfile: true }, quotes: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, relations?: Record<string, unknown>) {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations,
    });

    if (!request) {
      throw new NotFoundException('Moving request not found');
    }

    return request;
  }

  async updateStatus(id: string, status: MovingRequestStatus) {
    await this.requestRepository.update(id, { status });
    return this.findById(id);
  }
}
