import { IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { MessageType } from '../../common/enums/message-type.enum';

export class SendMessageDto {
  @ValidateIf((dto: SendMessageDto) => !dto.attachmentUrl)
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentMimeType?: string;
}
