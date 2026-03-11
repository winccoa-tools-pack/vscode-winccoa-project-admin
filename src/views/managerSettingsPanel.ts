import * as vscode from 'vscode';
import {
    ProjEnvManagerOptions,
    ProjEnvManagerStartMode,
} from '@winccoa-tools-pack/npm-winccoa-core';

export class ManagerSettingsPanel {
    public static currentPanel: ManagerSettingsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _resolvePromise: ((value: ProjEnvManagerOptions | null) => void) | undefined;

    private constructor(panel: vscode.WebviewPanel, currentOptions: ProjEnvManagerOptions) {
        this._panel = panel;

        // Set webview content
        this._panel.webview.html = this._getHtmlContent(currentOptions);

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'save':
                        if (this._resolvePromise) {
                            this._resolvePromise(message.options);
                        }
                        this._panel.dispose();
                        break;
                    case 'cancel':
                        if (this._resolvePromise) {
                            this._resolvePromise(null);
                        }
                        this._panel.dispose();
                        break;
                }
            },
            null,
            this._disposables,
        );

        // Handle panel disposal
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public static show(
        currentOptions: ProjEnvManagerOptions,
    ): Promise<ProjEnvManagerOptions | null> {
        // Open beside current editor (feels more like a dialog)
        const column = vscode.ViewColumn.Beside;

        // If panel exists, reveal it
        if (ManagerSettingsPanel.currentPanel) {
            ManagerSettingsPanel.currentPanel._panel.reveal(column);
        } else {
            // Create new panel
            const panel = vscode.window.createWebviewPanel(
                'managerSettings',
                'Manager Settings',
                column,
                {
                    enableScripts: true,
                    retainContextWhenHidden: false, // Don't retain - more modal-like
                },
            );

            ManagerSettingsPanel.currentPanel = new ManagerSettingsPanel(panel, currentOptions);
        }

        return new Promise((resolve) => {
            if (ManagerSettingsPanel.currentPanel) {
                ManagerSettingsPanel.currentPanel._resolvePromise = resolve;
            }
        });
    }

    public dispose() {
        ManagerSettingsPanel.currentPanel = undefined;

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _escapeAttr(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private _getHtmlContent(options: ProjEnvManagerOptions): string {
        const nonce = this._getNonce();
        const startOptionsEscaped = this._escapeAttr(options.startOptions || '');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Manager Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
            max-width: 480px;
            margin: 0 auto;
        }
        
        h1 {
            font-size: 20px;
            font-weight: 400;
            margin: 0 0 16px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        
        .manager-name {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }
        
        .form-group {
            margin-bottom: 16px;
        }
        
        label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            font-size: 13px;
            color: var(--vscode-input-foreground);
        }
        
        .label-description {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-weight: 400;
            margin-top: 2px;
        }
        
        input[type="number"],
        input[type="text"],
        select {
            width: 100%;
            padding: 6px 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            box-sizing: border-box;
        }
        
        input:focus,
        select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        
        input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        
        .current-value {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-top: 3px;
            font-style: italic;
        }
        
        .button-group {
            display: flex;
            gap: 8px;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        
        button {
            padding: 6px 14px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-weight: 500;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .info-box {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 10px 12px;
            margin: 0 0 16px 0;
            font-size: 12px;
        }
        
        .warning-box {
            background-color: var(--vscode-inputValidation-warningBackground);
            border-left: 3px solid var(--vscode-inputValidation-warningBorder);
            padding: 10px 12px;
            margin: 16px 0;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Manager Settings</h1>
    
    <div class="info-box">
        <strong>Manager:</strong> <span class="manager-name">${options.component}</span><br>
        <strong>Options:</strong> ${startOptionsEscaped || '(none)'}
    </div>
    
    <form id="settingsForm">
        <div class="form-group">
            <label for="startMode">
                Start Mode
                <div class="label-description">Startup behavior</div>
            </label>
            <select id="startMode" name="startMode">
                <option value="0" ${
                    options.startMode === ProjEnvManagerStartMode.Manual ? 'selected' : ''
                }>Manual</option>
                <option value="1" ${
                    options.startMode === ProjEnvManagerStartMode.Once ? 'selected' : ''
                }>Once - Start at startup</option>
                <option value="2" ${
                    options.startMode === ProjEnvManagerStartMode.Always ? 'selected' : ''
                }>Always - Auto-restart</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="secondToKill">
                Seconds to Kill
                <div class="label-description">Wait time before force-kill (1-300s)</div>
            </label>
            <input type="number" id="secondToKill" name="secondToKill" 
                   min="1" max="300" value="${options.secondToKill}" required>
            <div class="current-value">Typical: 30</div>
        </div>
        
        <div class="form-group">
            <label for="resetStartCounter">
                Restart Counter
                <div class="label-description">Restart attempts (0-10)</div>
            </label>
            <input type="number" id="resetStartCounter" name="resetStartCounter" 
                   min="0" max="10" value="${options.resetStartCounter}" required>
            <div class="current-value">Typical: 3 (or 2 for archive/proxy/sim)</div>
        </div>
        
        <div class="form-group">
            <label for="resetMin">
                Reset Min
                <div class="label-description">Counter reset time (0-60 min)</div>
            </label>
            <input type="number" id="resetMin" name="resetMin"
                   min="0" max="60" value="${options.resetMin}" required>
            <div class="current-value">Typical: 1 (or 2 for archive/proxy/sim)</div>
        </div>
        
        <div class="form-group">
            <label for="startOptions">
                Start Options
                <div class="label-description">Command line arguments</div>
            </label>
            <input type="text" id="startOptions" name="startOptions" 
                   value="${startOptionsEscaped}" 
                   placeholder="e.g., -num 1 -f script.lst">
        </div>
        
        <div class="warning-box">
            ⚠️ Manager will be stopped, updated, and restarted if running
        </div>
        
        <div class="button-group">
            <button type="submit" class="btn-primary">Save</button>
            <button type="button" class="btn-secondary" id="cancelButton">Cancel</button>
        </div>
    </form>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        document.getElementById('settingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const options = {
                component: '${options.component}',
                startMode: parseInt(formData.get('startMode')),
                secondToKill: parseInt(formData.get('secondToKill')),
                resetStartCounter: parseInt(formData.get('resetStartCounter')),
                resetMin: parseInt(formData.get('resetMin')),
                startOptions: formData.get('startOptions')
            };
            
            vscode.postMessage({
                command: 'save',
                options: options
            });
        });
        
        document.getElementById('cancelButton').addEventListener('click', () => {
            vscode.postMessage({
                command: 'cancel'
            });
        });
    </script>
</body>
</html>`;
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
