import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackingEvent } from './entities/tracking-event.entity';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { BookingsService } from '../bookings/bookings.service';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(TrackingEvent)
    private readonly trackingRepository: Repository<TrackingEvent>,
    private readonly bookingsService: BookingsService,
  ) {}

  async addEvent(
    bookingId: string,
    userId: string,
    roles: UserRole[],
    dto: CreateTrackingEventDto,
  ) {
    const booking = await this.bookingsService.findByIdForUser(
      bookingId,
      userId,
      roles,
    );

    const isMover = roles.includes(UserRole.Mover) && booking.moverId === userId;
    if (!isMover && !roles.includes(UserRole.Admin)) {
      throw new ForbiddenException('Only movers can add tracking events');
    }

    const event = this.trackingRepository.create({
      bookingId,
      createdById: userId,
      ...dto,
    });

    return this.trackingRepository.save(event);
  }

  async getTimeline(bookingId: string, userId: string, roles: UserRole[]) {
    await this.bookingsService.findByIdForUser(bookingId, userId, roles);

    return this.trackingRepository.find({
      where: { bookingId },
      relations: { createdBy: true },
      order: { createdAt: 'ASC' },
    });
  }
}
