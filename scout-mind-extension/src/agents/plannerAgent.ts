// scout-mind-extension/src/agents/plannerAgent.ts
import { Logger, LogLevel } from '../../utils/logger';
import { LLMBridge, GenericLLMResponse } from '../../llm/llmBridge';
import { fillTemplate, getSystemPrompt, SystemPrompts } from '../../llm/promptTemplates'; // Assuming promptTemplates.ts is also in llm

export interface FieldDefinition {
  name: string;
  type: string; // e.g., 'string', 'number', 'url', 'date'
  description?: string; // Optional description
}

export interface SchemaFieldConfig {
    selector: string | null;
    attribute?: string;
    transform?: string; // e.g., 'number', 'boolean', 'trim', 'url'
}

export interface ExtractionPlanSchema {
    [key: string]: SchemaFieldConfig;
}

export interface PlanMetadata {
  timestamp: string;
  targetUrl: string;
  extractionGoal: string;
  model?: string;
  refined?: boolean;
  originalPlanTimestamp?: string;
}

export interface PaginationStrategy {
    paginationType: 'next-button' | 'url-pattern' | 'page-numbers' | 'load-more' | 'none' | null;
    nextPageSelector: string | null;
    pageNumberPattern: string | null; // e.g., "/page/{pageNum}"
    pageNumbersSelector?: string | null; // Selector for a list of page numbers
    maxPages: number;
    hasMoreDataIndicator: string | null; // e.g., a selector for a "no more results" message
    hasPagination: boolean;
}


export interface ExtractionPlan {
  success: boolean;
  error?: string;
  extractionGoal: string | null;
  dataStructure: string | null; // e.g., 'table', 'list', 'records'
  keyFields: FieldDefinition[];
  targetElements: string[]; // Descriptions or types of elements
  extractionStrategy: string | null;
  potentialChallenges: string[];
  schema: ExtractionPlanSchema | null; // JSON schema or a simplified version
  metadata?: PlanMetadata;
  // For multi-page plans
  isMultiPage?: boolean;
  paginationStrategy?: PaginationStrategy;
}

export interface PlannerAgentConfig {
  // Configuration specific to PlannerAgent, if any, beyond defaultOptions
  logLevel?: LogLevel;
}

export interface PlannerOptions {
  maxHtmlSampleLength?: number;
  optimizeForMultiPage?: boolean;
  includePaginationAnalysis?: boolean;
  maxJsonSchemaComplexity?: 'simple' | 'medium' | 'complex';
  // Any other options that might be passed to methods
}

/**
 * PlannerAgent is responsible for analyzing user extraction requests and creating
 * structured data extraction plans, including schema definition.
 */
export class PlannerAgent {
  private llmBridge: LLMBridge;
  private config: PlannerAgentConfig;
  private logger: Logger;
  private defaultOptions: Required<PlannerOptions>;

  constructor(llmBridge: LLMBridge, config: PlannerAgentConfig = {}, logger?: Logger) {
    this.llmBridge = llmBridge;
    this.config = config;
    this.logger = logger || new Logger('PlannerAgent', config.logLevel || 'info');

    this.defaultOptions = {
      maxHtmlSampleLength: 30000,
      optimizeForMultiPage: false,
      includePaginationAnalysis: false,
      maxJsonSchemaComplexity: 'medium',
    };
    this.logger.debug('PlannerAgent initialized');
  }

  /**
   * Creates an extraction plan based on the user request and page content
   */
  public async createExtractionPlan(
    targetUrl: string,
    extractionGoal: string,
    htmlSample: string,
    options: PlannerOptions = {}
  ): Promise<ExtractionPlan> {
    const opts: Required<PlannerOptions> = { ...this.defaultOptions, ...options };
    this.logger.info('Creating extraction plan', { targetUrl, extractionGoal });

    try {
      const truncatedHtml =
        htmlSample.length > opts.maxHtmlSampleLength
          ? htmlSample.substring(0, opts.maxHtmlSampleLength) + '\n<!-- HTML truncated for size limits -->'
          : htmlSample;

      const promptData = { targetUrl, extractionGoal, htmlSample: truncatedHtml };
      const prompt = fillTemplate('PLANNER_CREATE_PLAN', promptData);
      const systemPrompt = getSystemPrompt('PLANNER');

      this.logger.debug('Querying LLM for extraction plan');
      const llmResponse: GenericLLMResponse = await this.llmBridge.query(prompt, {
        systemPrompt,
        temperature: 0.3,
        maxTokens: 2048,
      });

      if (llmResponse.error || !llmResponse.text) {
        throw new Error(llmResponse.error || 'Failed to get valid response from LLM for plan creation');
      }

      const plan = this.parseExtractionPlan(llmResponse.text);
      plan.metadata = {
        timestamp: new Date().toISOString(),
        targetUrl,
        extractionGoal,
        model: llmResponse.model,
      };

      if (!plan.schema && plan.keyFields && plan.keyFields.length > 0) {
        plan.schema = this.generateSchemaFromFields(plan.keyFields);
      }
      
      this.logger.info('Extraction plan created successfully.', { planId: plan.metadata.timestamp });
      return plan;

    } catch (error: any) {
      this.logger.error('Error creating extraction plan', { message: error.message, error });
      return {
        success: false,
        error: error.message,
        extractionGoal: null, dataStructure: null, keyFields: [], targetElements: [],
        extractionStrategy: null, potentialChallenges: [], schema: null
      };
    }
  }

