import * as fs from 'fs';

export const LogDestination = {
  STDOUT: 0,
  FILE: 1,
} as const;
export type LogDestination = typeof LogDestination[keyof typeof LogDestination];

export const LogLevel = {
  DEBUG: -1,
  INFO: 0,
  WARNING: 1,
  ERROR: 2,
  CRITICAL: 3
}
export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

export const DequeueTimeoutMs = {
  STANDARD: 100,
  EASY: 250,
  MEDIUM: 500,
  SLOW: 1000,
} as const;
export type DequeueTimeoutMs = typeof DequeueTimeoutMs[keyof typeof DequeueTimeoutMs];

export interface FifoLoggerConfig {
  logPrefix?: string
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

export class FifoLogger {

  //private constants
  private static readonly MAX_STREAM_ERROR_RETRIES = 5;
  private static readonly STREAM_ERROR_RETRY_DELAY_MS = 1000;
  private static readonly TO_REJUVENATE_MS = 10000;
  private static readonly ONE_MB_BYTES = 1048576

  //configuration private variables
  private static _dequeueTimeoutMs: DequeueTimeoutMs = DequeueTimeoutMs.STANDARD;
  private static _logPrefix = '';
  private static _hasColoredConsole = typeof module !== 'undefined' && module.exports;
  private static _minLogLevel = 0;
  private static _maxEventLength = 0;
  private static _filename = '';
  private static _jsonMode = false;

  //private variables
  private static _logWriteStream: fs.WriteStream | null = null;
  private static _logQueueItems: string[] = [];
  private static _bCanWritemore: boolean = true
  private static _timeout: NodeJS.Timeout | null = null
  private static _closeRequested: boolean = false
  private static _initialized = false;
  private static _streamErrorRetryCount = 0;
  private static _rejuvenateTimeout: NodeJS.Timeout | null = null
  private static _mustRejuvenate: boolean = false;
  private static _rejuvenateSizeMB: number = 10;

  static init(flc: FifoLoggerConfig) {
    if (FifoLogger._initialized) {
      return;
    }

    FifoLogger._logPrefix = flc.logPrefix ? flc.logPrefix : '';
    FifoLogger._minLogLevel = flc.minLogLevel ? flc.minLogLevel : LogLevel.INFO
    FifoLogger._maxEventLength = flc.maxEventLength ? flc.maxEventLength : 0

    FifoLogger._hasColoredConsole = flc.useColor ? flc.useColor : true
    FifoLogger._jsonMode = flc.jsonMode ? flc.jsonMode : false
    FifoLogger._dequeueTimeoutMs = flc.dequeueTimeoutMs ? flc.dequeueTimeoutMs : 100

    if (flc.destination === LogDestination.FILE && flc.fileName) {
      FifoLogger._filename = flc.fileName;
      FifoLogger.openStream()
      FifoLogger.setDequeueTimeout()
    }

    if (flc.rejuvenateLog && flc.rejuvenateSizeMB && flc.fileName && flc.destination === LogDestination.FILE) {
      FifoLogger._rejuvenateSizeMB = flc.rejuvenateSizeMB
      FifoLogger._rejuvenateTimeout = setTimeout(() => {
        FifoLogger.rejuvenateTimeoutHandler()
      }, FifoLogger.TO_REJUVENATE_MS);
    }

    FifoLogger._initialized = true
  }

  private static openStream() {
    FifoLogger._logWriteStream = fs.createWriteStream(FifoLogger._filename, { autoClose: false, flags: 'a' });

    FifoLogger._logWriteStream.on('drain', () => {
      //console.log("DRAIN EVENT RECVD")
      FifoLogger._bCanWritemore = true
    });

    FifoLogger._logWriteStream.on('error', (error) => {
      console.error(`FifoLogger: Error writing to file '${FifoLogger._filename}'. Error: ${error.message}`);
      FifoLogger.onStreamError()
    });
  }

  private static onStreamError() {
    try {
      FifoLogger._logWriteStream.close()
    } catch (closeError) {
      console.error(`FifoLogger: Error closing stream after write error: ${closeError.message}`);
    }
    FifoLogger._logWriteStream = null;
    FifoLogger._bCanWritemore = false;
    if (FifoLogger._streamErrorRetryCount < FifoLogger.MAX_STREAM_ERROR_RETRIES) {
      FifoLogger._streamErrorRetryCount++;
      const delay = FifoLogger.STREAM_ERROR_RETRY_DELAY_MS * FifoLogger._streamErrorRetryCount
      setTimeout(() => {
        try {
          FifoLogger.openStream();
          console.log(`FifoLogger: Log file stream re-opened successfully.`);
          FifoLogger._streamErrorRetryCount = 0;
          FifoLogger._bCanWritemore = true;
        } catch (openError) {
          console.error(`FifoLogger: Failed to reopen stream during retry: ${openError.message}`);
        }
      }, delay);
    } else {
      console.error(`FifoLogger: Max retries reached for opening log file. File logging disabled.`);
      FifoLogger._filename = '';
    }
  }

