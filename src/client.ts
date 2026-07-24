import { AIClientError } from "./errors/ai-client.error.js";

import { BedrockProvider } from "./providers/bedrock.provider.js";

import type {
  AIClientOptions,
  BedrockAIClientOptions,
  GenerateTextRequest
} from "./types/client.js";

import type { AIProviderClient } from "./types/provider.js";

import type { GenerateTextResponse } from "./types/response.js";

import { retryWithBackoff } from "./utils/retry.js";

import { withTimeout } from "./utils/timeout.js";

import type { TextStreamEvent } from "./types/stream.js";

export class AIClient {
  private readonly provider: AIProviderClient;

  private readonly options: AIClientOptions;

  public constructor(options: AIClientOptions) {
    this.validateOptions(options);

    this.options = options;
    this.provider = this.createProvider(options);
  }

  public async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    this.validateRequest(request);

    const maxRetries = this.options.maxRetries ?? 0;

    const timeoutMs = this.options.timeout ?? 30_000;

    return await withTimeout(
      async (signal) => {
        return await retryWithBackoff(
          async () => {
            return await this.provider.generateText({
              ...request,
              signal
            });
          },
          {
            maxRetries,
            baseDelayMs: 1_000,
            maxDelayMs: 30_000,
            signal
          }
        );
      },
      timeoutMs,
      request.signal
    );
  }

  public async *generateTextStream(request: GenerateTextRequest): AsyncIterable<TextStreamEvent> {
    this.validateRequest(request);

    if (!this.provider.generateTextStream) {
      throw new AIClientError(
        "The configured provider does not support streaming",
        "UNSUPPORTED_OPERATION"
      );
    }

    if (request.signal?.aborted) {
      throw new AIClientError("Operation was aborted", "REQUEST_ABORTED", {
        cause: request.signal.reason
      });
    }

    const controller = new AbortController();

    const timeoutMs = this.options.timeout ?? 30_000;

    const timeoutError = new AIClientError("Streaming operation timed out", "TIMEOUT");

    const timeoutHandle = setTimeout(() => {
      controller.abort(timeoutError);
    }, timeoutMs);

    const handleExternalAbort = () => {
      controller.abort(
        new AIClientError("Operation was aborted", "REQUEST_ABORTED", {
          cause: request.signal?.reason
        })
      );
    };

    request.signal?.addEventListener("abort", handleExternalAbort, {
      once: true
    });

    try {
      const stream = this.provider.generateTextStream({
        ...request,
        signal: controller.signal
      });

      for await (const event of stream) {
        if (controller.signal.aborted) {
          if (controller.signal.reason instanceof Error) {
            throw controller.signal.reason;
          }

          throw new AIClientError("Operation was aborted", "REQUEST_ABORTED");
        }

        yield event;
      }
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason instanceof Error) {
        throw controller.signal.reason;
      }

      throw error;
    } finally {
      clearTimeout(timeoutHandle);

      request.signal?.removeEventListener("abort", handleExternalAbort);

      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
  }

  public destroy(): void {
    this.provider.destroy?.();
  }

  private validateRequest(request: GenerateTextRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new AIClientError("Prompt must not be empty", "INVALID_PROMPT");
    }

    if (
      request.maxTokens !== undefined &&
      (!Number.isInteger(request.maxTokens) || request.maxTokens <= 0)
    ) {
      throw new AIClientError("maxTokens must be a positive integer", "INVALID_PROMPT");
    }

    if (
      request.temperature !== undefined &&
      (!Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 1)
    ) {
      throw new AIClientError("temperature must be between 0 and 1", "INVALID_PROMPT");
    }
  }

  private validateOptions(options: AIClientOptions): void {
    if (
      options.maxRetries !== undefined &&
      (!Number.isInteger(options.maxRetries) || options.maxRetries < 0)
    ) {
      throw new AIClientError("maxRetries must be a non-negative integer", "INVALID_CONFIGURATION");
    }

    if (
      options.timeout !== undefined &&
      (!Number.isFinite(options.timeout) || options.timeout <= 0)
    ) {
      throw new AIClientError("timeout must be a positive number", "INVALID_CONFIGURATION");
    }

    if (typeof options.provider !== "string") {
      if (!options.provider || typeof options.provider.generateText !== "function") {
        throw new AIClientError(
          "Custom provider must implement generateText",
          "INVALID_CONFIGURATION"
        );
      }

      return;
    }

    if (options.provider !== "bedrock") {
      throw new AIClientError("Unsupported provider", "UNSUPPORTED_PROVIDER");
    }

    if (!options.model || options.model.trim().length === 0) {
      throw new AIClientError("Model must be provided", "INVALID_CONFIGURATION");
    }

    if (options.region !== undefined && options.region.trim().length === 0) {
      throw new AIClientError("Region must not be empty", "INVALID_CONFIGURATION");
    }
  }

  private createProvider(options: AIClientOptions): AIProviderClient {
    if (typeof options.provider !== "string") {
      return options.provider;
    }

    return this.createBedrockProvider(options);
  }

  private createBedrockProvider(options: BedrockAIClientOptions): BedrockProvider {
    return new BedrockProvider({
      region: options.region,
      model: options.model
    });
  }
}
