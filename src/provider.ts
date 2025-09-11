import {
	CancellationToken,
	ExtensionContext,
	LanguageModelChatInformation,
	LanguageModelChatMessage,
	LanguageModelChatProvider,
	LanguageModelChatTool,
	LanguageModelChatToolMode,
	LanguageModelResponsePart,
	LanguageModelTextPart,
	LanguageModelToolCallPart,
	LanguageModelToolResultPart,
	Progress,
	ProvideLanguageModelChatResponseOptions,
	window,
	InputBoxOptions
} from 'vscode';

interface V0ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	tool_calls?: V0ToolCall[];
	tool_call_id?: string;
}

interface V0Tool {
	type: string;
	function?: {
		name: string;
		description?: string;
		parameters?: object;
	};
}

interface V0ChatRequest {
	model: string;
	messages: V0ChatMessage[];
	stream?: boolean;
	max_completion_tokens?: number;
	tools?: V0Tool[];
	tool_choice?: string | object;
}

interface V0ToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
}

interface V0ChatResponse {
	choices: Array<{
		message: {
			content: string;
			tool_calls?: V0ToolCall[];
		};
		delta?: {
			content?: string;
		};
	}>;
}

function getV0ModelInfo(
	id: string,
	name: string,
	description: string,
	maxInputTokens: number,
	maxOutputTokens: number
): LanguageModelChatInformation {
	return {
		id,
		name,
		tooltip: `v0 ${name} - ${description}`,
		family: 'v0',
		maxInputTokens,
		maxOutputTokens,
		version: '1.5.0',
		capabilities: {
			toolCalling: true, // v0 models support function/tool calls according to docs
			imageInput: true // v0 models support multimodal (text and image inputs)
		}
	};
}

export class V0ChatModelProvider implements LanguageModelChatProvider {
	private static readonly API_KEY_SECRET = 'v0.apiKey';
	private static readonly BASE_URL = 'https://api.v0.dev';

	constructor(private context: ExtensionContext) {}

	async provideLanguageModelChatInformation(
		options: { silent: boolean },
		_token: CancellationToken
	): Promise<LanguageModelChatInformation[]> {
		const apiKey = await this.context.secrets.get(
			V0ChatModelProvider.API_KEY_SECRET
		);

		if (!apiKey) {
			if (options.silent) {
				return [];
			} else {
				await this.promptForApiKey();
				const newApiKey = await this.context.secrets.get(
					V0ChatModelProvider.API_KEY_SECRET
				);
				if (!newApiKey) {
					return [];
				}
			}
		}

		return [
			getV0ModelInfo(
				'v0-1.5-md',
				'v0-1.5-md',
				'For everyday tasks and UI generation',
				128000,
				64000
			),
			getV0ModelInfo(
				'v0-1.5-lg',
				'v0-1.5-lg',
				'For advanced thinking or reasoning',
				512000,
				64000
			)
		];
	}

