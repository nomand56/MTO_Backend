import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from './entities/user.entity';
import { CustomerProfile } from './entities/customer-profile.entity';
import { MoverProfile } from '../movers/entities/mover-profile.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { MovingRequest } from '../requests/entities/moving-request.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { RegisterDto } from '../auth/dto/register.dto';
import { hashPassword } from '../common/utils/hash.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UpdateLanguageDto,
  UpdateNotificationSettingsDto,
  UpdatePreferencesDto,
  UpdatePrivacyDto,
} from './dto/user-settings.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CustomerProfile)
    private readonly customerProfileRepository: Repository<CustomerProfile>,
    @InjectRepository(MoverProfile)
    private readonly moverProfileRepository: Repository<MoverProfile>,
    private readonly dataSource: DataSource,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: {
        customerProfile: true,
        moverProfile: true,
      },
    });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        password: true,
        roles: true,
        isActive: true,
        isVerified: true,
      },
      relations: {
        customerProfile: true,
        moverProfile: true,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: {
        customerProfile: true,
        moverProfile: true,
      },
    });
  }

  async findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        roles: true,
        isActive: true,
        isVerified: true,
        refreshTokenHash: true,
      },
      relations: {
        customerProfile: true,
        moverProfile: true,
      },
    });
  }

  async create(registerDto: RegisterDto): Promise<User> {
    const email = registerDto.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Role-specific validations
    if (registerDto.role === UserRole.Customer) {
      if (!registerDto.firstName || !registerDto.lastName) {
        throw new BadRequestException('First name and last name are required for customer registration');
      }
    } else if (registerDto.role === UserRole.Mover) {
      if (!registerDto.businessName) {
        throw new BadRequestException('Business name is required for mover registration');
      }
    }

    const hashedPassword = await hashPassword(registerDto.password);

    // Run creation inside a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = new User();
      user.email = email;
      user.password = hashedPassword;
      user.roles = [registerDto.role];
      user.isActive = true;
      user.isVerified = registerDto.role === UserRole.Customer; // Auto-verify customers, movers need manual admin verification

      const savedUser = await queryRunner.manager.save(user);

      if (registerDto.role === UserRole.Customer) {
        const customerProfile = new CustomerProfile();
        customerProfile.firstName = registerDto.firstName!;
        customerProfile.lastName = registerDto.lastName!;
        customerProfile.phone = registerDto.phone;
        customerProfile.user = savedUser;
        customerProfile.userId = savedUser.id;
        await queryRunner.manager.save(customerProfile);
      } else if (registerDto.role === UserRole.Mover) {
        const moverProfile = new MoverProfile();
        moverProfile.businessName = registerDto.businessName!;
        moverProfile.phone = registerDto.phone;
        moverProfile.user = savedUser;
        moverProfile.userId = savedUser.id;
        await queryRunner.manager.save(moverProfile);
      }

      await queryRunner.commitTransaction();

      // Return the saved user with profile relations loaded
      return (await this.findById(savedUser.id))!;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateRefreshToken(userId: string, hashedRefreshToken: string | null): Promise<void> {
    await this.userRepository.update(userId, {
      refreshTokenHash: hashedRefreshToken,
    });
  }

  async setPasswordResetToken(email: string) {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        passwordResetToken: true,
        passwordResetExpires: true,
      },
    });

    if (!user) {
      return null;
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await this.userRepository.update(user.id, {
      passwordResetToken: token,
      passwordResetExpires: expires,
    });

    return { user, token };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: MoreThan(new Date()),
      },
      select: {
        id: true,
        email: true,
        password: true,
        passwordResetToken: true,
        passwordResetExpires: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Invalid or expired reset token');
    }

    user.password = await hashPassword(newPassword);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);

    return user;
  }

  async setEmailVerificationToken(userId: string) {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.userRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    });

    return token;
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findOne({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new NotFoundException('Invalid or expired verification token');
    }

    user.isVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepository.save(user);

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.getProfile(userId);

    if (user.customerProfile) {
      const profile = user.customerProfile;
      if (dto.firstName !== undefined) profile.firstName = dto.firstName;
      if (dto.lastName !== undefined) profile.lastName = dto.lastName;
      if (dto.phone !== undefined) profile.phone = dto.phone;
      if (dto.avatarUrl !== undefined) profile.avatarUrl = dto.avatarUrl;
      if (dto.address !== undefined) profile.address = { ...dto.address };
      await this.customerProfileRepository.save(profile);
    } else if (user.moverProfile) {
      const moverUpdates = {
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      };
      if (Object.keys(moverUpdates).length > 0) {
        await this.moverProfileRepository.update(user.moverProfile.id, moverUpdates);
      }
    }

    return this.getProfile(userId);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const profile = await this.getCustomerProfile(userId);
    profile.preferences = dto.preferences;
    await this.customerProfileRepository.save(profile);
    return this.getProfile(userId);
  }

  async updateLanguage(userId: string, dto: UpdateLanguageDto) {
    const profile = await this.getCustomerProfile(userId);
    profile.language = dto.language;
    await this.customerProfileRepository.save(profile);
    return this.getProfile(userId);
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    const profile = await this.getCustomerProfile(userId);
    profile.notificationSettings = dto.notificationSettings;
    await this.customerProfileRepository.save(profile);
    return this.getProfile(userId);
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacyDto) {
    const profile = await this.getCustomerProfile(userId);
    profile.privacy = dto.privacy;
    await this.customerProfileRepository.save(profile);
    return this.getProfile(userId);
  }

  async getActivity(userId: string) {
    return {
      userId,
      activities: [],
      message: 'Activity tracking is ready for audit-log integration.',
    };
  }

  async getStatistics(userId: string) {
    const [movingRequests, bookings] = await Promise.all([
      this.dataSource.getRepository(MovingRequest).count({ where: { customerId: userId } }),
      this.dataSource.getRepository(Booking).count({ where: { customerId: userId } }),
    ]);

    return {
      userId,
      movingRequests,
      bookings,
    };
  }

  private async getCustomerProfile(userId: string) {
    const profile = await this.customerProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }
    return profile;
  }
}
