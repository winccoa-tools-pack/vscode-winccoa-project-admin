import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa.helloWorld', () => {
            vscode.window.showInformationMessage('Hello from WinCC OA Extension!');
        }),
    );
}

export function deactivate() {}
