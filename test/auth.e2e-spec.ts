import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { UserRole } from './../src/common/enums/user-role.enum';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const customerEmail = `customer-${uniqueSuffix}@example.com`;
  const moverEmail = `mover-${uniqueSuffix}@example.com`;
  const password = 'securePassword123';

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

  describe('Registration', () => {
    it('should register a customer successfully with profile details', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: customerEmail,
          password: password,
          role: UserRole.Customer,
          firstName: 'John',
          lastName: 'Doe',
          phone: '1234567890',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(customerEmail.toLowerCase());
      expect(response.body.data.user.roles).toContain(UserRole.Customer);
      expect(response.body.data.user.customerProfile).toBeDefined();
      expect(response.body.data.user.customerProfile.firstName).toBe('John');
      expect(response.body.data.user.customerProfile.lastName).toBe('Doe');
      expect(response.body.data.user.customerProfile.phone).toBe('1234567890');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should register a mover successfully with business details', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: moverEmail,
          password: password,
          role: UserRole.Mover,
          businessName: 'Super Movers Inc.',
          phone: '9876543210',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(moverEmail.toLowerCase());
      expect(response.body.data.user.roles).toContain(UserRole.Mover);
      expect(response.body.data.user.moverProfile).toBeDefined();
      expect(response.body.data.user.moverProfile.businessName).toBe('Super Movers Inc.');
      expect(response.body.data.user.moverProfile.phone).toBe('9876543210');
      expect(response.body.data.user.moverProfile.isVerified).toBe(false); // Mover requires admin verification
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should reject registration if email is already registered', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: customerEmail,
          password: password,
          role: UserRole.Customer,
          firstName: 'Another',
          lastName: 'User',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already registered');
    });

    it('should reject customer registration if name details are missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `invalid-customer-${uniqueSuffix}@example.com`,
          password: password,
          role: UserRole.Customer,
          // Missing firstName and lastName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject mover registration if businessName is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `invalid-mover-${uniqueSuffix}@example.com`,
          password: password,
          role: UserRole.Mover,
          // Missing businessName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Login & Session Management', () => {
    let accessToken: string;
    let refreshToken: string;

    it('should login customer with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: customerEmail,
          password: password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe(customerEmail.toLowerCase());

      accessToken = response.body.data.tokens.accessToken;
      refreshToken = response.body.data.tokens.refreshToken;
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: customerEmail,
          password: 'wrongPassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fetch the profile details of the logged-in user at /auth/me', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(customerEmail.toLowerCase());
      expect(response.body.data.customerProfile).toBeDefined();
      expect(response.body.data.customerProfile.firstName).toBe('John');
    });

    it('should rotate access and refresh tokens using refresh token', async () => {
      // Small pause to ensure expiration differences (JWT iat resolution is 1s).
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.accessToken).not.toBe(accessToken);
      expect(response.body.data.refreshToken).not.toBe(refreshToken);

      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should reject refresh token rotation if refresh token is reused or invalid', async () => {
      // If we logout or call it with an invalid token:
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should logout and invalidate refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Logged out successfully');

      // Refreshing with the invalidated token should now fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(403);
    });
  });
});
