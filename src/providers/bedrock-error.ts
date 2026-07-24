import { AIClientError } from "../errors/ai-client.error.js";

interface AwsErrorMetadata {
  httpStatusCode?: unknown;
  requestId?: unknown;
}

interface AwsErrorLike {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  $metadata?: AwsErrorMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAwsError(error: unknown): AwsErrorLike {
  if (!isRecord(error)) {
    return {};
  }

  const metadata = isRecord(error.$metadata) ? error.$metadata : undefined;

  return {
    name: error.name,
    code: error.code,
    message: error.message,
    $metadata: metadata
  };
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function mapBedrockError(error: unknown): AIClientError {
  if (error instanceof AIClientError) {
    return error;
  }

  const awsError = getAwsError(error);

  const name = getString(awsError.name) ?? "";

  const code = getString(awsError.code) ?? "";

  const statusCode = getNumber(awsError.$metadata?.httpStatusCode);

  const requestId = getString(awsError.$metadata?.requestId);

  const options = {
    cause: error,
    statusCode,
    requestId
  };

  if (name === "AbortError" || code === "ABORT_ERR") {
    return new AIClientError("Bedrock request was aborted", "REQUEST_ABORTED", options);
  }

  if (
    [
      "UnrecognizedClientException",
      "InvalidSignatureException",
      "ExpiredTokenException",
      "CredentialsProviderError"
    ].includes(name)
  ) {
    return new AIClientError("AWS authentication failed", "AUTHENTICATION_ERROR", options);
  }

  if (name === "AccessDeniedException") {
    return new AIClientError("Access to AWS Bedrock was denied", "ACCESS_DENIED", options);
  }

  if (["ResourceNotFoundException", "ModelNotFoundException"].includes(name)) {
    return new AIClientError(
      "The requested Bedrock model was not found",
      "MODEL_NOT_FOUND",
      options
    );
  }

  if (name === "ValidationException" || statusCode === 400) {
    return new AIClientError("The Bedrock request was invalid", "INVALID_REQUEST", options);
  }

  if (name === "ThrottlingException" || statusCode === 429) {
    return new AIClientError("AWS Bedrock rate limit exceeded", "RATE_LIMITED", options);
  }

  if (
    ["ServiceUnavailableException", "InternalServerException", "ModelNotReadyException"].includes(
      name
    ) ||
    (statusCode !== undefined && statusCode >= 500 && statusCode <= 599)
  ) {
    return new AIClientError(
      "AWS Bedrock is temporarily unavailable",
      "PROVIDER_UNAVAILABLE",
      options
    );
  }

  if (
    ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"].includes(code) ||
    ["TimeoutError", "NetworkingError"].includes(name)
  ) {
    return new AIClientError(
      "A network error occurred while contacting Bedrock",
      "NETWORK_ERROR",
      options
    );
  }

  return new AIClientError("Bedrock request failed", "PROVIDER_ERROR", options);
}
