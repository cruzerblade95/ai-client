import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseResponse
} from "@aws-sdk/client-bedrock-runtime";

import { AIClientError } from "../errors/ai-client.error.js";

import type { GenerateTextRequest } from "../types/client.js";

import type { GenerateTextResponse } from "../types/response.js";

import { BaseProvider } from "./base.provider.js";

import { mapBedrockError } from "./bedrock-error.js";

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

  public destroy(): void {
    this.client.destroy();
  }
}
