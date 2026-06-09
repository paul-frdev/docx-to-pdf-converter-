import { LibreOfficeConverterAdapter } from '../../../src/infrastructure/adapters/office/LibreOfficeConverterAdapter';
import { execFile } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');

// Define global mock for module structure definition
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
    rm: jest.fn()
  }
}));

describe('LibreOfficeConverterAdapter Unit Tests', () => {
  let adapter: LibreOfficeConverterAdapter;
  const mockConfig = {
    binaryPath: '/mock/path/soffice',
    temporaryDir: '/mock/temp',
    timeoutMs: 50
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-apply mock implementations inside beforeEach block
    // to bypass Jest's resetMocks: true configuration
    (fs.existsSync as unknown as jest.Mock).mockReturnValue(true);
    (fs.promises.mkdir as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.readFile as unknown as jest.Mock).mockResolvedValue(
      Buffer.from('%PDF-1.4 mocked output')
    );
    (fs.promises.unlink as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.access as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.rm as unknown as jest.Mock).mockResolvedValue(undefined);

    adapter = new LibreOfficeConverterAdapter(mockConfig);
  });

  it('should successfully convert DOCX to PDF', async () => {
    // Mock successful execFile call
    (execFile as unknown as jest.Mock).mockImplementation((_file, _args, callback) => {
      setImmediate(() => callback(null, 'convert success stdout', ''));
      return {
        kill: jest.fn()
      };
    });

    const docxBuffer = Buffer.from('docx content');
    const resultBuffer = await adapter.convert(docxBuffer);

    expect(execFile).toHaveBeenCalledWith(
      mockConfig.binaryPath,
      expect.arrayContaining([
        '--headless',
        '--convert-to',
        'pdf:writer_pdf_Export',
        '--outdir',
        mockConfig.temporaryDir
      ]),
      expect.any(Function)
    );
    expect(resultBuffer.toString()).toBe('%PDF-1.4 mocked output');
  });

  it('should throw ConversionError when LibreOffice execution fails', async () => {
    // Mock failed execFile call (exit code non-zero)
    (execFile as unknown as jest.Mock).mockImplementation((_file, _args, callback) => {
      setImmediate(() =>
        callback(new Error('Process exited with code 1'), '', 'LibreOffice crash dump')
      );
      return {
        kill: jest.fn()
      };
    });

    const docxBuffer = Buffer.from('docx content');
    await expect(adapter.convert(docxBuffer)).rejects.toThrow(
      'LibreOffice failed: LibreOffice crash dump'
    );
  });

  it('should trigger timeout limit, kill the process, and throw timeout error', async () => {
    const mockKill = jest.fn();
    (execFile as unknown as jest.Mock).mockImplementation((_file, _args, _callback) => {
      // Process hangs indefinitely
      return {
        kill: mockKill
      };
    });

    const docxBuffer = Buffer.from('docx content');
    const convertPromise = adapter.convert(docxBuffer);

    await expect(convertPromise).rejects.toThrow('LibreOffice conversion timed out');
    expect(mockKill).toHaveBeenCalledWith('SIGKILL');
  });
});
