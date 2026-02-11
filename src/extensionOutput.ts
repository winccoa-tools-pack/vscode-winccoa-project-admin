/**
 * @fileoverview Core logging utility for WinCC OA VS Code extensions.
 * Provides a centralized output channel with configurable log levels,
 * formatted messages, and VS Code integration.
 */

import * as vscode from 'vscode';
import { EXTENSION_CONFIG_SECTION, EXTENSION_NAME } from './const';

/**
 * Enumeration of available log levels, ordered by severity.
 * Lower values indicate higher severity (ERROR is most severe).
 */
export enum LogLevel {
    /** Critical errors that prevent normal operation */
    ERROR = 0,
    /** Warnings about potential issues */
    WARN = 1,
    /** General informational messages */
    INFO = 2,
    /** Detailed debugging information */
    DEBUG = 3,
    /** Very detailed tracing information for development */
    TRACE = 4,
}

/**
 * Mapping of log levels to their string representations for display.
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.TRACE]: 'TRACE',
};

/**
 * Mapping of log levels to their visual icons for better readability in the output channel.
 */
const LOG_LEVEL_ICONS: Record<LogLevel, string> = {
    [LogLevel.ERROR]: '❌',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.TRACE]: '🔬',
};

/**
 * Core logging utility class for WinCC OA VS Code extensions.
 *
 * This class provides a centralized logging mechanism that integrates with VS Code's
 * output channel system. It supports multiple log levels, configurable verbosity,
 * formatted messages with timestamps and icons, and automatic error display.
 *
 * The log level can be configured via the extension's settings using the
 * `${EXTENSION_CONFIG_SECTION}.logLevel` configuration key.
 *
 * @example
 * ```typescript
 * // Initialize the output channel (usually done in activate())
 * const outputChannel = ExtensionOutputChannel.initialize();
 * context.subscriptions.push(outputChannel);
 *
 * // Log messages at different levels
 * ExtensionOutputChannel.error('Database', 'Connection failed', error);
 * ExtensionOutputChannel.warn('Config', 'Using default settings');
 * ExtensionOutputChannel.info('Extension', 'Activated successfully');
 * ExtensionOutputChannel.debug('Parser', 'Processing file: example.txt');
 * ExtensionOutputChannel.trace('Network', 'Sending request', { url: 'api.example.com' });
 * ```
 */
export class ExtensionOutputChannel {
    /** The VS Code output channel instance */
    public static instance: vscode.OutputChannel;


    /** Current log level threshold - messages below this level are filtered out */
    private static currentLogLevel: LogLevel = LogLevel.INFO;

    /**
     * Initializes the output channel for the extension.
     *
     * This method should be called once during extension activation. It creates
     * the VS Code output channel and sets up the initial log level from configuration.
     *
     * @returns The initialized VS Code output channel instance
     * @example
     * ```typescript
     * const outputChannel = ExtensionOutputChannel.initialize();
     * context.subscriptions.push(outputChannel);
     * ```
     */
    public static initialize(): vscode.OutputChannel {
        if (!ExtensionOutputChannel.instance) {
            ExtensionOutputChannel.instance = vscode.window.createOutputChannel(EXTENSION_NAME);
        }

        // Read log level from configuration
        ExtensionOutputChannel.updateLogLevel();

        return ExtensionOutputChannel.instance;
    }

    /**
     * Updates the current log level from VS Code configuration.
     *
     * Reads the `${EXTENSION_CONFIG_SECTION}.logLevel` setting and applies it.
     * Should be called when configuration changes or during initialization.
     *
     * Supported log levels: 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'
     * Defaults to 'INFO' if invalid value is provided.
     */
    public static updateLogLevel(): void {
        const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTION);
        const levelString = config.get<string>('logLevel', 'INFO');
        ExtensionOutputChannel.currentLogLevel =
            LogLevel[levelString as keyof typeof LogLevel] || LogLevel.INFO;

        ExtensionOutputChannel.log(LogLevel.INFO, 'Logger', `Log level set to: ${levelString}`);
    }

    /**
     * Internal logging method that formats and outputs messages to the channel.
     *
     * @private
     * @param level - The log level of the message
     * @param source - The source component/module generating the log (e.g., 'Extension', 'Database')
     * @param message - The log message content
     * @param error - Optional Error object for ERROR level messages (includes stack trace)
     */
    private static log(level: LogLevel, source: string, message: string, error?: Error): void {
        if (!ExtensionOutputChannel.instance || level > ExtensionOutputChannel.currentLogLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = LOG_LEVEL_NAMES[level].padEnd(5);
        const icon = LOG_LEVEL_ICONS[level];
        const formattedSource = source.padEnd(20);

        let logMessage = `[${timestamp}] ${icon} ${levelName} [${formattedSource}] ${message}`;

        // Add stack trace for errors if available
        if (error && level === LogLevel.ERROR) {
            logMessage += `\n    Stack: ${error.stack || error.message}`;
        }

        ExtensionOutputChannel.instance.appendLine(logMessage);

        // Auto-show output on errors
        if (level === LogLevel.ERROR) {
            ExtensionOutputChannel.instance.show(true);
        }
    }

    // Public API methods

    /**
     * Logs an error message with optional Error object details.
     *
     * Error messages automatically show the output channel and include stack traces
     * when an Error object is provided.
     *
     * @param source - The source component generating the error
     * @param message - The error message
     * @param error - Optional Error object for additional details and stack trace
     */
    public static error(source: string, message: string, error?: Error): void {
        ExtensionOutputChannel.log(LogLevel.ERROR, source, message, error);
    }

    /**
     * Logs a warning message.
     *
     * @param source - The source component generating the warning
     * @param message - The warning message
     */
    public static warn(source: string, message: string): void {
        ExtensionOutputChannel.log(LogLevel.WARN, source, message);
    }

    /**
     * Logs an informational message.
     *
     * @param source - The source component generating the message
     * @param message - The informational message
     */
    public static info(source: string, message: string): void {
        ExtensionOutputChannel.log(LogLevel.INFO, source, message);
    }

    /**
     * Logs a debug message for development and troubleshooting.
     *
     * @param source - The source component generating the message
     * @param message - The debug message
     */
    public static debug(source: string, message: string): void {
        ExtensionOutputChannel.log(LogLevel.DEBUG, source, message);
    }

    /**
     * Logs a trace message with optional structured data for detailed debugging.
     *
     * @param source - The source component generating the message
     * @param message - The trace message
     * @param data - Optional structured data to be JSON-stringified and included
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static trace(source: string, message: string, data?: any): void {
        let msg = message;
        if (data !== undefined) {
            msg += `\n    Data: ${JSON.stringify(data, null, 2)}`;
        }
        ExtensionOutputChannel.log(LogLevel.TRACE, source, msg);
    }

    // Convenience methods (legacy compatibility)

    /**
     * Logs a success message with a checkmark icon.
     *
     * @param source - The source component generating the message
     * @param message - The success message
     * @deprecated Use {@link info} instead for consistency
     */
    public static success(source: string, message: string): void {
        ExtensionOutputChannel.log(LogLevel.INFO, source, `✅ ${message}`);
    }

    /**
     * Shows the output channel in the VS Code UI.
     *
     * Useful for programmatically opening the logs for user inspection.
     */
    public static show(): void {
        if (ExtensionOutputChannel.instance) {
            ExtensionOutputChannel.instance.show();
        }
    }
}
