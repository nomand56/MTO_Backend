import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedAddress } from './entities/saved-address.entity';
import { SavedAddressesController } from './saved-addresses.controller';
import { SavedAddressesService } from './saved-addresses.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedAddress])],
  controllers: [SavedAddressesController],
  providers: [SavedAddressesService],
  exports: [SavedAddressesService, TypeOrmModule],
})
export class SavedAddressesModule {}
