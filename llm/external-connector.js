import { Logger } from '../utils/logger.js';

/**
 * ExternalConnector provides integration with external LLM providers like OpenAI and Mistral.
 */
export class ExternalConnector {
    /**
     * Creates a new ExternalConnector instance
     * @param {Object} config - Configuration for external providers
     * @param {Logger} [logger] - Optional logger instance
     */
    constructor(config = {}, logger = new Logger('ExternalConnector')) {
        this.logger = logger;
        this.config = config;
        
        // Provider-specific endpoints
        this.endpoints = {
            openai: 'https://api.openai.com/v1/chat/completions',
            mistral: 'https://api.mistral.ai/v1/chat/completions',
            anthropic: 'https://api.anthropic.com/v1/messages'
        };
        
        // Default models for each provider
        this.defaultModels = {
            openai: config.models?.openai || 'gpt-3.5-turbo',
            mistral: config.models?.mistral || 'mistral-tiny',
            anthropic: config.models?.anthropic || 'claude-3-sonnet-20240229'
        };
        
        this.logger.debug('ExternalConnector initialized');
    }

    /**
     * Updates the connector configuration
     * @param {Object} newConfig - New configuration object
     */
    updateConfig(newConfig) {
        // Update models if specified
        if (newConfig.models) {
            if (newConfig.models.openai) {
                this.defaultModels.openai = newConfig.models.openai;
            }
            if (newConfig.models.mistral) {
                this.defaultModels.mistral = newConfig.models.mistral;
            }
            if (newConfig.models.anthropic) {
                this.defaultModels.anthropic = newConfig.models.anthropic;
            }
        }
        
        this.config = { ...this.config, ...newConfig };
        this.logger.debug('Updated ExternalConnector configuration');
    }

