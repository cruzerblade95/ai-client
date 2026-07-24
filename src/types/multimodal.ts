import type { GenerateTextRequest } from "./client.js";
import type { GenerateTextResponse } from "./response.js";

export type AIImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export interface AITextContentPart {
  type: "text";
  text: string;
}

export interface AIImageContentPart {
  type: "image";
  mediaType: AIImageMediaType;
  data: Uint8Array;
}

export type AIContentPart = AITextContentPart | AIImageContentPart;

export interface GenerateMultimodalRequest extends Omit<GenerateTextRequest, "prompt"> {
  content: AIContentPart[];
}

export type GenerateMultimodalResponse = GenerateTextResponse;
