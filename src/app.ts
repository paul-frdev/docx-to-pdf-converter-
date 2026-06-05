import express, { Request, Response } from 'express';
import cors from 'cors';
import { initSentry } from './infrastructure/logging/sentry';
import conversionRoutes from './infrastructure/http/routes/conversionRoutes';
import { errorHandler } from './infrastructure/http/middleware/ErrorHandlerMiddleware';

// Initialize Sentry error tracking
initSentry();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    engine: process.env.CONVERTER_ENGINE || 'office',
    env: process.env.NODE_ENV || 'development'
  });
});

// Register API routes
app.use('/api', conversionRoutes);

// Register custom centralized error handler
app.use(errorHandler);

export default app;
