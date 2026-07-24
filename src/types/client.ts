import type { AIProviderClient } from "./provider.js";

export type AIProvider = "bedrock";

export interface CommonAIClientOptions {
  maxRetries?: number;
  timeout?: number;
}

export interface BedrockAIClientOptions extends CommonAIClientOptions {
  provider: "bedrock";
  region?: string;
  model: string;
}

export interface CustomAIClientOptions extends CommonAIClientOptions {
  provider: AIProviderClient;
}

export type AIClientOptions = BedrockAIClientOptions | CustomAIClientOptions;

export interface GenerateTextRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}