	async provideLanguageModelChatResponse(
		model: LanguageModelChatInformation,
		messages: Array<LanguageModelChatMessage>,
		options: ProvideLanguageModelChatResponseOptions,
		progress: Progress<LanguageModelResponsePart>,
		token: CancellationToken
	): Promise<void> {
		const apiKey = await this.context.secrets.get(
			V0ChatModelProvider.API_KEY_SECRET
		);

		if (!apiKey) {
			progress.report(
				new LanguageModelTextPart(
					"Error: v0 API key not configured. Please run the 'Manage v0 API Key' command."
				)
			);
			return;
		}

		try {
			const v0Messages = this.convertMessages(messages);
			const response = await this.makeV0Request(
				model.id,
				v0Messages,
				apiKey,
				options.tools,
				options.toolMode,
				token
			);

			if (response && response.choices && response.choices.length > 0) {
				const message = response.choices[0].message;
				if (message) {
					this.processV0Response(message, progress);
				} else {
					progress.report(
						new LanguageModelTextPart('Error: No response message from v0 API')
					);
				}
			} else {
				progress.report(
					new LanguageModelTextPart('Error: No response from v0 API')
				);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error occurred';
			progress.report(new LanguageModelTextPart(`Error: ${errorMessage}`));
		}
	}

	async provideTokenCount(
		_model: LanguageModelChatInformation,
		text: string | LanguageModelChatMessage,
		_token: CancellationToken
	): Promise<number> {
		// Simple token estimation - roughly 4 characters per token
		const textContent =
			typeof text === 'string' ? text : this.extractTextFromMessage(text);
		return Math.ceil(textContent.length / 4);
	}

	async manageApiKey(): Promise<void> {
		const options: InputBoxOptions = {
			prompt: 'Enter your v0 API key',
			password: true,
			placeHolder: 'v0_...',
			ignoreFocusOut: true
		};

		const apiKey = await window.showInputBox(options);

		if (apiKey) {
			await this.context.secrets.store(
				V0ChatModelProvider.API_KEY_SECRET,
				apiKey
			);
			window.showInformationMessage('v0 API key saved successfully!');
		}
	}

	private async promptForApiKey(): Promise<void> {
		const result = await window.showInformationMessage(
			'v0 API key is required to use v0 models. Would you like to configure it now?',
			'Configure API Key',
			'Cancel'
		);

		if (result === 'Configure API Key') {
			await this.manageApiKey();
		}
	}

	private convertMessages(
		messages: Array<LanguageModelChatMessage>
	): V0ChatMessage[] {
		return messages.map((msg) => {
			const role = msg.role === 1 ? 'user' : 'assistant'; // LanguageModelChatMessageRole.User = 1
			const v0Message: V0ChatMessage = {
				role,
				content: ''
			};

			// Process message content parts
			const textParts: string[] = [];
			const toolCalls: V0ToolCall[] = [];
			let toolCallId: string | undefined;

			for (const part of msg.content) {
				if (typeof part === 'object' && part !== null) {
					if ('value' in part && typeof part.value === 'string') {
						// Text part
						textParts.push(part.value);
					} else if (part instanceof LanguageModelToolCallPart) {
						// Tool call part
						toolCalls.push({
							id: part.callId,
							type: 'function',
							function: {
								name: part.name,
								arguments: JSON.stringify(part.input)
							}
						});
					} else if (part instanceof LanguageModelToolResultPart) {
						// Tool result part
						toolCallId = part.callId;
						// Extract text content from tool result
						const resultTexts = part.content
							.filter((resultPart): resultPart is { value: string } =>
								typeof resultPart === 'object' &&
								resultPart !== null &&
								'value' in resultPart
							)
							.map(resultPart => resultPart.value);
						textParts.push(...resultTexts);
					}
				}
			}

			// Set content and tool-related fields
			v0Message.content = textParts.join('');

			if (toolCalls.length > 0) {
				v0Message.tool_calls = toolCalls;
			}

			if (toolCallId) {
				v0Message.tool_call_id = toolCallId;
			}

			return v0Message;
		});
	}

	private processV0Response(
		message: { content: string; tool_calls?: V0ToolCall[] },
		progress: Progress<LanguageModelResponsePart>
	): void {
		// Report text content if present
		if (message.content) {
			progress.report(new LanguageModelTextPart(message.content));
		}

		// Process tool calls if present
		if (message.tool_calls && message.tool_calls.length > 0) {
			for (const toolCall of message.tool_calls) {
				if (toolCall.type === 'function' && toolCall.function) {
					try {
						// Parse the JSON arguments string
						const input = JSON.parse(toolCall.function.arguments);
						progress.report(
							new LanguageModelToolCallPart(
								toolCall.id,
								toolCall.function.name,
								input
							)
						);
					} catch (error) {
						console.error('Failed to parse tool call arguments:', error);
						// Still report the tool call with raw arguments as fallback
						progress.report(
							new LanguageModelToolCallPart(
								toolCall.id,
								toolCall.function.name,
								{ arguments: toolCall.function.arguments }
							)
						);
					}
				}
			}
		}
	}

	private extractTextFromMessage(message: LanguageModelChatMessage): string {
		return message.content
			.filter(
				(part: unknown): part is { value: string } =>
					typeof part === 'object' && part !== null && 'value' in part
			)
			.map((part) => part.value)
			.join('');
	}

	private convertToolsToV0Format(tools: readonly LanguageModelChatTool[]): V0Tool[] {
		return tools.map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema || {}
			}
		}));
	}

	private convertToolMode(toolMode: LanguageModelChatToolMode): string {
		switch (toolMode) {
			case LanguageModelChatToolMode.Auto:
				return 'auto';
			case LanguageModelChatToolMode.Required:
				return 'required';
			default:
				return 'auto';
		}
	}

	private async makeV0Request(
		modelId: string,
		messages: V0ChatMessage[],
		apiKey: string,
		tools: readonly LanguageModelChatTool[] | undefined,
		toolMode: LanguageModelChatToolMode,
		token: CancellationToken
	): Promise<V0ChatResponse> {
		const requestBody: V0ChatRequest = {
			model: modelId,
			messages,
			max_completion_tokens: 64_000
		};

		// Convert and add tools if provided
		if (tools && tools.length > 0) {
			requestBody.tools = this.convertToolsToV0Format(tools);
			requestBody.tool_choice = this.convertToolMode(toolMode);
		}

		const response = await fetch(
			`${V0ChatModelProvider.BASE_URL}/v1/chat/completions`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify(requestBody),
				signal: token.isCancellationRequested ? AbortSignal.abort() : undefined
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`v0 API request failed: ${response.status} ${response.statusText} - ${errorText}`
			);
		}

		return await response.json();
	}
}
