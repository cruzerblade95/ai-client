import { describe, expect, it, vi } from "vitest";
import { AIClient } from "../src/client.js";
import { AIClientError } from "../src/errors/ai-client.error.js";
import type { AIProviderClient } from "../src/types/provider.js";

class StubProvider implements AIProviderClient {
  public readonly generateText = vi.fn();
}

describe("AIClient", () => {
  it("returns generated text from the selected provider", async () => {
    const provider = new StubProvider();
    provider.generateText.mockResolvedValue({
      text: "Hello from AI",
      model: "test-model",
      provider: "bedrock"
    });

    const client = new AIClient(
      {
        provider: "bedrock",
        model: "test-model",
        region: "us-east-1"
      },
      provider
    );

    const response = await client.generateText({ prompt: "Say hello" });

    expect(response.text).toBe("Hello from AI");
    expect(provider.generateText).toHaveBeenCalledWith({ prompt: "Say hello" });
  });

  it("rejects empty prompts", async () => {
    const client = new AIClient({ provider: "bedrock", model: "test-model", region: "us-east-1" });

    await expect(client.generateText({ prompt: "   " })).rejects.toMatchObject({
      code: "INVALID_PROMPT"
    });
  });

  it("rejects invalid configuration", async () => {
    const client = new AIClient({ provider: "bedrock", model: "", region: "" });

    await expect(client.generateText({ prompt: "hello" })).rejects.toMatchObject({
      code: "INVALID_CONFIGURATION"
    });
  });
});
