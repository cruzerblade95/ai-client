# @cruzerblade95/ai-client

A provider-agnostic, TypeScript-first AI SDK for building reliable AI-powered Node.js applications.

[![CI](https://github.com/cruzerblade95/ai-client/actions/workflows/ci.yml/badge.svg)](https://github.com/cruzerblade95/ai-client/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@cruzerblade95/ai-client.svg)](https://www.npmjs.com/package/@cruzerblade95/ai-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- AWS Bedrock Converse API integration
- Custom AI provider support
- TypeScript declarations
- System prompts
- Runtime input validation
- Structured SDK errors
- Abortable requests
- Request timeouts
- Exponential retry with jitter
- Configurable retry behaviour
- AWS credential-provider chain support
- Automated tests and package verification
- Node.js 22 and 24 support
- ESM package output

## Requirements

- Node.js 22 or newer
- An AWS account for the Bedrock provider
- Access to a supported Bedrock model
- AWS credentials with permission to invoke the model

## Installation

Using pnpm:

```bash
pnpm add @cruzerblade95/ai-client
```

Using npm:

```bash
npm install @cruzerblade95/ai-client
```

Using yarn:

```bash
yarn add @cruzerblade95/ai-client
```

## Quick start

```ts
import { AIClient } from "@cruzerblade95/ai-client";

const client = new AIClient({
  provider: "bedrock",
  region: "us-east-1",
  model: "amazon.nova-lite-v1:0"
});

try {
  const response = await client.generateText({
    prompt: "Explain dependency injection in simple terms."
  });

  console.log(response.text);
} finally {
  client.destroy();
}
```

## System prompts

Use `systemPrompt` to provide instructions that are separate from the user's prompt:

```ts
const response = await client.generateText({
  systemPrompt: "You are a senior TypeScript engineer.",
  prompt: "Review this function and identify possible problems.",
  maxTokens: 500,
  temperature: 0.2
});
```

Empty or whitespace-only system prompts are ignored.

## Configuration

### AWS Bedrock configuration

```ts
const client = new AIClient({
  provider: "bedrock",
  model: "amazon.nova-lite-v1:0",
  region: "us-east-1",
  maxRetries: 3,
  timeout: 30_000
});
```

| Option       | Type        | Required |           Default | Description                     |
| ------------ | ----------- | -------: | ----------------: | ------------------------------- |
| `provider`   | `"bedrock"` |      Yes |                 — | Selects AWS Bedrock             |
| `model`      | `string`    |      Yes |                 — | Bedrock model ID                |
| `region`     | `string`    |       No | AWS configuration | AWS region                      |
| `maxRetries` | `number`    |       No |               `0` | Maximum retry count             |
| `timeout`    | `number`    |       No |           `30000` | Overall timeout in milliseconds |

`maxRetries` must be a non-negative integer. `timeout` must be greater than zero.

### Generation request

```ts
interface GenerateTextRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}
```

| Option         | Type          | Required | Description                         |
| -------------- | ------------- | -------: | ----------------------------------- |
| `prompt`       | `string`      |      Yes | User prompt sent to the provider    |
| `systemPrompt` | `string`      |       No | System-level model instructions     |
| `maxTokens`    | `number`      |       No | Positive maximum output-token count |
| `temperature`  | `number`      |       No | Sampling value from `0` to `1`      |
| `signal`       | `AbortSignal` |       No | Cancels the request                 |

## Request cancellation

```ts
const controller = new AbortController();

const responsePromise = client.generateText({
  prompt: "Generate a detailed technical explanation.",
  signal: controller.signal
});

controller.abort();

try {
  await responsePromise;
} catch (error) {
  if (error instanceof AIClientError && error.code === "REQUEST_ABORTED") {
    console.log("The request was cancelled.");
  }
}
```

## Timeout and retry behaviour

The client supports:

- Overall request timeouts
- Cancellable retry delays
- Exponential backoff
- Random jitter
- Maximum retry delays

The SDK does not retry permanent failures such as:

- Invalid prompts
- Invalid configuration
- Authentication failures
- Access-denied errors
- Missing models
- Invalid provider requests

Temporary errors such as rate limits, network failures, and provider unavailability may be retried.

## Error handling

```ts
import { AIClientError } from "@cruzerblade95/ai-client";

try {
  await client.generateText({
    prompt: "Hello"
  });
} catch (error) {
  if (error instanceof AIClientError) {
    console.error({
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      requestId: error.requestId,
      cause: error.cause
    });
  } else {
    throw error;
  }
}
```

Supported error codes include:

| Code                        | Meaning                             |
| --------------------------- | ----------------------------------- |
| `INVALID_PROMPT`            | Invalid generation input            |
| `INVALID_CONFIGURATION`     | Invalid client configuration        |
| `UNSUPPORTED_PROVIDER`      | Unsupported provider name           |
| `INVALID_PROVIDER_RESPONSE` | Provider returned no usable content |
| `AUTHENTICATION_ERROR`      | AWS authentication failed           |
| `ACCESS_DENIED`             | Bedrock access was denied           |
| `MODEL_NOT_FOUND`           | Requested model was not found       |
| `RATE_LIMITED`              | Provider rate limit was reached     |
| `INVALID_REQUEST`           | Provider rejected the request       |
| `NETWORK_ERROR`             | Network communication failed        |
| `PROVIDER_UNAVAILABLE`      | Provider is temporarily unavailable |
| `PROVIDER_ERROR`            | Unclassified provider failure       |
| `TIMEOUT`                   | Request exceeded its timeout        |
| `REQUEST_ABORTED`           | Request was cancelled               |
| `MAX_RETRIES_EXCEEDED`      | Retry limit was reached             |

## AWS credentials

The Bedrock provider uses the AWS SDK default credential-provider chain.

Credentials can come from:

- Environment variables
- AWS CLI profiles
- Shared AWS configuration
- EC2 instance roles
- ECS task roles
- Lambda execution roles

Example AWS CLI setup:

```bash
aws configure
```

Example environment variables:

```bash
AWS_REGION=us-east-1
AWS_PROFILE=your-profile
```

Do not commit AWS access keys or secret keys to source control.

The IAM identity requires permission similar to:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "*"
    }
  ]
}
```

For production, restrict `Resource` to the required model resources whenever possible.

## Custom providers

A custom provider must implement `AIProviderClient`:

```ts
import { AIClient, type AIProviderClient } from "@cruzerblade95/ai-client";

