import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type ConverseCommandInput,
  type ConverseResponse,
  type ConverseStreamCommandInput,
  type ConverseStreamResponse
} from "@aws-sdk/client-bedrock-runtime";

import { AIClientError } from "../errors/ai-client.error.js";

import type { GenerateTextRequest } from "../types/client.js";

import type { GenerateTextResponse } from "../types/response.js";

import { BaseProvider } from "./base.provider.js";

import { mapBedrockError } from "./bedrock-error.js";

import type { TextStreamEvent } from "../types/stream.js";

export interface BedrockProviderOptions {
  region?: string;
  model: string;
}

export class BedrockProvider extends BaseProvider {
  private readonly client: BedrockRuntimeClient;

  private readonly model: string;

  public constructor(options: BedrockProviderOptions) {
    super();

    this.client = new BedrockRuntimeClient({
      region: options.region
    });

    this.model = options.model;
  }

  public override async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    try {
      const commandInput = this.createCommandInput(request);

      if (request.systemPrompt?.trim()) {
        commandInput.system = [
          {
            text: request.systemPrompt.trim()
          }
        ];
      }

      const response = await this.runCommand(commandInput, request.signal);

      const content = response.output?.message?.content;

      const firstText = content?.find((item) => typeof item.text === "string")?.text?.trim();

      if (!firstText) {
        throw new AIClientError("Bedrock returned no text content", "INVALID_PROVIDER_RESPONSE");
      }

      return {
        text: firstText,
        model: this.model,
        provider: "bedrock",
        usage: {
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens
        }
      };
    } catch (error) {
      throw mapBedrockError(error);
    }
  }

  public async runCommand(
    input: ConverseCommandInput,
    signal?: AbortSignal
  ): Promise<ConverseResponse> {
    return await this.client.send(new ConverseCommand(input), {
      abortSignal: signal
    });
  }

  public async runStreamCommand(
    input: ConverseStreamCommandInput,
    signal?: AbortSignal
  ): Promise<ConverseStreamResponse> {
    return await this.client.send(new ConverseStreamCommand(input), {
      abortSignal: signal
    });
  }

  public destroy(): void {
    this.client.destroy();
  }

  private createCommandInput(request: GenerateTextRequest): ConverseCommandInput {
    const commandInput: ConverseCommandInput = {
      modelId: this.model,
      messages: [
        {
          role: "user",
          content: [
            {
              text: request.prompt
            }
          ]
        }
      ],
      inferenceConfig: {
        maxTokens: request.maxTokens,
        temperature: request.temperature
      }
    };

    if (request.systemPrompt?.trim()) {
      commandInput.system = [
        {
          text: request.systemPrompt.trim()
        }
      ];
    }

    return commandInput;
  }

  public async *generateTextStream(request: GenerateTextRequest): AsyncIterable<TextStreamEvent> {
    try {
      const commandInput: ConverseStreamCommandInput = this.createCommandInput(request);

      const response = await this.runStreamCommand(commandInput, request.signal);

      if (!response.stream) {
        throw new AIClientError("Bedrock returned no response stream", "INVALID_PROVIDER_RESPONSE");
      }

      for await (const event of response.stream) {
        const text = event.contentBlockDelta?.delta?.text;

        if (typeof text === "string" && text.length > 0) {
          yield {
            type: "text-delta",
            text
          };
        }

        if (event.messageStop) {
          yield {
            type: "message-stop",
            stopReason: event.messageStop.stopReason
          };
        }

        if (event.metadata) {
          yield {
            type: "metadata",
            usage: {
              inputTokens: event.metadata.usage?.inputTokens,
              outputTokens: event.metadata.usage?.outputTokens,
              totalTokens: event.metadata.usage?.totalTokens
            },
            latencyMs: event.metadata.metrics?.latencyMs
          };
        }
      }
    } catch (error) {
      throw mapBedrockError(error);
    }
  }
}
