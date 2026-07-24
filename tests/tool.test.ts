import { describe, expect, it, vi } from "vitest";

import { AIClient } from "../src/client.js";
import type { AIProviderClient } from "../src/types/provider.js";

const weatherTool = {
  name: "get_weather",
  description: "Get the weather for a location",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string"
      }
    },
    required: ["location"],
    additionalProperties: false
  }
};

describe("AIClient tool calling", () => {
  it("passes tools to the provider", async () => {
    const generateWithTools = vi.fn().mockResolvedValue({
      text: "",
      model: "test-model",
      provider: "custom",
      toolCalls: [
        {
          id: "call-1",
          name: "get_weather",
          arguments: {
            location: "Kuala Lumpur"
          }
        }
      ]
    });

    const provider = {
      generateText: vi.fn(),
      generateWithTools
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    const request = {
      prompt: "What is the weather in Kuala Lumpur?",
      tools: [weatherTool]
    };

    const result = await client.generateWithTools(request);

    expect(result.toolCalls).toHaveLength(1);

    expect(generateWithTools).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: request.prompt,
        tools: request.tools,
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("rejects an empty tools array", async () => {
    const provider = {
      generateText: vi.fn(),
      generateWithTools: vi.fn()
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateWithTools({
        prompt: "Hello",
        tools: []
      })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST"
    });
  });

  it("rejects duplicate tool names", async () => {
    const provider = {
      generateText: vi.fn(),
      generateWithTools: vi.fn()
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateWithTools({
        prompt: "Hello",
        tools: [weatherTool, weatherTool]
      })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST"
    });
  });

  it("rejects unsupported providers", async () => {
    const provider = {
      generateText: vi.fn()
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateWithTools({
        prompt: "Hello",
        tools: [weatherTool]
      })
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_OPERATION"
    });
  });

  it("rejects invalid tool names", async () => {
    const provider = {
      generateText: vi.fn(),
      generateWithTools: vi.fn()
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateWithTools({
        prompt: "Hello",
        tools: [
          {
            ...weatherTool,
            name: "invalid tool name"
          }
        ]
      })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST"
    });
  });

  it("rejects unknown named tool choices", async () => {
    const provider = {
      generateText: vi.fn(),
      generateWithTools: vi.fn()
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateWithTools({
        prompt: "Hello",
        tools: [weatherTool],
        toolChoice: {
          name: "unknown_tool"
        }
      })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST"
    });
  });
});
