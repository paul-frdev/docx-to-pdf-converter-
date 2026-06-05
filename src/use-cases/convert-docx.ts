import { performance } from 'perf_hooks';
import { DocumentEntity } from '../domain/entities/DocumentEntity';
import { IConverterService } from '../domain/interfaces/IConverterService';
import { ConversionError, ConversionFailedError } from '../domain/errors/ConversionError';
import { ConvertDocxInputDTO, ConvertDocxOutputDTO } from './dto/dto';

export class ConvertDocxToPdfUseCase {
  constructor(private readonly converterService: IConverterService) {}

  public async execute(input: ConvertDocxInputDTO): Promise<ConvertDocxOutputDTO> {
    // Create and validate the DocumentEntity
    const document = DocumentEntity.create({
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      buffer: input.buffer
    });

    const startTime = performance.now();
    let pdfBuffer: Buffer;

    try {
      // Perform the conversion using the injected service
      pdfBuffer = await this.converterService.convert(document.buffer);
    } catch (error: any) {
      // Ensure any thrown error is wrapped in a domain-specific ConversionError subclass
      if (error instanceof ConversionError) {
        throw error;
      }
      throw new ConversionFailedError(
        'Document conversion engine failed',
        error.message || String(error)
      );
    }

    const endTime = performance.now();
    const totalDurationMs = endTime - startTime;

    // Resolve output filename (.docx -> .pdf)
    const originalNameWithoutExt = document.fileName.substring(
      0,
      document.fileName.lastIndexOf('.')
    );
    const pdfFileName = `${originalNameWithoutExt}.pdf`;

    return {
      pdfBuffer,
      fileName: pdfFileName,
      totalDurationMs
    };
  }
}
