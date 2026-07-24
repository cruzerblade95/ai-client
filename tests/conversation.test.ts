import { describe, expect, it, vi } from "vitest";

import { AIClient } from "../src/client.js";

import type { AIProviderClient } from "../src/types/provider.js";

function createConversationProvider(): AIProviderClient {
  return {
    generateText: vi.fn(async () => ({
      text: "Text response",
      model: "custom-model",
      provider: "custom"
    })),

    generateConversation: vi.fn(async () => ({
      text: "Conversation response",
      model: "custom-model",
      provider: "custom"
    }))
  };
}

describe("AIClient conversations", () => {
  it("generates a multi-turn conversation", async () => {
    const provider = createConversationProvider();

    const client = new AIClient({
      provider
    });

    const response = await client.generateConversation({
      systemPrompt: "You are a coding assistant.",
      messages: [
        {
          role: "user",
          content: "What is TypeScript?"
        },
        {
          role: "assistant",
          content: "TypeScript extends JavaScript."
        },
        {
          role: "user",
          content: "What is its main benefit?"
        }
      ]
    });

    expect(response.text).toBe("Conversation response");

    expect(provider.generateConversation).toHaveBeenCalledWith({
      systemPrompt: "You are a coding assistant.",
      messages: [
        {
          role: "user",
          content: "What is TypeScript?"
        },
        {
          role: "assistant",
          content: "TypeScript extends JavaScript."
        },
        {
          role: "user",
          content: "What is its main benefit?"
        }
      ],
      signal: expect.any(AbortSignal)
    });
  });

  it("rejects an empty conversation", async () => {
    const provider = createConversationProvider();

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateConversation({
        messages: []
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROMPT"
    });

    expect(provider.generateConversation).not.toHaveBeenCalled();
  });

  it("rejects an empty message", async () => {
    const provider = createConversationProvider();

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateConversation({
        messages: [
          {
            role: "user",
            content: "   "
          }
        ]
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROMPT"
    });
  });

  it("rejects invalid runtime roles", async () => {
    const provider = createConversationProvider();

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateConversation({
        messages: [
          {
            role: "system",
            content: "Invalid role"
          }
        ]
      } as never)
    ).rejects.toMatchObject({
      code: "INVALID_PROMPT"
    });
  });

  it("rejects providers without conversation support", async () => {
    const provider: AIProviderClient = {
      generateText: vi.fn(async () => ({
        text: "Result",
        model: "custom-model",
        provider: "custom"
      }))
    };

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateConversation({
        messages: [
          {
            role: "user",
            content: "Hello"
          }
        ]
      })
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_OPERATION"
    });
  });
});
