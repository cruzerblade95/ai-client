import type { GenerateTextRequest } from "./client.js";

import type { GenerateTextResponse } from "./response.js";

import type { TextStreamEvent } from "./stream.js";

import type { GenerateConversationRequest, GenerateConversationResponse } from "./conversation.js";

export interface AIProviderClient {
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;

  generateConversation?(
    request: GenerateConversationRequest
  ): Promise<GenerateConversationResponse>;

  generateTextStream?(request: GenerateTextRequest): AsyncIterable<TextStreamEvent>;

  destroy?(): void;
}