  static close(callback: () => void = null) {
    FifoLogger._closeRequested = true

    if (FifoLogger._timeout) {
      clearTimeout(FifoLogger._timeout)
    }

    FifoLogger.flush()

    if (FifoLogger._logWriteStream) {
      FifoLogger._logWriteStream.end(() => {
        FifoLogger._initialized = false
        FifoLogger._closeRequested = false
        FifoLogger._streamErrorRetryCount = 0
        FifoLogger._logQueueItems = []
        if (callback) {
          callback()
        }
      })
    } else {
      if (callback) {
        callback()
      }
    }
  }

  private static setDequeueTimeout() {
    if (!FifoLogger._timeout) {
      FifoLogger._timeout = setTimeout(() => {
        FifoLogger.dequeueTimeoutHandler()
      }, FifoLogger._dequeueTimeoutMs)
    }
  }

  // TODO: check under heavy load - the FD Count must not increment
  // private static getFDCount() {
  //   var readdir = require('fs').readdir;

  //   readdir('/proc/self/fd', function (err, list) {
  //     if (err) throw err;
  //     console.log("FD COUNT=" + list.length);
  //   });
  // }

  private static toSeverity(logLevel: LogLevel) {
    switch (logLevel) {
      case LogLevel.DEBUG: return 'debug';
      case LogLevel.INFO: return 'info';
      case LogLevel.WARNING: return 'warning';
      case LogLevel.ERROR: return 'error';
      case LogLevel.CRITICAL: return 'critical';
      default: return 'info';
    }
  }

  static log(logLevel: LogLevel, message: string, ...optionalParams: any[]) {
    if (FifoLogger._closeRequested) {
      return;
    }

    if (!FifoLogger._timeout && FifoLogger._logWriteStream && FifoLogger._filename && FifoLogger._filename.length > 0) {
      FifoLogger.setDequeueTimeout()
    }

    if (logLevel >= FifoLogger._minLogLevel) {
      const msg = FifoLogger.buildMessage(
        FifoLogger._hasColoredConsole,
        FifoLogger._jsonMode,
        logLevel,
        message,
        optionalParams
      );
      FifoLogger.writeMessage(msg);
    }
  }

  static debug(message: string, ...optionalParams: any[]) {
    FifoLogger.log(LogLevel.DEBUG, message, ...optionalParams);
  }

  static info(message: string, ...optionalParams: any[]) {
    FifoLogger.log(LogLevel.INFO, message, ...optionalParams);
  }

  static warn(message: string, ...optionalParams: any[]) {
    FifoLogger.log(LogLevel.WARNING, message, ...optionalParams);
  }

  static error(message: string, ...optionalParams: any[]) {
    FifoLogger.log(LogLevel.ERROR, message, ...optionalParams);
  }

  static critical(message: string, ...optionalParams: any[]) {
    FifoLogger.log(LogLevel.CRITICAL, message, ...optionalParams);
  }

  private static buildMessage(color: boolean, json: boolean, logLevel: LogLevel, message: any, optionalParams: any[]) {
    let msg = '';

    if (color && !json) {
      msg = FifoLogger.buildTerminalColorMessage(logLevel, message, optionalParams);
    } else {
      if (json) {
        msg = FifoLogger.buildJsonMessage(logLevel, message, optionalParams);
      } else {
        msg = FifoLogger.buildTerminalMessage(logLevel, message, optionalParams);
      }
    }

    if (FifoLogger._maxEventLength > 0 && msg.length > FifoLogger._maxEventLength) {
      msg = msg.substring(0, FifoLogger._maxEventLength) + '...';
    }

    return msg;
  }

  private static buildJsonMessage(logLevel: LogLevel, message: any, optionalParams: any[]) {
    const date = new Date().toISOString();
    const severity = FifoLogger.toSeverity(logLevel);
    const out = {
      name: FifoLogger._logPrefix,
      severity,
      date,
      message: message,
      optionalParams,
    };
    return JSON.stringify(out);
  }

  private static buildTerminalMessage(logLevel: LogLevel, message: any, optionalParams: any[]) {
    const date = new Date().toISOString();
    const severity = FifoLogger.toSeverity(logLevel);
    const s = '[' + severity + ']';
    const d = '[' + date + ']';
    let e = ''
    if (optionalParams) {
      e = '['
      optionalParams.forEach((prm: any) => {
        e += ' ' + JSON.stringify(prm) + ' '
      })
      e += ']'
    }
    return FifoLogger._logPrefix + ' ' + s + d + '[' + message + ']' + e;
  }

