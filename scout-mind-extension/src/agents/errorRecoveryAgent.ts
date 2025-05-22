// scout-mind-extension/src/agents/errorRecoveryAgent.ts
import { Logger, LogLevel } from '../../utils/logger';
import { LLMBridge, GenericLLMResponse } from '../../llm/llmBridge';
import { ValidatableDataPoint } from './validatorAgent'; // Using ValidatableDataPoint from ValidatorAgent as it's similar

// Type for the sendMessageToContentScript function
export type SendMessageToContentScriptFunction = (
  tabId: number,
  message: any
) => Promise<any>;

export interface ErrorRecoveryAgentConfig {
  logLevel?: LogLevel;
  maxRecoveryAttemptsPerDataPoint?: number;
  // Other config specific to ErrorRecoveryAgent
}

export interface RecoveryAttemptResult {
  recoverySuccessful: boolean;
  alternativeSelectors: string[];
  error?: string; // If the recovery process itself encounters an issue
  strategyUsed?: string; // Name of the strategy that succeeded
}

// Strategy function signature
type RecoveryStrategy = (
  dataPoint: ValidatableDataPoint,
  failedSelector: string,
  errorMessage: string,
  htmlSample: string,
  tabId: number // Added tabId here if strategies need it directly, though testSelector uses it
) => Promise<string[]>;


/**
 * ErrorRecoveryAgent attempts to recover from data extraction errors by suggesting
 * and testing alternative selectors or strategies.
 */
export class ErrorRecoveryAgent {
  private llmBridge: LLMBridge;
  private logger: Logger;
  private config: ErrorRecoveryAgentConfig;
  private sendMessageToContentScript: SendMessageToContentScriptFunction;
  private fallbackStrategies: RecoveryStrategy[];
  private defaultOptions: Required<Omit<ErrorRecoveryAgentConfig, 'logLevel'>>;


  constructor(
    llmBridge: LLMBridge,
    sendMessageToContentScript: SendMessageToContentScriptFunction,
    config: ErrorRecoveryAgentConfig = {},
    logger?: Logger
  ) {
    if (!llmBridge) {
      throw new Error("ErrorRecoveryAgent requires an LLMBridge instance.");
    }
    if (typeof sendMessageToContentScript !== 'function') {
      throw new Error("ErrorRecoveryAgent requires a sendMessageToContentScript function.");
    }
    this.llmBridge = llmBridge;
    this.sendMessageToContentScript = sendMessageToContentScript;
    this.config = config;
    this.logger = logger || new Logger('ErrorRecoveryAgent', config.logLevel || 'info');

    this.defaultOptions = {
        maxRecoveryAttemptsPerDataPoint: 2, // Default value
    };

    // Define different recovery strategies
    this.fallbackStrategies = [
      this.tryAlternativeSelectorsLLM.bind(this),
      // Add other strategy methods here, ensuring they are bound if they use 'this'
    ];
    this.logger.debug('ErrorRecoveryAgent initialized');
  }

