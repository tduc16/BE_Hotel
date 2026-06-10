import { Injectable, BadRequestException } from '@nestjs/common';
import * as multer from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';

export const multerOptions = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Unsupported file type ${extname(file.originalname)}`,
        ),
        false,
      );
    }
  },
  storage: multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
      const uploadPath = join(process.cwd(), 'uploads', 'room-categories');
      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req: any, file: any, cb: any) => {
      const randomName = Array(32)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');
      cb(null, `${Date.now()}-${randomName}${extname(file.originalname)}`);
    },
  }),
};

@Injectable()
export class UploadService {
  deleteFile(filePath: string) {
    try {
      // Remove leading slash to prevent path.join issues on some OS
      const relativePath = filePath.replace(/^\/+/, '');
      const fullPath = join(process.cwd(), relativePath);
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
      }
    } catch (err) {
      console.error(`Failed to delete file: ${filePath}`, err);
    }
  }
}
