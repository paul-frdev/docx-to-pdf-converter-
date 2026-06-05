import { Request, Response, NextFunction } from 'express';
import { ConversionError } from '../../../domain/errors/ConversionError';
import { Logger } from '../../logging/Logger';
import { HttpErrorResponse } from '../../../shared/types';
import multer from 'multer';
import * as Sentry from '@sentry/node';

/**
 * Express error handler middleware.
 * Maps custom domain exceptions and Multer limits (like LIMIT_FILE_SIZE) to standardized HttpErrorResponse formats.
 * Captures and sends unhandled 500 errors to Sentry.
 */
export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // Handle custom domain exceptions
  if (error instanceof ConversionError) {
    Logger.warn(`Domain Validation Error [${error.code}]: ${error.message}`);
    const errorResponse: HttpErrorResponse = {
      error: {
        code: error.code,
        message: error.message
      }
    };
    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle Multer upload limits and validation errors
  if (error instanceof multer.MulterError) {
    Logger.warn(`Multer Upload Constraint violated: ${error.message}`);

    if (error.code === 'LIMIT_FILE_SIZE') {
      const errorResponse: HttpErrorResponse = {
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'File size exceeds the maximum limit of 25MB'
        }
      };
      res.status(413).json(errorResponse);
      return;
    }

    const errorResponse: HttpErrorResponse = {
      error: {
        code: 'INVALID_FILE',
        message: error.message
      }
    };
    res.status(400).json(errorResponse);
    return;
  }

  // Fallback handler for unhandled server errors (500)
  Logger.error('Unhandled server-side exception:', error);

  // Send to Sentry if active
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }

  const errorResponse: HttpErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred during document conversion'
    }
  };
  res.status(500).json(errorResponse);
};
