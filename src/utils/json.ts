import { AIClientError } from "../errors/ai-client.error.js";

function removeMarkdownFence(value: string): string {
  const trimmedValue = value.trim();

  const match = trimmedValue.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return match?.[1]?.trim() ?? trimmedValue;
}

export function parseJSONResponse(responseText: string): unknown {
  const jsonText = removeMarkdownFence(responseText);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new AIClientError("The provider returned invalid JSON", "INVALID_STRUCTURED_OUTPUT", {
      cause: error
    });
  }
}