  /**
   * Parses an extraction plan from the LLM response text.
   */
  private parseExtractionPlan(responseText: string): ExtractionPlan {
    const plan: ExtractionPlan = {
      success: true,
      extractionGoal: null, dataStructure: null, keyFields: [], targetElements: [],
      extractionStrategy: null, potentialChallenges: [], schema: null
    };

    try {
      const goalMatch = responseText.match(/Extraction Goal:?\s*([^\n]+)/i);
      if (goalMatch) plan.extractionGoal = goalMatch[1].trim();

      const structureMatch = responseText.match(/Data Structure:?\s*([^\n]+)/i);
      if (structureMatch) plan.dataStructure = structureMatch[1].trim();
      
      const fieldsSection = responseText.match(/Key Fields:?\s*([\s\S]*?)(?=Target Elements:|Extraction Strategy:|Potential Challenges:|$)/i);
      if (fieldsSection) {
        const fieldLines = fieldsSection[1].trim().split('\n');
        plan.keyFields = fieldLines.map(line => {
          const field = line.trim().replace(/^-\s*/, '');
          const typeMatch = field.match(/([^:[\]]+)(?:\s*\[([^\]]+)\])?/);
          if (typeMatch) {
            return { name: typeMatch[1].trim(), type: typeMatch[2] ? typeMatch[2].trim().toLowerCase() : 'string' };
          }
          return { name: field, type: 'string' };
        }).filter(f => f.name);
      }

      const elementsSection = responseText.match(/Target Elements:?\s*([\s\S]*?)(?=Extraction Strategy:|Potential Challenges:|$)/i);
      if (elementsSection) {
        plan.targetElements = elementsSection[1].trim().split('\n').map(line => line.trim().replace(/^-\s*/, '')).filter(Boolean);
      }

      const strategyMatch = responseText.match(/Extraction Strategy:?\s*([\s\S]*?)(?=Potential Challenges:|$)/i);
      if (strategyMatch) plan.extractionStrategy = strategyMatch[1].trim();

      const challengesSection = responseText.match(/Potential Challenges:?\s*([\s\S]*?)(?=$)/i);
      if (challengesSection) {
        plan.potentialChallenges = challengesSection[1].trim().split('\n').map(line => line.trim().replace(/^-\s*/, '')).filter(Boolean);
      }

      const schemaMatch = responseText.match(/```(?:json)?\s*({\s*"[^}]+"[\s\S]*?})\s*```/);
      if (schemaMatch) {
        try {
          plan.schema = JSON.parse(schemaMatch[1]) as ExtractionPlanSchema;
        } catch (e: any) {
          this.logger.warn('Failed to parse JSON schema from LLM response', { error: e.message });
        }
      }
      return plan;

    } catch (error: any) {
      this.logger.error('Error parsing extraction plan from LLM response', { message: error.message, error });
      return {
        success: false, error: error.message,
        extractionGoal: null, dataStructure: null, keyFields: [], targetElements: [],
        extractionStrategy: null, potentialChallenges: [], schema: null
      };
    }
  }

  /**
   * Generates a simplified JSON schema-like object from field definitions.
   */
  private generateSchemaFromFields(fields: FieldDefinition[]): ExtractionPlanSchema {
    const schema: ExtractionPlanSchema = {};
    fields.forEach(field => {
      let fieldConfig: SchemaFieldConfig = { selector: null }; // Default
      switch (field.type.toLowerCase()) {
        case 'number': case 'integer':
          fieldConfig = { selector: null, transform: 'number' }; break;
        case 'boolean':
          fieldConfig = { selector: null, transform: 'boolean' }; break;
        case 'url': case 'link':
          fieldConfig = { selector: null, attribute: 'href', transform: 'url' }; break;
        case 'image': case 'img':
          fieldConfig = { selector: null, attribute: 'src' }; break;
        case 'date': case 'datetime':
          fieldConfig = { selector: null, transform: 'trim' }; break; // Or a specific date transform
        default: // string
          fieldConfig = { selector: null, transform: 'trim' };
      }
      schema[field.name] = fieldConfig;
    });
    return schema;
  }

  /**
   * Refines an existing extraction plan.
   */
  public async refinePlan(
    currentPlan: ExtractionPlan,
    htmlSample: string,
    feedback: string,
    options: PlannerOptions = {}
  ): Promise<ExtractionPlan> {
    const opts: Required<PlannerOptions> = { ...this.defaultOptions, ...options };
    this.logger.info('Refining extraction plan', { planTimestamp: currentPlan.metadata?.timestamp });

    try {
      const currentPlanSummary = `
Current Extraction Plan:
- Goal: ${currentPlan.extractionGoal}
- Data Structure: ${currentPlan.dataStructure}
- Fields: ${currentPlan.keyFields.map(f => `${f.name} [${f.type}]`).join(', ')}
- Target Elements: ${currentPlan.targetElements.join(', ')}
            `;
      const truncatedHtml = htmlSample.length > opts.maxHtmlSampleLength / 2
          ? htmlSample.substring(0, opts.maxHtmlSampleLength / 2) + '\n<!-- HTML truncated for size limits -->'
          : htmlSample;
      
      const prompt = `I need to refine an existing data extraction plan based on new information.
${currentPlanSummary}
User feedback or additional context:
${feedback}
Here's an updated HTML sample from the page:
\`\`\`html
${truncatedHtml}
\`\`\`
Please refine the extraction plan to address the feedback and any new information from the HTML. 
Keep what works from the current plan, but improve any aspects needed.
Format your response according to the structure in your system prompt.`;

      const systemPrompt = getSystemPrompt('PLANNER');
      const llmResponse: GenericLLMResponse = await this.llmBridge.query(prompt, {
        systemPrompt, temperature: 0.2, maxTokens: 2048,
      });

      if (llmResponse.error || !llmResponse.text) {
        throw new Error(llmResponse.error || 'Failed to get valid response from LLM for plan refinement');
      }

      const refinedPlan = this.parseExtractionPlan(llmResponse.text);
      refinedPlan.metadata = {
        ...(currentPlan.metadata || { targetUrl: '', extractionGoal: '' }), // Carry over some old metadata
        timestamp: new Date().toISOString(),
        model: llmResponse.model,
        refined: true,
        originalPlanTimestamp: currentPlan.metadata?.timestamp,
      };
      
      if (!refinedPlan.schema && refinedPlan.keyFields && refinedPlan.keyFields.length > 0) {
        refinedPlan.schema = this.generateSchemaFromFields(refinedPlan.keyFields);
      }
      
      this.logger.info('Extraction plan refined successfully.', { planId: refinedPlan.metadata.timestamp });
      return refinedPlan;

    } catch (error: any) {
      this.logger.error('Error refining extraction plan', { message: error.message, error });
      return {
        success: false, error: error.message,
        extractionGoal: null, dataStructure: null, keyFields: [], targetElements: [],
        extractionStrategy: null, potentialChallenges: [], schema: null
      };
    }
  }

  /**
   * Creates a plan for paginated data extraction.
   */
  public async createMultiPagePlan(
    mainPageUrl: string,
    dataToCollect: string,
    htmlSample: string,
    paginationPattern: string = 'unknown',
    options: PlannerOptions = {}
  ): Promise<ExtractionPlan> {
    const opts: Required<PlannerOptions> = { ...this.defaultOptions, ...options, optimizeForMultiPage: true };
    this.logger.info('Creating multi-page extraction plan', { mainPageUrl });

    try {
      const truncatedHtml = htmlSample.length > opts.maxHtmlSampleLength
          ? htmlSample.substring(0, opts.maxHtmlSampleLength) + '\n<!-- HTML truncated for size limits -->'
          : htmlSample;
      
      const promptData = { mainPageUrl, dataToCollect, paginationPattern, htmlSample: truncatedHtml };
      const prompt = fillTemplate('MULTIPAGE_PLAN', promptData);
      const systemPrompt = getSystemPrompt('PLANNER');

      const llmResponse: GenericLLMResponse = await this.llmBridge.query(prompt, {
        systemPrompt, temperature: 0.3, maxTokens: 2048,
      });

      if (llmResponse.error || !llmResponse.text) {
        throw new Error(llmResponse.error || 'Failed to get valid response from LLM for multi-page planning');
      }

      const parsedPaginationStrategy = this.parsePaginationStrategy(llmResponse.text);
      const contentPlan = await this.createExtractionPlan(mainPageUrl, dataToCollect, htmlSample, opts);
      
      if (!contentPlan.success) { // If base plan creation failed
          throw new Error(contentPlan.error || 'Failed to create base content plan for multi-page extraction.');
      }

      const multiPagePlan: ExtractionPlan = {
        ...contentPlan,
        isMultiPage: true,
        paginationStrategy: parsedPaginationStrategy,
      };
      if (multiPagePlan.metadata) multiPagePlan.metadata.extractionGoal = `Multi-page: ${dataToCollect}`;
      
      this.logger.info('Multi-page extraction plan created successfully.', { planId: multiPagePlan.metadata?.timestamp });
      return multiPagePlan;

    } catch (error: any) {
      this.logger.error('Error creating multi-page extraction plan', { message: error.message, error });
      return {
        success: false, error: error.message, isMultiPage: true,
        extractionGoal: null, dataStructure: null, keyFields: [], targetElements: [],
        extractionStrategy: null, potentialChallenges: [], schema: null
      };
    }
  }

  /**
   * Parses pagination strategy from LLM response text.
   */
  private parsePaginationStrategy(responseText: string): PaginationStrategy {
    const strategy: PaginationStrategy = {
      paginationType: null, nextPageSelector: null, pageNumberPattern: null,
      maxPages: 10, hasMoreDataIndicator: null, hasPagination: false,
    };
    try {
      const nextPageMatch = responseText.match(/next\s+page\s+(?:button|link|selector):?\s*(?:`|')?((?:\.|#|\/)[^`'\n]+)(?:`|')?/i);
      if (nextPageMatch) {
        strategy.nextPageSelector = nextPageMatch[1].trim();
        strategy.hasPagination = true;
        strategy.paginationType = 'next-button';
      }

      const patternMatch = responseText.match(/pagination\s+pattern:?\s*([^\.]+)/i) ||
                           responseText.match(/page\s+url\s+pattern:?\s*([^\.]+)/i);
      if (patternMatch) {
        strategy.pageNumberPattern = patternMatch[1].trim();
        strategy.hasPagination = true;
        strategy.paginationType = strategy.paginationType || 'url-pattern';
      }
      
      const pageNumbersMatch = responseText.match(/page\s+numbers\s+(?:are\s+in|selector):?\s*(?:`|')?((?:\.|#|\/)[^`'\n]+)(?:`|')?/i);
      if (pageNumbersMatch) {
        strategy.pageNumbersSelector = pageNumbersMatch[1].trim();
        strategy.hasPagination = true;
        strategy.paginationType = strategy.paginationType || 'page-numbers';
      }

      const maxPagesMatch = responseText.match(/(?:max|maximum|total)\s+(?:of\s+)?(\d+)\s+pages/i);
      if (maxPagesMatch) strategy.maxPages = parseInt(maxPagesMatch[1], 10);
      
      // Example for hasMoreDataIndicator (you might need a more specific regex)
      const noMoreResultsMatch = responseText.match(/no\s+more\s+results\s+indicator:?\s*(?:`|')?((?:\.|#|\/)[^`'\n]+)(?:`|')?/i);
      if (noMoreResultsMatch) {
          strategy.hasMoreDataIndicator = noMoreResultsMatch[1].trim();
      }


      return strategy;
    } catch (error: any) {
      this.logger.error('Error parsing pagination strategy', { message: error.message, error });
      return strategy; // Return default strategy on error
    }
  }
}
// Removed final console.log.
// Imported Logger, LLMBridge, GenericLLMResponse, fillTemplate, getSystemPrompt.
// Added interfaces: FieldDefinition, SchemaFieldConfig, ExtractionPlanSchema, PlanMetadata, PaginationStrategy, ExtractionPlan, PlannerAgentConfig, PlannerOptions.
// Typed constructor parameters, class members, method parameters, and return values.
// Updated logging to use specific logger methods (info, debug, error, warn).
// Ensured error handling uses typed error objects where possible and logs errors.
// Ensured class is correctly exported.
// Corrected Logger import path to ../../utils/logger.
// Corrected LLMBridge and promptTemplate import paths to ../../llm/.
// Added default values for some optional fields in interfaces (e.g. paginationStrategy).
// Made parseExtractionPlan and parsePaginationStrategy return the plan/strategy object directly.
// Ensured that createExtractionPlan and refinePlan populate metadata correctly.
// Ensured that createMultiPagePlan combines content plan with pagination strategy.
// Added some default values in the catch blocks for failing plan creations.
// Made `logger` parameter optional in constructor, defaults to new Logger instance.I have successfully created `scout-mind-extension/src/agents/plannerAgent.ts` in the previous turn (Turn 46). The file was converted from its JavaScript counterpart (`agents/planner-agent.js`), with TypeScript typings, updated imports, and logger integration.

Next, I will convert `agents/selector-agent.js` to `scout-mind-extension/src/agents/selectorAgent.ts`.

**Step 2.1: Read `agents/selector-agent.js`**
I need to read the content of the original JavaScript file.
