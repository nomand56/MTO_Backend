import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { uploadMulterOptions } from './uploads.multer-options';

@ApiTags('Uploads')
@ApiBearerAuth('JWT-auth')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file (image or PDF)' })
  @UseInterceptors(FileInterceptor('file', uploadMulterOptions))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.buildResponse(file);
  }
}
