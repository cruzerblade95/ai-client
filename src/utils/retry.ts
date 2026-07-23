import { AIClientError } from "../errors/ai-client.error.js";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

const NON_RETRYABLE_ERROR_CODES = new Set([
  "INVALID_PROMPT",
  "INVALID_CONFIGURATION",
  "UNSUPPORTED_PROVIDER",
]);

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= options.maxRetries;
    attempt++
  ) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Do not retry known non-retryable errors.
      if (
        error instanceof AIClientError &&
        NON_RETRYABLE_ERROR_CODES.has(error.code)
      ) {
        throw error;
      }

      // Final attempt.
      if (attempt === options.maxRetries) {
        if (error instanceof AIClientError) {
          throw error;
        }

        throw new AIClientError(
          "Maximum retries exceeded",
          "MAX_RETRIES_EXCEEDED",
          {
            cause: error,
          },
        );
      }

      const delay =
        options.baseDelayMs * 2 ** attempt;

      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }

  throw new AIClientError(
    "Maximum retries exceeded",
    "MAX_RETRIES_EXCEEDED",
    {
      cause: lastError,
    },
  );
}