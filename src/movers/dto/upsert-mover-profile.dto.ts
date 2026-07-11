import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MoverDocumentDto {
  @IsString()
  type: string;

  @IsUrl({ require_tld: false })
  url: string;
}

export class UpsertMoverProfileDto {
  @IsString()
  businessName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceAreas?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MoverDocumentDto)
  documents?: MoverDocumentDto[];

  @IsOptional()
  availability?: { days: string[]; hours: string };

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vehicleTypeIds?: string[];

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
