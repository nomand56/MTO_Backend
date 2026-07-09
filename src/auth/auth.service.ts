import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { comparePassword, hashPassword } from '../common/utils/hash.util';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(registerDto);

    if (!user.isVerified) {
      const verificationToken =
        await this.usersService.setEmailVerificationToken(user.id);
      console.log(
        `Email verification token for ${user.email}: ${verificationToken}`,
      );
    }

    const tokens = await this.generateTokens(user);
    const hashedRefreshToken = await hashPassword(tokens.refreshToken);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    // Remove sensitive fields
    const { password, refreshTokenHash, ...userResponse } = user;
    return {
      user: userResponse,
      tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordMatch = await comparePassword(
      loginDto.password,
      user.password,
    );
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const tokens = await this.generateTokens(user);
    const hashedRefreshToken = await hashPassword(tokens.refreshToken);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    // Remove password and refresh token hash
    const { password: _, refreshTokenHash: __, ...userResponse } = user;
    return {
      user: userResponse,
      tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
      const userId = payload.sub;

      const user = await this.usersService.findByIdWithRefreshToken(userId);
      if (!user || !user.refreshTokenHash) {
        throw new ForbiddenException('Access Denied');
      }

      const isRefreshTokenMatching = await comparePassword(
        refreshToken,
        user.refreshTokenHash,
      );
      if (!isRefreshTokenMatching) {
        throw new ForbiddenException('Access Denied');
      }

      const tokens = await this.generateTokens(user);
      const hashedRefreshToken = await hashPassword(tokens.refreshToken);
      await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

      return tokens;
    } catch (e) {
      throw new ForbiddenException('Access Denied');
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const result = await this.usersService.setPasswordResetToken(dto.email);
    if (result) {
      console.log(
        `Password reset token for ${result.user.email}: ${result.token}`,
      );
    }
    return {
      message: 'If the email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    await this.usersService.resetPassword(dto.token, dto.password);
    return { message: 'Password reset successfully' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.usersService.verifyEmail(dto.token);
    return { message: 'Email verified successfully', user };
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, roles: user.roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>(
          'jwt.refreshExpiresIn',
        ) as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
