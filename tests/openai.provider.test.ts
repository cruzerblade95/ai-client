import OpenAI from "openai";

import { describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "../src/providers/openai.provider.js";

function createMockClient(createResponse: ReturnType<typeof vi.fn>): OpenAI {
  return {
    responses: {
      create: createResponse
    }
  } as unknown as OpenAI;
}

describe("OpenAIProvider", () => {
  it("generates text with the Responses API", async () => {
    const createResponse = vi.fn().mockResolvedValue({
      output_text: "OpenAI response",
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15
      },
      _request_id: "request-123"
    });

    const provider = new OpenAIProvider({
      model: "gpt-5.6-sol",
      client: createMockClient(createResponse)
    });

    const response = await provider.generateText({
      prompt: "Hello",
      systemPrompt: "Be concise.",
      maxTokens: 200
    });

    expect(response).toEqual({
      text: "OpenAI response",
      model: "gpt-5.6-sol",
      provider: "openai",
      usage: {
        inputTokens: 10,
        outputTokens: 5
      }
    });

    expect(createResponse).toHaveBeenCalledWith(
      {
        model: "gpt-5.6-sol",
        input: "Hello",
        instructions: "Be concise.",
        max_output_tokens: 200,
        temperature: undefined
      },
      {
        signal: undefined
      }
    );
  });

  it("rejects an empty response", async () => {
    const provider = new OpenAIProvider({
      model: "gpt-5.6-sol",
      client: createMockClient(
        vi.fn().mockResolvedValue({
          output_text: "   ",
          usage: undefined
        })
      )
    });

    await expect(
      provider.generateText({
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });

  it("maps conversation messages", async () => {
    const createResponse = vi.fn().mockResolvedValue({
      output_text: "Conversation result",
      usage: undefined
    });

    const provider = new OpenAIProvider({
      model: "gpt-5.6-sol",
      client: createMockClient(createResponse)
    });

    await provider.generateConversation({
      messages: [
        {
          role: "user",
          content: "Question"
        },
        {
          role: "assistant",
          content: "Earlier answer"
        },
        {
          role: "user",
          content: "Follow-up"
        }
      ]
    });

    expect(createResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        input: [
          {
            role: "user",
            content: "Question"
          },
          {
            role: "assistant",
            content: "Earlier answer"
          },
          {
            role: "user",
            content: "Follow-up"
          }
        ]
      }),
      {
        signal: undefined
      }
    );
  });
});
