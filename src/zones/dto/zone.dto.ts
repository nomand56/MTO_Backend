import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateZoneDto {
  @ApiProperty({ example: 'Greater Toronto Area' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Primary launch service zone' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: {
      type: 'circle',
      coordinates: { lat: 43.6532, lng: -79.3832, radiusKm: 45 },
    },
  })
  @IsObject()
  boundary: {
    type: 'polygon' | 'circle';
    coordinates: number[][] | { lat: number; lng: number; radiusKm: number };
  };

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  basePriceMultiplier?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  baseFee?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

export class CheckZoneDto {
  @ApiProperty({ example: 43.6532 })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -79.3832 })
  @Type(() => Number)
  @IsNumber()
  longitude: number;
}

export class ZonePricingQueryDto {
  @ApiProperty({ example: 43.6532 })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -79.3832 })
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  distanceKm?: number;

  @ApiPropertyOptional({ example: '2026-07-09T18:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class ZoneAvailabilityQueryDto {
  @ApiProperty({ example: 43.6532 })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -79.3832 })
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ example: '2026-07-09T18:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
