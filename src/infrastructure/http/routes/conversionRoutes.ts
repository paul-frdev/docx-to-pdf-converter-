import { Router } from 'express';
import * as path from 'path';
import { ConversionController } from '../controllers/ConversionController';
import { upload } from '../middleware/UploadMiddleware';
import { docxSignatureValidator } from '../middleware/docxSignatureValidator';
import { ConvertDocxToPdfUseCase } from '../../../use-cases/convert-docx';
import { LibreOfficeConverterAdapter } from '../../adapters/office/LibreOfficeConverterAdapter';
import { NativeConverterAdapter } from '../../adapters/native/NativeConverterAdapter';

const router = Router();

// Map POST /api/v1/convert
router.post(
  '/v1/convert',
  upload.single('file'),
  docxSignatureValidator,
  (req, res, next) => {
    // Resolve configurations dynamically at request time to support test overrides
    const engine = process.env.CONVERTER_ENGINE || 'office';
    const binaryPath =
      process.env.LIBREOFFICE_BINARY_PATH ||
      process.env.LIBREOFFICE_PATH ||
      '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    const temporaryDir = process.env.TEMPORARY_DIR || path.join(process.cwd(), 'temp');
    const timeoutMs = parseInt(process.env.CONVERSION_TIMEOUT_MS || '15000', 10);

    const converterService =
      engine === 'native'
        ? new NativeConverterAdapter()
        : new LibreOfficeConverterAdapter({
            binaryPath,
            temporaryDir,
            timeoutMs
          });

    const convertUseCase = new ConvertDocxToPdfUseCase(converterService);
    const controller = new ConversionController(convertUseCase);

    controller.convert(req, res, next);
  }
);

export default router;
