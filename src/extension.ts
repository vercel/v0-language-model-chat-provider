import * as vscode from 'vscode';
import { V0ChatModelProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
	const provider = new V0ChatModelProvider(context);
	vscode.lm.registerLanguageModelChatProvider('v0', provider);

	// Register the management command
	const disposable = vscode.commands.registerCommand('v0.manage', () => {
		provider.manageApiKey();
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
