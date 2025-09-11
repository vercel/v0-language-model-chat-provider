# v0 Model Provider

This VS Code extension provides access to the v0 Model API through VS Code's Language Model API. The v0 Model API is designed for building modern web applications and supports text and image inputs, streaming responses, and is compatible with the OpenAI Chat Completions API format.

## Features

- **Framework-aware completions**: Evaluated on modern stacks like Next.js and Vercel
- **Auto-fix**: Identifies and corrects common coding issues during generation
- **OpenAI compatible**: Uses the standard OpenAI Chat Completions API format
- **Multimodal**: Supports both text and image inputs
- **Secure storage**: API keys are encrypted using VS Code's secret storage

## Models

### v0-1.5-md

The `v0-1.5-md` model is for everyday tasks and UI generation.

- **Max context window**: 128,000 tokens
- **Max output tokens**: 64,000 tokens

### v0-1.5-lg

The `v0-1.5-lg` model is for advanced thinking or reasoning.

- **Max context window**: 512,000 tokens
- **Max output tokens**: 64,000 tokens

**Capabilities:**

- Supports text and image inputs (multimodal)
- Compatible with OpenAI's Chat Completions format
- Supports function/tool calls
- Streaming responses with low latency
- Optimized for frontend and full-stack web development

## Getting Started

The v0 API is currently in beta and requires a Premium or Team plan with usage-based billing enabled.

### Prerequisites

- VS Code version 1.104.0 or higher
- v0 Premium or Team plan with usage-based billing enabled

### Installation

1. Install the extension from the VS Code marketplace
2. Create an API key at [v0.app/chat/settings/keys](https://v0.app/chat/settings/keys)
3. Configure the API key:
   - Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Run **"Manage v0 API Key"**
   - Enter your API key when prompted

## Usage

### Accessing Models

1. Open VS Code's chat interface
2. Select a v0 model from the model dropdown:
   - `v0-1.5-md` for everyday tasks and UI generation
   - `v0-1.5-lg` for advanced thinking or reasoning
3. Send messages to interact with the model

The extension integrates with VS Code's Language Model API, making v0 models available wherever VS Code's AI features are supported.

## Troubleshooting

**API key not configured**

- Run the "Manage v0 API Key" command and enter your API key

**API request failed**

- Verify your API key is valid
- Check your internet connection
- Ensure you have sufficient API credits

**Models not appearing**

- Confirm the extension is enabled
- Verify your API key is configured correctly
- Restart VS Code if needed

**Billing issues**

- Ensure you have a Premium or Team plan
- Verify usage-based billing is enabled

## Links & Resources

- **[v0.app](https://v0.app)** - Main v0 platform
- **[Get API Key](https://v0.app/chat/settings/keys)** - Create and manage your v0 API keys
- **[v0 Model API Documentation](https://v0.app/docs/api/model)** - Complete API reference and usage guide
- **[Terms of Service](https://vercel.com/legal/terms)** - v0 API terms and conditions
