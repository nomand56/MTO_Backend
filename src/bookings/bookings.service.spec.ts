import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingStatus } from '../common/enums/booking-status.enum';

describe('BookingsService', () => {
  let service: BookingsService;

  const mockBookingRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'booking-1', ...data })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    manager: { update: jest.fn() },
  };

  const mockHistoryRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepository },
        {
          provide: getRepositoryToken(BookingStatusHistory),
          useValue: mockHistoryRepository,
        },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get(BookingsService);
    jest.clearAllMocks();
  });

  it('creates a booking from an accepted quote', async () => {
    const quote = {
      id: 'quote-1',
      moverId: 'mover-1',
      price: 500,
    };
    const request = {
      id: 'req-1',
      customerId: 'customer-1',
      movingDate: new Date('2026-08-01'),
    };

    const booking = await service.createFromQuote(quote as never, request as never);

    expect(mockBookingRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BookingStatus.Confirmed,
        price: 500,
      }),
    );
    expect(booking.id).toBe('booking-1');
  });
});
