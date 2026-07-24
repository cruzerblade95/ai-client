import type { GenerateTextRequest } from "./client.js";

import type { GenerateTextResponse } from "./response.js";

import type { TextStreamEvent } from "./stream.js";

import type { GenerateConversationRequest, GenerateConversationResponse } from "./conversation.js";

import type { GenerateWithToolsRequest, GenerateWithToolsResponse } from "./tool.js";

import type { GenerateMultimodalRequest, GenerateMultimodalResponse } from "./multimodal.js";

export interface AIProviderClient {
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;

  generateConversation?(
    request: GenerateConversationRequest
  ): Promise<GenerateConversationResponse>;

  generateMultimodal?(request: GenerateMultimodalRequest): Promise<GenerateMultimodalResponse>;

  generateWithTools?(request: GenerateWithToolsRequest): Promise<GenerateWithToolsResponse>;

  generateTextStream?(request: GenerateTextRequest): AsyncIterable<TextStreamEvent>;

  destroy?(): void;
}
