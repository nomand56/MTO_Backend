import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UpdateLanguageDto,
  UpdateNotificationSettingsDto,
  UpdatePreferencesDto,
  UpdatePrivacyDto,
} from './dto/user-settings.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Authenticated user profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ description: 'Updated profile' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update customer preferences' })
  @ApiOkResponse({ description: 'Updated preferences' })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(user.id, dto);
  }

  @Patch('language')
  @ApiOperation({ summary: 'Update customer language' })
  @ApiOkResponse({ description: 'Updated language' })
  updateLanguage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLanguageDto,
  ) {
    return this.usersService.updateLanguage(user.id, dto);
  }

  @Patch('notification-settings')
  @ApiOperation({ summary: 'Update notification settings' })
  @ApiOkResponse({ description: 'Updated notification settings' })
  updateNotificationSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.usersService.updateNotificationSettings(user.id, dto);
  }

  @Patch('privacy')
  @ApiOperation({ summary: 'Update privacy settings' })
  @ApiOkResponse({ description: 'Updated privacy settings' })
  updatePrivacy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePrivacyDto,
  ) {
    return this.usersService.updatePrivacy(user.id, dto);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get user activity summary' })
  @ApiOkResponse({ description: 'User activity feed' })
  getActivity(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getActivity(user.id);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiOkResponse({ description: 'User booking and request statistics' })
  getStatistics(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getStatistics(user.id);
  }
}
