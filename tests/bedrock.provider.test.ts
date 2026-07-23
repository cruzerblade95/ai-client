import { describe, expect, it, vi } from "vitest";
import { BedrockProvider } from "../src/providers/bedrock.provider.js";
import { AIClientError } from "../src/errors/ai-client.error.js";

describe("BedrockProvider", () => {
  it("maps a successful Bedrock response into the public response shape", async () => {
    const provider = new BedrockProvider({ region: "us-east-1", model: "amazon.nova-lite-v1:0" });

    vi.spyOn(provider as never, "runCommand" as never).mockResolvedValue({
      output: {
        message: {
          content: [{ text: "Bedrock says hi" }]
        }
      }
    });

    const response = await provider.generateText({ prompt: "Hello" });

    expect(response.text).toBe("Bedrock says hi");
    expect(response.model).toBe("amazon.nova-lite-v1:0");
    expect(response.provider).toBe("bedrock");
  });

  it("wraps provider failures in AIClientError", async () => {
    const provider = new BedrockProvider({ region: "us-east-1", model: "amazon.nova-lite-v1:0" });

    vi.spyOn(provider as never, "runCommand" as never).mockRejectedValue(new Error("boom"));

    await expect(provider.generateText({ prompt: "Hello" })).rejects.toMatchObject({
      code: "PROVIDER_ERROR"
    });
  });
});
