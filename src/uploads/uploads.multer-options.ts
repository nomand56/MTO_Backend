import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const uploadsDir = join(process.cwd(), 'uploads');

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const uploadMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: uploadsDir,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new BadRequestException(
          'Unsupported file type. Allowed: JPEG, PNG, WEBP, PDF.',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
