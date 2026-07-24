import { AIClientError } from "../errors/ai-client.error.js";

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  let removeExternalAbortListener: (() => void) | undefined;

  if (externalSignal?.aborted) {
    throw new AIClientError("Operation was aborted", "REQUEST_ABORTED", {
      cause: externalSignal.reason
    });
  }

  const cancellationPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      const timeoutError = new AIClientError("Operation timed out", "TIMEOUT");

      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);

    if (externalSignal) {
      const handleExternalAbort = () => {
        const abortedError = new AIClientError("Operation was aborted", "REQUEST_ABORTED", {
          cause: externalSignal.reason
        });

        controller.abort(abortedError);
        reject(abortedError);
      };

      externalSignal.addEventListener("abort", handleExternalAbort, {
        once: true
      });

      removeExternalAbortListener = () => {
        externalSignal.removeEventListener("abort", handleExternalAbort);
      };
    }
  });

  try {
    return await Promise.race([operation(controller.signal), cancellationPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }

    removeExternalAbortListener?.();
  }
}
