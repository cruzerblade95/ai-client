import { AIClientError } from "../errors/ai-client.error.js";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  signal?: AbortSignal;
}

const NON_RETRYABLE_ERROR_CODES = new Set([
  "INVALID_PROMPT",
  "INVALID_CONFIGURATION",
  "UNSUPPORTED_PROVIDER",
  "INVALID_PROVIDER_RESPONSE",
  "REQUEST_ABORTED",
  "TIMEOUT"
]);

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  if (signal.reason instanceof Error) {
    throw signal.reason;
  }

  throw new AIClientError("Operation was aborted", "REQUEST_ABORTED", {
    cause: signal.reason
  });
}

async function waitForDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);

  await new Promise<void>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      removeAbortListener();
      resolve();
    }, delayMs);

    const handleAbort = () => {
      clearTimeout(timeoutHandle);

      if (signal?.reason instanceof Error) {
        reject(signal.reason);
        return;
      }

      reject(
        new AIClientError("Operation was aborted", "REQUEST_ABORTED", {
          cause: signal?.reason
        })
      );
    };

    const removeAbortListener = () => {
      signal?.removeEventListener("abort", handleAbort);
    };

    signal?.addEventListener("abort", handleAbort, {
      once: true
    });
  });
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    throwIfAborted(options.signal);

    try {
      return await operation();
    } catch (error) {
      lastError = error;

      throwIfAborted(options.signal);

      if (error instanceof AIClientError && NON_RETRYABLE_ERROR_CODES.has(error.code)) {
        throw error;
      }

      if (attempt === options.maxRetries) {
        if (error instanceof AIClientError) {
          throw error;
        }

        throw new AIClientError("Maximum retries exceeded", "MAX_RETRIES_EXCEEDED", {
          cause: error
        });
      }

      const delay = options.baseDelayMs * 2 ** attempt;

      await waitForDelay(delay, options.signal);
    }
  }

  throw new AIClientError("Maximum retries exceeded", "MAX_RETRIES_EXCEEDED", {
    cause: lastError
  });
}