const provider: AIProviderClient = {
  async generateText(request) {
    return {
      text: `Response for: ${request.prompt}`,
      model: "custom-model",
      provider: "custom"
    };
  },

  destroy() {
    // Release provider resources if needed.
  }
};

const client = new AIClient({
  provider,
  timeout: 30_000,
  maxRetries: 2
});

const response = await client.generateText({
  prompt: "Hello"
});

console.log(response.text);

client.destroy();
```

## Resource cleanup

Long-running applications can reuse one client. Short scripts and automated tests should call:

```ts
client.destroy();
```

Use `try` and `finally` when appropriate:

```ts
try {
  const response = await client.generateText({
    prompt: "Hello"
  });

  console.log(response.text);
} finally {
  client.destroy();
}
```

## Streaming

```ts
const stream = client.generateTextStream({
  prompt: "Explain TypeScript generics."
});

for await (const event of stream) {
  if (event.type === "text-delta") {
    process.stdout.write(event.text);
  }

  if (event.type === "metadata") {
    console.log(event.usage);
  }
}
```

Streaming requires the
`bedrock:InvokeModelWithResponseStream` IAM permission.

## Structured output

Use `generateObject()` to parse and validate model
output against a JSON Schema.

```ts
interface Analysis {
  summary: string;
  score: number;
}

const response = await client.generateObject<Analysis>({
  prompt: "Analyze this TypeScript project.",
  schema: {
    type: "object",
    properties: {
      summary: {
        type: "string"
      },
      score: {
        type: "number"
      }
    },
    required: ["summary", "score"],
    additionalProperties: false
  }
});

console.log(response.data.summary);
console.log(response.data.score);
```

The generic type improves TypeScript usage, while the
JSON Schema performs runtime validation.

A generic type alone does not validate model output.

````

## Multi-turn conversations

```ts
const response =
  await client.generateConversation({
    systemPrompt:
      "You are a TypeScript instructor.",
    messages: [
      {
        role: "user",
        content:
          "What is an interface?",
      },
      {
        role: "assistant",
        content:
          "An interface describes an object shape.",
      },
      {
        role: "user",
        content:
          "Show me a simple example.",
      },
    ],
  });

console.log(response.text);
```

Conversation messages support the `user` and `assistant`
roles. Use `systemPrompt` for system-level instructions.


## Current limitations

The current release supports text generation through:

- AWS Bedrock
- Custom provider implementations

The SDK does not yet provide dedicated APIs for:

- Tool calling
- Multimodal input
- Provider-specific reasoning controls
- OpenAI
- Anthropic

Some reasoning-capable models may work through Bedrock text generation, but the SDK does not yet expose dedicated reasoning settings or reasoning-content responses.

## Development

Clone the repository:

```bash
git clone https://github.com/cruzerblade95/ai-client.git
cd ai-client
pnpm install
````

Run validation:

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:package
```

## Scripts

| Command               | Description                    |
| --------------------- | ------------------------------ |
| `pnpm format`         | Formats project files          |
| `pnpm format:check`   | Checks formatting              |
| `pnpm typecheck`      | Checks TypeScript              |
| `pnpm test`           | Runs automated tests           |
| `pnpm test:coverage`  | Runs coverage checks           |
| `pnpm build`          | Builds the package             |
| `pnpm test:package`   | Tests the packed package       |
| `pnpm audit --prod`   | Audits production dependencies |
| `pnpm pack --dry-run` | Inspects package contents      |

## Roadmap

### v0.2

- Streaming text generation
- Structured output
- Improved response metadata

### v0.3

- Multi-turn conversations
- OpenAI provider
- Anthropic provider

### Future

- Tool calling
- Multimodal requests
- Provider-specific reasoning controls
- Middleware and telemetry hooks
- Cost and token estimation

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

Please report security vulnerabilities according to [SECURITY.md](SECURITY.md). Do not disclose vulnerabilities through public GitHub issues.

## License

Licensed under the [MIT License](LICENSE).
