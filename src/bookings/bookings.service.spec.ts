import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { BookingShare } from './entities/booking-share.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { ZonesService } from '../zones/zones.service';
import { BookingStatus } from '../common/enums/booking-status.enum';

describe('BookingsService', () => {
  let service: BookingsService;

  const mockBookingRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'booking-1', ...data })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    manager: { update: jest.fn() },
  };

  const mockBookingItemRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };

  const mockBookingShareRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(),
  };

  const mockHistoryRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  const mockVehiclesService = {
    calculateRecommendation: jest.fn(),
  };

  const mockZonesService = {
    getPricing: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepository },
        { provide: getRepositoryToken(BookingItem), useValue: mockBookingItemRepository },
        { provide: getRepositoryToken(BookingShare), useValue: mockBookingShareRepository },
        {
          provide: getRepositoryToken(BookingStatusHistory),
          useValue: mockHistoryRepository,
        },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: VehiclesService, useValue: mockVehiclesService },
        { provide: ZonesService, useValue: mockZonesService },
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
      pickupAddress: '123 Main St',
      destinationAddress: '456 King St',
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
