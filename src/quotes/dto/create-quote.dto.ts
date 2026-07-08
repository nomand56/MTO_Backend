import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateQuoteDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCounterofferDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
