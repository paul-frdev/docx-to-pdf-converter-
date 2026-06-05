import { Response, NextFunction } from 'express';
import { ValidatedConversionRequest, HttpErrorResponse } from '../../../shared/types';

/**
 * Validates the binary file signature of the uploaded document.
 * Checks the first 4 bytes of the buffer for ZIP/OOXML magic numbers (50 4B 03 04).
 */
export const docxSignatureValidator = (
  req: ValidatedConversionRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.file || !req.file.buffer) {
    const errorResponse: HttpErrorResponse = {
      error: {
        code: 'INVALID_FILE',
        message: 'No file uploaded'
      }
    };
    res.status(400).json(errorResponse);
    return;
  }

  const buffer = req.file.buffer;
  if (buffer.length < 4) {
    const errorResponse: HttpErrorResponse = {
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Invalid file signature. File size is too small.'
      }
    };
    res.status(400).json(errorResponse);
    return;
  }

  // Extract the first 4 bytes and convert to uppercase Hex representation
  const hexSignature = buffer.toString('hex', 0, 4).toUpperCase();
  const ZIP_OOXML_MAGIC_NUMBER = '504B0304';

  if (hexSignature !== ZIP_OOXML_MAGIC_NUMBER) {
    const errorResponse: HttpErrorResponse = {
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Invalid file signature. Only valid ZIP/OOXML DOCX files are allowed.'
      }
    };
    res.status(400).json(errorResponse);
    return;
  }

  next();
};
