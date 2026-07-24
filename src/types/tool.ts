import type { GenerateTextRequest } from "./client.js";

export type JSONPrimitive = string | number | boolean | null;

export type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | {
      [key: string]: JSONValue;
    };

export interface JSONSchema {
  [key: string]: JSONValue;
}

export interface AIToolDefinition {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
  strict?: boolean;
}

export type AIToolChoice =
  | "auto"
  | "required"
  | "none"
  | {
      name: string;
    };

export interface AIToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface GenerateWithToolsRequest extends GenerateTextRequest {
  tools: AIToolDefinition[];
  toolChoice?: AIToolChoice;
}

export interface GenerateWithToolsResponse {
  text: string;
  model: string;
  provider: string;
  toolCalls: AIToolCall[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}
