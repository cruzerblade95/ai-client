import type { GenerateTextRequest } from "./client.js";

import type { GenerateTextResponse } from "./response.js";

import type { TextStreamEvent } from "./stream.js";

import type { GenerateConversationRequest, GenerateConversationResponse } from "./conversation.js";

import type { GenerateWithToolsRequest, GenerateWithToolsResponse } from "./tool.js";

export interface AIProviderClient {
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;

  generateConversation?(
    request: GenerateConversationRequest
  ): Promise<GenerateConversationResponse>;

  generateWithTools?(request: GenerateWithToolsRequest): Promise<GenerateWithToolsResponse>;

  generateTextStream?(request: GenerateTextRequest): AsyncIterable<TextStreamEvent>;

  destroy?(): void;
}
