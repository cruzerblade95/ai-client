import { afterEach, describe, expect, it, vi } from "vitest";

import { retryWithBackoff } from "../src/utils/retry.js";

import { AIClientError } from "../src/errors/ai-client.error.js";

describe("retryWithBackoff", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns without retrying when the first attempt succeeds", async () => {
    const operation = vi.fn().mockResolvedValue("success");

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      baseDelayMs: 1,
      random: () => 0
    });

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledOnce();
  });

  it("retries provider errors until success", async () => {
    let attempts = 0;

    const result = await retryWithBackoff(
      async () => {
        attempts += 1;

        if (attempts < 3) {
          throw new AIClientError("Temporary issue", "PROVIDER_ERROR");
        }

        return "ok";
      },
      {
        maxRetries: 3,
        baseDelayMs: 1,
        random: () => 0
      }
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry invalid input errors", async () => {
    const operation = vi.fn(async () => {
      throw new AIClientError("Bad input", "INVALID_PROMPT");
    });

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelayMs: 1,
        random: () => 0
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROMPT"
    });

    expect(operation).toHaveBeenCalledOnce();
  });

  it("throws MAX_RETRIES_EXCEEDED for unknown errors", async () => {
    const originalError = new Error("Network failed");

    const operation = vi.fn().mockRejectedValue(originalError);

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 2,
        baseDelayMs: 1,
        random: () => 0
      })
    ).rejects.toMatchObject({
      code: "MAX_RETRIES_EXCEEDED",
      cause: originalError
    });

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("preserves an AIClientError after retries are exhausted", async () => {
    const providerError = new AIClientError("Provider unavailable", "PROVIDER_ERROR");

    const operation = vi.fn().mockRejectedValue(providerError);

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 2,
        baseDelayMs: 1,
        random: () => 0
      })
    ).rejects.toBe(providerError);

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("caps the retry delay at maxDelayMs", async () => {
    vi.useFakeTimers();

    const providerError = new AIClientError("Temporary issue", "PROVIDER_ERROR");

    const operation = vi.fn().mockRejectedValue(providerError);

    const resultPromise = retryWithBackoff(operation, {
      maxRetries: 1,
      baseDelayMs: 1_000,
      maxDelayMs: 50,
      random: () => 1
    });

    const rejectionExpectation = expect(resultPromise).rejects.toBe(providerError);

    await vi.advanceTimersByTimeAsync(49);

    expect(operation).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1);

    await rejectionExpectation;

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("allows a custom retry decision", async () => {
    const operation = vi.fn(async () => {
      throw new Error("Custom non-retryable error");
    });

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelayMs: 1,
        shouldRetry: () => false,
        random: () => 0
      })
    ).rejects.toThrow("Custom non-retryable error");

    expect(operation).toHaveBeenCalledOnce();
  });

  it("stops retrying when the signal is aborted", async () => {
    const controller = new AbortController();

    const abortedError = new AIClientError("Operation was aborted", "REQUEST_ABORTED");

    const operation = vi.fn(async () => {
      controller.abort(abortedError);

      throw new Error("Temporary failure");
    });

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelayMs: 1,
        signal: controller.signal,
        random: () => 0
      })
    ).rejects.toBe(abortedError);

    expect(operation).toHaveBeenCalledOnce();
  });

  it.each(["AUTHENTICATION_ERROR", "ACCESS_DENIED", "MODEL_NOT_FOUND", "INVALID_REQUEST"] as const)(
    "does not retry %s",
    async (code) => {
      const operation = vi.fn(async () => {
        throw new AIClientError("Permanent error", code);
      });

      await expect(
        retryWithBackoff(operation, {
          maxRetries: 3,
          baseDelayMs: 1,
          random: () => 0
        })
      ).rejects.toMatchObject({
        code
      });

      expect(operation).toHaveBeenCalledOnce();
    }
  );

  it.each(["RATE_LIMITED", "NETWORK_ERROR", "PROVIDER_UNAVAILABLE"] as const)(
    "retries temporary error %s",
    async (code) => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new AIClientError("Temporary error", code))
        .mockResolvedValueOnce("success");

      const result = await retryWithBackoff(operation, {
        maxRetries: 1,
        baseDelayMs: 1,
        random: () => 0
      });

      expect(result).toBe("success");

      expect(operation).toHaveBeenCalledTimes(2);
    }
  );
});
