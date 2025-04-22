import { Logger } from '../utils/logger.js';

/**
 * OllamaConnector provides integration with locally running Ollama models.
 */
export class OllamaConnector {
    /**
     * Creates a new OllamaConnector instance
     * @param {Object} config - Configuration for Ollama
     * @param {Logger} [logger] - Optional logger instance
     */
    constructor(config = {}, logger = new Logger('OllamaConnector')) {
        this.logger = logger;
        this.config = config;
        
        this.baseUrl = config.ollamaUrl || 'http://localhost:11434';
        this.defaultModel = config.models?.ollama || 'llama2';
        
        this.logger.debug('OllamaConnector initialized', {
            baseUrl: this.baseUrl,
            defaultModel: this.defaultModel
        });
    }

    /**
     * Updates the connector configuration
     * @param {Object} newConfig - New configuration object
     */
    updateConfig(newConfig) {
        if (newConfig.ollamaUrl) {
            this.baseUrl = newConfig.ollamaUrl;
        }
        
        if (newConfig.models?.ollama) {
            this.defaultModel = newConfig.models.ollama;
        }
        
        this.config = { ...this.config, ...newConfig };
        this.logger.debug('Updated OllamaConnector configuration');
    }

    /**
     * Sends a query to Ollama
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Response object with text property
     */
    async query(prompt, options = {}) {
        const model = options.model || this.defaultModel;
        const temperature = options.temperature !== undefined ? options.temperature : this.config.temperature || 0.7;
        const maxTokens = options.maxTokens || this.config.maxTokens || 2048;
        
        this.logger.debug('Sending query to Ollama', {
            model,
            temperature,
            maxTokens,
            promptLength: prompt.length
        });
        
        try {
            // Ollama API URL for completions
            const url = `${this.baseUrl}/api/generate`;
            
            // Prepare request body
            const requestBody = {
                model: model,
                prompt: prompt,
                options: {
                    temperature: temperature,
                },
                system: options.systemPrompt || '',
                stream: false
            };
            
            if (maxTokens > 0) {
                requestBody.options.num_predict = maxTokens;
            }
            
            // Make request to Ollama API
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            return {
                text: data.response,
                usage: {
                    promptTokens: data.prompt_eval_count || 0,
                    completionTokens: data.eval_count || 0,
                    totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
                },
                model: data.model
            };
        } catch (error) {
            this.logger.error('Error querying Ollama', error);
            
            // Check if it's a connection error (likely Ollama not running)
            if (error.message.includes('Failed to fetch') || 
                error.message.includes('ECONNREFUSED') || 
                error.message.includes('NetworkError')) {
                throw new Error(`Unable to connect to Ollama at ${this.baseUrl}. Is Ollama running?`);
            }
            
            throw error;
        }
    }

    /**
     * Lists available models in Ollama
     * @returns {Promise<Array<string>>} List of available model names
     */
    async listModels() {
        try {
            const url = `${this.baseUrl}/api/tags`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            // Extract model names from the response
            const models = data.models ? data.models.map(m => m.name) : [];
            
            this.logger.debug(`Listed ${models.length} available Ollama models`);
            return models;
        } catch (error) {
            this.logger.error('Error listing Ollama models', error);
            
            // Check if it's a connection error
            if (error.message.includes('Failed to fetch') || 
                error.message.includes('ECONNREFUSED') || 
                error.message.includes('NetworkError')) {
                throw new Error(`Unable to connect to Ollama at ${this.baseUrl}. Is Ollama running?`);
            }
            
            throw error;
        }
    }

    /**
     * Checks if the Ollama service is available
     * @returns {Promise<boolean>} True if Ollama is available
     */
    async checkAvailability() {
        try {
            await this.listModels();
            return true;
        } catch (error) {
            this.logger.error('Ollama service unavailable', error);
            return false;
        }
    }
}

console.log("OllamaConnector Class loaded.");
