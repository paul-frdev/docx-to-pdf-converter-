import * as Sentry from '@sentry/node';

/**
 * Initializes Sentry integration if SENTRY_DSN is configured.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0
    });
    console.log('[Sentry] Sentry error tracking initialized successfully.');
  } else {
    console.log('[Sentry] Sentry tracking omitted (no DSN configured).');
  }
}
