import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestsService } from './requests.service';
import { MovingRequest } from './entities/moving-request.entity';
import { MovingRequestStatus } from '../common/enums/moving-request-status.enum';

describe('RequestsService', () => {
  let service: RequestsService;

  const mockRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'req-1', ...data })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getRepositoryToken(MovingRequest),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get(RequestsService);
    jest.clearAllMocks();
  });

  it('creates a moving request with pending status', async () => {
    const dto = {
      pickupAddress: '123 Main St',
      destinationAddress: '456 Oak Ave',
      movingDate: '2026-08-01',
      items: [{ name: 'Sofa', quantity: 1 }],
    };

    const result = await service.create('customer-1', dto);

    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'customer-1',
        status: MovingRequestStatus.Pending,
      }),
    );
    expect(result.id).toBe('req-1');
  });
});
