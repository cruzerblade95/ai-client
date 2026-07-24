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
