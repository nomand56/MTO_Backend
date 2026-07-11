import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QuotesService } from './quotes.service';
import { Quote } from './entities/quote.entity';
import { QuoteCounteroffer } from './entities/quote-counteroffer.entity';
import { RequestsService } from '../requests/requests.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MovingRequestStatus } from '../common/enums/moving-request-status.enum';

describe('QuotesService', () => {
  let service: QuotesService;

  const mockQuoteRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'quote-1', ...data })),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockCounterofferRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'counter-1', ...data })),
    findOne: jest.fn(),
  };

  const mockRequestsService = {
    findById: jest.fn(),
    updateStatus: jest.fn(),
    findByIdForCustomer: jest.fn(),
  };

  const mockBookingsService = {
    createFromQuote: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        update: jest.fn(),
      },
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: getRepositoryToken(Quote), useValue: mockQuoteRepository },
        {
          provide: getRepositoryToken(QuoteCounteroffer),
          useValue: mockCounterofferRepository,
        },
        { provide: RequestsService, useValue: mockRequestsService },
        { provide: BookingsService, useValue: mockBookingsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(QuotesService);
    jest.clearAllMocks();
  });

  it('creates a quote and activates the request', async () => {
    mockRequestsService.findById.mockResolvedValue({
      id: 'req-1',
      customerId: 'customer-1',
      status: MovingRequestStatus.Pending,
    });
    mockQuoteRepository.findOne.mockResolvedValue(null);

    await service.createQuote('mover-1', 'req-1', {
      price: 500,
      estimatedHours: 4,
    });

    expect(mockRequestsService.updateStatus).toHaveBeenCalledWith(
      'req-1',
      MovingRequestStatus.Active,
    );
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('updates an existing pending quote instead of conflicting', async () => {
    mockRequestsService.findById.mockResolvedValue({
      id: 'req-1',
      customerId: 'customer-1',
      status: MovingRequestStatus.Active,
    });
    mockQuoteRepository.findOne.mockResolvedValue({
      id: 'quote-1',
      requestId: 'req-1',
      moverId: 'mover-1',
      status: 'pending',
      price: 400,
    });

    const result = await service.createQuote('mover-1', 'req-1', {
      price: 500,
      estimatedHours: 4,
    });

    expect(mockQuoteRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ price: 500 }),
    );
    expect(mockNotificationsService.create).not.toHaveBeenCalled();
    expect(result.price).toBe(500);
  });
});
