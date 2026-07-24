import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConverseStreamOutput } from "@aws-sdk/client-bedrock-runtime";

import { BedrockProvider } from "../src/providers/bedrock.provider.js";

async function* createBedrockStream(): AsyncIterable<ConverseStreamOutput> {
  yield {
    messageStart: {
      role: "assistant"
    }
  };

  yield {
    contentBlockDelta: {
      contentBlockIndex: 0,
      delta: {
        text: "Hello "
      }
    }
  };

  yield {
    contentBlockDelta: {
      contentBlockIndex: 0,
      delta: {
        text: "world"
      }
    }
  };

  yield {
    messageStop: {
      stopReason: "end_turn"
    }
  };

  yield {
    metadata: {
      usage: {
        inputTokens: 5,
        outputTokens: 2,
        totalTokens: 7
      },
      metrics: {
        latencyMs: 100
      }
    }
  };
}

describe("BedrockProvider streaming", () => {
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

  it("maps Bedrock stream events", async () => {
    const provider = createProvider();

    vi.spyOn(provider, "runStreamCommand").mockResolvedValue({
      stream: createBedrockStream()
    });

    const events = [];

    for await (const event of provider.generateTextStream({
      prompt: "Hello"
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: "text-delta",
        text: "Hello "
      },
      {
        type: "text-delta",
        text: "world"
      },
      {
        type: "message-stop",
        stopReason: "end_turn"
      },
      {
        type: "metadata",
        usage: {
          inputTokens: 5,
          outputTokens: 2,
          totalTokens: 7
        },
        latencyMs: 100
      }
    ]);
  });

  it("passes system prompts to ConverseStream", async () => {
    const provider = createProvider();

    const runStreamCommand = vi.spyOn(provider, "runStreamCommand").mockResolvedValue({
      stream: createBedrockStream()
    });

    for await (const _event of provider.generateTextStream({
      prompt: "Review this",
      systemPrompt: "You are a reviewer."
    })) {
      // Consume the stream.
    }

    expect(runStreamCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        system: [
          {
            text: "You are a reviewer."
          }
        ]
      }),
      undefined
    );
  });

  it("rejects a missing response stream", async () => {
    const provider = createProvider();

    vi.spyOn(provider, "runStreamCommand").mockResolvedValue({
      stream: undefined
    });

    const consumeStream = async () => {
      for await (const _event of provider.generateTextStream({
        prompt: "Hello"
      })) {
        // Consume the stream.
      }
    };

    await expect(consumeStream()).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });
});
