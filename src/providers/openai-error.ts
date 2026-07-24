import { AIClientError } from "../errors/ai-client.error.js";

interface OpenAIErrorLike {
  name?: unknown;
  status?: unknown;
  request_id?: unknown;
  code?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOpenAIError(error: unknown): OpenAIErrorLike {
  if (!isRecord(error)) {
    return {};
  }

  return {
    name: error.name,
    status: error.status,
    request_id: error.request_id,
    code: error.code
  };
}

export function mapOpenAIError(error: unknown): AIClientError {
  if (error instanceof AIClientError) {
    return error;
  }

  const openAIError = readOpenAIError(error);

  const name = getString(openAIError.name) ?? "";

  const code = getString(openAIError.code) ?? "";

  const statusCode = getNumber(openAIError.status);

  const requestId = getString(openAIError.request_id);

  const options = {
    cause: error,
    statusCode,
    requestId
  };

  if (name === "APIUserAbortError" || name === "AbortError" || code === "ABORT_ERR") {
    return new AIClientError("OpenAI request was aborted", "REQUEST_ABORTED", options);
  }

  if (name === "AuthenticationError" || statusCode === 401) {
    return new AIClientError("OpenAI authentication failed", "AUTHENTICATION_ERROR", options);
  }

  if (name === "PermissionDeniedError" || statusCode === 403) {
    return new AIClientError("Access to OpenAI was denied", "ACCESS_DENIED", options);
  }

  if (name === "NotFoundError" || statusCode === 404) {
    return new AIClientError(
      "The requested OpenAI model or resource was not found",
      "MODEL_NOT_FOUND",
      options
    );
  }

  if (name === "RateLimitError" || statusCode === 429) {
    return new AIClientError("OpenAI rate limit exceeded", "RATE_LIMITED", options);
  }

  if (
    name === "BadRequestError" ||
    name === "UnprocessableEntityError" ||
    statusCode === 400 ||
    statusCode === 422
  ) {
    return new AIClientError("The OpenAI request was invalid", "INVALID_REQUEST", options);
  }

  if (name === "APIConnectionError" || name === "APIConnectionTimeoutError") {
    return new AIClientError(
      "A network error occurred while contacting OpenAI",
      "NETWORK_ERROR",
      options
    );
  }

  if (name === "InternalServerError" || (statusCode !== undefined && statusCode >= 500)) {
    return new AIClientError("OpenAI is temporarily unavailable", "PROVIDER_UNAVAILABLE", options);
  }

  return new AIClientError("OpenAI request failed", "PROVIDER_ERROR", options);
}
