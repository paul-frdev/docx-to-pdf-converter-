import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import app from './app';
import { Logger } from './infrastructure/logging/Logger';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  Logger.info(
    `Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
  );
});

// Handle graceful shutdown
const gracefulShutdown = (signal: string) => {
  Logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    Logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
