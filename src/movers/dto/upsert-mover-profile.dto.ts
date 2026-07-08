import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MoverDocumentDto {
  @IsString()
  type: string;

  @IsUrl()
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
  @IsUrl()
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
}
