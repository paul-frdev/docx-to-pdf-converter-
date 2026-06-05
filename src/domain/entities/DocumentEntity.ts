import { InvalidFileError } from '../errors/ConversionError';

export interface DocumentProps {
  fileName: string;
  fileSize: number;
  mimeType: string;
  buffer: Buffer;
}

export class DocumentEntity {
  private constructor(private readonly props: DocumentProps) {}

  public static create(props: DocumentProps): DocumentEntity {
    this.validate(props);
    return new DocumentEntity(props);
  }

  private static validate(props: DocumentProps): void {
    if (!props.fileName) {
      throw new InvalidFileError('File name is required');
    }

    if (!props.buffer || props.buffer.length === 0) {
      throw new InvalidFileError('File buffer cannot be empty');
    }

    // Validate size (max 25MB)
    const MAX_SIZE = 26214400; // 25MB
    if (props.fileSize > MAX_SIZE || props.buffer.length > MAX_SIZE) {
      throw new InvalidFileError('File size exceeds the maximum limit of 25MB');
    }

    // Validate extension
    const extension = props.fileName.split('.').pop()?.toLowerCase();
    if (extension !== 'docx') {
      throw new InvalidFileError('Invalid file extension. Only .docx is supported');
    }

    // Validate mime-type
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream' // fallback
    ];
    if (!allowedMimeTypes.includes(props.mimeType)) {
      if (
        props.mimeType.startsWith('image/') ||
        props.mimeType.startsWith('audio/') ||
        props.mimeType.startsWith('video/') ||
        props.mimeType === 'application/pdf'
      ) {
        throw new InvalidFileError(`Invalid file format: ${props.mimeType}`);
      }
    }
  }

  public get fileName(): string {
    return this.props.fileName;
  }

  public get fileSize(): number {
    return this.props.fileSize;
  }

  public get mimeType(): string {
    return this.props.mimeType;
  }

  public get buffer(): Buffer {
    return this.props.buffer;
  }
}
