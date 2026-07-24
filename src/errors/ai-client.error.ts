export type AIClientErrorCode =
  | "INVALID_PROMPT"
  | "INVALID_CONFIGURATION"
  | "INVALID_SCHEMA"
  | "INVALID_STRUCTURED_OUTPUT"
  | "UNSUPPORTED_PROVIDER"
  | "UNSUPPORTED_OPERATION"
  | "INVALID_PROVIDER_RESPONSE"
  | "AUTHENTICATION_ERROR"
  | "ACCESS_DENIED"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "NETWORK_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "REQUEST_ABORTED"
  | "MAX_RETRIES_EXCEEDED";

export interface AIClientErrorOptions {
  cause?: unknown;
  statusCode?: number;
  requestId?: string;
}

export class AIClientError extends Error {
  public readonly code: AIClientErrorCode;

  public readonly statusCode?: number;

  public readonly requestId?: string;

  public constructor(message: string, code: AIClientErrorCode, options?: AIClientErrorOptions) {
    super(message, {
      cause: options?.cause
    });

    this.name = "AIClientError";
    this.code = code;
    this.statusCode = options?.statusCode;
    this.requestId = options?.requestId;
  }
}
