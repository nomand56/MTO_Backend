import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
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
}
