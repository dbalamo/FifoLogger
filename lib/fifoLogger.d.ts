export declare const LogDestination: {
    readonly STDOUT: 0;
    readonly FILE: 1;
};
export type LogDestination = typeof LogDestination[keyof typeof LogDestination];
export declare const LogLevel: {
    DEBUG: number;
    INFO: number;
    WARNING: number;
    ERROR: number;
    CRITICAL: number;
};
export type LogLevel = typeof LogLevel[keyof typeof LogLevel];
export declare const DequeueTimeoutMs: {
    readonly FAST: 100;
    readonly STANDARD: 250;
    readonly MEDIUM: 500;
    readonly SLOW: 1000;
};
export type DequeueTimeoutMs = typeof DequeueTimeoutMs[keyof typeof DequeueTimeoutMs];
export interface FifoLoggerConfig {
    logPrefix?: string;
    minLogLevel?: LogLevel;
    maxEventLength?: number;
    destination?: LogDestination;
    useColor?: boolean;
    jsonMode?: boolean;
    fileName?: string;
    dequeueTimeoutMs?: DequeueTimeoutMs;
    rejuvenateLog?: boolean;
    rejuvenateSizeMB?: number;
}
export declare class FifoLogger {
    private static readonly MAX_STREAM_ERROR_RETRIES;
    private static readonly STREAM_ERROR_RETRY_DELAY_MS;
    private static readonly TO_REJUVENATE_MS;
    private static readonly ONE_MB_BYTES;
    private static cfg;
    private static _logWriteStream;
    private static _logQueueItems;
    private static _bCanWritemore;
    private static _timeout;
    private static _closeRequested;
    private static _initialized;
    private static _streamErrorRetryCount;
    private static _rejuvenateTimeout;
    private static _mustRejuvenate;
    private static _rejuvenateSizeMB;
    static init(flc: FifoLoggerConfig): void;
    private static openStream;
    private static onStreamError;
    static close(callback?: () => void): void;
    private static setDequeueTimeout;
    private static toSeverity;
    static log(logLevel: LogLevel, message: string, ...optionalParams: any[]): void;
    static debug(message: string, ...optionalParams: any[]): void;
    static info(message: string, ...optionalParams: any[]): void;
    static warn(message: string, ...optionalParams: any[]): void;
    static error(message: string, ...optionalParams: any[]): void;
    static critical(message: string, ...optionalParams: any[]): void;
    private static buildMessage;
    private static buildJsonMessage;
    private static buildTerminalMessage;
    private static buildTerminalColorMessage;
    private static writeMessage;
    private static writeFile;
    private static dequeueTimeoutHandler;
    private static flush;
    private static rejuvenateTimeoutHandler;
    private static checkMustRejuvenateLogFile;
    private static rejuvenateLogFile;
}
