// scout-mind-extension/src/utils/storageManager.ts
import { Logger, LogLevel } from './logger'; // Import the new TypeScript Logger

export type StorageAreaName = 'local' | 'sync' | 'managed';

export class StorageManager {
  private logger: Logger;
  private storageAreaName: StorageAreaName;
  private storage: chrome.storage.StorageArea;

  constructor(storageAreaName: StorageAreaName = 'local', logLevel: LogLevel = 'info') {
    this.logger = new Logger(`StorageManager:${storageAreaName}`, logLevel);
    this.storageAreaName = storageAreaName;
    
    if (chrome.storage && chrome.storage[storageAreaName]) {
      this.storage = chrome.storage[storageAreaName];
    } else {
      this.logger.warn(
        `Storage area '${storageAreaName}' is not available. Falling back to local storage.`
      );
      this.storageAreaName = 'local';
      this.storage = chrome.storage.local;
    }
  }

  public async getItem<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      this.logger.debug(`Getting item: ${key}`);
      const result = await this.storage.get(key);
      
      if (result && key in result) {
        return result[key] as T;
      }
      this.logger.debug(`Key '${key}' not found, returning default value.`);
      return defaultValue;
    } catch (error: any) {
      this.logger.error(`Error getting item '${key}': ${error.message}`, error);
      return defaultValue;
    }
  }

  public async setItem(key: string, value: any): Promise<void> {
    try {
      this.logger.debug(`Setting item: ${key}`, value);
      await this.storage.set({ [key]: value });
      this.logger.debug(`Item set successfully: ${key}`);
    } catch (error: any) {
      this.logger.error(`Error setting item '${key}': ${error.message}`, error);
      // Potentially re-throw or handle more gracefully depending on requirements
      throw error; 
    }
  }

  public async removeItem(key: string): Promise<void> {
    try {
      this.logger.debug(`Removing item: ${key}`);
      await this.storage.remove(key);
      this.logger.debug(`Item removed successfully: ${key}`);
    } catch (error: any) {
      this.logger.error(`Error removing item '${key}': ${error.message}`, error);
      throw error;
    }
  }

  public async clear(): Promise<void> {
    try {
      this.logger.debug(`Clearing all items in '${this.storageAreaName}' storage`);
      await this.storage.clear();
      this.logger.debug(`Storage cleared successfully: '${this.storageAreaName}'`);
    } catch (error: any) {
      this.logger.error(`Error clearing storage '${this.storageAreaName}': ${error.message}`, error);
      throw error;
    }
  }

  public async getAllItems<T = { [key: string]: any }>(): Promise<T | undefined> {
    try {
      this.logger.debug(`Getting all items from '${this.storageAreaName}' storage`);
      const allItems = await this.storage.get(null);
      return allItems as T;
    } catch (error: any) {
      this.logger.error(`Error getting all items from storage '${this.storageAreaName}': ${error.message}`, error);
      return undefined;
    }
  }
}
