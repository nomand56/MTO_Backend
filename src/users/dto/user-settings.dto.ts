import { IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({
    example: { theme: 'dark', currency: 'CAD', distanceUnit: 'km' },
  })
  @IsObject()
  preferences: Record<string, unknown>;
}

export class UpdateLanguageDto {
  @ApiProperty({ example: 'en' })
  @IsString()
  language: string;
}

export class UpdateNotificationSettingsDto {
  @ApiProperty({
    example: {
      push: true,
      email: true,
      sms: false,
      bookingUpdates: true,
      promotions: false,
    },
  })
  @IsObject()
  notificationSettings: Record<string, unknown>;
}

export class UpdatePrivacyDto {
  @ApiProperty({
    example: {
      showProfile: true,
      shareActivity: false,
      allowMarketing: false,
    },
  })
  @IsObject()
  privacy: Record<string, unknown>;
}