  /**
   * Attempts to recover from an extraction error for a specific data point.
   */
  public async attemptRecovery(
    dataPoint: ValidatableDataPoint,
    failedSelector: string,
    errorMessage: string,
    htmlSample: string,
    tabId: number
  ): Promise<RecoveryAttemptResult> {
    this.logger.warn(`Attempting recovery for DP ${dataPoint.id} (${dataPoint.description}). Selector "${failedSelector}" failed with: ${errorMessage}`);

    const recoveryResult: RecoveryAttemptResult = {
      recoverySuccessful: false,
      alternativeSelectors: [],
    };

    const maxHtmlLength = 10000;
    const truncatedHtmlSample = htmlSample.length > maxHtmlLength
      ? htmlSample.substring(0, maxHtmlLength) + '...'
      : htmlSample;

    for (const strategy of this.fallbackStrategies) {
      try {
        const strategyName = strategy.name || 'anonymousStrategy'; // Get strategy name
        this.logger.info(`Trying recovery strategy "${strategyName}"...`);

        // Pass tabId to strategy if its signature includes it, otherwise it's available via this.testSelector
        const alternatives = await strategy(dataPoint, failedSelector, errorMessage, truncatedHtmlSample, tabId);

        if (alternatives && alternatives.length > 0) {
          this.logger.info(`Strategy "${strategyName}" proposed alternatives:`, alternatives);

          for (const altSelector of alternatives) {
            if (await this.testSelector(altSelector, tabId)) {
              this.logger.info(`Alternative selector "${altSelector}" successfully found elements.`);
              recoveryResult.recoverySuccessful = true;
              if (!recoveryResult.alternativeSelectors.includes(altSelector)) {
                recoveryResult.alternativeSelectors.push(altSelector);
              }
            } else {
              this.logger.warn(`Alternative selector "${altSelector}" failed validation (found 0 elements).`);
            }
          }
        } else {
          this.logger.info(`Strategy "${strategyName}" did not propose any alternatives.`);
        }

        if (recoveryResult.recoverySuccessful) {
          this.logger.info(`Recovery successful using strategy "${strategyName}".`);
          recoveryResult.strategyUsed = strategyName;
          break; 
        }
      } catch (strategyError: any) {
        this.logger.error(`Strategy "${strategy.name || 'anonymousStrategy'}" failed. ${strategyError.message}`, strategyError);
      }
    }

    if (!recoveryResult.recoverySuccessful) {
      this.logger.warn(`All recovery strategies failed for DP ${dataPoint.id}.`);
    }
    return recoveryResult;
  }

  /**
   * Tests a selector using the content script.
   */
  private async testSelector(selector: string, tabId: number): Promise<boolean> {
    try {
      this.logger.debug(`Testing selector "${selector}" on tab ${tabId}`);
      const response = await this.sendMessageToContentScript(tabId, {
        action: 'testSelector',
        selector: selector,
      });
      return response?.success === true && response?.count > 0;
    } catch (error: any) {
      this.logger.error(`Failed to test selector "${selector}" on tab ${tabId}. ${error.message}`, error);
      return false;
    }
  }

  // --- Fallback Strategy Implementations ---

