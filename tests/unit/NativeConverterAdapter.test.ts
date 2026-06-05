import { NativeConverterAdapter } from '../../src/infrastructure/adapters/native/NativeConverterAdapter';
import * as mammoth from 'mammoth';

jest.mock('mammoth');

describe('NativeConverterAdapter', () => {
  let adapter: NativeConverterAdapter;

  beforeEach(() => {
    adapter = new NativeConverterAdapter();
    jest.clearAllMocks();
  });

  it('should successfully convert docx buffer to PDF buffer when mammoth parsing succeeds', async () => {
    const mockHtml = '<h1>My Header</h1><p>Paragraph text</p><ul><li>List Item</li></ul>';
    (mammoth.convertToHtml as jest.Mock).mockResolvedValue({ value: mockHtml });

    const docxBuffer = Buffer.from('mock docx');
    const pdfBuffer = await adapter.convert(docxBuffer);

    expect(mammoth.convertToHtml).toHaveBeenCalledWith({ buffer: docxBuffer });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    // PDF Magic number verification
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should fallback to plain text parsing if mammoth returns raw text without structural tags', async () => {
    const mockTextOnly = 'Plain text paragraph with no tags whatsoever';
    (mammoth.convertToHtml as jest.Mock).mockResolvedValue({ value: mockTextOnly });

    const pdfBuffer = await adapter.convert(Buffer.from('mock docx'));

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('should throw ConversionFailedError when mammoth conversion fails', async () => {
    (mammoth.convertToHtml as jest.Mock).mockRejectedValue(new Error('Mammoth parsing failure'));

    await expect(adapter.convert(Buffer.from('mock docx'))).rejects.toThrow(
      'Native JS conversion failed: Mammoth parsing failure'
    );
  });
});
