import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class UpdatePresenceDto {
  @IsBoolean()
  isOnline: boolean;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