    /**
     * Sends a query to the specified external provider
     * @param {string} prompt - The prompt to send
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Response object with text property
     */
    async query(prompt, options = {}) {
        // Determine which provider to use
        const provider = options.provider || this.config.llmProvider || 'openai';
        
        // Ensure we have a valid provider
        if (!this.endpoints[provider]) {
            throw new Error(`Unknown provider: ${provider}`);
        }
        
        // Get the API key for the selected provider
        const apiKey = this._getApiKey(provider);
        
        if (!apiKey) {
            throw new Error(`No API key found for ${provider}. Please set one in the options.`);
        }
        
        // Get model and other parameters
        const model = options.model || this.defaultModels[provider];
        const temperature = options.temperature !== undefined ? options.temperature : this.config.temperature || 0.7;
        const maxTokens = options.maxTokens || this.config.maxTokens || 2048;
        const systemPrompt = options.systemPrompt || '';
        
        this.logger.debug(`Sending query to ${provider}`, {
            model,
            temperature,
            maxTokens,
            promptLength: prompt.length
        });
        
        try {
            // Call the appropriate provider method
            switch (provider) {
                case 'openai':
                    return await this._queryOpenAI(apiKey, model, prompt, systemPrompt, temperature, maxTokens);
                case 'mistral':
                    return await this._queryMistral(apiKey, model, prompt, systemPrompt, temperature, maxTokens);
                case 'anthropic':
                    return await this._queryAnthropic(apiKey, model, prompt, systemPrompt, temperature, maxTokens);
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        } catch (error) {
            this.logger.error(`Error querying ${provider}`, error);
            throw error;
        }
    }

    /**
     * Gets the API key for the specified provider
     * @param {string} provider - Provider name (e.g. 'openai', 'mistral')
     * @returns {string|null} API key or null if not found
     * @private
     */
    _getApiKey(provider) {
        if (this.config.apiKeys && this.config.apiKeys[provider]) {
            return this.config.apiKeys[provider];
        }
        
        return null;
    }

    /**
     * Sends a query to OpenAI
     * @param {string} apiKey - OpenAI API key
     * @param {string} model - Model name
     * @param {string} prompt - User prompt
     * @param {string} systemPrompt - System prompt
     * @param {number} temperature - Temperature parameter
     * @param {number} maxTokens - Maximum tokens to generate
     * @returns {Promise<Object>} Response object
     * @private
     */
    async _queryOpenAI(apiKey, model, prompt, systemPrompt, temperature, maxTokens) {
        const messages = [];
        
        // Add system message if provided
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        
        // Add user message
        messages.push({ role: 'user', content: prompt });
        
        const requestBody = {
            model: model,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            n: 1
        };
        
        const response = await fetch(this.endpoints.openai, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(`OpenAI API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        
        return {
            text: data.choices[0]?.message?.content || '',
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: data.usage?.total_tokens || 0
            },
            model: data.model
        };
    }

    /**
     * Sends a query to Mistral AI
     * @param {string} apiKey - Mistral API key
     * @param {string} model - Model name
     * @param {string} prompt - User prompt
     * @param {string} systemPrompt - System prompt
     * @param {number} temperature - Temperature parameter
     * @param {number} maxTokens - Maximum tokens to generate
     * @returns {Promise<Object>} Response object
     * @private
     */
    async _queryMistral(apiKey, model, prompt, systemPrompt, temperature, maxTokens) {
        const messages = [];
        
        // Add system message if provided
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        
        // Add user message
        messages.push({ role: 'user', content: prompt });
        
        const requestBody = {
            model: model,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens
        };
        
        const response = await fetch(this.endpoints.mistral, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(`Mistral API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        
        return {
            text: data.choices[0]?.message?.content || '',
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: data.usage?.total_tokens || 0
            },
            model: data.model
        };
    }

    /**
     * Sends a query to Anthropic Claude
     * @param {string} apiKey - Anthropic API key
     * @param {string} model - Model name
     * @param {string} prompt - User prompt
     * @param {string} systemPrompt - System prompt
     * @param {number} temperature - Temperature parameter
     * @param {number} maxTokens - Maximum tokens to generate
     * @returns {Promise<Object>} Response object
     * @private
     */
    async _queryAnthropic(apiKey, model, prompt, systemPrompt, temperature, maxTokens) {
        const requestBody = {
            model: model,
            messages: [
                { role: 'user', content: prompt }
            ],
            temperature: temperature,
            max_tokens: maxTokens
        };
        
        // Add system prompt if provided
        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }
        
        const response = await fetch(this.endpoints.anthropic, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(`Anthropic API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
        }
        
        const data = await response.json();
        
        return {
            text: data.content[0]?.text || '',
            usage: {
                promptTokens: data.usage?.input_tokens || 0,
                completionTokens: data.usage?.output_tokens || 0,
                totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
            },
            model: data.model
        };
    }

    /**
     * Validates an API key for the specified provider
     * @param {string} provider - Provider name (e.g. 'openai', 'mistral', 'anthropic')
     * @param {string} apiKey - API key to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateApiKey(provider, apiKey) {
        this.logger.debug(`Validating ${provider} API key`);
        
        // Ensure we have a valid provider
        if (!this.endpoints[provider]) {
            throw new Error(`Unknown provider: ${provider}`);
        }
        
        try {
            let endpoint;
            
            // Set up validation parameters based on provider
            switch (provider) {
                case 'openai':
                    endpoint = 'https://api.openai.com/v1/models';
                    break;
                case 'mistral':
                    endpoint = 'https://api.mistral.ai/v1/models';
                    break;
                case 'anthropic':
                    endpoint = 'https://api.anthropic.com/v1/models';
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
            
            // Configure headers based on the provider
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (provider === 'anthropic') {
                headers['x-api-key'] = apiKey;
                headers['anthropic-version'] = '2023-06-01';
            } else {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
            
            // Send a simple models list request to validate the key
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: 'Invalid API key' } }));
                return {
                    success: false,
                    message: `Invalid API key: ${errorData.error?.message || 'Unknown error'}`
                };
            }
            
            return {
                success: true,
                message: `API key for ${provider} is valid`
            };
        } catch (error) {
            this.logger.error(`Error validating ${provider} API key`, error);
            return {
                success: false,
                message: `Error validating API key: ${error.message}`
            };
        }
    }
}

console.log("ExternalConnector Class loaded.");
