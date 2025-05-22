// scout-mind-extension/src/llm/llmBridge.ts
import { Logger, LogLevel } from '../utils/logger';
import { OllamaConnector, OllamaConfig, OllamaQueryOptions, OllamaResponse } from './ollamaConnector';
import { ExternalConnector, ExternalConnectorConfig, ExternalQueryOptions, ExternalQueryResponse, LLMProviderType, ApiKeyValidationResponse } from './externalConnector';

// Define a generic query options type that can encompass options for any provider
export type GenericQueryOptions = OllamaQueryOptions | ExternalQueryOptions | {
    provider?: string; // General provider ID
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    stream?: boolean;
    fallbackProvider?: string; // For fallback logic
    // Add other common or specific options if needed
};

// Define a generic response type
export type GenericLLMResponse = OllamaResponse | ExternalQueryResponse | {
    text: string;
    error?: string;
    usage?: any; // Could be more specific if common usage fields are defined
    model?: string;
    provider?: string;
};

export interface LLMProvider {
  query(prompt: string, options: GenericQueryOptions): Promise<GenericLLMResponse>;
  updateConfig?(config: LLMBridgeConfig): void; // Config is the overall bridge config
  // Add other common methods like validateApiKey if all providers should have it (ExternalConnector does)
  validateApiKey?(providerId: LLMProviderType, apiKey: string): Promise<ApiKeyValidationResponse>; 
}

export interface LLMBridgeConfig {
  llmProvider?: string; // e.g., 'ollama', 'openai', 'mistral', 'anthropic'
  ollama?: OllamaConfig;
  external?: ExternalConnectorConfig; // This can hold API keys and default models for external providers
  // Add other global settings for the bridge if any
  logLevel?: LogLevel;
}

export class LLMBridge {
  private logger: Logger;
  private config: LLMBridgeConfig;
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProviderId: string | null = null;

  constructor(config: LLMBridgeConfig = {}, loggerLevel?: LogLevel) {
    const effectiveLogLevel = loggerLevel || config.logLevel || 'info';
    this.logger = new Logger('LLMBridge', effectiveLogLevel);
    this.config = config;
    // Default provider will be set during initialization
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing LLMBridge...');

    // For Ollama:
    // We can instantiate OllamaConnector if 'ollama' is the chosen provider or if no provider is specified (making it a default)
    // Or, if specific ollama config is present.
    if (this.config.llmProvider === 'ollama' || !this.config.llmProvider || this.config.ollama) {
        try {
            const ollamaConfig = this.config.ollama || {};
            const ollamaInstance = new OllamaConnector(ollamaConfig, this.logger.getLevel());
            this.registerProvider('ollama', ollamaInstance);
            this.logger.info('OllamaConnector registered and initialized.');
        } catch (err) {
            this.logger.error('Failed to initialize OllamaConnector.', err);
        }
    }

    // For ExternalConnectors (OpenAI, Mistral, Anthropic):
    // ExternalConnector handles multiple external providers. We register one instance of it.
    // It will use its internal config (this.config.external) to determine API keys and default models.
    // The specific external provider (openai, mistral) is chosen at query time or by llmProvider config.
    if (this.config.external || 
        (this.config.llmProvider && ['openai', 'mistral', 'anthropic'].includes(this.config.llmProvider))) {
        try {
            const externalConfig = this.config.external || { llmProvider: this.config.llmProvider as LLMProviderType };
            if (this.config.llmProvider && !externalConfig.llmProvider) { // Ensure default provider is passed if set at bridge level
                 externalConfig.llmProvider = this.config.llmProvider as LLMProviderType;
            }
            const externalInstance = new ExternalConnector(externalConfig, this.logger.getLevel());
            // We register the single ExternalConnector instance under a generic key, e.g., 'external'.
            // Or, we can register it for each specific provider it handles if we want to select it by 'openai', 'mistral' etc.
            // For simplicity here, let's assume ExternalConnector itself handles the 'provider' option in its query method.
            this.registerProvider('external', externalInstance); // General external handler
            this.logger.info('ExternalConnector registered and initialized.');

            // If the main llmProvider is one of the external ones, 'external' could be the default.
            if (this.config.llmProvider && ['openai', 'mistral', 'anthropic'].includes(this.config.llmProvider) && !this.defaultProviderId) {
                this.defaultProviderId = 'external';
            }

        } catch (err) {
            this.logger.error('Failed to initialize ExternalConnector.', err);
        }
    }
    
    // Set default provider ID
    if (this.config.llmProvider) {
        if (this.providers.has(this.config.llmProvider)) { // e.g. 'ollama'
            this.defaultProviderId = this.config.llmProvider;
        } else if (['openai', 'mistral', 'anthropic'].includes(this.config.llmProvider) && this.providers.has('external')) {
            // If 'openai' is chosen, and 'external' connector is registered.
            this.defaultProviderId = 'external'; 
        }
    } else if (this.providers.has('ollama')) { // Fallback to ollama if no preference
        this.defaultProviderId = 'ollama';
    } else if (this.providers.has('external')) { // Then to external
        this.defaultProviderId = 'external';
    }


    if (this.defaultProviderId) {
        this.logger.info(`Default LLM provider set to: ${this.defaultProviderId}`);
    } else {
        this.logger.warn('No default LLM provider could be set. Ensure configuration is correct and providers initialize.');
    }
    this.logger.info('LLMBridge initialized successfully.');
  }

