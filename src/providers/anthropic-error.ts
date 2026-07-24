import Anthropic from "@anthropic-ai/sdk";
import { AIClientError, type AIClientErrorCode } from "../errors/ai-client.error.js";

function mapStatusCode(status: number | undefined): AIClientErrorCode {
  switch (status) {
    case 400:
    case 409:
    case 413:
    case 422:
      return "INVALID_REQUEST";

    case 401:
      return "AUTHENTICATION_ERROR";

    case 402:
    case 403:
      return "ACCESS_DENIED";

    case 404:
      return "MODEL_NOT_FOUND";

    case 429:
      return "RATE_LIMITED";

    case 500:
    case 502:
    case 503:
    case 504:
    case 529:
      return "PROVIDER_UNAVAILABLE";

    default:
      return "PROVIDER_ERROR";
  }
}

export function mapAnthropicError(error: unknown): AIClientError {
  if (error instanceof AIClientError) {
    return error;
  }

  if (error instanceof Anthropic.APIUserAbortError) {
    return new AIClientError("Anthropic request was aborted", "REQUEST_ABORTED", { cause: error });
  }

  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AIClientError("Anthropic request timed out", "TIMEOUT", { cause: error });
  }

  if (error instanceof Anthropic.APIConnectionError) {
    return new AIClientError("Unable to connect to Anthropic", "NETWORK_ERROR", { cause: error });
  }

  if (error instanceof Anthropic.APIError) {
    return new AIClientError(
      error.message || "Anthropic request failed",
      mapStatusCode(error.status),
      { cause: error }
    );
  }

  return new AIClientError("Anthropic request failed", "PROVIDER_ERROR", { cause: error });
}
