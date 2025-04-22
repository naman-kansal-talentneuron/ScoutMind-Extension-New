// agents/planner-agent.js
import { Logger } from '../utils/logger.js';
import { fillTemplate, getSystemPrompt } from '../llm/prompt-templates.js';

/**
 * PlannerAgent is responsible for analyzing user extraction requests and creating 
 * structured data extraction plans, including schema definition.
 */
export class PlannerAgent {
    /**
     * Creates a new PlannerAgent instance
     * @param {Object} llmBridge - The LLM bridge for AI assistance
     * @param {Object} config - Configuration options
     * @param {Logger} [logger] - Optional logger instance
     */
    constructor(llmBridge, config = {}, logger = new Logger('PlannerAgent')) {
        this.llmBridge = llmBridge;
        this.config = config;
        this.logger = logger;
        
        // Default planning options
        this.defaultOptions = {
            maxHtmlSampleLength: 30000, // Maximum HTML to include in prompts
            optimizeForMultiPage: false, // Whether to plan for multi-page extraction
            includePaginationAnalysis: false, // Whether to analyze pagination patterns
            maxJsonSchemaComplexity: 'medium', // Complexity of generated schemas: 'simple', 'medium', 'complex'
        };
    }

    /**
     * Creates an extraction plan based on the user request and page content
     * @param {string} targetUrl - The URL to extract data from
     * @param {string} extractionGoal - The user's extraction goal description
     * @param {string} htmlSample - Sample of the HTML content to analyze
     * @param {Object} [options] - Additional options
     * @returns {Promise<Object>} The extraction plan
     */
    async createExtractionPlan(targetUrl, extractionGoal, htmlSample, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        this.logger.info('Creating extraction plan', { targetUrl, extractionGoal });
        
        try {
            // Truncate HTML sample if needed
            const truncatedHtml = htmlSample.length > opts.maxHtmlSampleLength
                ? htmlSample.substring(0, opts.maxHtmlSampleLength) + '\n<!-- HTML truncated for size limits -->'
                : htmlSample;
            
            // Prepare prompt data
            const promptData = {
                targetUrl,
                extractionGoal,
                htmlSample: truncatedHtml
            };
            
            // Get prompt and system prompt for planner
            const prompt = fillTemplate('PLANNER_CREATE_PLAN', promptData);
            const systemPrompt = getSystemPrompt('PLANNER');
            
            // Query the LLM
            this.logger.debug('Querying LLM for extraction plan');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt,
                temperature: 0.3, // Balance between creativity and precision
                maxTokens: 2048
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM');
            }
            
            // Parse the plan from the LLM response
            const plan = this.parseExtractionPlan(llmResponse.text);
            
            // Add metadata to the plan
            const planWithMetadata = {
                ...plan,
                metadata: {
                    timestamp: new Date().toISOString(),
                    targetUrl,
                    extractionGoal,
                    model: llmResponse.model
                }
            };
            
            // Generate JSON schema if needed
            if (!plan.schema && plan.keyFields) {
                planWithMetadata.schema = this.generateSchemaFromFields(plan.keyFields);
            }
            
            return planWithMetadata;
        } catch (error) {
            this.logger.error('Error creating extraction plan', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parses an extraction plan from the LLM response
     * @param {string} responseText - The LLM response text
     * @returns {Object} The parsed extraction plan
     * @private
     */
    parseExtractionPlan(responseText) {
        const plan = {
            success: true,
            extractionGoal: null,
            dataStructure: null,
            keyFields: [],
            targetElements: [],
            extractionStrategy: null,
            potentialChallenges: [],
            schema: null
        };
        
        try {
            // Extract the extraction goal
            const goalMatch = responseText.match(/Extraction Goal:?\s*([^\n]+)/i);
            if (goalMatch) {
                plan.extractionGoal = goalMatch[1].trim();
            }
            
            // Extract data structure
            const structureMatch = responseText.match(/Data Structure:?\s*([^\n]+)/i);
            if (structureMatch) {
                plan.dataStructure = structureMatch[1].trim();
            }
            
            // Extract key fields
            const fieldsSection = responseText.match(/Key Fields:?\s*([\s\S]*?)(?=Target Elements:|Extraction Strategy:|Potential Challenges:|$)/i);
            if (fieldsSection) {
                const fieldLines = fieldsSection[1].trim().split('\n');
                plan.keyFields = fieldLines.map(line => {
                    const field = line.trim().replace(/^-\s*/, '');
                    
                    // Try to identify field name and type if specified
                    const typeMatch = field.match(/([^:[\]]+)(?:\s*\[([^\]]+)\])?/);
                    
                    if (typeMatch) {
                        return {
                            name: typeMatch[1].trim(),
                            type: typeMatch[2] ? typeMatch[2].trim().toLowerCase() : 'string'
                        };
                    }
                    
                    return { name: field, type: 'string' };
                }).filter(f => f.name); // Filter out any empty fields
            }
            
            // Extract target elements
            const elementsSection = responseText.match(/Target Elements:?\s*([\s\S]*?)(?=Extraction Strategy:|Potential Challenges:|$)/i);
            if (elementsSection) {
                const elementLines = elementsSection[1].trim().split('\n');
                plan.targetElements = elementLines.map(line => line.trim().replace(/^-\s*/, '')).filter(Boolean);
            }
            
            // Extract extraction strategy
            const strategyMatch = responseText.match(/Extraction Strategy:?\s*([\s\S]*?)(?=Potential Challenges:|$)/i);
            if (strategyMatch) {
                plan.extractionStrategy = strategyMatch[1].trim();
            }
            
            // Extract potential challenges
            const challengesSection = responseText.match(/Potential Challenges:?\s*([\s\S]*?)(?=$)/i);
            if (challengesSection) {
                const challengeLines = challengesSection[1].trim().split('\n');
                plan.potentialChallenges = challengeLines.map(line => line.trim().replace(/^-\s*/, '')).filter(Boolean);
            }
            
            // Check if JSON schema was provided directly
            const schemaMatch = responseText.match(/```(?:json)?\s*({\s*"[^}]+"[\s\S]*?})\s*```/);
            if (schemaMatch) {
                try {
                    plan.schema = JSON.parse(schemaMatch[1]);
                } catch (e) {
                    this.logger.warn('Failed to parse JSON schema from response', e);
                }
            }
            
            return plan;
        } catch (error) {
            this.logger.error('Error parsing extraction plan', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generates a JSON schema from field definitions
     * @param {Array<Object>} fields - The field definitions
     * @returns {Object} The generated schema
     * @private
     */
    generateSchemaFromFields(fields) {
        const schema = {};
        
        fields.forEach(field => {
            let fieldConfig = {};
            
            // Map field types to schema configurations
            switch (field.type) {
                case 'number':
                case 'integer':
                    fieldConfig = { selector: null, transform: 'number' };
                    break;
                case 'boolean':
                    fieldConfig = { selector: null, transform: 'boolean' };
                    break;
                case 'url':
                case 'link':
                    fieldConfig = { selector: null, attribute: 'href', transform: 'url' };
                    break;
                case 'image':
                    fieldConfig = { selector: null, attribute: 'src' };
                    break;
                case 'date':
                case 'datetime':
                    fieldConfig = { selector: null, transform: 'trim' };
                    break;
                default:
                    fieldConfig = { selector: null, transform: 'trim' };
            }
            
            schema[field.name] = fieldConfig;
        });
        
        return schema;
    }

    /**
     * Refines an existing extraction plan with additional context
     * @param {Object} currentPlan - The current extraction plan
     * @param {string} htmlSample - Updated HTML sample
     * @param {string} feedback - User feedback or additional context
     * @param {Object} [options] - Additional options
     * @returns {Promise<Object>} The refined plan
     */
    async refinePlan(currentPlan, htmlSample, feedback, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        this.logger.info('Refining extraction plan');
        
        try {
            // Prepare the current plan summary
            const currentPlanSummary = `
Current Extraction Plan:
- Goal: ${currentPlan.extractionGoal}
- Data Structure: ${currentPlan.dataStructure}
- Fields: ${currentPlan.keyFields.map(f => `${f.name} [${f.type}]`).join(', ')}
- Target Elements: ${currentPlan.targetElements.join(', ')}
            `;
            
            // Truncate HTML sample if needed
            const truncatedHtml = htmlSample.length > opts.maxHtmlSampleLength / 2
                ? htmlSample.substring(0, opts.maxHtmlSampleLength / 2) + '\n<!-- HTML truncated for size limits -->'
                : htmlSample;
            
            // Create a custom prompt for refinement
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
            
            // Query the LLM
            this.logger.debug('Querying LLM for plan refinement');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt,
                temperature: 0.2, // Lower temperature for more precise refinement
                maxTokens: 2048
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM for plan refinement');
            }
            
            // Parse the refined plan
            const refinedPlan = this.parseExtractionPlan(llmResponse.text);
            
            // Add metadata and mark as refined
            const refinedPlanWithMetadata = {
                ...refinedPlan,
                metadata: {
                    timestamp: new Date().toISOString(),
                    model: llmResponse.model,
                    refined: true,
                    originalPlanTimestamp: currentPlan.metadata?.timestamp
                }
            };
            
            // Generate JSON schema if needed
            if (!refinedPlan.schema && refinedPlan.keyFields) {
                refinedPlanWithMetadata.schema = this.generateSchemaFromFields(refinedPlan.keyFields);
            }
            
            return refinedPlanWithMetadata;
        } catch (error) {
            this.logger.error('Error refining extraction plan', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Creates a plan for paginated data extraction
     * @param {string} mainPageUrl - The main page URL
     * @param {string} dataToCollect - Description of data to collect
     * @param {string} htmlSample - Sample HTML content
     * @param {string} paginationPattern - Description of pagination pattern (if known)
     * @param {Object} [options] - Additional options
     * @returns {Promise<Object>} Multi-page extraction plan
     */
    async createMultiPagePlan(mainPageUrl, dataToCollect, htmlSample, paginationPattern = 'unknown', options = {}) {
        const opts = { ...this.defaultOptions, ...options, optimizeForMultiPage: true };
        
        this.logger.info('Creating multi-page extraction plan', { mainPageUrl });
        
        try {
            // Truncate HTML sample if needed
            const truncatedHtml = htmlSample.length > opts.maxHtmlSampleLength
                ? htmlSample.substring(0, opts.maxHtmlSampleLength) + '\n<!-- HTML truncated for size limits -->'
                : htmlSample;
            
            // Prepare prompt data
            const promptData = {
                mainPageUrl,
                dataToCollect,
                paginationPattern,
                htmlSample: truncatedHtml
            };
            
            // Get prompt for multi-page planning
            const prompt = fillTemplate('MULTIPAGE_PLAN', promptData);
            const systemPrompt = getSystemPrompt('PLANNER');
            
            // Query the LLM
            this.logger.debug('Querying LLM for multi-page plan');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt,
                temperature: 0.3,
                maxTokens: 2048
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM for multi-page planning');
            }
            
            // Parse pagination strategy from response
            const paginationStrategy = this.parsePaginationStrategy(llmResponse.text);
            
            // Create regular extraction plan for the content
            const contentPlan = await this.createExtractionPlan(
                mainPageUrl, 
                dataToCollect, 
                htmlSample,
                opts
            );
            
            // Combine regular plan with pagination strategy
            const multiPagePlan = {
                ...contentPlan,
                paginationStrategy,
                isMultiPage: true
            };
            
            return multiPagePlan;
        } catch (error) {
            this.logger.error('Error creating multi-page extraction plan', error);
            return {
                success: false,
                error: error.message,
                isMultiPage: true
            };
        }
    }

    /**
     * Parses pagination strategy from LLM response
     * @param {string} responseText - The LLM response text
     * @returns {Object} Pagination strategy
     * @private
     */
    parsePaginationStrategy(responseText) {
        const strategy = {
            paginationType: null,
            nextPageSelector: null,
            pageNumberPattern: null,
            maxPages: 10, // Default max pages
            hasMoreDataIndicator: null,
            hasPagination: false
        };
        
        try {
            // Look for pagination selectors or patterns
            const nextPageMatch = responseText.match(/next\s+page\s+(?:button|link|selector):?\s*(?:`|')?((?:\.|#|\/)[^`'\n]+)(?:`|')?/i);
            if (nextPageMatch) {
                strategy.nextPageSelector = nextPageMatch[1].trim();
                strategy.hasPagination = true;
                strategy.paginationType = 'next-button';
            }
            
            // Look for pagination pattern description
            const patternMatch = responseText.match(/pagination\s+pattern:?\s*([^\.]+)/i) ||
                              responseText.match(/page\s+url\s+pattern:?\s*([^\.]+)/i);
            if (patternMatch) {
                strategy.pageNumberPattern = patternMatch[1].trim();
                strategy.hasPagination = true;
                strategy.paginationType = strategy.paginationType || 'url-pattern';
            }
            
            // Look for page number selector
            const pageNumbersMatch = responseText.match(/page\s+numbers\s+(?:are\s+in|selector):?\s*(?:`|')?((?:\.|#|\/)[^`'\n]+)(?:`|')?/i);
            if (pageNumbersMatch) {
                strategy.pageNumbersSelector = pageNumbersMatch[1].trim();
                strategy.hasPagination = true;
                strategy.paginationType = strategy.paginationType || 'page-numbers';
            }
            
            // Extract max pages information if available
            const maxPagesMatch = responseText.match(/(?:max|maximum|total)\s+(?:of\s+)?(\d+)\s+pages/i);
            if (maxPagesMatch) {
                strategy.maxPages = parseInt(maxPagesMatch[1], 10);
            }
            
            return strategy;
        } catch (error) {
            this.logger.error('Error parsing pagination strategy', error);
            return strategy;
        }
    }
}

console.log("PlannerAgent Class loaded.");

// agents/orchestrator.js
// import { Logger } from '../utils/logger.js';
// import { PlannerAgent } from './planner-agent.js';
import { SelectorAgent } from './selector-agent.js';
import { ExtractorAgent } from './extractor-agent.js';
import { ValidatorAgent } from './validator-agent.js';

export class AgentOrchestrator {
  constructor(llmBridge, logger = new Logger('AgentOrchestrator'), 
             sendMessageToContentScript, sendMessageToOffscreen) {
    this.logger = logger;
    // ... initialize agents
  }
}
