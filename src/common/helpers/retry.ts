import { sleep } from "./sleep";

interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoff?: boolean;
}

/**
 * Retries a promise-based function with configurable attempts and delay
 * @param fn Function to retry
 * @param options Retry configuration
 * @returns Result of the function call
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  const { maxAttempts, delayMs, backoff = false } = options;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = backoff ? delayMs * attempt : delayMs;
      await sleep(delay);
    }
  }

  throw lastError!;
};
