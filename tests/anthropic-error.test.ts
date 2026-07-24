import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AIClientError, type AIClientErrorCode } from "../src/errors/ai-client.error.js";
import { mapAnthropicError } from "../src/providers/anthropic-error.js";

function createApiError(status: number, message = "Anthropic API error") {
  return new Anthropic.APIError(status, {}, message, new Headers());
}

describe("mapAnthropicError", () => {
  it("preserves an existing AIClientError", () => {
    const original = new AIClientError("Existing error", "INVALID_REQUEST");

    expect(mapAnthropicError(original)).toBe(original);
  });

  it("maps user cancellation", () => {
    const result = mapAnthropicError(new Anthropic.APIUserAbortError());

    expect(result).toMatchObject({
      code: "REQUEST_ABORTED"
    });
  });

  it("maps connection timeouts", () => {
    const result = mapAnthropicError(new Anthropic.APIConnectionTimeoutError());

    expect(result).toMatchObject({
      code: "TIMEOUT"
    });
  });

  it("maps connection errors", () => {
    const result = mapAnthropicError(
      new Anthropic.APIConnectionError({
        cause: new Error("Network unavailable")
      })
    );

    expect(result).toMatchObject({
      code: "NETWORK_ERROR"
    });
  });

  it.each<[number, AIClientErrorCode]>([
    [400, "INVALID_REQUEST"],
    [409, "INVALID_REQUEST"],
    [413, "INVALID_REQUEST"],
    [422, "INVALID_REQUEST"],
    [401, "AUTHENTICATION_ERROR"],
    [402, "ACCESS_DENIED"],
    [403, "ACCESS_DENIED"],
    [404, "MODEL_NOT_FOUND"],
    [429, "RATE_LIMITED"],
    [500, "PROVIDER_UNAVAILABLE"],
    [502, "PROVIDER_UNAVAILABLE"],
    [503, "PROVIDER_UNAVAILABLE"],
    [504, "PROVIDER_UNAVAILABLE"],
    [529, "PROVIDER_UNAVAILABLE"],
    [418, "PROVIDER_ERROR"]
  ])("maps HTTP status %i to %s", (status, expectedCode) => {
    const result = mapAnthropicError(createApiError(status));

    expect(result).toBeInstanceOf(AIClientError);

    expect(result.code).toBe(expectedCode);
  });

  it("maps an unknown error", () => {
    const original = new Error("Unexpected failure");

    const result = mapAnthropicError(original);

    expect(result).toMatchObject({
      code: "PROVIDER_ERROR",
      cause: original
    });
  });
});
