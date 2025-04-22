// utils/logger.js

/**
 * Logger utility with multiple log levels and context prefixing.
 * Handles consistent logging across the extension.
 */
export class Logger {
    /**
     * Creates a new Logger instance.
     * @param {string} context - The context label for this logger (e.g., component name)
     * @param {string} [level='log'] - Default log level (debug, log, info, warn, error, none)
     */
    constructor(context = 'ScoutMind', level = 'log') {
        this.context = context;
        this.level = level;
        this.LOG_LEVELS = {
            'debug': 0,
            'log': 1,
            'info': 2,
            'warn': 3,
            'error': 4,
            'none': 5
        };
    }

    /**
     * Sets the current log level.
     * @param {string} level - The new log level
     */
    setLevel(level) {
        if (this.LOG_LEVELS[level] === undefined) {
            console.warn(`[${this.context}] Invalid log level: ${level}, keeping current: ${this.level}`);
            return;
        }
        
        const oldLevel = this.level;
        this.level = level;
        this.log(`Log level changed from ${oldLevel} to ${level}`);
    }

    /**
     * Gets the current log level.
     * @returns {string} The current log level
     */
    getLevel() {
        return this.level;
    }

    /**
     * Formats a log message with context and timestamp.
     * @param {string} message - The message to format
     * @returns {string} The formatted message
     * @private
     */
    _formatMessage(message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${this.context}] ${message}`;
    }

    /**
     * Determines if a log level should be shown.
     * @param {string} level - The level to check
     * @returns {boolean} Whether this level should be logged
     * @private
     */
    _shouldLog(level) {
        return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.level];
    }

    /**
     * Logs a debug message.
     * @param {string} message - The message to log
     * @param {any} [data] - Optional data to log
     */
    debug(message, data) {
        if (this._shouldLog('debug')) {
            if (data !== undefined) {
                console.debug(this._formatMessage(message), data);
            } else {
                console.debug(this._formatMessage(message));
            }
        }
    }

    /**
     * Logs a standard log message.
     * @param {string} message - The message to log
     * @param {any} [data] - Optional data to log
     */
    log(message, data) {
        if (this._shouldLog('log')) {
            if (data !== undefined) {
                console.log(this._formatMessage(message), data);
            } else {
                console.log(this._formatMessage(message));
            }
        }
    }

    /**
     * Logs an info message.
     * @param {string} message - The message to log
     * @param {any} [data] - Optional data to log
     */
    info(message, data) {
        if (this._shouldLog('info')) {
            if (data !== undefined) {
                console.info(this._formatMessage(message), data);
            } else {
                console.info(this._formatMessage(message));
            }
        }
    }

    /**
     * Logs a warning message.
     * @param {string} message - The message to log
     * @param {any} [data] - Optional data to log
     */
    warn(message, data) {
        if (this._shouldLog('warn')) {
            if (data !== undefined) {
                console.warn(this._formatMessage(message), data);
            } else {
                console.warn(this._formatMessage(message));
            }
        }
    }

    /**
     * Logs an error message.
     * @param {string} message - The message to log
     * @param {any} [data] - Optional data to log
     */
    error(message, data) {
        if (this._shouldLog('error')) {
            if (data !== undefined) {
                console.error(this._formatMessage(message), data);
            } else {
                console.error(this._formatMessage(message));
            }
        }
    }
}

console.log("Logger Class loaded.");

// utils/storage-manager.js
// import { Logger } from './logger.js';

export class StorageManager {
  constructor(storageArea = 'local', logger = new Logger('StorageManager')) {
    this.logger = logger;
    // ... rest of implementation
  }
}