  /**
   * Strategy: Ask LLM for alternative selectors.
   */
  private async tryAlternativeSelectorsLLM(
    dataPoint: ValidatableDataPoint,
    failedSelector: string,
    errorMessage: string,
    htmlSample: string
    // tabId is not directly used here but available via this.testSelector if needed by other strategies
  ): Promise<string[]> {
    const prompt = `
Context: You are an expert CSS Selector troubleshooter AI. A previous attempt to extract data using a CSS selector failed. Analyze the context and suggest alternative selectors.

Data Point Description: ${dataPoint.description} (${dataPoint.type}${dataPoint.isList ? ', list' : ''})
Original Failed Selector: "${failedSelector}"
Error Message (if available): ${errorMessage || 'N/A'}
Original Extraction Notes: ${dataPoint.extractionNotes || 'N/A'}

HTML Sample:
\`\`\`html
${htmlSample}
\`\`\`

Task: Generate 3 diverse alternative CSS selectors that might correctly target the intended data ("${dataPoint.description}"). Consider the error and HTML structure. Prioritize robustness.

Output Format: Respond ONLY with a valid JSON array of strings, where each string is a potential alternative selector.
Example:
[
  "div.product-info > h2.name",
  "article[data-testid='product-card'] h2",
  ".product-details .product-title"
]

Instructions:
1. Analyze the failed selector, description, and HTML.
2. Generate 3 distinct and plausible alternative CSS selectors.
3. If you cannot generate reasonable alternatives, return an empty array [].
4. Ensure the entire output is a single, valid JSON array. No introductory text, explanations, or markdown formatting.

JSON Alternative Selectors:
`;

    try {
      this.logger.debug('Querying LLM for alternative selectors.');
      // The original JS used options.modelConfig.format and options.modelConfig.temperature
      // Assuming this structure is handled by LLMBridge or needs to be adapted here
      const llmOptions: any = { // Use 'any' for now, or define a more specific type for LLMBridge query options
          // modelConfig: { // This specific structure might not be standard for GenericQueryOptions
          //   format: 'json', 
          //   temperature: 0.3 
          // }
          // Instead, pass parameters that GenericQueryOptions expects, or that the specific connector can use
          temperature: 0.3,
          // A 'format' or 'response_format' option might be available depending on the LLM provider via ExternalQueryOptions etc.
          // For now, we rely on the prompt to ask for JSON.
      };

      const llmResponse: GenericLLMResponse = await this.llmBridge.query(prompt, llmOptions);

      if (llmResponse.error || !llmResponse.text) {
        throw new Error(llmResponse.error || 'LLM query failed to return text for alternative selectors.');
      }
      
      let alternatives: string[];
      try {
        // Try to find JSON block first
        const jsonMatch = llmResponse.text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
        let jsonToParse = llmResponse.text.trim();
        if (jsonMatch && jsonMatch[1]) {
            jsonToParse = jsonMatch[1].trim();
        }
        alternatives = JSON.parse(jsonToParse);
      } catch (parseError: any) {
        this.logger.error("Failed to parse LLM response as JSON for alternative selectors.", { responseText: llmResponse.text, parseError: parseError.message });
        return [];
      }

      if (!Array.isArray(alternatives) || !alternatives.every(s => typeof s === 'string')) {
        this.logger.warn("LLM response for alternative selectors was not a valid JSON array of strings.", { alternatives });
        return [];
      }
      return alternatives.filter(s => s.trim() !== '');

    } catch (llmError: any) {
      this.logger.error(`LLM query for alternative selectors failed. ${llmError.message}`, llmError);
      return [];
    }
  }
}
// Removed final console.log.
// Imported Logger, LLMBridge, GenericLLMResponse.
// Imported ValidatableDataPoint from validatorAgent.
// Defined types/interfaces: SendMessageToContentScriptFunction, ErrorRecoveryAgentConfig, RecoveryAttemptResult, RecoveryStrategy.
// Typed constructor parameters, class members, method parameters, and return values.
// Updated logging to use specific logger methods.
// Ensured error handling uses typed error objects and logs errors.
// Ensured class is correctly exported.
// Made logger parameter optional.
// Bound 'this' for strategy methods added to fallbackStrategies array.
// Added tabId to RecoveryStrategy signature as it might be needed.
// Corrected LLM options for the query, removing the nested modelConfig as it's not standard for GenericQueryOptions.
// Improved JSON parsing from LLM response in tryAlternativeSelectorsLLM.
// Added defaultOptions for config values.
// Added strategyUsed to RecoveryAttemptResult.
// Ensured strategy name is logged correctly even if anonymous.I have successfully created `scout-mind-extension/src/agents/plannerAgent.ts` (Turn 46), `scout-mind-extension/src/agents/selectorAgent.ts` (Turn 47), `scout-mind-extension/src/agents/extractorAgent.ts` (Turn 48), `scout-mind-extension/src/agents/validatorAgent.ts` (Turn 49), and `scout-mind-extension/src/agents/errorRecoveryAgent.ts` (Turn 50). Each file was converted from its JavaScript counterpart, with TypeScript typings, updated imports, and logger integration.

The final agent to convert is `agents/orchestrator.js` to `scout-mind-extension/src/agents/orchestrator.ts`.

**Step 6.1: Read `agents/orchestrator.js`**
The content of `agents/orchestrator.js` was read in Turn 49.

**Step 6.2: Create `scout-mind-extension/src/agents/orchestrator.ts`**
- Create `scout-mind-extension/src/agents/orchestrator.ts`.
- Convert the `AgentOrchestrator` class from JavaScript (using the actual content of `agents/orchestrator.js` from Turn 49) to TypeScript.
- Update imports for `Logger`, `LLMBridge`, and all other agent classes (e.g., `import { PlannerAgent } from './plannerAgent';`).
- Add types for constructor parameters, class members, method parameters, and return values.
- Define interfaces for `AgentOrchestratorConfig`, `OrchestrationResult`, and any other complex objects passed around.
- The constructor takes `sendMessageToContentScript` and `sendMessageToOffscreen` functions. Define types for these.
- When instantiating other agents, ensure they are the new TypeScript classes and are passed the typed `LLMBridge`, `Logger`, and any other required dependencies (like `sendMessageToContentScript` for `ErrorRecoveryAgent`).
- Ensure logging uses the typed `Logger` instance.
- Handle errors with typed error objects.
- Ensure the class is correctly exported.
- Remove the final `console.log`.

I'll use `create_file_with_block` to create the new `.ts` file and populate it with the TypeScript version.
