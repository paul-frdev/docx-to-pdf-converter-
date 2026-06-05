import { DocumentEntity } from '../../src/domain/entities/DocumentEntity';
import { InvalidFileError } from '../../src/domain/errors/ConversionError';

describe('DocumentEntity', () => {
  const validBuffer = Buffer.from('mock docx content');

  it('should create a valid DocumentEntity instance with proper properties', () => {
    const doc = DocumentEntity.create({
      fileName: 'test.docx',
      fileSize: validBuffer.length,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: validBuffer
    });

    expect(doc.fileName).toBe('test.docx');
    expect(doc.fileSize).toBe(validBuffer.length);
    expect(doc.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(doc.buffer).toEqual(validBuffer);
  });

  it('should throw InvalidFileError if fileName is empty', () => {
    expect(() => {
      DocumentEntity.create({
        fileName: '',
        fileSize: validBuffer.length,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: validBuffer
      });
    }).toThrow(InvalidFileError);
  });

  it('should throw InvalidFileError if buffer is empty', () => {
    expect(() => {
      DocumentEntity.create({
        fileName: 'test.docx',
        fileSize: 0,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.alloc(0)
      });
    }).toThrow(InvalidFileError);
  });

  it('should throw InvalidFileError if file extension is not .docx', () => {
    expect(() => {
      DocumentEntity.create({
        fileName: 'test.pdf',
        fileSize: validBuffer.length,
        mimeType: 'application/pdf',
        buffer: validBuffer
      });
    }).toThrow(InvalidFileError);
  });

  it('should throw InvalidFileError if size exceeds 25MB', () => {
    const largeBuffer = Buffer.alloc(26214400 + 1); // 25MB + 1 byte
    expect(() => {
      DocumentEntity.create({
        fileName: 'large.docx',
        fileSize: largeBuffer.length,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: largeBuffer
      });
    }).toThrow(InvalidFileError);
  });

  it('should throw InvalidFileError if mimeType is obviously invalid', () => {
    expect(() => {
      DocumentEntity.create({
        fileName: 'test.docx',
        fileSize: validBuffer.length,
        mimeType: 'image/png',
        buffer: validBuffer
      });
    }).toThrow(InvalidFileError);
  });

  it('should accept application/octet-stream fallback mime-type', () => {
    const doc = DocumentEntity.create({
      fileName: 'fallback.docx',
      fileSize: validBuffer.length,
      mimeType: 'application/octet-stream',
      buffer: validBuffer
    });
    expect(doc.fileName).toBe('fallback.docx');
  });
});
