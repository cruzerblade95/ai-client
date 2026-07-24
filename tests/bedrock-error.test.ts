import { describe, expect, it } from "vitest";

import { AIClientError } from "../src/errors/ai-client.error.js";

import { mapBedrockError } from "../src/providers/bedrock-error.js";

describe("mapBedrockError", () => {
  it.each([
    {
      name: "UnrecognizedClientException",
      expectedCode: "AUTHENTICATION_ERROR"
    },
    {
      name: "InvalidSignatureException",
      expectedCode: "AUTHENTICATION_ERROR"
    },
    {
      name: "ExpiredTokenException",
      expectedCode: "AUTHENTICATION_ERROR"
    },
    {
      name: "AccessDeniedException",
      expectedCode: "ACCESS_DENIED"
    },
    {
      name: "ResourceNotFoundException",
      expectedCode: "MODEL_NOT_FOUND"
    },
    {
      name: "ValidationException",
      expectedCode: "INVALID_REQUEST"
    },
    {
      name: "ThrottlingException",
      expectedCode: "RATE_LIMITED"
    },
    {
      name: "ServiceUnavailableException",
      expectedCode: "PROVIDER_UNAVAILABLE"
    },
    {
      name: "InternalServerException",
      expectedCode: "PROVIDER_UNAVAILABLE"
    },
    {
      name: "TimeoutError",
      expectedCode: "NETWORK_ERROR"
    },
    {
      name: "AbortError",
      expectedCode: "REQUEST_ABORTED"
    }
  ])("maps $name to $expectedCode", ({ name, expectedCode }) => {
    const originalError = Object.assign(new Error("AWS failed"), {
      name,
      $metadata: {
        requestId: "request-123"
      }
    });

    const result = mapBedrockError(originalError);

    expect(result).toBeInstanceOf(AIClientError);

    expect(result.code).toBe(expectedCode);

    expect(result.cause).toBe(originalError);

    expect(result.requestId).toBe("request-123");
  });

  it("maps HTTP 429 to RATE_LIMITED", () => {
    const result = mapBedrockError({
      name: "UnknownAwsError",
      $metadata: {
        httpStatusCode: 429,
        requestId: "request-429"
      }
    });

    expect(result).toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
      requestId: "request-429"
    });
  });

  it("maps HTTP 503 to PROVIDER_UNAVAILABLE", () => {
    const result = mapBedrockError({
      name: "UnknownAwsError",
      $metadata: {
        httpStatusCode: 503
      }
    });

    expect(result).toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      statusCode: 503
    });
  });

  it("maps network error codes", () => {
    const result = mapBedrockError({
      name: "Error",
      code: "ECONNRESET"
    });

    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("uses PROVIDER_ERROR for unknown errors", () => {
    const originalError = new Error("Unknown failure");

    const result = mapBedrockError(originalError);

    expect(result.code).toBe("PROVIDER_ERROR");

    expect(result.cause).toBe(originalError);
  });

  it("preserves an existing AIClientError", () => {
    const originalError = new AIClientError("Existing SDK error", "INVALID_PROVIDER_RESPONSE");

    const result = mapBedrockError(originalError);

    expect(result).toBe(originalError);
  });
});
