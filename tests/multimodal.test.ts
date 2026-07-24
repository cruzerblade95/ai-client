import { describe, expect, it, vi } from "vitest";

import { AIClient } from "../src/client.js";
import type { AIProviderClient } from "../src/types/provider.js";

const imageData = new Uint8Array([1, 2, 3]);

const content = [
  {
    type: "image" as const,
    mediaType: "image/png" as const,
    data: imageData
  },
  {
    type: "text" as const,
    text: "Describe this image."
  }
];

describe("AIClient multimodal input", () => {
  it("passes content to the provider", async () => {
    const generateMultimodal = vi.fn().mockResolvedValue({
      text: "A test image",
      model: "test-model",
      provider: "custom"
    });

    const provider = {
      generateText: vi.fn(),
      generateMultimodal
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    const result = await client.generateMultimodal({
      content
    });

    expect(result.text).toBe("A test image");

    expect(generateMultimodal).toHaveBeenCalledWith(
      expect.objectContaining({
        content,
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("rejects empty content", async () => {
    const provider = {
      generateText: vi.fn(),
      generateMultimodal: vi.fn()
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateMultimodal({
        content: []
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROMPT"
    });
  });

  it("requires an image", async () => {
    const provider = {
      generateText: vi.fn(),
      generateMultimodal: vi.fn()
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateMultimodal({
        content: [
          {
            type: "text",
            text: "Text only"
          }
        ]
      })
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST"
    });
  });

  it("rejects empty image data", async () => {
    const provider = {
      generateText: vi.fn(),
      generateMultimodal: vi.fn()
    } satisfies AIProviderClient;

    const client = new AIClient({
      provider
    });

    await expect(
      client.generateMultimodal({
        content: [
          {
            type: "image",
            mediaType: "image/png",
            data: new Uint8Array()
          }
        ]
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
      client.generateMultimodal({
        content
      })
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_OPERATION"
    });
  });
});
