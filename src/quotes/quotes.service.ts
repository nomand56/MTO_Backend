import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { Quote } from './entities/quote.entity';
import { QuoteCounteroffer } from './entities/quote-counteroffer.entity';
import { MovingRequest } from '../requests/entities/moving-request.entity';
import { CreateCounterofferDto, CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteStatus } from '../common/enums/quote-status.enum';
import { MovingRequestStatus } from '../common/enums/moving-request-status.enum';
import { CounterofferStatus } from '../common/enums/counteroffer-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { RequestsService } from '../requests/requests.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepository: Repository<Quote>,
    @InjectRepository(QuoteCounteroffer)
    private readonly counterofferRepository: Repository<QuoteCounteroffer>,
    private readonly requestsService: RequestsService,
    @Inject(forwardRef(() => BookingsService))
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async createQuote(moverId: string, requestId: string, dto: CreateQuoteDto) {
    const request = await this.requestsService.findById(requestId);

    if (
      request.status !== MovingRequestStatus.Pending &&
      request.status !== MovingRequestStatus.Active
    ) {
      throw new BadRequestException('Request is not open for quotes');
    }

    const existing = await this.quoteRepository.findOne({
      where: { requestId, moverId },
    });
    if (existing) {
      throw new ConflictException('You already submitted a quote for this request');
    }

    const quote = this.quoteRepository.create({
      ...dto,
      requestId,
      moverId,
      status: QuoteStatus.Pending,
    });
    const saved = await this.quoteRepository.save(quote);

    if (request.status === MovingRequestStatus.Pending) {
      await this.requestsService.updateStatus(requestId, MovingRequestStatus.Active);
    }

    await this.notificationsService.create(
      request.customerId,
      NotificationType.QuoteReceived,
      'New quote received',
      `A mover submitted a quote of $${dto.price} for your moving request.`,
      { requestId, quoteId: saved.id },
    );

    return saved;
  }

  async acceptQuote(customerId: string, requestId: string, quoteId: string) {
    await this.requestsService.findByIdForCustomer(requestId, customerId);

    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId, requestId },
      relations: { mover: true, request: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (
      quote.status !== QuoteStatus.Pending &&
      quote.status !== QuoteStatus.Countered
    ) {
      throw new BadRequestException('Quote cannot be accepted');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Quote, quoteId, {
        status: QuoteStatus.Accepted,
      });
      await queryRunner.manager.update(
        Quote,
        { requestId, id: Not(quoteId) },
        { status: QuoteStatus.Rejected },
      );
      await queryRunner.manager.update(MovingRequest, requestId, {
        status: MovingRequestStatus.Booked,
      });

      const booking = await this.bookingsService.createFromQuote(
        quote,
        quote.request,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      await this.notificationsService.create(
        quote.moverId,
        NotificationType.BookingConfirmed,
        'Booking confirmed',
        'Your quote was accepted and a booking has been created.',
        { bookingId: booking.id, requestId },
      );

      return booking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createCounteroffer(
    userId: string,
    role: UserRole,
    quoteId: string,
    dto: CreateCounterofferDto,
  ) {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
      relations: { request: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (role === UserRole.Customer && quote.request.customerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (role === UserRole.Mover && quote.moverId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (
      quote.status !== QuoteStatus.Pending &&
      quote.status !== QuoteStatus.Countered
    ) {
      throw new BadRequestException('Quote is not open for negotiation');
    }

    const counteroffer = this.counterofferRepository.create({
      quoteId,
      authorId: userId,
      authorRole: role,
      price: dto.price,
      notes: dto.notes,
      status: CounterofferStatus.Pending,
    });
    await this.counterofferRepository.save(counteroffer);

    quote.price = dto.price;
    quote.status = QuoteStatus.Countered;
    await this.quoteRepository.save(quote);

    const recipientId =
      role === UserRole.Customer ? quote.moverId : quote.request.customerId;

    await this.notificationsService.create(
      recipientId,
      NotificationType.Counteroffer,
      'New counteroffer',
      `A counteroffer of $${dto.price} was submitted.`,
      { quoteId, counterofferId: counteroffer.id },
    );

    return counteroffer;
  }

  async respondToCounteroffer(
    userId: string,
    role: UserRole,
    quoteId: string,
    accept: boolean,
  ) {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
      relations: { request: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const latestCounteroffer = await this.counterofferRepository.findOne({
      where: { quoteId, status: CounterofferStatus.Pending },
      order: { createdAt: 'DESC' },
    });

    if (!latestCounteroffer) {
      throw new BadRequestException('No pending counteroffer found');
    }

    if (latestCounteroffer.authorId === userId) {
      throw new BadRequestException('You cannot respond to your own counteroffer');
    }

    if (role === UserRole.Customer && quote.request.customerId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (role === UserRole.Mover && quote.moverId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    latestCounteroffer.status = accept
      ? CounterofferStatus.Accepted
      : CounterofferStatus.Rejected;
    await this.counterofferRepository.save(latestCounteroffer);

    quote.status = accept ? QuoteStatus.Pending : QuoteStatus.Rejected;
    await this.quoteRepository.save(quote);

    return { quote, counteroffer: latestCounteroffer };
  }

  async findById(quoteId: string) {
    const quote = await this.quoteRepository.findOne({
      where: { id: quoteId },
      relations: { request: true, mover: true, counteroffers: true },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    return quote;
  }
}
