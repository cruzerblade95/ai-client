# @cruzerblade95/ai-client

A provider-agnostic, TypeScript-first AI SDK for building AI-powered applications with a stable, future-proof interface.

[![CI](https://github.com/cruzerblade95/ai-client/actions/workflows/ci.yml/badge.svg)](https://github.com/cruzerblade95/ai-client/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@cruzerblade95/ai-client.svg)](https://www.npmjs.com/package/@cruzerblade95/ai-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Provider-agnostic core client API
- AWS Bedrock provider support
- TypeScript-first design
- Input validation and structured errors
- Retry and timeout support
- Strict ESM build output

## Installation

```bash
pnpm add @cruzerblade95/ai-client
```

## Quick start

```ts
import { AIClient } from "@cruzerblade95/ai-client";

const ai = new AIClient({
  provider: "bedrock",
  region: "us-east-1",
  model: "amazon.nova-lite-v1:0"
});

const response = await ai.generateText({
  prompt: "Analyze this portfolio"
});

console.log(response.text);
```

## Configuration

```ts
interface AIClientOptions {
  provider: "bedrock";
  region?: string;
  model: string;
  maxRetries?: number;
  timeout?: number;
}
```

## AWS credential setup

This package uses the AWS SDK v3 default credential provider chain. Credentials can come from:

- environment variables
- AWS CLI profiles
- IAM roles for EC2, ECS, or Lambda

## Supported providers

- AWS Bedrock (current)
- Additional providers planned for future releases

## API documentation

### AIClient

```ts
const client = new AIClient({ provider: "bedrock", region: "us-east-1", model: "model-id" });
const response = await client.generateText({ prompt: "Hello" });
```

### Error handling

The SDK throws AIClientError objects with a stable error code:

```ts
try {
  await client.generateText({ prompt: "" });
} catch (error) {
  if (error instanceof AIClientError) {
    console.error(error.code, error.message);
  }
}
```

## Resource cleanup

Long-running applications can reuse one `AIClient`
instance. Short scripts and tests should release the
underlying provider resources when finished.

```ts
const client = new AIClient({
  provider: "bedrock",
  region: "us-east-1",
  model: "amazon.nova-lite-v1:0"
});

try {
  const response = await client.generateText({
    prompt: "Hello"
  });

  console.log(response.text);
} finally {
  client.destroy();
}
```

## Step 8 — Run all checks

```powershell
pnpm format
pnpm typecheck
pnpm test
pnpm build
```

## Testing

```bash
pnpm test
```

## Building

```bash
pnpm build
```

## Release process

Tags following the format v0.1.0 will trigger npm publication through GitHub Actions.

## Roadmap

- v0.1.0: AWS Bedrock, text generation, TypeScript support, tests
- v0.2.0: Retry handling and timeout handling
- v0.3.0: Streaming and structured output
- v0.4.0: OpenAI and Anthropic providers
- v1.0.0: Stable multi-provider API

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

## License

MIT
