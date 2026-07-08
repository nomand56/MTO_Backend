import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesService } from './quotes.service';
import { Quote } from './entities/quote.entity';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote]),
    RequestsModule,
  ],
  providers: [QuotesService],
  exports: [QuotesService, TypeOrmModule],
})
export class QuotesModule {}
