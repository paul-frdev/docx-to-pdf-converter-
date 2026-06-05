/**
 * Input Data Transfer Object for the conversion use-case
 */
export interface ConvertDocxInputDTO {
  fileName: string;
  fileSize: number;
  mimeType: string;
  buffer: Buffer;
  preserveMetadata?: boolean;
}

/**
 * Output Data Transfer Object for the conversion use-case
 */
export interface ConvertDocxOutputDTO {
  pdfBuffer: Buffer;
  fileName: string;
  totalDurationMs: number;
}
