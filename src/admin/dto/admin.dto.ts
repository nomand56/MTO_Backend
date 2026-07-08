import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  transactionRef?: string;
}

export class CreatePromotionDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  discountPercent?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  discountAmount?: number;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validTo: string;
}

export class CreateDisputeDto {
  @IsString()
  reason: string;
}

export class ResolveDisputeDto {
  @IsString()
  resolution: string;
}
