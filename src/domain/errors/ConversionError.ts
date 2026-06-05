export class ConversionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidFileError extends ConversionError {
  constructor(message: string) {
    super(message, 'INVALID_FILE', 400);
  }
}

export class ConversionFailedError extends ConversionError {
  constructor(message: string, details?: string) {
    super(details ? `${message}: ${details}` : message, 'CONVERSION_FAILED', 500);
  }
}

export class EngineNotAvailableError extends ConversionError {
  constructor(message: string) {
    super(message, 'ENGINE_NOT_AVAILABLE', 500);
  }
}
