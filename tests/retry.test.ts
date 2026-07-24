import { describe, expect, it, vi } from "vitest";
import { retryWithBackoff } from "../src/utils/retry.js";
import { AIClientError } from "../src/errors/ai-client.error.js";

describe("retryWithBackoff", () => {
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
      { maxRetries: 3, baseDelayMs: 1 }
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry invalid input errors", async () => {
    const fn = vi.fn(async () => {
      throw new AIClientError("Bad input", "INVALID_PROMPT");
    });

    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toMatchObject({
      code: "INVALID_PROMPT"
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("stops retrying when the signal is aborted", async () => {
    const controller = new AbortController();

    const operation = vi.fn(async () => {
      controller.abort(new AIClientError("Operation was aborted", "REQUEST_ABORTED"));

      throw new Error("Temporary failure");
    });

    await expect(
      retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelayMs: 1,
        signal: controller.signal
      })
    ).rejects.toMatchObject({
      code: "REQUEST_ABORTED"
    });

    expect(operation).toHaveBeenCalledOnce();
  });
});
