import { describe, expect, it, vi } from "vitest";

import { withTimeout } from "../src/utils/timeout.js";

describe("withTimeout", () => {
  it("returns the result when work finishes before timeout", async () => {
    const result = await withTimeout(async () => {
      return "completed";
    }, 1_000);

    expect(result).toBe("completed");
  });

  it("rejects when work exceeds the timeout", async () => {
    const operation = vi.fn(async (signal: AbortSignal) => {
      return await new Promise<string>((_resolve, reject) => {
        const handleAbort = () => {
          reject(signal.reason);
        };

        signal.addEventListener("abort", handleAbort, {
          once: true
        });
      });
    });

    await expect(withTimeout(operation, 5)).rejects.toMatchObject({
      code: "TIMEOUT"
    });

    expect(operation).toHaveBeenCalledOnce();

    const receivedSignal = operation.mock.calls[0]?.[0];

    expect(receivedSignal?.aborted).toBe(true);
  });

  it("supports external cancellation", async () => {
    const controller = new AbortController();

    const operation = vi.fn(async (signal: AbortSignal) => {
      return await new Promise<string>((_resolve, reject) => {
        const handleAbort = () => {
          reject(signal.reason);
        };

        signal.addEventListener("abort", handleAbort, {
          once: true
        });
      });
    });

    const resultPromise = withTimeout(operation, 30_000, controller.signal);

    controller.abort("Cancelled by caller");

    await expect(resultPromise).rejects.toMatchObject({
      code: "REQUEST_ABORTED"
    });
  });

  it("rejects immediately when the external signal is already aborted", async () => {
    const controller = new AbortController();

    controller.abort("Already cancelled");

    const operation = vi.fn(async () => "completed");

    await expect(withTimeout(operation, 30_000, controller.signal)).rejects.toMatchObject({
      code: "REQUEST_ABORTED"
    });

    expect(operation).not.toHaveBeenCalled();
  });
});
