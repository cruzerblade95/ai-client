import { describe, expect, it } from "vitest";

import { AIClientError } from "../src/errors/ai-client.error.js";

import { mapOpenAIError } from "../src/providers/openai-error.js";

describe("mapOpenAIError", () => {
  it.each([
    {
      name: "AuthenticationError",
      status: 401,
      expected: "AUTHENTICATION_ERROR"
    },
    {
      name: "PermissionDeniedError",
      status: 403,
      expected: "ACCESS_DENIED"
    },
    {
      name: "NotFoundError",
      status: 404,
      expected: "MODEL_NOT_FOUND"
    },
    {
      name: "BadRequestError",
      status: 400,
      expected: "INVALID_REQUEST"
    },
    {
      name: "RateLimitError",
      status: 429,
      expected: "RATE_LIMITED"
    },
    {
      name: "InternalServerError",
      status: 500,
      expected: "PROVIDER_UNAVAILABLE"
    },
    {
      name: "APIConnectionError",
      status: undefined,
      expected: "NETWORK_ERROR"
    },
    {
      name: "APIUserAbortError",
      status: undefined,
      expected: "REQUEST_ABORTED"
    }
  ])("maps $name to $expected", ({ name, status, expected }) => {
    const originalError = Object.assign(new Error("OpenAI failed"), {
      name,
      status,
      request_id: "request-openai-123"
    });

    const result = mapOpenAIError(originalError);

    expect(result).toBeInstanceOf(AIClientError);

    expect(result.code).toBe(expected);

    expect(result.requestId).toBe("request-openai-123");

    expect(result.cause).toBe(originalError);
  });

  it("preserves existing SDK errors", () => {
    const originalError = new AIClientError("Existing error", "INVALID_PROVIDER_RESPONSE");

    expect(mapOpenAIError(originalError)).toBe(originalError);
  });

  it("maps unknown errors to PROVIDER_ERROR", () => {
    expect(mapOpenAIError(new Error("Unknown")).code).toBe("PROVIDER_ERROR");
  });
});
