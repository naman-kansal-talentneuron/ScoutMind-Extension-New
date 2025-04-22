// File: llm/llm-bridge.js (Refactored)

import { Logger } from '../utils/logger.js';
import { ExternalConnector } from './external-connector.js';
import { OllamaConnector } from './ollama-connector.js';

// Assuming connectors are loaded via importScripts or similar
// importScripts('ollama-connector.js', 'external-connector.js');

/**
 * Defines the expected interface for LLM connector classes.
 * Connectors should implement a `generateResponse` method.
 * @interface LLMConnectorInterface
 */
/**
 * Generates a response from the LLM provider.
 * @function
 * @name LLMConnectorInterface#generateResponse
 * @param {string} prompt - The prompt to send.
 * @param {object} [modelConfig={}] - Model-specific configuration.
 * @returns {Promise<string>} - A promise resolving with the generated text content.
 */

/**
 * Registry for LLM provider factory functions.
 * Maps provider names (keys in config) to functions that create connector instances.
 * @type {Object.<string, function(object, Logger): LLMConnectorInterface>}
 */
const providerFactoryRegistry = {};

// --- Registration ---
// Register known providers. This should happen after connector scripts are loaded.
// This registration decouples the Bridge from knowing about specific classes directly.

if (typeof OllamaConnector !== 'undefined') {
    providerFactoryRegistry['ollama'] = (config, logger) => new OllamaConnector(config, logger);
    console.log("OllamaConnector registered with LLM Bridge factory.");
} else {
    console.warn("OllamaConnector class not found during factory registration.");
}

if (typeof ExternalConnector !== 'undefined') {
    // ExternalConnector handles multiple underlying providers based on its own config
    const externalProviders = ['openai', 'mistral']; // Add others like 'anthropic' here
    externalProviders.forEach(providerName => {
        providerFactoryRegistry[providerName] = (config, logger) => {
            // Pass the provider name explicitly to ExternalConnector constructor
            const connectorConfig = { ...config, provider: providerName };
            return new ExternalConnector(connectorConfig, logger);
        };
        console.log(`ExternalConnector registered for provider "${providerName}".`);
    });
} else {
    console.warn("ExternalConnector class not found during factory registration.");
}
// --- End Registration ---


/**
 * LLM Bridge - Abstraction layer for interacting with various LLM providers
 * Supports both local (Ollama) and cloud (OpenAI, Mistral) providers with fallback mechanisms
 */

export class LLMBridge {
    /**
     * Creates a new LLMBridge instance
     * @param {Object} config - Configuration for LLM providers
     * @param {Logger} [logger] - Optional logger instance
     */
    constructor(config = {}, logger = new Logger('LLMBridge')) {
        this.logger = logger;
        this.config = config;
        this.providers = new Map();
        
        // Default provider is the one specified in config or the first registered one
        this.defaultProvider = null;
    }

    /**
     * Initializes the LLM Bridge
     * @returns {Promise<void>}
     */
    async initialize() {
        this.logger.debug('Initializing LLMBridge');
        
        // Dynamic imports to avoid bundling all providers at once
        try {
            // Import and register the Ollama provider if enabled
            if (this.config.llmProvider === 'ollama' || !this.config.llmProvider) {
                const { OllamaConnector } = await import('./ollama-connector.js');
                this.registerProvider('ollama', new OllamaConnector(this.config, this.logger));
            }
            
            // Import and register the external (OpenAI, etc.) provider if enabled
            if (this.config.llmProvider === 'openai' || this.config.llmProvider === 'mistral') {
                const { ExternalConnector } = await import('./external-connector.js');
                this.registerProvider('external', new ExternalConnector(this.config, this.logger));
            }
            
            // Set default provider
            this.defaultProvider = this.config.llmProvider || 'ollama';
            
            this.logger.info('LLMBridge initialized successfully');
        } catch (error) {
            this.logger.error('Error initializing LLMBridge', error);
            throw error;
        }
    }

