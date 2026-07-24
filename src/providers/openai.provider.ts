import OpenAI from "openai";

import { AIClientError } from "../errors/ai-client.error.js";

import type { GenerateTextRequest } from "../types/client.js";

import type {
  GenerateConversationRequest,
  GenerateConversationResponse
} from "../types/conversation.js";

import type { GenerateTextResponse } from "../types/response.js";

import type { TextStreamEvent } from "../types/stream.js";

import { mapOpenAIError } from "./openai-error.js";

import { BaseProvider } from "./base.provider.js";

export interface OpenAIProviderOptions {
  model: string;
  apiKey?: string;
  baseURL?: string;

  /**
   * Used for testing or advanced dependency injection.
   */
  client?: OpenAI;
}

export class OpenAIProvider extends BaseProvider {
  private readonly client: OpenAI;

  private readonly model: string;

  public constructor(options: OpenAIProviderOptions) {
    super();

    this.model = options.model;

    this.client =
      options.client ??
      new OpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseURL,

        // AIClient owns retry behaviour.
        maxRetries: 0
      });
  }

  public override async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    try {
      const response = await this.client.responses.create(
        {
          model: this.model,
          input: request.prompt,
          instructions: request.systemPrompt,
          max_output_tokens: request.maxTokens,
          temperature: request.temperature
        },
        {
          signal: request.signal
        }
      );

      const text = response.output_text.trim();

      if (!text) {
        throw new AIClientError("OpenAI returned no text content", "INVALID_PROVIDER_RESPONSE");
      }

      return {
        text,
        model: this.model,
        provider: "openai",
        usage: {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens
        }
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }

  public async generateConversation(
    request: GenerateConversationRequest
  ): Promise<GenerateConversationResponse> {
    try {
      const response = await this.client.responses.create(
        {
          model: this.model,
          instructions: request.systemPrompt,
          input: request.messages.map((message) => ({
            role: message.role,
            content: message.content
          })),
          max_output_tokens: request.maxTokens,
          temperature: request.temperature
        },
        {
          signal: request.signal
        }
      );

      const text = response.output_text.trim();

      if (!text) {
        throw new AIClientError("OpenAI returned no text content", "INVALID_PROVIDER_RESPONSE");
      }

      return {
        text,
        model: this.model,
        provider: "openai",
        usage: {
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens
        }
      };
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }

  public async *generateTextStream(request: GenerateTextRequest): AsyncIterable<TextStreamEvent> {
    try {
      const stream = await this.client.responses.create(
        {
          model: this.model,
          input: request.prompt,
          instructions: request.systemPrompt,
          max_output_tokens: request.maxTokens,
          temperature: request.temperature,
          stream: true
        },
        {
          signal: request.signal
        }
      );

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          if (event.delta.length > 0) {
            yield {
              type: "text-delta",
              text: event.delta
            };
          }
        }

        if (event.type === "response.completed") {
          yield {
            type: "message-stop",
            stopReason: "completed"
          };

          yield {
            type: "metadata",
            usage: {
              inputTokens: event.response.usage?.input_tokens,
              outputTokens: event.response.usage?.output_tokens,
              totalTokens: event.response.usage?.total_tokens
            }
          };
        }

        if (event.type === "response.incomplete") {
          yield {
            type: "message-stop",
            stopReason: "incomplete"
          };
        }

        if (event.type === "response.failed") {
          throw new AIClientError("OpenAI streaming response failed", "PROVIDER_ERROR", {
            cause: event.response.error
          });
        }
      }
    } catch (error) {
      throw mapOpenAIError(error);
    }
  }
}
