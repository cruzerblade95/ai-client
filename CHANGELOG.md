# Changelog

All notable changes to this project will be documented
in this file.

The format is based on Keep a Changelog, and this
project follows Semantic Versioning.

## [Unreleased]

### Added

- Streaming text generation with async iterables
- Typed text-delta, completion, and metadata events
- Bedrock ConverseStream support
- Streaming cancellation and timeout handling
- Structured JSON generation with `generateObject()`
- Runtime JSON Schema validation using Ajv
- Typed structured-output responses
- Markdown JSON-fence handling

### Planned

- Streaming text generation
- Structured output
- Additional AI providers
- Multi-turn conversations

## [0.1.0] - 2026-07-24

### Added

- AWS Bedrock Converse API provider
- Custom provider support
- TypeScript declarations
- System prompt support
- Request validation
- Structured AI client errors
- AWS error classification
- Abortable requests
- Overall request timeout
- Exponential retry backoff with jitter
- Configurable retry decisions
- Provider resource cleanup
- Automated tests and coverage thresholds
- Package installation smoke testing
- Node.js 22 and 24 CI validation
- npm publishing workflow
- Dependabot configuration

[Unreleased]: https://github.com/cruzerblade95/ai-client/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cruzerblade95/ai-client/releases/tag/v0.1.0