  public registerProvider(providerId: string, provider: LLMProvider): void {
    if (!provider || typeof provider.query !== 'function') {
      this.logger.error(`Attempted to register invalid provider: ${providerId}`);
      throw new Error(`Invalid provider instance for: ${providerId}. Must have a query method.`);
    }
    this.providers.set(providerId, provider);
    this.logger.debug(`Registered LLM provider: ${providerId}`);
    if (!this.defaultProviderId) {
      this.defaultProviderId = providerId; // Set first registered as default if none yet
    }
  }

  public getProvider(providerId: string): LLMProvider | null {
    return this.providers.get(providerId) || null;
  }

  public getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  public async query(prompt: string, options: GenericQueryOptions = {}): Promise<GenericLLMResponse> {
    // Determine the target provider ID for this query
    let targetProviderId = options.provider || this.defaultProviderId;
    
    // If the options.provider is 'openai', 'mistral', or 'anthropic', and 'external' provider exists, route to 'external'
    if (targetProviderId && ['openai', 'mistral', 'anthropic'].includes(targetProviderId) && this.providers.has('external')) {
        targetProviderId = 'external'; 
        // Pass the specific external provider (openai, mistral, etc.) via options for ExternalConnector to handle
        if (!options.provider) options.provider = this.config.llmProvider; // Ensure ExternalConnector knows which one if not in options
    }


    if (!targetProviderId) {
        this.logger.error('No LLM provider specified for query and no default provider is set.');
        return { text: '', error: 'No LLM provider available for query.' };
    }

    const provider = this.providers.get(targetProviderId);

    if (!provider) {
      const availableProviders = Array.from(this.providers.keys());
      const errorMsg = `LLM provider '${targetProviderId}' not found. Available: ${availableProviders.join(', ')}`;
      this.logger.error(errorMsg);
      return { text: '', error: errorMsg };
    }

    try {
      this.logger.debug(`Sending query to provider: ${targetProviderId}`, {
        promptLength: prompt.length,
        options: { ...options, prompt: undefined }, // Don't log full prompt
      });
      
      // Ensure the options passed to the specific provider are correctly typed.
      // This might involve casting or transforming GenericQueryOptions.
      // For now, we assume the connectors can handle GenericQueryOptions or the relevant parts.
      const response = await provider.query(prompt, options);
      
      this.logger.debug(`Received response from provider: ${targetProviderId}`, {
        responseLength: response.text?.length || 0,
        error: response.error,
      });
      response.provider = targetProviderId; // Add provider to response
      return response;

    } catch (error: any) {
      const errorMsg = `Error querying provider ${targetProviderId}: ${error.message || 'Unknown error'}`;
      this.logger.error(errorMsg, error);

      if (options.fallbackProvider && options.fallbackProvider !== targetProviderId) {
        this.logger.info(`Trying fallback provider: ${options.fallbackProvider}`);
        return this.query(prompt, { ...options, provider: options.fallbackProvider, fallbackProvider: undefined });
      }
      return { text: '', error: errorMsg, provider: targetProviderId };
    }
  }

  public updateConfig(newConfig: Partial<LLMBridgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.logLevel) {
        this.logger.setLevel(newConfig.logLevel);
    }

    if (newConfig.llmProvider) {
        if (this.providers.has(newConfig.llmProvider)) {
            this.defaultProviderId = newConfig.llmProvider;
        } else if (['openai', 'mistral', 'anthropic'].includes(newConfig.llmProvider) && this.providers.has('external')) {
            this.defaultProviderId = 'external';
        } else {
            this.logger.warn(`Default provider set to '${newConfig.llmProvider}', but this provider is not registered or mapped.`);
            // Potentially set to null or keep old default? For now, allows setting to a future provider.
            this.defaultProviderId = newConfig.llmProvider; 
        }
        this.logger.info(`Default LLM provider updated to: ${this.defaultProviderId}`);
    }

