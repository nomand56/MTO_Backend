import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentKind } from '../../common/enums/payment-kind.enum';

export class CreatePaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  transactionRef?: string;

  @IsOptional()
  @IsEnum(PaymentKind)
  kind?: PaymentKind;
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}

export class RefundDisputeDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ResolveDisputeDto {
  @IsString()
  resolution: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundAmount?: number;
}
