import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateVehicleTypeDto {
  @ApiProperty({ example: 'Cargo Van' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Best for studio moves' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 89 })
  @IsNumber()
  basePrice: number;

  @ApiProperty({ example: 1.75 })
  @IsNumber()
  pricePerKm: number;

  @ApiProperty({ example: 800 })
  @IsNumber()
  maxWeightKg: number;

  @ApiProperty({ example: 8 })
  @IsNumber()
  maxVolumeM3: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  moverCapacity?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVehicleTypeDto extends PartialType(CreateVehicleTypeDto) {}

export class RecommendationItemDto {
  @ApiProperty({ example: 'Sofa' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber()
  volumeM3?: number;
}

export class CalculateVehicleRecommendationDto {
  @ApiProperty({ type: [RecommendationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendationItemDto)
  items: RecommendationItemDto[];

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  distanceKm?: number;
}