    /**
     * Registers an LLM provider
     * @param {string} providerId - Unique identifier for the provider
     * @param {Object} provider - Provider instance with query method
     */
    registerProvider(providerId, provider) {
        if (!provider || typeof provider.query !== 'function') {
            throw new Error(`Invalid provider: ${providerId}`);
        }
        
        this.providers.set(providerId, provider);
        this.logger.debug(`Registered LLM provider: ${providerId}`);
        
        // If this is the first provider, set it as default
        if (!this.defaultProvider) {
            this.defaultProvider = providerId;
        }
    }

    /**
     * Gets a specific LLM provider by ID
     * @param {string} providerId - The provider ID to get
     * @returns {Object|null} The provider or null if not found
     */
    getProvider(providerId) {
        return this.providers.get(providerId) || null;
    }

    /**
     * Lists all registered providers
     * @returns {Array<string>} Array of provider IDs
     */
    getProviderIds() {
        return Array.from(this.providers.keys());
    }

    /**
     * Sends a query to the specified LLM provider
     * @param {string} prompt - The prompt to send
     * @param {Object} [options={}] - Query options
     * @param {string} [options.provider] - Provider ID to use (default: this.defaultProvider)
     * @param {string} [options.model] - Model to use (overrides config)
     * @param {number} [options.temperature] - Temperature (overrides config)
     * @param {number} [options.maxTokens] - Max tokens (overrides config)
     * @param {boolean} [options.stream=false] - Whether to stream the response
     * @returns {Promise<Object>} Response object with text property
     */
    async query(prompt, options = {}) {
        const providerId = options.provider || this.defaultProvider;
        const provider = this.providers.get(providerId);
        
        if (!provider) {
            const availableProviders = Array.from(this.providers.keys());
            throw new Error(`LLM provider '${providerId}' not found. Available providers: ${availableProviders.join(', ')}`);
        }
        
        try {
            this.logger.debug(`Sending query to provider: ${providerId}`, { 
                promptLength: prompt.length,
                options: { ...options, prompt: undefined } // Don't log the full prompt
            });
            
            const response = await provider.query(prompt, options);
            
            this.logger.debug(`Received response from provider: ${providerId}`, { 
                responseLength: response.text?.length || 0
            });
            
            return response;
        } catch (error) {
            this.logger.error(`Error querying provider: ${providerId}`, error);
            
            // Try fallback provider if specified
            if (options.fallbackProvider && options.fallbackProvider !== providerId) {
                this.logger.info(`Trying fallback provider: ${options.fallbackProvider}`);
                return this.query(prompt, { ...options, provider: options.fallbackProvider, fallbackProvider: null });
            }
            
            throw error;
        }
    }

    /**
     * Updates the configuration for the LLM bridge
     * @param {Object} newConfig - New configuration object
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Update the default provider if specified
        if (newConfig.llmProvider) {
            this.defaultProvider = newConfig.llmProvider;
        }
        
        // Update providers with new config
        for (const provider of this.providers.values()) {
            if (typeof provider.updateConfig === 'function') {
                provider.updateConfig(this.config);
            }
        }
        
        this.logger.debug('Updated LLMBridge configuration');
    }

    /**
     * Validates an API key for the specified provider
     * @param {string} providerId - Provider ID (e.g., 'openai', 'mistral')
     * @param {string} apiKey - API key to validate
     * @returns {Promise<Object>} Validation result with success boolean and message
     */
    async validateApiKey(providerId, apiKey) {
        this.logger.debug(`Validating API key for provider: ${providerId}`);
        
        try {
            const provider = this.providers.get('external');
            
            if (!provider || typeof provider.validateApiKey !== 'function') {
                throw new Error(`Provider ${providerId} doesn't support API key validation`);
            }
            
            const result = await provider.validateApiKey(providerId, apiKey);
            return result;
        } catch (error) {
            this.logger.error(`API key validation failed for: ${providerId}`, error);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

console.log("LLMBridge Class loaded.");
