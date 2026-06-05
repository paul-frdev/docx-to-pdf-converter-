import * as winston from 'winston';
import * as Sentry from '@sentry/node';

const logFormat = winston.format.printf(({ timestamp, level, message, ...metadata }) => {
  let msg = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
  if (metadata && Object.keys(metadata).length > 0 && metadata.metadata && Object.keys(metadata.metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata.metadata)}`;
  }
  return msg;
});

const winstonLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

export const Logger = {
  info: (message: string, meta?: any) => {
    winstonLogger.info(message, meta);
  },
  warn: (message: string, meta?: any) => {
    winstonLogger.warn(message, meta);
  },
  error: (message: string, error?: any, meta?: any) => {
    winstonLogger.error(message, { error, ...meta });
    if (error && process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: { message, ...meta }
      });
    }
  },
  debug: (message: string, meta?: any) => {
    winstonLogger.debug(message, meta);
  }
};
