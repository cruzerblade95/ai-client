import type { GenerateTextResponse } from "./response.js";

export type ConversationRole = "user" | "assistant";

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
}

export interface GenerateConversationRequest {
  messages: ConversationMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export type GenerateConversationResponse = GenerateTextResponse;
