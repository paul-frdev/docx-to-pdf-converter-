import { ConvertDocxToPdfUseCase } from '../../../src/use-cases/convert-docx';
import { IConverterService } from '../../../src/domain/interfaces/IConverterService';
import { ConversionFailedError } from '../../../src/domain/errors/ConversionError';

describe('ConvertDocxToPdfUseCase (Unit Tests)', () => {
  let mockConverter: jest.Mocked<IConverterService>;
  let useCase: ConvertDocxToPdfUseCase;

  beforeEach(() => {
    mockConverter = {
      convert: jest.fn()
    };
    useCase = new ConvertDocxToPdfUseCase(mockConverter);
  });

  it('should successfully calculate duration and return a valid DTO output structure', async () => {
    const fakeBuffer = Buffer.from('%PDF-1.4 output');
    mockConverter.convert.mockResolvedValue(fakeBuffer);

    const input = {
      fileName: 'my-resume.docx',
      fileSize: 100,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('mock docx content')
    };

    const result = await useCase.execute(input);

    expect(mockConverter.convert).toHaveBeenCalledWith(input.buffer);
    expect(result.fileName).toBe('my-resume.pdf');
    expect(result.pdfBuffer).toEqual(fakeBuffer);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.totalDurationMs).toBe('number');
  });

  it('should wrap generic errors thrown by the converter service into ConversionFailedError', async () => {
    mockConverter.convert.mockRejectedValue(new Error('Low-level socket failure'));

    const input = {
      fileName: 'my-resume.docx',
      fileSize: 100,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('mock docx content')
    };

    await expect(useCase.execute(input)).rejects.toThrow(ConversionFailedError);
    await expect(useCase.execute(input)).rejects.toThrow(
      'Document conversion engine failed: Low-level socket failure'
    );
  });

  it('should propagate ConversionError subclasses unmodified', async () => {
    const customError = new ConversionFailedError('Specific error message');
    mockConverter.convert.mockRejectedValue(customError);

    const input = {
      fileName: 'my-resume.docx',
      fileSize: 100,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('mock docx content')
    };

    await expect(useCase.execute(input)).rejects.toThrow(customError);
  });
});
