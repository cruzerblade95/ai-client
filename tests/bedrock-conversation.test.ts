import { afterEach, describe, expect, it, vi } from "vitest";

import { BedrockProvider } from "../src/providers/bedrock.provider.js";

describe("Bedrock conversations", () => {
  const providers: BedrockProvider[] = [];

  function createProvider(): BedrockProvider {
    const provider = new BedrockProvider({
      region: "us-east-1",
      model: "amazon.nova-lite-v1:0"
    });

    providers.push(provider);

    return provider;
  }

  afterEach(() => {
    for (const provider of providers) {
      provider.destroy();
    }

    providers.length = 0;
    vi.restoreAllMocks();
  });

  it("maps conversation history to Bedrock", async () => {
    const provider = createProvider();

    const runCommand = vi.spyOn(provider, "runCommand").mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [
            {
              text: "Final answer"
            }
          ]
        }
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 20,
        outputTokens: 5,
        totalTokens: 25
      },
      metrics: {
        latencyMs: 100
      }
    });

    const response = await provider.generateConversation({
      systemPrompt: "You are helpful.",
      messages: [
        {
          role: "user",
          content: "Question one"
        },
        {
          role: "assistant",
          content: "Answer one"
        },
        {
          role: "user",
          content: "Question two"
        }
      ]
    });

    expect(response.text).toBe("Final answer");

    expect(runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        system: [
          {
            text: "You are helpful."
          }
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                text: "Question one"
              }
            ]
          },
          {
            role: "assistant",
            content: [
              {
                text: "Answer one"
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                text: "Question two"
              }
            ]
          }
        ]
      }),
      undefined
    );
  });
});
