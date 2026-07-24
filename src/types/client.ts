import type { AIProviderClient } from "./provider.js";

export type AIProvider = "bedrock" | "openai";

export interface CommonAIClientOptions {
  maxRetries?: number;
  timeout?: number;
}

export interface BedrockAIClientOptions extends CommonAIClientOptions {
  provider: "bedrock";
  region?: string;
  model: string;
}

export interface OpenAIClientOptions extends CommonAIClientOptions {
  provider: "openai";
  model: string;
  apiKey?: string;
  baseURL?: string;
}

export interface CustomAIClientOptions extends CommonAIClientOptions {
  provider: AIProviderClient;
}

export type AIClientOptions = BedrockAIClientOptions | OpenAIClientOptions | CustomAIClientOptions;

export interface GenerateTextRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}
