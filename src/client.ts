import { Ajv, type AnySchema } from "ajv";

import { AIClientError } from "./errors/ai-client.error.js";
import { AnthropicProvider } from "./providers/anthropic.provider.js";
import { BedrockProvider } from "./providers/bedrock.provider.js";
import { OpenAIProvider } from "./providers/openai.provider.js";

import type {
  AIClientOptions,
  BedrockAIClientOptions,
  GenerateTextRequest
} from "./types/client.js";
import type {
  GenerateConversationRequest,
  GenerateConversationResponse
} from "./types/conversation.js";
import type { AIProviderClient } from "./types/provider.js";
import type { GenerateTextResponse } from "./types/response.js";
import type { TextStreamEvent } from "./types/stream.js";
import type { GenerateObjectRequest, GenerateObjectResponse } from "./types/structured.js";
import type { GenerateWithToolsRequest, GenerateWithToolsResponse } from "./types/tool.js";

import { parseJSONResponse } from "./utils/json.js";
import { retryWithBackoff } from "./utils/retry.js";
import { withTimeout } from "./utils/timeout.js";
import type { GenerateMultimodalRequest, GenerateMultimodalResponse } from "./types/multimodal.js";

const schemaValidator = new Ajv({
  allErrors: true,
  strict: false
});

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

  public async generateObject<T>(
    request: GenerateObjectRequest
  ): Promise<GenerateObjectResponse<T>> {
    let serializedSchema: string;

    try {
      serializedSchema = JSON.stringify(request.schema, null, 2);
    } catch (error) {
      throw new AIClientError("The JSON Schema could not be serialized", "INVALID_SCHEMA", {
        cause: error
      });
    }

    let validate: ReturnType<typeof schemaValidator.compile>;

    try {
      validate = schemaValidator.compile(request.schema as AnySchema);
    } catch (error) {
      throw new AIClientError("The provided JSON Schema is invalid", "INVALID_SCHEMA", {
        cause: error
      });
    }

    const { schema: _schema, prompt, ...generationOptions } = request;

    const structuredPrompt = [
      prompt,
      "",
      "Return only valid JSON.",
      "Do not include an explanation.",
      "The JSON must match this JSON Schema:",
      serializedSchema
    ].join("\n");

    const response = await this.generateText({
      ...generationOptions,
      prompt: structuredPrompt
    });

    const parsedValue = parseJSONResponse(response.text);

    if (!validate(parsedValue)) {
      throw new AIClientError(
        "The provider response did not match the JSON Schema",
        "INVALID_STRUCTURED_OUTPUT",
        {
          cause: validate.errors
        }
      );
    }

    return {
      ...response,
      data: parsedValue as T
    };
  }

  public async generateConversation(
    request: GenerateConversationRequest
  ): Promise<GenerateConversationResponse> {
    this.validateConversationRequest(request);

    if (!this.provider.generateConversation) {
      throw new AIClientError(
        "The configured provider does not support conversations",
        "UNSUPPORTED_OPERATION"
      );
    }

    const maxRetries = this.options.maxRetries ?? 0;

    const timeoutMs = this.options.timeout ?? 30_000;

    return await withTimeout(
      async (signal) => {
        return await retryWithBackoff(
          async () => {
            return (await this.provider.generateConversation?.({
              ...request,
              signal
            })) as GenerateConversationResponse;
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

  public async generateWithTools(
    request: GenerateWithToolsRequest
  ): Promise<GenerateWithToolsResponse> {
    this.validateRequest(request);
    this.validateTools(request);

    if (!this.provider.generateWithTools) {
      throw new AIClientError(
        "The selected provider does not support tool calling",
        "UNSUPPORTED_OPERATION"
      );
    }

    const maxRetries = this.options.maxRetries ?? 0;

    const timeoutMs = this.options.timeout ?? 30_000;

    return await withTimeout(
      async (signal) => {
        return await retryWithBackoff(
          async () => {
            return await this.provider.generateWithTools!({
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

  public async generateMultimodal(
    request: GenerateMultimodalRequest
  ): Promise<GenerateMultimodalResponse> {
    this.validateMultimodalRequest(request);

    if (!this.provider.generateMultimodal) {
      throw new AIClientError(
        "The selected provider does not support multimodal input",
        "UNSUPPORTED_OPERATION"
      );
    }

    const maxRetries = this.options.maxRetries ?? 0;

    const timeoutMs = this.options.timeout ?? 30_000;

    return await withTimeout(
      async (signal) => {
        return await retryWithBackoff(
          async () => {
            return await this.provider.generateMultimodal!({
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

  private validateConversationRequest(request: GenerateConversationRequest): void {
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw new AIClientError("Conversation must contain at least one message", "INVALID_PROMPT");
    }

    for (const message of request.messages) {
      if (message.role !== "user" && message.role !== "assistant") {
        throw new AIClientError("Conversation message has an invalid role", "INVALID_PROMPT");
      }

      if (!message.content || message.content.trim().length === 0) {
        throw new AIClientError("Conversation messages must not be empty", "INVALID_PROMPT");
      }
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

    if (
      options.provider !== "bedrock" &&
      options.provider !== "openai" &&
      options.provider !== "anthropic"
    ) {
      throw new AIClientError("Unsupported provider", "UNSUPPORTED_PROVIDER");
    }

    if (!options.model || options.model.trim().length === 0) {
      throw new AIClientError("Model must be provided", "INVALID_CONFIGURATION");
    }

    if (
      options.provider === "bedrock" &&
      options.region !== undefined &&
      options.region.trim().length === 0
    ) {
      throw new AIClientError("Region must not be empty", "INVALID_CONFIGURATION");
    }

    if (
      options.provider === "openai" &&
      options.apiKey !== undefined &&
      options.apiKey.trim().length === 0
    ) {
      throw new AIClientError("OpenAI API key must not be empty", "INVALID_CONFIGURATION");
    }

    if (
      options.provider === "openai" &&
      options.baseURL !== undefined &&
      options.baseURL.trim().length === 0
    ) {
      throw new AIClientError("OpenAI base URL must not be empty", "INVALID_CONFIGURATION");
    }
  }

  private createProvider(options: AIClientOptions): AIProviderClient {
    if (typeof options.provider !== "string") {
      return options.provider;
    }

    switch (options.provider) {
      case "bedrock":
        return new BedrockProvider({
          region: options.region,
          model: options.model
        });

      case "openai":
        return new OpenAIProvider({
          model: options.model,
          apiKey: options.apiKey,
          baseURL: options.baseURL
        });

      case "anthropic":
        return new AnthropicProvider({
          model: options.model,
          apiKey: options.apiKey,
          baseURL: options.baseURL
        });

      default:
        throw new AIClientError("Unsupported provider", "UNSUPPORTED_PROVIDER");
    }
  }

  private createBedrockProvider(options: BedrockAIClientOptions): BedrockProvider {
    return new BedrockProvider({
      region: options.region,
      model: options.model
    });
  }

  private validateTools(request: GenerateWithToolsRequest): void {
    if (!Array.isArray(request.tools) || request.tools.length === 0) {
      throw new AIClientError("At least one tool must be provided", "INVALID_REQUEST");
    }

    const names = new Set<string>();

    for (const tool of request.tools) {
      if (!tool.name || tool.name.trim().length === 0) {
        throw new AIClientError("Tool name must not be empty", "INVALID_REQUEST");
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
        throw new AIClientError(`Invalid tool name: ${tool.name}`, "INVALID_REQUEST");
      }

      if (names.has(tool.name)) {
        throw new AIClientError(`Duplicate tool name: ${tool.name}`, "INVALID_REQUEST");
      }

      names.add(tool.name);

      if (
        !tool.inputSchema ||
        typeof tool.inputSchema !== "object" ||
        Array.isArray(tool.inputSchema)
      ) {
        throw new AIClientError(`Invalid input schema for tool: ${tool.name}`, "INVALID_REQUEST");
      }
    }

    if (typeof request.toolChoice === "object" && !names.has(request.toolChoice.name)) {
      throw new AIClientError(`Unknown tool choice: ${request.toolChoice.name}`, "INVALID_REQUEST");
    }
  }

  private validateMultimodalRequest(request: GenerateMultimodalRequest): void {
    if (!Array.isArray(request.content) || request.content.length === 0) {
      throw new AIClientError("Multimodal content must not be empty", "INVALID_PROMPT");
    }

    let imageCount = 0;

    for (const part of request.content) {
      if (part.type === "text") {
        if (!part.text || part.text.trim().length === 0) {
          throw new AIClientError("Multimodal text must not be empty", "INVALID_PROMPT");
        }

        continue;
      }

      if (part.type === "image") {
        imageCount += 1;

        if (!(part.data instanceof Uint8Array) || part.data.byteLength === 0) {
          throw new AIClientError("Multimodal image data must not be empty", "INVALID_REQUEST");
        }

        const supportedMediaTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];

        if (!supportedMediaTypes.includes(part.mediaType)) {
          throw new AIClientError(
            `Unsupported image media type: ${part.mediaType}`,
            "INVALID_REQUEST"
          );
        }

        continue;
      }

      throw new AIClientError("Unsupported multimodal content type", "INVALID_REQUEST");
    }

    if (imageCount === 0) {
      throw new AIClientError(
        "Multimodal input must contain at least one image",
        "INVALID_REQUEST"
      );
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
}
