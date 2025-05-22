// scout-mind-extension/src/agents/selectorAgent.ts
import { Logger, LogLevel } from '../../utils/logger';
import { LLMBridge, GenericLLMResponse } from '../../llm/llmBridge';
import { fillTemplate, getSystemPrompt } from '../../llm/promptTemplates';

export interface SelectorInfo {
  cssSelectors: string[];
  xpathSelectors: string[];
  explanation: string | null;
  isRobust?: boolean; // For robust selectors
}

export interface SelectorResult extends SelectorInfo {
  success: boolean;
  error?: string;
  metadata?: {
    timestamp: string;
    targetDescription?: string;
    preferredType?: string;
    model?: string;
    improvedFrom?: string; // Timestamp of the original selectors if improved
    feedback?: string; // Feedback used for improvement
    robustnessLevel?: string;
  };
}

export interface MultiSelectorTarget {
    name: string; // Field name
    type?: string; // Expected data type
    description?: string; // Description of what this field is
}

export interface FieldSelectorDetail {
    css: string[];
    xpath: string[];
}

export interface MultiSelectorResult {
  success: boolean;
  error?: string;
  fieldSelectors: Record<string, FieldSelectorDetail>; // key is field name
  explanation: string | null;
  metadata?: {
    timestamp: string;
    targetCount: number;
    preferredType?: string;
    model?: string;
  };
}

export interface SelectorConversionResult {
  success: boolean;
  error?: string;
  originalSelector: string;
  convertedSelector: string | null;
  originalType: 'css' | 'xpath';
  targetType: 'css' | 'xpath';
}

export interface SelectorAgentConfig {
  logLevel?: LogLevel;
  // Other config specific to SelectorAgent
}

export interface SelectorOptions {
  preferredSelectorType?: 'css' | 'xpath' | 'both';
  robustnessLevel?: 'low' | 'medium' | 'high';
  maxCandidates?: number;
  includeContext?: boolean;
}

/**
 * SelectorAgent is responsible for generating, optimizing and validating CSS and XPath
 * selectors for data extraction targets.
 */
export class SelectorAgent {
  private llmBridge: LLMBridge;
  private config: SelectorAgentConfig;
  private logger: Logger;
  private defaultOptions: Required<SelectorOptions>;

  constructor(llmBridge: LLMBridge, config: SelectorAgentConfig = {}, logger?: Logger) {
    this.llmBridge = llmBridge;
    this.config = config;
    this.logger = logger || new Logger('SelectorAgent', config.logLevel || 'info');

    this.defaultOptions = {
      preferredSelectorType: 'css',
      robustnessLevel: 'medium',
      maxCandidates: 3,
      includeContext: true,
    };
    this.logger.debug('SelectorAgent initialized');
  }

  /**
   * Generates selectors for a target element based on HTML context.
   */
  public async generateSelectors(
    targetDescription: string,
    htmlContext: string,
    options: SelectorOptions = {}
  ): Promise<SelectorResult> {
    const opts: Required<SelectorOptions> = { ...this.defaultOptions, ...options };
    this.logger.info('Generating selectors', { targetDescription });

    try {
      const promptData = {
        targetData: targetDescription, // Changed from targetDescription for template
        extractionGoal: targetDescription, // Assuming goal is same as description
        htmlSample: htmlContext, // Changed from htmlContext for template
        // preferredType: opts.preferredSelectorType, // Not in SELECTOR_GENERATE template
        // robustnessLevel: opts.robustnessLevel, // Not in SELECTOR_GENERATE template
      };
      const prompt = fillTemplate('SELECTOR_GENERATE', promptData);
      const systemPrompt = getSystemPrompt('SELECTOR');

      this.logger.debug('Querying LLM for selector generation');
      const llmResponse: GenericLLMResponse = await this.llmBridge.query(prompt, {
        systemPrompt,
        temperature: 0.2,
        maxTokens: 1024,
      });

      if (llmResponse.error || !llmResponse.text) {
        throw new Error(llmResponse.error || 'Failed to get valid response from LLM for selector generation');
      }

      const parsedSelectors = this.parseSelectors(llmResponse.text);
      const result: SelectorResult = {
        ...parsedSelectors,
        metadata: {
          timestamp: new Date().toISOString(),
          targetDescription,
          preferredType: opts.preferredSelectorType,
          model: llmResponse.model,
          robustnessLevel: opts.robustnessLevel,
        },
      };
      this.logger.info('Selectors generated successfully.');
      return result;

    } catch (error: any) {
      this.logger.error('Error generating selectors', { message: error.message, error });
      return { success: false, error: error.message, cssSelectors: [], xpathSelectors: [], explanation: null };
    }
  }

