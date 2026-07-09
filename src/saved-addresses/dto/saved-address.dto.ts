import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { AddressBookDto } from '../../common/dto/address.dto';

export class CreateSavedAddressDto extends AddressBookDto {}

export class UpdateSavedAddressDto extends PartialType(CreateSavedAddressDto) {}

export class SetDefaultSavedAddressDto {
  @ApiProperty({
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  addressId: string;
}
