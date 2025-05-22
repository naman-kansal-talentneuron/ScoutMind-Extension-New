// scout-mind-extension/src/llm/ollamaConnector.ts
import { Logger, LogLevel } from '../utils/logger';

export interface OllamaConfig {
  ollamaUrl?: string;
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number; // Ollama uses num_predict
  // Add other Ollama specific settings if needed
}

export interface OllamaQueryOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number; // num_predict in Ollama
  systemPrompt?: string;
  stream?: boolean; // Ollama supports stream, default false for this usage
}

export interface OllamaUsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OllamaResponse {
  text: string;
  usage?: OllamaUsageMetrics;
  model?: string;
  error?: string; // To include potential error messages
}

/**
 * OllamaConnector provides integration with locally running Ollama models.
 */
export class OllamaConnector {
  private logger: Logger;
  private config: OllamaConfig;
  private baseUrl: string;
  private defaultModel: string;

  /**
   * Creates a new OllamaConnector instance
   * @param config - Configuration for Ollama
   * @param loggerLevel - Optional logger level
   */
  constructor(config: OllamaConfig = {}, loggerLevel: LogLevel = 'info') {
    this.logger = new Logger('OllamaConnector', loggerLevel);
    this.config = config;
    
    this.baseUrl = config.ollamaUrl || 'http://localhost:11434';
    this.defaultModel = config.defaultModel || 'llama2'; // Default from original JS
    
    this.logger.debug('OllamaConnector initialized', {
      baseUrl: this.baseUrl,
      defaultModel: this.defaultModel,
      initialConfig: this.config
    });
  }

  /**
   * Updates the connector configuration
   * @param newConfig - New configuration object
   */
  public updateConfig(newConfig: Partial<OllamaConfig>): void {
    if (newConfig.ollamaUrl) {
      this.baseUrl = newConfig.ollamaUrl;
    }
    if (newConfig.defaultModel) { // Changed from models.ollama to defaultModel for consistency
      this.defaultModel = newConfig.defaultModel;
    }
    
    this.config = { ...this.config, ...newConfig };
    this.logger.debug('Updated OllamaConnector configuration', this.config);
  }

  /**
   * Sends a query to Ollama
   * @param prompt - The prompt to send
   * @param options - Query options
   * @returns Promise<OllamaResponse> Response object
   */
  public async query(prompt: string, options: OllamaQueryOptions = {}): Promise<OllamaResponse> {
    const model = options.model || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : this.config.temperature || 0.7;
    // Ollama uses num_predict for max tokens. Let's use a default from config or a general one if not set.
    const numPredict = options.maxTokens || this.config.maxTokens || 2048;
    
    this.logger.debug('Sending query to Ollama', {
      model,
      temperature,
      numPredict, // Changed from maxTokens to numPredict for clarity with Ollama API
      promptLength: prompt.length,
      systemPromptProvided: !!options.systemPrompt,
      stream: options.stream || false,
    });
    
    try {
      const url = `${this.baseUrl}/api/generate`;
      
      const requestBody: any = {
        model: model,
        prompt: prompt,
        options: {
          temperature: temperature,
        },
        system: options.systemPrompt || '', // Use systemPrompt from options or empty
        stream: options.stream || false, // Default to false for non-streaming
      };
      
      if (numPredict > 0) {
        requestBody.options.num_predict = numPredict;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Ollama API error (${response.status}): ${errorText}`);
        return { text: '', error: `Ollama API error (${response.status}): ${errorText}` };
      }
      
      const data = await response.json();
      
      // Assuming data structure from original JS: data.response for text, data.prompt_eval_count, data.eval_count
      return {
        text: data.response || '',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        model: data.model || model // Return the model used
      };
    } catch (error: any) {
      this.logger.error('Error querying Ollama', error);
      
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('NetworkError')) {
        const connError = `Unable to connect to Ollama at ${this.baseUrl}. Is Ollama running?`;
        return { text: '', error: connError };
      }
      
      return { text: '', error: errorMessage };
    }
  }

  /**
   * Lists available models in Ollama
   * @returns Promise<string[]> List of available model names
   */
  public async listModels(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/api/tags`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      const models = data.models ? data.models.map((m: any) => m.name) : [];
      
      this.logger.debug(`Listed ${models.length} available Ollama models`);
      return models;
    } catch (error: any) {
      this.logger.error('Error listing Ollama models', error);
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('ECONNREFUSED') || 
          errorMessage.includes('NetworkError')) {
        throw new Error(`Unable to connect to Ollama at ${this.baseUrl}. Is Ollama running?`);
      }
      throw error; // Re-throw other errors
    }
  }

  /**
   * Checks if the Ollama service is available
   * @returns Promise<boolean> True if Ollama is available
   */
  public async checkAvailability(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch (error) {
      // Logged by listModels, just return false
      return false;
    }
  }
}
// Removed final console.log as requested.
// The Logger from '../utils/logger' is used.
// Interfaces for config, options, and response are defined.
// Class members and methods are typed.
// query method returns Promise<OllamaResponse>.
// Error handling in query method now returns an OllamaResponse with an error field.
// The path for Logger is `../utils/logger` because ollamaConnector.ts is in `scout-mind-extension/src/llm/`
// and logger.ts is in `scout-mind-extension/src/utils/`. This path is correct.
// Changed `newConfig.models?.ollama` to `newConfig.defaultModel` in `updateConfig` for consistency.
// Changed `maxTokens` to `numPredict` in query method's log for clarity with Ollama API.
// Ensured `systemPrompt` is passed in the requestBody.
// Made `OllamaResponse.text` non-optional, defaults to empty string on error.
// Made `OllamaResponse.error` optional.
// Made `OllamaResponse.usage` and `OllamaResponse.model` optional as they might not be present on error.
// Updated error handling in `query` to return the error message in the `OllamaResponse` object.
// `listModels` re-throws errors not related to connection issues.
// `checkAvailability` catches errors from `listModels` and returns false.I have successfully created `scout-mind-extension/src/llm/promptTemplates.ts` in Turn 40 and `scout-mind-extension/src/llm/ollamaConnector.ts` in Turn 41. Both files were converted to TypeScript based on their original JavaScript versions, with appropriate typings, logger usage, and removal of trailing console logs.

**Summary of `promptTemplates.ts` (Turn 40):**
- Copied content from `llm/prompt-templates.js`.
- Defined `AgentType` for `SystemPrompts` keys.
- Typed `SystemPrompts` as `Record<AgentType, string>`.
- Typed `PromptTemplates` as `Record<string, string>`.
- Added types to `fillTemplate` parameters (`templateId: keyof typeof PromptTemplates`, `data: Record<string, string | number | undefined | null>`) and return type (`string`).
- Added types to `getSystemPrompt` parameters (`agentType: AgentType`) and return type (`string`).
- Removed the final `console.log`.
- Used `Logger` for warnings/errors within `fillTemplate` and `getSystemPrompt`.

**Summary of `ollamaConnector.ts` (Turn 41):**
- Converted `OllamaConnector` class from `llm/ollama-connector.js` to TypeScript.
- Imported and used the TypeScript `Logger` from `../utils/logger.ts`.
- Defined interfaces: `OllamaConfig`, `OllamaQueryOptions`, `OllamaUsageMetrics`, `OllamaResponse`.
- Strongly typed class members (e.g., `baseUrl: string`, `defaultModel: string`).
- Ensured the `query` method returns `Promise<OllamaResponse>`.
- Updated error handling in `query` to return an `OllamaResponse` with an `error` field.
- Removed the final `console.log`.

Both parts of the subtask are now complete. I will submit the report.
