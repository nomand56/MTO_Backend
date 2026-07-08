import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { UserRole } from '../src/common/enums/user-role.enum';

describe('Marketplace flow (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  let customerToken: string;
  let moverToken: string;
  let requestId: string;
  let quoteId: string;
  let bookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers customer and mover', async () => {
    const customerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `flow-customer-${suffix}@example.com`,
        password: 'Password123!',
        role: UserRole.Customer,
        firstName: 'Flow',
        lastName: 'Customer',
      })
      .expect(201);

    customerToken = customerRes.body.data.tokens.accessToken;

    const moverRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `flow-mover-${suffix}@example.com`,
        password: 'Password123!',
        role: UserRole.Mover,
        businessName: 'Flow Movers',
      })
      .expect(201);

    moverToken = moverRes.body.data.tokens.accessToken;
  });

  it('verifies mover profile and admin verifies mover', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/movers/profile')
      .set('Authorization', `Bearer ${moverToken}`)
      .send({
        businessName: 'Flow Movers',
        serviceAreas: ['Downtown'],
        documents: [{ type: 'license', url: 'https://example.com/license.pdf' }],
      })
      .expect(200);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@movethisout.com',
        password: 'Admin123!',
      });

    const moverUser = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${moverToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/admin/users/${moverUser.body.data.id}/verify`)
      .set('Authorization', `Bearer ${adminLogin.body.data.tokens.accessToken}`)
      .expect(200);
  });

  it('customer creates request and mover submits quote', async () => {
    const requestRes = await request(app.getHttpServer())
      .post('/api/v1/customers/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        pickupAddress: '100 Start St',
        destinationAddress: '200 End Ave',
        movingDate: '2026-09-15',
        items: [{ name: 'Boxes', quantity: 10 }],
      })
      .expect(201);

    requestId = requestRes.body.data.id;

    const quoteRes = await request(app.getHttpServer())
      .post(`/api/v1/movers/requests/${requestId}/quote`)
      .set('Authorization', `Bearer ${moverToken}`)
      .send({ price: 750, estimatedHours: 5, notes: 'Includes packing' })
      .expect(201);

    quoteId = quoteRes.body.data.id;
  });

  it('customer accepts quote and booking is created', async () => {
    const bookingRes = await request(app.getHttpServer())
      .post(`/api/v1/customers/requests/${requestId}/quotes/${quoteId}/accept`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    bookingId = bookingRes.body.data.id;
    expect(bookingRes.body.data.status).toBe('confirmed');
  });

  it('mover progresses booking to completed and customer reviews', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/movers/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${moverToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/movers/bookings/${bookingId}/update-status`)
      .set('Authorization', `Bearer ${moverToken}`)
      .send({ status: 'completed', note: 'Move finished' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/customers/bookings/${bookingId}/review`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ rating: 5, comment: 'Excellent service' })
      .expect(201);
  });

  it('returns analytics for admin', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@movethisout.com',
        password: 'Admin123!',
      });

    const analyticsRes = await request(app.getHttpServer())
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${adminLogin.body.data.tokens.accessToken}`)
      .expect(200);

    expect(analyticsRes.body.data.marketplace).toBeDefined();
    expect(analyticsRes.body.data.users.total).toBeGreaterThan(0);
  });
});
