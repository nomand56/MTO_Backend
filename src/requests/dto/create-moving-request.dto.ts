import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RequestItemDto {
  @IsString()
  name: string;

  @IsOptional()
  quantity?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateMovingRequestDto {
  @IsString()
  pickupAddress: string;

  @IsString()
  destinationAddress: string;

  @IsDateString()
  movingDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items: RequestItemDto[];

  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  distanceKm?: number;
}
