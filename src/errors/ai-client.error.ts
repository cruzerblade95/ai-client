export type AIClientErrorCode =
  | "INVALID_PROMPT"
  | "INVALID_CONFIGURATION"
  | "UNSUPPORTED_PROVIDER"
  | "PROVIDER_ERROR"
  | "INVALID_PROVIDER_RESPONSE"
  | "TIMEOUT"
  | "REQUEST_ABORTED"
  | "MAX_RETRIES_EXCEEDED";

export class AIClientError extends Error {
  public readonly code: AIClientErrorCode;

  public readonly cause?: unknown;

  public constructor(message: string, code: AIClientErrorCode, options?: { cause?: unknown }) {
    super(message);

    this.name = "AIClientError";
    this.code = code;
    this.cause = options?.cause;
  }
}