  private static buildTerminalColorMessage(logLevel: LogLevel, message: any, optionalParams: any[]) {
    let date = new Date().toISOString();
    let severity = FifoLogger.toSeverity(logLevel);

    const Reset = '\x1b[0m';
    const FgRed = '\x1b[31m';
    const FgGreen = '\x1b[32m';
    const FgOrange = '\x1b[33m';
    const FgYellow = '\x1b[38;5;226m'
    const FgMagenta = '\x1b[35m';
    const FgCyan = '\x1b[36m';
    const FgWhite = '\x1b[37m';
    const appName = Reset + FgWhite + FifoLogger._logPrefix;
    date = FgGreen + '[' + FgOrange + date + FgGreen + ']';
    let e = ''
    if (optionalParams) {
      e = FgGreen + '['
      optionalParams.forEach((prm: any) => {
        e += ' ' + FgYellow + JSON.stringify(prm) + ' '
      })
      e += FgGreen + ']'
    }

    switch (logLevel) {
      case LogLevel.DEBUG:
        severity = FgGreen + '[' + FgCyan + severity + FgGreen + ']';
        break;
      case LogLevel.INFO:
        severity = FgGreen + '[' + severity + ']';
        break;
      case LogLevel.WARNING:
        severity = FgGreen + '[' + FgYellow + severity + FgGreen + ']';
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        severity = FgGreen + '[' + FgRed + severity + FgGreen + ']';
        break;
      default:
        severity = FgGreen + '[' + severity + ']';
    }
    return appName + ' ' + severity + date + '[' + message + ']' + e;
  }

  private static writeMessage(msg: string) {
    if (FifoLogger._filename && FifoLogger._filename.length > 0) {
      FifoLogger._logQueueItems.push(msg)
    } else {
      console.log(msg);
    }
  }

  private static writeFile(msg: string) {
    const theMsg = msg + '\n'
    FifoLogger._bCanWritemore = FifoLogger._logWriteStream.write(theMsg)
  }

  private static dequeueTimeoutHandler() {
    if (FifoLogger._timeout) {
      FifoLogger._timeout = null
    }
    while (FifoLogger._logWriteStream != null && FifoLogger._bCanWritemore) {
      const msg = FifoLogger._logQueueItems.shift()
      if (msg !== undefined) {
        FifoLogger.writeFile(msg)
      } else {
        break
      }
    }

    if (FifoLogger._mustRejuvenate) {
      FifoLogger._mustRejuvenate = false
      FifoLogger.rejuvenateLogFile()
    }

    FifoLogger.setDequeueTimeout()
  }

  private static flush() {
    while (FifoLogger._logWriteStream != null && FifoLogger._logQueueItems.length > 0) {
      const msg = FifoLogger._logQueueItems.shift()
      if (msg !== undefined) {
        FifoLogger.writeFile(msg)
      }
    }
  }

  private static rejuvenateTimeoutHandler() {
    if (FifoLogger._rejuvenateTimeout) {
      clearTimeout(FifoLogger._rejuvenateTimeout)

      FifoLogger.checkMustRejuvenateLogFile()

      FifoLogger._rejuvenateTimeout = setTimeout(() => {
        FifoLogger.rejuvenateTimeoutHandler()
      }, FifoLogger.TO_REJUVENATE_MS);
    }
  }

  private static checkMustRejuvenateLogFile() {
    fs.stat(FifoLogger._filename, (err, stats) => {
      if (err) {
        console.error(`FifoLogger: Error stat-ing log file '${FifoLogger._filename}'. Error: ${err.message}`);
        return;
      }
      const actualSize = stats.size;
      const maxSize = FifoLogger._rejuvenateSizeMB * FifoLogger.ONE_MB_BYTES;
      if (actualSize >= maxSize) {
        FifoLogger._mustRejuvenate = true
      }
    })
  }

  private static rejuvenateLogFile() {
    FifoLogger._bCanWritemore = false
    FifoLogger._logWriteStream.end(() => {
      FifoLogger._streamErrorRetryCount = 0
      let archFile = ""
      const date = new Date();
      const dateFormat = `${date.getFullYear()}_${date.getMonth() + 1}_${date.getDate()}_${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
      const lastDot = FifoLogger._filename.lastIndexOf(".")
      if (lastDot > 0) {
        const pre = FifoLogger._filename.substring(0, lastDot)
        const post = FifoLogger._filename.substring(lastDot)
        archFile = pre + "_" + dateFormat + post
      } else {
        archFile = FifoLogger._filename + "_" + dateFormat
      }
      fs.renameSync(FifoLogger._filename, archFile)

      FifoLogger.openStream()
      FifoLogger._bCanWritemore = true
    })
  }

}
