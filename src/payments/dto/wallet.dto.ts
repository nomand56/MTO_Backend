import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentKind } from '../../common/enums/payment-kind.enum';

export class TopUpWalletDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;
}

export class PayFromWalletDto {
  @IsOptional()
  @IsEnum(PaymentKind)
  kind?: PaymentKind;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;
}
