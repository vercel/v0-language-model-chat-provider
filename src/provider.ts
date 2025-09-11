import {
	CancellationToken,
	ExtensionContext,
	LanguageModelChatInformation,
	LanguageModelChatMessage,
	LanguageModelChatProvider,
	LanguageModelResponsePart,
	LanguageModelTextPart,
	Progress,
	ProvideLanguageModelChatResponseOptions,
	window,
	InputBoxOptions
} from 'vscode';

interface V0ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
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

interface V0ChatResponse {
	choices: Array<{
		message: {
			content: string;
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
		_options: ProvideLanguageModelChatResponseOptions,
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
				token
			);

			if (response && response.choices && response.choices.length > 0) {
				const content =
					response.choices[0].message?.content ||
					response.choices[0].delta?.content ||
					'No response from v0 API';
				progress.report(new LanguageModelTextPart(content));
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
		return messages.map((msg) => ({
			role: msg.role === 1 ? 'user' : 'assistant', // LanguageModelChatMessageRole.User = 1
			content: this.extractTextFromMessage(msg)
		}));
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

	private async makeV0Request(
		modelId: string,
		messages: V0ChatMessage[],
		apiKey: string,
		token: CancellationToken
	): Promise<V0ChatResponse> {
		const requestBody: V0ChatRequest = {
			model: modelId,
			messages,
			max_completion_tokens: 4000 // Default from v0 docs
		};

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