    // Propagate config updates to individual providers
    this.providers.forEach((provider, providerId) => {
      if (typeof provider.updateConfig === 'function') {
        // Pass the relevant part of the config to each provider
        let providerSpecificConfig: any = this.config;
        if (providerId === 'ollama' && this.config.ollama) {
            providerSpecificConfig = { ...this.config, ...this.config.ollama }; // Merge global and ollama
        } else if (providerId === 'external' && this.config.external) {
            providerSpecificConfig = { ...this.config, ...this.config.external }; // Merge global and external
        }
        provider.updateConfig(providerSpecificConfig);
      }
    });
    this.logger.debug('LLMBridge configuration updated.', this.config);
  }

  public async validateApiKey(providerId: LLMProviderType, apiKey: string): Promise<ApiKeyValidationResponse> {
    this.logger.debug(`Validating API key for external provider type: ${providerId}`);
    const externalProvider = this.providers.get('external') as ExternalConnector; // Assuming it's an ExternalConnector

    if (!externalProvider || typeof externalProvider.validateApiKey !== 'function') {
      const errorMsg = `API key validation is not supported for ${providerId} or ExternalConnector not registered.`;
      this.logger.error(errorMsg);
      return { success: false, error: errorMsg, provider: providerId };
    }
    return externalProvider.validateApiKey(providerId, apiKey);
  }
}
// Removed final console.log.
// Used TypeScript Logger from ../utils/logger.ts.
// Imported OllamaConnector and ExternalConnector with their types.
// Defined LLMProvider interface and other necessary types/interfaces.
// Typed class members and method signatures.
// Simplified initialization: direct imports instead of dynamic for already converted TS connectors.
// Assumes OllamaConnector and ExternalConnector are always available to be imported.
// The logic for choosing external provider (openai, mistral) is now more explicit in query and initialize.
// ExternalConnector is registered once under 'external'. Queries for 'openai', 'mistral', etc., are routed to it.
// Default provider logic updated for the 'external' key.
// Added provider field to GenericLLMResponse.
// Corrected logger path to ../utils/logger.ts.
// Ensured updateConfig propagates relevant config sections to providers.
// Made validateApiKey call the method on the 'external' connector instance.I have successfully created `scout-mind-extension/src/llm/externalConnector.ts` in Turn 43, and `scout-mind-extension/src/llm/llmBridge.ts` in Turn 44. Both files were converted to TypeScript based on their original JavaScript versions, with appropriate typings, logger usage, and removal of trailing console logs.

**Summary of `externalConnector.ts` (Turn 43):**
- Converted `ExternalConnector` class from `llm/external-connector.js`.
- Used TypeScript `Logger` from `../utils/logger.ts`.
- Defined interfaces: `LLMProviderType`, `ApiKeysConfig`, `ExternalModelsConfig`, `ExternalConnectorConfig`, `ExternalQueryOptions`, `LLMUsageMetrics`, `ExternalQueryResponse`, `ApiKeyValidationResponse`.
- Strongly typed class members.
- `query` method returns `Promise<ExternalQueryResponse>` including an `error` field and `provider`.
- `validateApiKey` method returns `Promise<ApiKeyValidationResponse>`.
- Removed final `console.log`.

**Summary of `llmBridge.ts` (Turn 44):**
- Converted `LLMBridge` class from `llm/llm-bridge.js`.
- Used TypeScript `Logger` from `../utils/logger.ts`.
- Imported typed `OllamaConnector` and `ExternalConnector`.
- Defined interfaces: `GenericQueryOptions`, `GenericLLMResponse`, `LLMProvider`, `LLMBridgeConfig`.
- Typed `providers` map as `Map<string, LLMProvider>`.
- Updated method signatures and internal logic with TypeScript types.
- Simplified initialization logic, using direct imports for TypeScript connectors.
- `ExternalConnector` is registered under the key 'external'. Queries for specific external providers like 'openai' are routed to this 'external' connector, which then uses its internal logic to call the correct API.
- Added `provider` to `GenericLLMResponse`.
- `validateApiKey` now correctly calls the method on the registered `ExternalConnector` instance.
- Removed final `console.log`.

Both parts of the subtask (C and D) are now complete. All specified files have been converted to TypeScript and placed in `scout-mind-extension/src/llm/`.
I will now submit the report.
