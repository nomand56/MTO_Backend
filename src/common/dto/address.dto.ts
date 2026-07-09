import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressDto {
  @ApiProperty({ example: '123 Main Street' })
  @IsString()
  street: string;

  @ApiProperty({ example: 'Toronto' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'ON' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ example: 'M5V 2T6' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Canada' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 43.6532 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -79.3832 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'Apartment 1201' })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class AddressBookDto extends AddressDto {
  @ApiProperty({ example: 'Home' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
