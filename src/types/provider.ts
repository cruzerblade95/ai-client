import type { GenerateTextRequest } from "./client.js";

import type { GenerateTextResponse } from "./response.js";

import type { TextStreamEvent } from "./stream.js";

export interface AIProviderClient {
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;

  generateTextStream?(request: GenerateTextRequest): AsyncIterable<TextStreamEvent>;

  destroy?(): void;
}
