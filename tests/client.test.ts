import { describe, expect, it, vi } from "vitest";

import { AIClient } from "../src/client.js";
import { AIClientError } from "../src/errors/ai-client.error.js";

import type { AIProviderClient } from "../src/types/provider.js";
import type { GenerateTextRequest } from "../src/types/client.js";

import type { GenerateTextResponse } from "../src/types/response.js";

describe("AIClient", () => {
  const createMockProvider = (): AIProviderClient => ({
    generateText: vi.fn(async (request: GenerateTextRequest): Promise<GenerateTextResponse> => ({
      text: `Response for: ${request.prompt}`,
      model: "test-model",
      provider: "test",
      usage: {
        inputTokens: 10,
        outputTokens: 20
      }
    }))
  });

  const createClient = (provider?: AIProviderClient): AIClient => {
    return new AIClient(
      {
        provider: "bedrock",
        region: "us-east-1",
        model: "test-model",
        maxRetries: 0,
        timeout: 30_000
      },
      provider
    );
  };

  describe("constructor", () => {
    it("creates an AI client with valid configuration", () => {
      const provider = createMockProvider();

      expect(() => {
        createClient(provider);
      }).not.toThrow();
    });

    it("rejects invalid configuration", () => {
      expect(() => {
        new AIClient({
          provider: "bedrock",
          model: "",
          region: ""
        });
      }).toThrowError(
        expect.objectContaining({
          code: "INVALID_CONFIGURATION"
        })
      );
    });

    it("rejects missing model", () => {
      expect(() => {
        new AIClient({
          provider: "bedrock",
          model: "",
          region: "us-east-1"
        });
      }).toThrowError(
        expect.objectContaining({
          code: "INVALID_CONFIGURATION"
        })
      );
    });

    it("rejects missing region", () => {
      expect(() => {
        new AIClient({
          provider: "bedrock",
          model: "test-model",
          region: ""
        });
      }).toThrowError(
        expect.objectContaining({
          code: "INVALID_CONFIGURATION"
        })
      );
    });

    it("rejects an unsupported provider", () => {
      expect(() => {
        new AIClient({
          provider: "unsupported" as never,
          model: "test-model",
          region: "us-east-1"
        });
      }).toThrowError(
        expect.objectContaining({
          code: "UNSUPPORTED_PROVIDER"
        })
      );
    });
  });

  it.each([{ maxRetries: -1 }, { maxRetries: 1.5 }, { timeout: 0 }, { timeout: -100 }])(
    "rejects invalid options: %o",
    (invalidOptions) => {
      expect(
        () =>
          new AIClient({
            provider: "bedrock",
            region: "us-east-1",
            model: "test-model",
            ...invalidOptions
          })
      ).toThrowError(expect.objectContaining({ code: "INVALID_CONFIGURATION" }));
    }
  );

  it.each([
    { prompt: "Hello", maxTokens: 0 },
    { prompt: "Hello", maxTokens: -1 },
    { prompt: "Hello", temperature: -0.1 },
    { prompt: "Hello", temperature: 1.1 }
  ])("rejects invalid request: %o", async (request) => {
    const provider = createMockProvider();
    const client = createClient(provider);

    await expect(client.generateText(request)).rejects.toMatchObject({
      code: "INVALID_PROMPT"
    });
    expect(provider.generateText).not.toHaveBeenCalled();
  });

  describe("generateText", () => {
    it("generates text successfully", async () => {
      const provider = createMockProvider();

      const client = createClient(provider);

      const response = await client.generateText({
        prompt: "Hello AI"
      });

      expect(response).toEqual({
        text: "Response for: Hello AI",
        model: "test-model",
        provider: "test",
        usage: {
          inputTokens: 10,
          outputTokens: 20
        }
      });

      expect(provider.generateText).toHaveBeenCalledTimes(1);

      expect(provider.generateText).toHaveBeenCalledWith({
        prompt: "Hello AI",
        signal: expect.any(AbortSignal)
      });
    });

    it("rejects an empty prompt", async () => {
      const provider = createMockProvider();

      const client = createClient(provider);

      await expect(
        client.generateText({
          prompt: ""
        })
      ).rejects.toMatchObject({
        code: "INVALID_PROMPT"
      });

      expect(provider.generateText).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only prompt", async () => {
      const provider = createMockProvider();

      const client = createClient(provider);

      await expect(
        client.generateText({
          prompt: "   "
        })
      ).rejects.toMatchObject({
        code: "INVALID_PROMPT"
      });

      expect(provider.generateText).not.toHaveBeenCalled();
    });

    it("passes the request to the provider", async () => {
      const provider = createMockProvider();

      const client = createClient(provider);

      const request: GenerateTextRequest = {
        prompt: "Analyze this portfolio",
        systemPrompt: "You are a financial analyst",
        maxTokens: 500,
        temperature: 0.7
      };

      await client.generateText(request);

      expect(provider.generateText).toHaveBeenCalledWith({
        ...request,
        signal: expect.any(AbortSignal)
      });
    });
  });

  describe("errors", () => {
    it("preserves provider errors", async () => {
      const providerError = new AIClientError("Provider failed", "PROVIDER_ERROR");

      const provider: AIProviderClient = {
        generateText: vi.fn().mockRejectedValue(providerError)
      };

      const client = createClient(provider);

      await expect(
        client.generateText({
          prompt: "Hello"
        })
      ).rejects.toThrow(providerError);
    });
  });

  describe("lifecycle", () => {
    it("destroys the configured provider", () => {
      const destroy = vi.fn();

      const provider: AIProviderClient = {
        generateText: vi.fn(async () => ({
          text: "Result",
          model: "test-model",
          provider: "test"
        })),
        destroy
      };

      const client = createClient(provider);

      client.destroy();

      expect(destroy).toHaveBeenCalledOnce();
    });

    it("does not fail when the provider has no destroy method", () => {
      const provider = createMockProvider();

      const client = createClient(provider);

      expect(() => {
        client.destroy();
      }).not.toThrow();
    });
  });
});
