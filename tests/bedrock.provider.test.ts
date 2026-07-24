import { afterEach, describe, expect, it, vi } from "vitest";

import { BedrockProvider } from "../src/providers/bedrock.provider.js";

const createdProviders:
  BedrockProvider[] = [];

function createBedrockProvider():
  BedrockProvider {
  const provider =
  createBedrockProvider();

  createdProviders.push(provider);

  return provider;
}

describe("BedrockProvider", () => {
  afterEach(() => {
    for (const provider of createdProviders) {
      provider.destroy();
    }

    createdProviders.length = 0;

    vi.restoreAllMocks();
  });

  it("maps a successful Bedrock response into the public response shape", async () => {
    const provider =
  createBedrockProvider();

    vi.spyOn(provider, "runCommand").mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [
            {
              text: "Bedrock says hi"
            }
          ]
        }
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
      },
      metrics: {
        latencyMs: 100
      }
    });

    const response = await provider.generateText({
      prompt: "Hello"
    });

    expect(response).toEqual({
      text: "Bedrock says hi",
      model: "amazon.nova-lite-v1:0",
      provider: "bedrock",
      usage: {
        inputTokens: 10,
        outputTokens: 20
      }
    });
  });

  it("maps the system prompt into the Bedrock request", async () => {
    const provider =
  createBedrockProvider();

    const runCommand = vi.spyOn(provider, "runCommand").mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [
            {
              text: "Review completed"
            }
          ]
        }
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
      },
      metrics: {
        latencyMs: 100
      }
    });

    await provider.generateText({
      prompt: "Review this code",
      systemPrompt: "You are a senior TypeScript reviewer."
    });

    expect(runCommand).toHaveBeenCalledOnce();

    expect(runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "amazon.nova-lite-v1:0",
        system: [
          {
            text: "You are a senior TypeScript reviewer."
          }
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                text: "Review this code"
              }
            ]
          }
        ]
      }),
      undefined
    );
  });

  it("does not add an empty system prompt", async () => {
    const provider =
  createBedrockProvider();

    const runCommand = vi.spyOn(provider, "runCommand").mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [
            {
              text: "Result"
            }
          ]
        }
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
      },
      metrics: {
        latencyMs: 100
      }
    });

    await provider.generateText({
      prompt: "Hello",
      systemPrompt: "   "
    });

    const commandInput = runCommand.mock.calls[0]?.[0];

    expect(commandInput?.system).toBeUndefined();
  });

  it("rejects a Bedrock response without text", async () => {
    const provider =
  createBedrockProvider();

    vi.spyOn(provider, "runCommand").mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: []
        }
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      },
      metrics: {
        latencyMs: 100
      }
    });

    await expect(
      provider.generateText({
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE",
      message: "Bedrock returned no text content"
    });
  });

  it("rejects a whitespace-only Bedrock response", async () => {
    const provider =
  createBedrockProvider();

    vi.spyOn(provider, "runCommand").mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [
            {
              text: "   "
            }
          ]
        }
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 10,
        outputTokens: 0,
        totalTokens: 10
      },
      metrics: {
        latencyMs: 100
      }
    });

    await expect(
      provider.generateText({
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });

  it("wraps provider failures in AIClientError", async () => {
    const provider =
  createBedrockProvider();

    const originalError = new Error("AWS request failed");

    vi.spyOn(provider, "runCommand").mockRejectedValue(originalError);

    await expect(
      provider.generateText({
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      message: "Bedrock request failed",
      cause: originalError
    });
  });

  it("maps Bedrock access-denied failures", async () => {
    const provider =
  createBedrockProvider();
    const accessDeniedError = Object.assign(new Error("Access denied"), {
      name: "AccessDeniedException",
      $metadata: {
        httpStatusCode: 403,
        requestId: "request-403"
      }
    });

    vi.spyOn(provider, "runCommand").mockRejectedValue(accessDeniedError);

    await expect(
      provider.generateText({
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      code: "ACCESS_DENIED",
      statusCode: 403,
      requestId: "request-403",
      cause: accessDeniedError
    });
  });

  it(
    "destroys the AWS Bedrock client",
    () => {
      const provider =
  createBedrockProvider();

      expect(() => {
        provider.destroy();
      }).not.toThrow();
    },
  );
});
