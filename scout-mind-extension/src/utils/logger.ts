// scout-mind-extension/src/utils/logger.ts
export type LogLevel = 'debug' | 'log' | 'info' | 'warn' | 'error' | 'none';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  log: 1,
  info: 2,
  warn: 3,
  error: 4,
  none: 5,
};

export class Logger {
  private context: string;
  private currentLevel: LogLevel;

  constructor(context: string, level: LogLevel = 'log') {
    this.context = context;
    this.currentLevel = level;
  }

  private _shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.currentLevel];
  }

  private _formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }

  private _log(level: LogLevel, message: string, data?: any): void {
    if (!this._shouldLog(level)) {
      return;
    }

    const formattedMessage = this._formatMessage(level, message);
    if (data !== undefined) {
      console[level === 'debug' ? 'debug' : 'log'](formattedMessage, data); // console.log for info, warn, error for better object inspection in some browser consoles
    } else {
      console[level === 'debug' ? 'debug' : 'log'](formattedMessage);
    }
  }

  public setLevel(level: LogLevel): void {
     this.info(`Log level changed from ${this.currentLevel} to ${level}`);
     this.currentLevel = level;
  }

  public debug(message: string, data?: any): void {
    this._log('debug', message, data);
  }

  public log(message: string, data?: any): void {
    this._log('log', message, data);
  }

  public info(message: string, data?: any): void {
    this._log('info', message, data);
  }

  public warn(message: string, data?: any): void {
    this._log('warn', message, data);
  }

  public error(message: string, data?: any): void {
    this._log('error', message, data);
  }
}
