import Anthropic from "@anthropic-ai/sdk";
import { AIClientError } from "../errors/ai-client.error.js";
import type { GenerateTextRequest } from "../types/client.js";
import type { GenerateConversationRequest } from "../types/conversation.js";
import type { GenerateTextResponse } from "../types/response.js";
import { BaseProvider } from "./base.provider.js";
import { mapAnthropicError } from "./anthropic-error.js";
import type { TextStreamEvent } from "../types/stream.js";

export interface AnthropicProviderOptions {
  model: string;
  apiKey?: string;
  baseURL?: string;
  defaultMaxTokens?: number;

  /**
   * Used by tests so no real request is made.
   */
  client?: Anthropic;
}

export class AnthropicProvider extends BaseProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly defaultMaxTokens: number;

  public constructor(options: AnthropicProviderOptions) {
    super();

    this.model = options.model;
    this.defaultMaxTokens = options.defaultMaxTokens ?? 1024;

    this.client =
      options.client ??
      new Anthropic({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        maxRetries: 0
      });
  }

  public override async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: request.maxTokens ?? this.defaultMaxTokens,
          messages: [
            {
              role: "user",
              content: request.prompt
            }
          ],
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          ...(request.temperature !== undefined
            ? {
                temperature: request.temperature
              }
            : {})
        },
        {
          signal: request.signal
        }
      );

      return this.mapResponse(response);
    } catch (error) {
      throw mapAnthropicError(error);
    }
  }

  public async generateConversation(
    request: GenerateConversationRequest
  ): Promise<GenerateTextResponse> {
    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: request.maxTokens ?? this.defaultMaxTokens,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content
          })),
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          ...(request.temperature !== undefined
            ? {
                temperature: request.temperature
              }
            : {})
        },
        {
          signal: request.signal
        }
      );

      return this.mapResponse(response);
    } catch (error) {
      throw mapAnthropicError(error);
    }
  }

  public async *generateTextStream(request: GenerateTextRequest): AsyncIterable<TextStreamEvent> {
    try {
      const stream = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: request.maxTokens ?? this.defaultMaxTokens,
          stream: true,
          messages: [
            {
              role: "user",
              content: request.prompt
            }
          ],
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          ...(request.temperature !== undefined
            ? {
                temperature: request.temperature
              }
            : {})
        },
        {
          signal: request.signal
        }
      );

      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let stopReason: string | undefined;

      for await (const event of stream) {
        if (event.type === "message_start") {
          inputTokens = event.message.usage.input_tokens;
          continue;
        }

        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield {
            type: "text-delta",
            text: event.delta.text
          };

          continue;
        }

        if (event.type === "message_delta") {
          outputTokens = event.usage.output_tokens;

          stopReason = event.delta.stop_reason ?? undefined;

          continue;
        }

        if (event.type === "message_stop") {
          yield {
            type: "message-stop",
            stopReason
          };

          yield {
            type: "metadata",
            usage: {
              inputTokens,
              outputTokens
            }
          };
        }
      }
    } catch (error) {
      throw mapAnthropicError(error);
    }
  }

  private mapResponse(response: Anthropic.Message): GenerateTextResponse {
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      throw new AIClientError("Anthropic returned no text", "INVALID_PROVIDER_RESPONSE");
    }

    return {
      text,
      model: response.model,
      provider: "anthropic",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  }
}
