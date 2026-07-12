import { DataSource, Repository } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { UserRole } from '../../common/enums/user-role.enum';
import { hashPassword } from '../../common/utils/hash.util';
import { User } from '../../users/entities/user.entity';
import { CustomerProfile } from '../../users/entities/customer-profile.entity';
import { MoverProfile } from '../../movers/entities/mover-profile.entity';
import { MoverVehicleType } from '../../movers/entities/mover-vehicle-type.entity';
import { VehicleType } from '../../vehicles/entities/vehicle-type.entity';
import { Zone } from '../../zones/entities/zone.entity';
import { PeakHourConfig } from '../../zones/entities/peak-hour-config.entity';

config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, '../../**/*.entity.{ts,js}')],
  synchronize: true,
});

type DemoOnlineMover = {
  email: string;
  password: string;
  businessName: string;
  phone: string;
  bio: string;
  latitude: number;
  longitude: number;
  vehicleNames: string[];
};

const DEMO_ONLINE_MOVERS: DemoOnlineMover[] = [
  {
    email: 'mover1@movethisout.com',
    password: 'Mover123!',
    businessName: 'Northline Movers',
    phone: '555-0301',
    bio: 'Cargo Van · Ford Transit 2021 · 2 helpers available',
    latitude: 43.662,
    longitude: -79.381,
    vehicleNames: ['Cargo Van', '16ft Box Truck'],
  },
  {
    email: 'mover2@movethisout.com',
    password: 'Mover123!',
    businessName: 'CityVan Express',
    phone: '555-0302',
    bio: 'Cargo Van · Mercedes Sprinter 2022 · 2 helpers available',
    latitude: 43.648,
    longitude: -79.392,
    vehicleNames: ['Cargo Van'],
  },
  {
    email: 'mover3@movethisout.com',
    password: 'Mover123!',
    businessName: 'Big Load Bros',
    phone: '555-0303',
    bio: '16ft Box Truck · Isuzu NPR 2020 · 2 helpers available',
    latitude: 43.671,
    longitude: -79.365,
    vehicleNames: ['16ft Box Truck', '26ft Box Truck'],
  },
  {
    email: 'mover4@movethisout.com',
    password: 'Mover123!',
    businessName: 'Metro Muscle Moving',
    phone: '555-0304',
    bio: 'Cargo Van · Nissan NV200 2020 · 1 helper available',
    latitude: 43.641,
    longitude: -79.405,
    vehicleNames: ['Cargo Van'],
  },
  {
    email: 'mover5@movethisout.com',
    password: 'Mover123!',
    businessName: 'Swift Haul Co.',
    phone: '555-0305',
    bio: '26ft Box Truck · large home moves',
    latitude: 43.655,
    longitude: -79.358,
    vehicleNames: ['26ft Box Truck'],
  },
];

async function ensureOnlineDemoMovers(
  userRepo: Repository<User>,
  moverProfileRepo: Repository<MoverProfile>,
  vehicleTypeRepo: Repository<VehicleType>,
  moverVehicleRepo: Repository<MoverVehicleType>,
) {
  const vehicleTypes = await vehicleTypeRepo.find();
  const now = new Date();

  for (const demo of DEMO_ONLINE_MOVERS) {
    let user = await userRepo.findOne({ where: { email: demo.email } });
    if (!user) {
      const hashedPassword = await hashPassword(demo.password);
      user = await userRepo.save(
        userRepo.create({
          email: demo.email,
          password: hashedPassword,
          roles: [UserRole.Mover],
          isActive: true,
          isVerified: true,
        }),
      );
      console.log(`Seeded demo mover user: ${demo.email}`);
    }

    let profile = await moverProfileRepo.findOne({ where: { userId: user.id } });
    if (!profile) {
      profile = moverProfileRepo.create({
        userId: user.id,
        businessName: demo.businessName,
        phone: demo.phone,
        bio: demo.bio,
        isVerified: true,
        serviceAreas: ['Greater Toronto Area'],
        documents: [],
        availability: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], hours: '8:00-20:00' },
      });
    }

    profile.businessName = demo.businessName;
    profile.phone = demo.phone;
    profile.bio = demo.bio;
    profile.isVerified = true;
    profile.isOnline = true;
    profile.latitude = demo.latitude;
    profile.longitude = demo.longitude;
    profile.locationUpdatedAt = now;
    profile.lastSeenAt = now;
    await moverProfileRepo.save(profile);

    const linked = await moverVehicleRepo.find({
      where: { moverProfileId: profile.id },
    });
    if (!linked.length) {
      const vehicleIds = demo.vehicleNames
        .map((name) => vehicleTypes.find((type) => type.name === name)?.id)
        .filter((id): id is string => !!id);

      for (const [index, vehicleTypeId] of vehicleIds.entries()) {
        await moverVehicleRepo.save(
          moverVehicleRepo.create({
            moverProfileId: profile.id,
            vehicleTypeId,
            isPrimary: index === 0,
          }),
        );
      }
      console.log(`Linked vehicles for ${demo.businessName}`);
    }
  }

  const legacyMover = await userRepo.findOne({
    where: { email: 'mover@movethisout.com' },
  });
  if (legacyMover) {
    const profile = await moverProfileRepo.findOne({
      where: { userId: legacyMover.id },
    });
    if (profile) {
      profile.isOnline = true;
      profile.isVerified = true;
      profile.latitude = 43.6532;
      profile.longitude = -79.3832;
      profile.locationUpdatedAt = now;
      profile.lastSeenAt = now;
      await moverProfileRepo.save(profile);

      const cargoVan = vehicleTypes.find((type) => type.name === 'Cargo Van');
      const linked = await moverVehicleRepo.find({
        where: { moverProfileId: profile.id },
      });
      if (cargoVan && !linked.length) {
        await moverVehicleRepo.save(
          moverVehicleRepo.create({
            moverProfileId: profile.id,
            vehicleTypeId: cargoVan.id,
            isPrimary: true,
          }),
        );
      }
      console.log('Updated legacy mover@movethisout.com to online');
    }
  }
}

