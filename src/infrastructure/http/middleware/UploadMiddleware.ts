import multer from 'multer';
import { Request } from 'express';
import { InvalidFileError } from '../../../domain/errors/ConversionError';

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase();

  // Validate extension
  if (ext !== 'docx') {
    return callback(new InvalidFileError('Invalid file extension. Only .docx is supported'));
  }

  // Validate MIME type. Block obviously incorrect mime types.
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('audio/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype === 'application/pdf'
  ) {
    return callback(new InvalidFileError(`Invalid file format: ${file.mimetype}`));
  }

  callback(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 26214400, // 25MB limit
    files: 1
  }
});
