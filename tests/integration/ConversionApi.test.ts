import request from 'supertest';
import app from '../../src/app';
import { NativeConverterAdapter } from '../../src/infrastructure/adapters/native/NativeConverterAdapter';

jest.mock('../../src/infrastructure/adapters/native/NativeConverterAdapter');

describe('Conversion HTTP API Integration Tests (v1)', () => {
  beforeAll(() => {
    process.env.CONVERTER_ENGINE = 'native';
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    (NativeConverterAdapter as jest.Mock).mockImplementation(() => {
      return {
        convert: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock pdf document content'))
      };
    });
  });

  describe('GET /health', () => {
    it('should return health check status OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'OK',
        engine: 'native',
        env: 'test'
      });
    });
  });

  describe('POST /api/v1/convert', () => {
    it('should successfully convert a valid mockup buffer starting with ZIP/OOXML signature (504B0304)', async () => {
      // Create a valid ZIP/OOXML signature (50 4B 03 04)
      const validMockupBuffer = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('mock zip archive content')
      ]);

      const res = await request(app)
        .post('/api/v1/convert')
        .attach('file', validMockupBuffer, 'document.docx')
        .field('preserveMetadata', 'true');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('application/pdf');
      expect(res.header['content-disposition']).toBe('attachment; filename="document.pdf"');
      expect(res.body.toString()).toBe('%PDF-1.4 mock pdf document content');
    });

    it('should reject a file exceeding the maximum limit of 25MB with 413 Payload Too Large', async () => {
      // Create a large buffer (25MB + 1 byte)
      const largeBuffer = Buffer.alloc(26214400 + 1);
      // Write ZIP signature to the beginning
      largeBuffer.writeUInt32BE(0x504b0304, 0);

      const res = await request(app)
        .post('/api/v1/convert')
        .attach('file', largeBuffer, 'huge-document.docx');

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(res.body.error.message).toContain('exceeds the maximum limit');
    });

    it('should reject a .docx file that contains plain text (invalid signature) with 400 Bad Request', async () => {
      const plainTextBuffer = Buffer.from(
        'This is raw ASCII plain text and does not start with ZIP magic bytes.'
      );

      const res = await request(app)
        .post('/api/v1/convert')
        .attach('file', plainTextBuffer, 'fake-doc.docx');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
      expect(res.body.error.message).toContain('Invalid file signature');
    });

    it('should return 400 Bad Request if no file is uploaded', async () => {
      const res = await request(app).post('/api/v1/convert').send();

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE');
      expect(res.body.error.message).toBe('No file uploaded');
    });

    it('should return 400 Bad Request if file extension is not docx', async () => {
      const validZipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

      const res = await request(app)
        .post('/api/v1/convert')
        .attach('file', validZipSignature, 'document.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE');
      expect(res.body.error.message).toContain('Only .docx is supported');
    });
  });
});
