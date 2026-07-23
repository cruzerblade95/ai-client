import { describe, expect, it } from "vitest";
import { withTimeout } from "../src/utils/timeout.js";
import { AIClientError } from "../src/errors/ai-client.error.js";

describe("withTimeout", () => {
  it("rejects when work exceeds the timeout", async () => {
    const promise = withTimeout(
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("late"), 30);
      }),
      5
    );

    await expect(promise).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
