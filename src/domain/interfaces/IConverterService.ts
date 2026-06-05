import { ConversionEngineOptions } from '../../shared/types';

export interface IConverterService {
  convert(fileBuffer: Buffer, options?: ConversionEngineOptions): Promise<Buffer>;
}
