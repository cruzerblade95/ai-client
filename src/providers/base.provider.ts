import type { AIProviderClient } from "../types/provider.js";
import type { GenerateTextRequest } from "../types/client.js";
import type { GenerateTextResponse } from "../types/response.js";

export abstract class BaseProvider implements AIProviderClient {
  public abstract generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;
}
