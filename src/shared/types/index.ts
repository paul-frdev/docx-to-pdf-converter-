import { Request } from 'express';

/**
 * Configuration for the LibreOffice converter adapter
 */
export interface LibreOfficeAdapterConfig {
  binaryPath: string;
  temporaryDir: string;
  timeoutMs: number;
}

/**
 * Options passing specific execution details to conversion engine
 */
export interface ConversionEngineOptions {
  preserveMetadata?: boolean;
}

/**
 * Application config settings mapping to .env values
 */
export interface AppConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  converterEngine: 'office' | 'native';
  libreOfficePath: string;
  sentryDsn?: string;
}

/**
 * Result structure for conversion process
 */
export interface ConversionResult {
  pdfBuffer: Buffer;
  fileName: string;
}

/**
 * Request containing a validated file and payload body parameters
 */
export interface ValidatedConversionRequest extends Request {
  file?: Express.Multer.File;
  body: {
    preserveMetadata?: any;
    [key: string]: any;
  };
}

/**
 * Normalized HTTP error response shape
 */
export interface HttpErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
