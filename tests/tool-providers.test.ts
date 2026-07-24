import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnthropicProvider } from "../src/providers/anthropic.provider.js";
import { BedrockProvider } from "../src/providers/bedrock.provider.js";
import { OpenAIProvider } from "../src/providers/openai.provider.js";

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

describe("provider tool calling", () => {
  const bedrockProviders: BedrockProvider[] = [];

  afterEach(() => {
    vi.restoreAllMocks();

    for (const provider of bedrockProviders) {
      provider.destroy();
    }

    bedrockProviders.length = 0;
  });

  it("maps a Bedrock tool call", async () => {
    const provider = new BedrockProvider({
      region: "us-east-1",
      model: "test-bedrock-model"
    });

    bedrockProviders.push(provider);

    const runCommand = vi.spyOn(provider, "runCommand").mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [
            {
              toolUse: {
                toolUseId: "bedrock-call-1",
                name: "get_weather",
                input: {
                  location: "Kuala Lumpur"
                }
              }
            }
          ]
        }
      },
      stopReason: "tool_use",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15
      },
      metrics: {
        latencyMs: 100
      }
    });

    const response = await provider.generateWithTools({
      prompt: "What is the weather in Kuala Lumpur?",
      tools: [weatherTool],
      toolChoice: "required"
    });

    expect(response).toEqual({
      text: "",
      model: "test-bedrock-model",
      provider: "bedrock",
      toolCalls: [
        {
          id: "bedrock-call-1",
          name: "get_weather",
          arguments: {
            location: "Kuala Lumpur"
          }
        }
      ],
      usage: {
        inputTokens: 10,
        outputTokens: 5
      }
    });

    expect(runCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "test-bedrock-model",
        messages: [
          {
            role: "user",
            content: [
              {
                text: "What is the weather in Kuala Lumpur?"
              }
            ]
          }
        ],
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: "get_weather",
                description: "Get the weather for a location",
                inputSchema: {
                  json: weatherTool.inputSchema
                }
              }
            }
          ],
          toolChoice: {
            any: {}
          }
        }
      }),
      undefined
    );
  });

  it("maps an OpenAI tool call", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "response-1",
      model: "test-openai-model",
      output_text: "",
      output: [
        {
          id: "function-call-1",
          type: "function_call",
          call_id: "openai-call-1",
          name: "get_weather",
          arguments: JSON.stringify({
            location: "Kuala Lumpur"
          }),
          status: "completed"
        }
      ],
      usage: {
        input_tokens: 12,
        output_tokens: 6,
        total_tokens: 18
      }
    });

    const client = {
      responses: {
        create
      }
    } as unknown as OpenAI;

    const provider = new OpenAIProvider({
      model: "test-openai-model",
      apiKey: "test-key",
      client
    });

    const response = await provider.generateWithTools({
      prompt: "What is the weather in Kuala Lumpur?",
      tools: [weatherTool],
      toolChoice: {
        name: "get_weather"
      }
    });

    expect(response).toEqual({
      text: "",
      model: "test-openai-model",
      provider: "openai",
      toolCalls: [
        {
          id: "openai-call-1",
          name: "get_weather",
          arguments: {
            location: "Kuala Lumpur"
          }
        }
      ],
      usage: {
        inputTokens: 12,
        outputTokens: 6
      }
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-openai-model",
        input: "What is the weather in Kuala Lumpur?",
        tools: [
          {
            type: "function",
            name: "get_weather",
            description: "Get the weather for a location",
            parameters: weatherTool.inputSchema,
            strict: false
          }
        ],
        tool_choice: {
          type: "function",
          name: "get_weather"
        }
      }),
      {
        signal: undefined
      }
    );
  });

  it("maps an Anthropic tool call", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "message-1",
      type: "message",
      role: "assistant",
      model: "test-anthropic-model",
      content: [
        {
          type: "tool_use",
          id: "anthropic-call-1",
          name: "get_weather",
          input: {
            location: "Kuala Lumpur"
          }
        }
      ],
      stop_reason: "tool_use",
      stop_sequence: null,
      stop_details: null,
      container: null,
      usage: {
        input_tokens: 14,
        output_tokens: 7,
        cache_creation: null,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        inference_geo: null,
        output_tokens_details: null,
        server_tool_use: null,
        service_tier: "standard"
      }
    });

    const client = {
      messages: {
        create
      }
    } as unknown as Anthropic;

    const provider = new AnthropicProvider({
      model: "test-anthropic-model",
      apiKey: "test-key",
      client
    });

    const response = await provider.generateWithTools({
      prompt: "What is the weather in Kuala Lumpur?",
      tools: [weatherTool],
      toolChoice: "required"
    });

    expect(response).toEqual({
      text: "",
      model: "test-anthropic-model",
      provider: "anthropic",
      toolCalls: [
        {
          id: "anthropic-call-1",
          name: "get_weather",
          arguments: {
            location: "Kuala Lumpur"
          }
        }
      ],
      usage: {
        inputTokens: 14,
        outputTokens: 7
      }
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-anthropic-model",
        messages: [
          {
            role: "user",
            content: "What is the weather in Kuala Lumpur?"
          }
        ],
        tools: [
          {
            name: "get_weather",
            description: "Get the weather for a location",
            input_schema: weatherTool.inputSchema
          }
        ],
        tool_choice: {
          type: "any"
        }
      }),
      {
        signal: undefined
      }
    );
  });

  it("rejects invalid OpenAI tool arguments", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: "",
      output: [
        {
          type: "function_call",
          call_id: "openai-call-1",
          name: "get_weather",
          arguments: "{invalid-json"
        }
      ]
    });

    const client = {
      responses: {
        create
      }
    } as unknown as OpenAI;

    const provider = new OpenAIProvider({
      model: "test-openai-model",
      client
    });

    await expect(
      provider.generateWithTools({
        prompt: "Get the weather",
        tools: [weatherTool]
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });

  it("rejects an empty Bedrock tool response", async () => {
    const provider = new BedrockProvider({
      region: "us-east-1",
      model: "test-bedrock-model"
    });

    bedrockProviders.push(provider);

    vi.spyOn(provider, "runCommand").mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: []
        }
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2
      },
      metrics: {
        latencyMs: 10
      }
    });

    await expect(
      provider.generateWithTools({
        prompt: "Hello",
        tools: [weatherTool]
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });

  it("rejects an empty Anthropic tool response", async () => {
    const create = vi.fn().mockResolvedValue({
      model: "test-anthropic-model",
      content: [],
      usage: {
        input_tokens: 1,
        output_tokens: 1
      }
    });

    const client = {
      messages: {
        create
      }
    } as unknown as Anthropic;

    const provider = new AnthropicProvider({
      model: "test-anthropic-model",
      client
    });

    await expect(
      provider.generateWithTools({
        prompt: "Hello",
        tools: [weatherTool]
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });
});
