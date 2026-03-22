/**
 * Simple logger that suppresses output in production.
 * Use instead of console.error/console.warn to avoid leaking
 * implementation details in production browser consoles.
 */
export const logger = {
  error: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(...args);
    }
  },
};
