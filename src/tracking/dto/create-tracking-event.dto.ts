import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { TrackingEventType } from '../../common/enums/tracking-event-type.enum';

export class CreateTrackingEventDto {
  @IsEnum(TrackingEventType)
  type: TrackingEventType;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
