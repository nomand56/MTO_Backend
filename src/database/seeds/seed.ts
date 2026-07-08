import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../../users/entities/user.entity';
import { CustomerProfile } from '../../users/entities/customer-profile.entity';
import { MoverProfile } from '../../movers/entities/mover-profile.entity';
import { MovingRequest } from '../../requests/entities/moving-request.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { hashPassword } from '../../common/utils/hash.util';

config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [User, CustomerProfile, MoverProfile, MovingRequest, Quote, Booking],
  synchronize: true,
});

async function seed() {
  await dataSource.initialize();

  const userRepo = dataSource.getRepository(User);
  const customerProfileRepo = dataSource.getRepository(CustomerProfile);
  const moverProfileRepo = dataSource.getRepository(MoverProfile);

  const seeds = [
    {
      email: 'admin@movethisout.com',
      password: 'Admin123!',
      roles: [UserRole.Admin],
    },
    {
      email: 'customer@movethisout.com',
      password: 'Customer123!',
      roles: [UserRole.Customer],
      profile: {
        firstName: 'Jane',
        lastName: 'Customer',
        phone: '555-0100',
      },
    },
    {
      email: 'mover@movethisout.com',
      password: 'Mover123!',
      roles: [UserRole.Mover],
      profile: {
        businessName: 'MoveThisOut Movers',
        phone: '555-0200',
        bio: 'Reliable local moving service.',
        isVerified: true,
      },
    },
  ];

  for (const seedUser of seeds) {
    const existing = await userRepo.findOne({
      where: { email: seedUser.email },
    });

    if (existing) {
      console.log(`Skipped (already exists): ${seedUser.email}`);
      continue;
    }

    const hashedPassword = await hashPassword(seedUser.password);
    const user = userRepo.create({
      email: seedUser.email,
      password: hashedPassword,
      roles: seedUser.roles,
      isActive: true,
      isVerified: true,
    });
    const savedUser = await userRepo.save(user);

    if (seedUser.roles.includes(UserRole.Customer) && seedUser.profile && 'firstName' in seedUser.profile) {
      await customerProfileRepo.save(
        customerProfileRepo.create({
          ...seedUser.profile,
          userId: savedUser.id,
        }),
      );
    }

    if (seedUser.roles.includes(UserRole.Mover) && seedUser.profile && 'businessName' in seedUser.profile) {
      await moverProfileRepo.save(
        moverProfileRepo.create({
          ...seedUser.profile,
          userId: savedUser.id,
        }),
      );
    }

    console.log(`Seeded: ${seedUser.email}`);
  }

  await dataSource.destroy();
  console.log('Seeding complete.');
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
