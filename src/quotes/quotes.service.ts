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
      if (
        existing.status === QuoteStatus.Accepted ||
        existing.status === QuoteStatus.Rejected
      ) {
        throw new ConflictException(
          'This quote can no longer be updated',
        );
      }

      Object.assign(existing, {
        price: dto.price,
        estimatedHours: dto.estimatedHours,
        notes: dto.notes,
        status: QuoteStatus.Pending,
      });
      return this.quoteRepository.save(existing);
    }

    const quote = this.quoteRepository.create({
      ...dto,
      requestId,
      moverId,
      status: QuoteStatus.Pending,
    });
    const saved = await this.quoteRepository.save(quote);

    if (request.status === MovingRequestStatus.Pending) {
      await this.requestsService.updateStatus(
        requestId,
        MovingRequestStatus.Active,
      );
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
      relations: { mover: true, request: true, counteroffers: true },
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

    const counteroffers = [...(quote.counteroffers ?? [])].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const pendingOffers = counteroffers.filter(
      (c) => c.status === CounterofferStatus.Pending,
    );
    const pendingFromCustomer = pendingOffers.find(
      (c) => c.authorRole === UserRole.Customer,
    );
    if (pendingFromCustomer) {
      throw new BadRequestException(
        'Waiting for the mover to respond to your counteroffer',
      );
    }

    const pendingFromMover = pendingOffers.find(
      (c) => c.authorRole === UserRole.Mover,
    );
    if (pendingFromMover) {
      pendingFromMover.status = CounterofferStatus.Accepted;
      await this.counterofferRepository.save(pendingFromMover);
      quote.price = pendingFromMover.price;
      quote.status = QuoteStatus.Pending;
      await this.quoteRepository.save(quote);
    } else if (counteroffers.length > 0) {
      const latest = counteroffers[counteroffers.length - 1];
      if (latest.status !== CounterofferStatus.Accepted) {
        throw new BadRequestException(
          'Agree on a price before booking this mover',
        );
      }
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

    await this.counterofferRepository.update(
      { quoteId, status: CounterofferStatus.Pending },
      { status: CounterofferStatus.Rejected },
    );

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

    const opponentRole =
      role === UserRole.Customer ? UserRole.Mover : UserRole.Customer;

    const latestCounteroffer = await this.counterofferRepository.findOne({
      where: {
        quoteId,
        status: CounterofferStatus.Pending,
        authorRole: opponentRole,
      },
      order: { createdAt: 'DESC' },
    });

    if (!latestCounteroffer) {
      const acceptedOffer = await this.counterofferRepository.findOne({
        where: {
          quoteId,
          status: CounterofferStatus.Accepted,
          authorRole: opponentRole,
        },
        order: { createdAt: 'DESC' },
      });

      if (acceptedOffer && accept) {
        const currentQuote = await this.quoteRepository.findOne({
          where: { id: quoteId },
        });
        return { quote: currentQuote ?? quote, counteroffer: acceptedOffer };
      }

      throw new BadRequestException('No pending counteroffer found');
    }

    if (latestCounteroffer.authorId === userId) {
      throw new BadRequestException(
        'You cannot respond to your own counteroffer',
      );
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