async function seed() {
  await dataSource.initialize();
  console.log(
    `Connected to ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`,
  );

  const userRepo = dataSource.getRepository(User);
  const customerProfileRepo = dataSource.getRepository(CustomerProfile);
  const moverProfileRepo = dataSource.getRepository(MoverProfile);
  const vehicleTypeRepo = dataSource.getRepository(VehicleType);
  const moverVehicleRepo = dataSource.getRepository(MoverVehicleType);
  const zoneRepo = dataSource.getRepository(Zone);
  const peakHourRepo = dataSource.getRepository(PeakHourConfig);

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

    if (
      seedUser.roles.includes(UserRole.Customer) &&
      seedUser.profile &&
      'firstName' in seedUser.profile
    ) {
      await customerProfileRepo.save(
        customerProfileRepo.create({
          ...seedUser.profile,
          userId: savedUser.id,
        }),
      );
    }

    if (
      seedUser.roles.includes(UserRole.Mover) &&
      seedUser.profile &&
      'businessName' in seedUser.profile
    ) {
      await moverProfileRepo.save(
        moverProfileRepo.create({
          ...seedUser.profile,
          userId: savedUser.id,
        }),
      );
    }

    console.log(`Seeded: ${seedUser.email}`);
  }

  const vehicleTypes = [
    {
      name: 'Cargo Van',
      description: 'Best for studio and one-bedroom moves',
      basePrice: 89,
      pricePerKm: 1.75,
      maxWeightKg: 800,
      maxVolumeM3: 8,
      moverCapacity: 2,
    },
    {
      name: '16ft Box Truck',
      description: 'Best for two-bedroom homes',
      basePrice: 129,
      pricePerKm: 2.25,
      maxWeightKg: 1800,
      maxVolumeM3: 18,
      moverCapacity: 2,
    },
    {
      name: '26ft Box Truck',
      description: 'Best for large homes and bulky items',
      basePrice: 189,
      pricePerKm: 2.85,
      maxWeightKg: 3500,
      maxVolumeM3: 32,
      moverCapacity: 3,
    },
  ];

  for (const vehicleType of vehicleTypes) {
    const existing = await vehicleTypeRepo.findOne({
      where: { name: vehicleType.name },
    });
    if (!existing) {
      await vehicleTypeRepo.save(vehicleTypeRepo.create(vehicleType));
      console.log(`Seeded vehicle type: ${vehicleType.name}`);
    } else {
      console.log(`Skipped vehicle type (already exists): ${vehicleType.name}`);
    }
  }

  const existingZone = await zoneRepo.findOne({
    where: { name: 'Greater Toronto Area' },
  });
  if (!existingZone) {
    await zoneRepo.save(
      zoneRepo.create({
        name: 'Greater Toronto Area',
        description: 'Primary launch service zone',
        boundary: {
          type: 'circle',
          coordinates: { lat: 43.6532, lng: -79.3832, radiusKm: 45 },
        },
        basePriceMultiplier: 1,
        baseFee: 25,
        isActive: true,
        isAvailable: true,
      }),
    );
    console.log('Seeded zone: Greater Toronto Area');
  } else {
    console.log('Skipped zone (already exists): Greater Toronto Area');
  }

  const peakHours = [
    {
      dayOfWeek: 1,
      startTime: '07:00:00',
      endTime: '09:30:00',
      multiplier: 1.2,
    },
    {
      dayOfWeek: 5,
      startTime: '16:00:00',
      endTime: '19:00:00',
      multiplier: 1.35,
    },
  ];

  for (const peakHour of peakHours) {
    const existing = await peakHourRepo.findOne({
      where: {
        dayOfWeek: peakHour.dayOfWeek,
        startTime: peakHour.startTime,
        endTime: peakHour.endTime,
      },
    });
    if (!existing) {
      await peakHourRepo.save(peakHourRepo.create(peakHour));
      console.log(`Seeded peak hour config for day ${peakHour.dayOfWeek}`);
    } else {
      console.log(
        `Skipped peak hour (already exists): day ${peakHour.dayOfWeek}`,
      );
    }
  }

  await ensureOnlineDemoMovers(
    userRepo,
    moverProfileRepo,
    vehicleTypeRepo,
    moverVehicleRepo,
  );

  await dataSource.destroy();
  console.log('Seeding complete.');
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
