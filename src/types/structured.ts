import type { GenerateTextRequest } from "./client.js";

import type { GenerateTextResponse } from "./response.js";

export type JSONSchema = boolean | Record<string, unknown>;

export interface GenerateObjectRequest extends GenerateTextRequest {
  schema: JSONSchema;
}

export interface GenerateObjectResponse<T> extends GenerateTextResponse {
  data: T;
}
