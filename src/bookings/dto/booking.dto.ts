import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AddressDto } from '../../common/dto/address.dto';

export class BookingItemDto {
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

  @ApiPropertyOptional({ example: '3-seater fabric sofa' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/items/sofa.jpg' })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class CreateBookingDto {
  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress: AddressDto;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  destinationAddress: AddressDto;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleTypeId?: string;

  @ApiProperty({ type: [BookingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @ApiPropertyOptional({ example: 'Please call on arrival' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBookingDto extends PartialType(CreateBookingDto) {}

export class BookingEstimateDto extends CreateBookingDto {}

export class BookingPreviewDto extends CreateBookingDto {}

export class RescheduleBookingDto {
  @ApiProperty({ example: '2026-08-20T14:00:00.000Z' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ example: 'Customer requested later time' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ShareBookingDto {
  @ApiPropertyOptional({ example: 'friend@example.com' })
  @IsOptional()
  @IsString()
  sharedWithEmail?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  expiresInHours?: number;
}

export class UpdateBookingItemDto extends PartialType(BookingItemDto) {}

export class BookingItemPhotoDto {
  @ApiProperty({ example: 'https://cdn.example.com/photos/item.jpg' })
  @IsString()
  photoUrl: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  itemId?: string;
}
