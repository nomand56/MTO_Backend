import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { NearbyMoversSortBy } from './nearby-movers-sort-by.enum';

export { NearbyMoversSortBy } from './nearby-movers-sort-by.enum';
export class NearbyMoversQueryDto {
  @ApiProperty({ example: 43.6532 })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -79.3832 })
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm?: number = 25;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleTypeId?: string;

  @ApiPropertyOptional({
    enum: NearbyMoversSortBy,
    default: NearbyMoversSortBy.Distance,
  })
  @IsOptional()
  @IsEnum(NearbyMoversSortBy)
  sortBy?: NearbyMoversSortBy = NearbyMoversSortBy.Distance;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationLongitude?: number;
}
