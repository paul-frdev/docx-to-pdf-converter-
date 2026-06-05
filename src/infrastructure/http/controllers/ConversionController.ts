import { Response, NextFunction } from 'express';
import { ValidatedConversionRequest, HttpErrorResponse } from '../../../shared/types';
import { ConvertDocxToPdfUseCase } from '../../../use-cases/convert-docx';
import { IConverterService } from '../../../domain/interfaces/IConverterService';
import { Logger } from '../../logging/Logger';

/**
 * Temporary mocked implementation of IConverterService.
 * Returns a simulated PDF buffer after a 300ms delay.
 */
class MockConverterService implements IConverterService {
  public async convert(_fileBuffer: Buffer): Promise<Buffer> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return Buffer.from('%PDF-1.4 mock pdf document content');
  }
}

export class ConversionController {
  private readonly useCase: ConvertDocxToPdfUseCase;

  constructor(convertUseCase?: ConvertDocxToPdfUseCase) {
    // Default to the actual Use Case containing the 300ms MockConverterService
    this.useCase = convertUseCase || new ConvertDocxToPdfUseCase(new MockConverterService());
  }

  public async convert(
    req: ValidatedConversionRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        const errorResponse: HttpErrorResponse = {
          error: {
            code: 'INVALID_FILE',
            message: 'No file uploaded'
          }
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Parse body parameters and convert preserveMetadata to a boolean
      let preserveMetadata = false;
      if (req.body.preserveMetadata !== undefined) {
        const val = req.body.preserveMetadata;
        preserveMetadata = val === true || val === 'true' || val === '1' || val === 1;
      }

      Logger.info(`Controller invoking ConvertDocxToPdfUseCase. preserveMetadata: ${preserveMetadata}`);

      const result = await this.useCase.execute({
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
        preserveMetadata
      });

      // Respond with the PDF buffer and output headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('Content-Length', result.pdfBuffer.length);
      res.setHeader('X-Conversion-Time-Ms', result.totalDurationMs.toFixed(2));

      res.status(200).send(result.pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}
