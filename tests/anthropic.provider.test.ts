import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "../src/providers/anthropic.provider.js";

function createMessage(): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [
      {
        type: "text",
        text: "Hello from Claude",
        citations: null
      }
    ],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    container: null,
    usage: {
      input_tokens: 8,
      output_tokens: 4,
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: "standard"
    }
  };
}

describe("AnthropicProvider", () => {
  it("maps an Anthropic response", async () => {
    const create = vi.fn().mockResolvedValue(createMessage());

    const client = {
      messages: {
        create
      }
    } as unknown as Anthropic;

    const provider = new AnthropicProvider({
      model: "claude-sonnet-5",
      apiKey: "test-key",
      client
    });

    const result = await provider.generateText({
      prompt: "Hello"
    });

    expect(result).toEqual({
      text: "Hello from Claude",
      model: "claude-sonnet-5",
      provider: "anthropic",
      usage: {
        inputTokens: 8,
        outputTokens: 4
      }
    });

    expect(create).toHaveBeenCalledWith(
      {
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: "Hello"
          }
        ]
      },
      {
        signal: undefined
      }
    );
  });

  it("maps the system prompt", async () => {
    const create = vi.fn().mockResolvedValue(createMessage());

    const client = {
      messages: {
        create
      }
    } as unknown as Anthropic;

    const provider = new AnthropicProvider({
      model: "claude-sonnet-5",
      client
    });

    await provider.generateText({
      prompt: "Hello",
      systemPrompt: "Be concise"
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "Be concise"
      }),
      expect.anything()
    );
  });

  it("rejects a response without text", async () => {
    const message = createMessage();
    message.content = [];

    const client = {
      messages: {
        create: vi.fn().mockResolvedValue(message)
      }
    } as unknown as Anthropic;

    const provider = new AnthropicProvider({
      model: "claude-sonnet-5",
      client
    });

    await expect(
      provider.generateText({
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });
});
