import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class UploadsService {
  buildResponse(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
    };
  }
}
