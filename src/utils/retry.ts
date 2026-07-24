import { AIClientError } from "../errors/ai-client.error.js";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  shouldRetry?: (error: unknown) => boolean;
  random?: () => number;
}

const NON_RETRYABLE_ERROR_CODES = new Set([
  "INVALID_PROMPT",
  "INVALID_CONFIGURATION",
  "UNSUPPORTED_PROVIDER",
  "INVALID_PROVIDER_RESPONSE",
  "REQUEST_ABORTED",
  "TIMEOUT"
]);

function defaultShouldRetry(error: unknown): boolean {
  if (!(error instanceof AIClientError)) {
    return true;
  }

  return !NON_RETRYABLE_ERROR_CODES.has(error.code);
}

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
    const handleAbort = () => {
      clearTimeout(timeoutHandle);
      removeAbortListener();

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

    const timeoutHandle = setTimeout(() => {
      removeAbortListener();
      resolve();
    }, delayMs);

    signal?.addEventListener("abort", handleAbort, {
      once: true
    });
  });
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const maxDelayMs = options.maxDelayMs ?? 30_000;

  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

  const random = options.random ?? Math.random;

  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    throwIfAborted(options.signal);

    try {
      return await operation();
    } catch (error) {
      lastError = error;

      throwIfAborted(options.signal);

      if (!shouldRetry(error)) {
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

      const exponentialDelay = options.baseDelayMs * 2 ** attempt;

      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

      const jitteredDelay = Math.floor(random() * cappedDelay);

      await waitForDelay(jitteredDelay, options.signal);
    }
  }

  throw new AIClientError("Maximum retries exceeded", "MAX_RETRIES_EXCEEDED", {
    cause: lastError
  });
}
