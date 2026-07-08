import { IsBoolean } from 'class-validator';

export class RespondCounterofferDto {
  @IsBoolean()
  accept: boolean;
}
