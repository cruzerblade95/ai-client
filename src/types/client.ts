export type AIProvider = "bedrock";

export interface AIClientOptions {
  provider: AIProvider;
  region?: string;
  model: string;
  maxRetries?: number;
  timeout?: number;
}

export interface GenerateTextRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}
