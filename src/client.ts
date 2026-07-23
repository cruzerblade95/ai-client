import { AIClientError } from "./errors/ai-client.error.js";
import { BedrockProvider } from "./providers/bedrock.provider.js";
import type { AIClientOptions, GenerateTextRequest } from "./types/client.js";
import type { AIProviderClient } from "./types/provider.js";
import type { GenerateTextResponse } from "./types/response.js";
import { retryWithBackoff } from "./utils/retry.js";
import { withTimeout } from "./utils/timeout.js";

export class AIClient {
  private readonly provider: AIProviderClient;
  private readonly options: AIClientOptions;

  public constructor(options: AIClientOptions, provider?: AIProviderClient) {
    this.options = options;
    this.provider = provider ?? this.createProvider(options);
  }

  public async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    this.validateRequest(request);
    this.validateOptions(this.options);

    const run = async () => {
      const response = await this.provider.generateText(request);
      return response;
    };

    const maxRetries = this.options.maxRetries ?? 0;
    const timeoutMs = this.options.timeout ?? 30000;

    return await withTimeout(
      retryWithBackoff(run, { maxRetries, baseDelayMs: 1000 }),
      timeoutMs
    );
  }

  private validateRequest(request: GenerateTextRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new AIClientError("Prompt must not be empty", "INVALID_PROMPT");
    }
  }

  private validateOptions(options: AIClientOptions): void {
    if (!options.model || options.model.trim().length === 0) {
      throw new AIClientError("Model must be provided", "INVALID_CONFIGURATION");
    }

    if (!options.region || options.region.trim().length === 0) {
      throw new AIClientError("Region must be provided", "INVALID_CONFIGURATION");
    }

    if (options.provider !== "bedrock") {
      throw new AIClientError("Unsupported provider", "UNSUPPORTED_PROVIDER");
    }
  }

  private createProvider(options: AIClientOptions): AIProviderClient {
    switch (options.provider) {
      case "bedrock":
        return new BedrockProvider({ region: options.region, model: options.model });
      default:
        throw new AIClientError("Unsupported provider", "UNSUPPORTED_PROVIDER");
    }
  }
}