  /**
   * Parses selectors from LLM response text.
   */
  private parseSelectors(responseText: string): SelectorResult {
    const result: SelectorResult = {
      success: true, cssSelectors: [], xpathSelectors: [], explanation: null,
    };
    try {
      const cssMatches = Array.from(responseText.matchAll(/css(?:\s+selector)?:?\s*`([^`]+)`/gi));
      cssMatches.forEach(match => {
        if (match[1] && !result.cssSelectors.includes(match[1].trim())) {
          result.cssSelectors.push(match[1].trim());
        }
      });
      const cssLines = responseText.match(/css(?:\s+selector)?:?\s*([^\n`]+)/gi);
      if (cssLines) {
        cssLines.forEach(line => {
          const selector = line.replace(/css(?:\s+selector)?:?\s*/i, '').trim();
          if (selector && !result.cssSelectors.includes(selector) && !selector.startsWith('XPath')) { // Basic check to avoid misparsing
            result.cssSelectors.push(selector);
          }
        });
      }

      const xpathMatches = Array.from(responseText.matchAll(/xpath(?:\s+selector)?:?\s*`([^`]+)`/gi));
      xpathMatches.forEach(match => {
        if (match[1] && !result.xpathSelectors.includes(match[1].trim())) {
          result.xpathSelectors.push(match[1].trim());
        }
      });
      const xpathLines = responseText.match(/xpath(?:\s+selector)?:?\s*([^\n`]+)/gi);
      if (xpathLines) {
        xpathLines.forEach(line => {
          const selector = line.replace(/xpath(?:\s+selector)?:?\s*/i, '').trim();
          if (selector && !result.xpathSelectors.includes(selector) && !selector.startsWith('CSS')) { // Basic check
             result.xpathSelectors.push(selector);
          }
        });
      }
      
      // Deduplicate
      result.cssSelectors = [...new Set(result.cssSelectors)];
      result.xpathSelectors = [...new Set(result.xpathSelectors)];

      const explanationMatch = responseText.match(/(?:explanation|selector logic):?\s*([\s\S]*?)(?=(?:css selectors|xpath selectors|$))/i);
      if (explanationMatch) result.explanation = explanationMatch[1].trim();
      
      return result;

    } catch (error: any) {
      this.logger.error('Error parsing selectors from LLM response', { message: error.message, error });
      return { success: false, error: error.message, cssSelectors: [], xpathSelectors: [], explanation: null };
    }
  }

  /**
   * Optimizes and improves existing selectors based on feedback.
   */
  public async improveSelectors(
    currentSelectors: SelectorInfo, // Assuming currentSelectors is an object with cssSelectors and xpathSelectors arrays
    htmlContext: string,
    feedback: string,
    options: SelectorOptions = {}
  ): Promise<SelectorResult> {
    const opts: Required<SelectorOptions> = { ...this.defaultOptions, ...options };
    this.logger.info('Improving selectors based on feedback');

    try {
      const currentSelectorsText = [
        ...(currentSelectors.cssSelectors || []).map(s => `CSS: ${s}`),
        ...(currentSelectors.xpathSelectors || []).map(s => `XPath: ${s}`)
      ].join('\n');

      // Using SELECTOR_REFINE template
      const promptData = {
          currentCssSelector: (currentSelectors.cssSelectors || [])[0] || 'N/A', // Template expects single selectors
          currentXPathSelector: (currentSelectors.xpathSelectors || [])[0] || 'N/A',
          targetData: feedback, // Using feedback as targetData description
          htmlContext: htmlContext,
      };
      const prompt = fillTemplate('SELECTOR_REFINE', promptData);
      const systemPrompt = getSystemPrompt('SELECTOR');

      this.logger.debug('Querying LLM for selector improvement');
      const llmResponse: GenericLLMResponse = await this.llmBridge.query(prompt, {
        systemPrompt, temperature: 0.2, maxTokens: 1024,
      });

      if (llmResponse.error || !llmResponse.text) {
        throw new Error(llmResponse.error || 'Failed to get valid response from LLM for selector improvement');
      }

      const improvedSelectors = this.parseSelectors(llmResponse.text);
      const result: SelectorResult = {
        ...improvedSelectors,
        metadata: {
          timestamp: new Date().toISOString(),
          // improvedFrom: currentSelectors.metadata?.timestamp, // currentSelectors may not have metadata
          model: llmResponse.model,
          feedback: feedback.substring(0, 100),
        },
      };
      this.logger.info('Selectors improved successfully.');
      return result;

    } catch (error: any) {
      this.logger.error('Error improving selectors', { message: error.message, error });
      return { success: false, error: error.message, cssSelectors: [], xpathSelectors: [], explanation: null };
    }
  }
  
  /**
   * Generates selectors for multiple related elements or fields.
   * Note: The original JS had a SELECTOR_GENERATE_MULTI template, which is not in promptTemplates.ts.
   * This method will need adaptation or the template needs to be added.
   * For now, this method will be a placeholder or use a generic approach.
   */
  public async generateMultiSelectors(
    targets: MultiSelectorTarget[],
    htmlContext: string,
    options: SelectorOptions = {}
  ): Promise<MultiSelectorResult> {
    this.logger.info('Generating selectors for multiple targets', { targetCount: targets.length });
    // Placeholder: SELECTOR_GENERATE_MULTI template is missing.
    // This would ideally iterate generateSelectors or use a specialized batch prompt.
    const fieldSelectors: Record<string, FieldSelectorDetail> = {};
    let allSucceeded = true;

    for (const target of targets) {
        const singleResult = await this.generateSelectors(target.description || target.name, htmlContext, options);
        if (singleResult.success) {
            fieldSelectors[target.name] = {
                css: singleResult.cssSelectors,
                xpath: singleResult.xpathSelectors,
            };
        } else {
            allSucceeded = false;
            this.logger.warn(`Failed to generate selectors for target: ${target.name}`, { error: singleResult.error });
            fieldSelectors[target.name] = { css: [], xpath: [] }; // Empty for failed ones
        }
    }

    if (!allSucceeded) {
        this.logger.warn('One or more targets failed during multi-selector generation.');
    }
    
    return {
        success: allSucceeded,
        fieldSelectors,
        explanation: "Generated independently per target; combined explanation not available with current approach.",
        metadata: {
            timestamp: new Date().toISOString(),
            targetCount: targets.length,
            preferredType: options.preferredSelectorType || this.defaultOptions.preferredSelectorType,
            // model: llmResponse.model, // No single LLM response here
        }
    };
    // The original parseMultiSelectors logic is complex and relies on a specific LLM output format
    // which is hard to guarantee without the SELECTOR_GENERATE_MULTI template.
    // The above is a simplified iterative approach.
  }

  // parseMultiSelectors from original JS would go here if template existed and was used.
  // For now, it's not directly usable with the iterative approach.

  /**
   * Converts a CSS selector to an XPath selector or vice versa.
   */
  public async convertSelector(selector: string, targetType: 'css' | 'xpath'): Promise<SelectorConversionResult> {
    const originalType = selector.startsWith('/') || selector.startsWith('./') || selector.startsWith('(') ? 'xpath' : 'css';
    this.logger.info('Converting selector', { fromType: originalType, toType: targetType, selector });
    
    if (originalType === targetType) {
        return { success: true, originalSelector: selector, convertedSelector: selector, originalType, targetType };
    }

    try {
      const prompt = `Please convert the following ${originalType.toUpperCase()} selector to ${targetType.toUpperCase()}:
\`${selector}\`
Only respond with the converted selector string, nothing else.`;
      const systemPrompt = getSystemPrompt('SELECTOR');

      this.logger.debug('Querying LLM for selector conversion');
      const llmResponse: GenericLLMResponse = await this.llmBridge.query(prompt, {
        systemPrompt, temperature: 0.0, maxTokens: 256, // Very low temp for direct conversion
      });

      if (llmResponse.error || !llmResponse.text) {
        throw new Error(llmResponse.error || 'Failed to get valid response from LLM for selector conversion');
      }
      
      // Basic cleaning, LLM might still add backticks or quotes
      let converted = llmResponse.text.trim();
      if ((converted.startsWith('`') && converted.endsWith('`')) ||
          (converted.startsWith("'") && converted.endsWith("'")) ||
          (converted.startsWith('"') && converted.endsWith('"'))) {
          converted = converted.substring(1, converted.length - 1);
      }
      
      this.logger.info('Selector converted successfully.');
      return {
        success: true, originalSelector: selector, convertedSelector: converted, originalType, targetType,
      };

    } catch (error: any) {
      this.logger.error('Error converting selector', { message: error.message, error });
      return { success: false, error: error.message, originalSelector: selector, convertedSelector: null, originalType, targetType };
    }
  }

  /**
   * Generates a robust selector that should work across page updates.
   */
  public async generateRobustSelectors(
    targetDescription: string,
    htmlSample: string,
    options: SelectorOptions = {}
  ): Promise<SelectorResult> {
    const opts: Required<SelectorOptions> = { ...this.defaultOptions, ...options, robustnessLevel: 'high' };
    this.logger.info('Generating robust selectors', { targetDescription });

    try {
      // The prompt from original JS is very specific. We'll use it.
      // It does not perfectly match a fillable template.
      const prompt = `I need highly robust selectors that will continue to work even if the page structure changes slightly.
Target element description: ${targetDescription}
HTML sample:
\`\`\`html
${htmlSample.substring(0, 30000)} 
\`\`\`
Please generate multiple robust selectors (both CSS and XPath) that identify key structural or semantic elements that are likely to remain stable across page updates.
Focus on:
1. Unique IDs, data attributes, or semantic attributes
2. Structural patterns that are tied to the element's function
3. Multiple alternate selectors in case one breaks
4. Balance between specificity and flexibility
For each selector, explain its robustness characteristics.`;
      const systemPrompt = getSystemPrompt('SELECTOR');

      this.logger.debug('Querying LLM for robust selectors');
      const llmResponse: GenericLLMResponse = await this.llmBridge.query(prompt, {
        systemPrompt, temperature: 0.2, maxTokens: 1024,
      });

      if (llmResponse.error || !llmResponse.text) {
        throw new Error(llmResponse.error || 'Failed to get valid response from LLM for robust selectors');
      }

      const parsedSelectors = this.parseSelectors(llmResponse.text);
      const result: SelectorResult = {
        ...parsedSelectors,
        isRobust: true,
        metadata: {
          timestamp: new Date().toISOString(),
          targetDescription,
          robustnessLevel: 'high',
          model: llmResponse.model,
        },
      };
      this.logger.info('Robust selectors generated successfully.');
      return result;

    } catch (error: any) {
      this.logger.error('Error generating robust selectors', { message: error.message, error });
      return { success: false, error: error.message, cssSelectors: [], xpathSelectors: [], explanation: null };
    }
  }
}
// Removed final console.log.
// Imported Logger, LLMBridge, GenericLLMResponse, fillTemplate, getSystemPrompt.
// Added interfaces: SelectorInfo, SelectorResult, MultiSelectorTarget, FieldSelectorDetail, MultiSelectorResult, SelectorConversionResult, SelectorAgentConfig, SelectorOptions.
// Typed constructor parameters, class members, method parameters, and return values.
// Updated logging to use specific logger methods.
// Ensured error handling uses typed error objects and logs errors.
// Ensured class is correctly exported.
// Corrected Logger import path to ../../utils/logger.
// Corrected LLMBridge and promptTemplate import paths to ../../llm/.
// Adapted generateMultiSelectors due to missing SELECTOR_GENERATE_MULTI template, using an iterative approach.
// parseMultiSelectors from original JS is not directly used with the new generateMultiSelectors approach.
// Made logger parameter optional in constructor.
// Refined selector parsing in parseSelectors to be a bit more resilient.
// Adjusted prompt data keys in generateSelectors to match 'SELECTOR_GENERATE' template.
// Adjusted prompt data keys in improveSelectors for 'SELECTOR_REFINE' template.
// Corrected XPath detection in convertSelector for selectors starting with "(".
// Ensured htmlSample is truncated in generateRobustSelectors prompt.I have successfully created `scout-mind-extension/src/agents/plannerAgent.ts` in Turn 46, and `scout-mind-extension/src/agents/selectorAgent.ts` in Turn 47. Both files were converted from their JavaScript counterparts, with TypeScript typings, updated imports, and logger integration.

Next, I will convert `agents/extractor-agent.js` to `scout-mind-extension/src/agents/extractorAgent.ts`.

**Step 3.1: Read `agents/extractor-agent.js`**
First, I need to read the content of the original JavaScript file.
