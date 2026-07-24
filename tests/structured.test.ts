import { describe, expect, it, vi } from "vitest";

import { AIClient } from "../src/client.js";

import type { AIProviderClient } from "../src/types/provider.js";

interface AnalysisResult {
  summary: string;
  score: number;
}

const analysisSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string"
    },
    score: {
      type: "number"
    }
  },
  required: ["summary", "score"],
  additionalProperties: false
};

function createProvider(responseText: string): AIProviderClient {
  return {
    generateText: vi.fn(async () => ({
      text: responseText,
      model: "custom-model",
      provider: "custom"
    }))
  };
}

describe("AIClient structured output", () => {
  it("returns validated structured data", async () => {
    const provider = createProvider(
      JSON.stringify({
        summary: "Looks good",
        score: 95
      })
    );

    const client = new AIClient({
      provider
    });

    const response = await client.generateObject<AnalysisResult>({
      prompt: "Analyze this project",
      schema: analysisSchema
    });

    expect(response.data).toEqual({
      summary: "Looks good",
      score: 95
    });

    expect(response.text).toBe('{"summary":"Looks good","score":95}');
  });

  it("includes the schema in the provider prompt", async () => {
    const provider = createProvider(
      JSON.stringify({
        summary: "Valid",
        score: 80
      })
    );

    const client = new AIClient({
      provider
    });

    await client.generateObject({
      prompt: "Analyze this",
      schema: analysisSchema
    });

    expect(provider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('"summary"'),
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("preserves generation options", async () => {
    const provider = createProvider(
      JSON.stringify({
        summary: "Valid",
        score: 80
      })
    );

    const client = new AIClient({
      provider
    });

    await client.generateObject({
      prompt: "Analyze this",
      systemPrompt: "You are an analyst.",
      temperature: 0.2,
      maxTokens: 500,
      schema: analysisSchema
    });

    expect(provider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "You are an analyst.",
        temperature: 0.2,
        maxTokens: 500
      })
    );
  });

  it("rejects invalid JSON", async () => {
    const provider = createProvider("Not JSON");

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateObject({
        prompt: "Analyze this",
        schema: analysisSchema
      })
    ).rejects.toMatchObject({
      code: "INVALID_STRUCTURED_OUTPUT"
    });
  });

  it("rejects JSON that does not match the schema", async () => {
    const provider = createProvider(
      JSON.stringify({
        summary: "Missing score"
      })
    );

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateObject({
        prompt: "Analyze this",
        schema: analysisSchema
      })
    ).rejects.toMatchObject({
      code: "INVALID_STRUCTURED_OUTPUT"
    });
  });

  it("rejects an invalid JSON Schema", async () => {
    const provider = createProvider("{}");

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateObject({
        prompt: "Analyze this",
        schema: {
          type: "definitely-not-valid"
        }
      })
    ).rejects.toMatchObject({
      code: "INVALID_SCHEMA"
    });

    expect(provider.generateText).not.toHaveBeenCalled();
  });
});
