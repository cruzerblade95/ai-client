import { AIClientError } from "../errors/ai-client.error.js";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AIClientError && error.code === "INVALID_PROMPT") {
        throw error;
      }

      if (attempt >= options.maxRetries) {
        throw new AIClientError("Maximum retries exceeded", "MAX_RETRIES_EXCEEDED", {
          cause: error
        });
      }

      const delay = options.baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}
