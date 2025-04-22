import { Logger } from './logger.js';

/**
 * Storage Manager utility for handling browser storage operations.
 * Provides a consistent interface for local, sync, and managed storage areas.
 */
export class StorageManager {
    /**
     * Creates a new StorageManager instance.
     * @param {string} storageArea - The storage area to use ('local', 'sync', or 'managed')
     * @param {Logger} [logger] - Optional logger instance
     */
    constructor(storageArea = 'local', logger = new Logger('StorageManager')) {
        this.logger = logger;
        this.storageArea = storageArea;
        this.storage = chrome.storage[storageArea];
        
        if (!this.storage) {
            this.logger.error(`Storage area '${storageArea}' is not available. Falling back to local storage.`);
            this.storageArea = 'local';
            this.storage = chrome.storage.local;
        }
    }

    /**
     * Gets an item from storage.
     * @param {string} key - The key to get
     * @param {any} [defaultValue] - Default value to return if key doesn't exist
     * @returns {Promise<any>} The stored value or defaultValue if not found
     */
    async getItem(key, defaultValue = undefined) {
        try {
            this.logger.debug(`Getting item: ${key}`);
            const result = await this.storage.get(key);
            
            if (key in result) {
                return result[key];
            }
            
            this.logger.debug(`Key '${key}' not found, returning default value`);
            return defaultValue;
        } catch (error) {
            this.logger.error(`Error getting item: ${key}`, error);
            return defaultValue;
        }
    }

    /**
     * Sets an item in storage.
     * @param {string} key - The key to set
     * @param {any} value - The value to store
     * @returns {Promise<void>}
     */
    async setItem(key, value) {
        try {
            this.logger.debug(`Setting item: ${key}`);
            await this.storage.set({ [key]: value });
            this.logger.debug(`Item set successfully: ${key}`);
        } catch (error) {
            this.logger.error(`Error setting item: ${key}`, error);
            throw error;
        }
    }

    /**
     * Removes an item from storage.
     * @param {string} key - The key to remove
     * @returns {Promise<void>}
     */
    async removeItem(key) {
        try {
            this.logger.debug(`Removing item: ${key}`);
            await this.storage.remove(key);
            this.logger.debug(`Item removed successfully: ${key}`);
        } catch (error) {
            this.logger.error(`Error removing item: ${key}`, error);
            throw error;
        }
    }

    /**
     * Clears all items in the storage area.
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            this.logger.debug(`Clearing all items in ${this.storageArea} storage`);
            await this.storage.clear();
            this.logger.debug(`Storage cleared successfully: ${this.storageArea}`);
        } catch (error) {
            this.logger.error(`Error clearing storage: ${this.storageArea}`, error);
            throw error;
        }
    }

    /**
     * Gets all items from storage.
     * @returns {Promise<Object>} All stored items
     */
    async getAllItems() {
        try {
            this.logger.debug(`Getting all items from ${this.storageArea} storage`);
            return await this.storage.get(null);
        } catch (error) {
            this.logger.error(`Error getting all items from storage: ${this.storageArea}`, error);
            throw error;
        }
    }
}

console.log("StorageManager Class loaded.");
