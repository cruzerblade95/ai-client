import type { GenerateTextRequest } from "./client.js";
import type { GenerateTextResponse } from "./response.js";

export interface AIProviderClient {
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;
}
