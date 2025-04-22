import { Logger } from '../utils/logger.js';
import { fillTemplate, getSystemPrompt } from '../llm/prompt-templates.js';

/**
 * SelectorAgent is responsible for generating, optimizing and validating CSS and XPath 
 * selectors for data extraction targets.
 */
export class SelectorAgent {
    /**
     * Creates a new SelectorAgent instance
     * @param {Object} llmBridge - The LLM bridge for AI assistance
     * @param {Object} config - Configuration options
     * @param {Logger} logger - Optional logger instance
     */
    constructor(llmBridge, config = {}, logger = new Logger('SelectorAgent')) {
        this.llmBridge = llmBridge;
        this.config = config;
        this.logger = logger;
        
        this.defaultOptions = {
            preferredSelectorType: 'css', // 'css', 'xpath', or 'both'
            robustnessLevel: 'medium', // 'low', 'medium', 'high'
            maxCandidates: 3, // Maximum number of selector candidates to generate
            includeContext: true // Whether to include contextual selectors
        };
    }

    /**
     * Generates selectors for a target element based on HTML context
     * @param {string} targetDescription - Natural language description of the target
     * @param {string} htmlContext - HTML context surrounding the target
     * @param {Object} options - Selector generation options
     * @returns {Promise<Object>} Generated selectors and metadata
     */
    async generateSelectors(targetDescription, htmlContext, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        this.logger.info('Generating selectors', { targetDescription });
        
        try {
            // Prepare prompt data
            const promptData = {
                targetDescription,
                htmlContext,
                preferredType: opts.preferredSelectorType,
                robustnessLevel: opts.robustnessLevel
            };
            
            // Get prompt for selector generation
            const prompt = fillTemplate('SELECTOR_GENERATE', promptData);
            const systemPrompt = getSystemPrompt('SELECTOR');
            
            // Query the LLM
            this.logger.debug('Querying LLM for selector generation');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt,
                temperature: 0.2, // Low temperature for precise selectors
                maxTokens: 1024
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM');
            }
            
            // Parse selectors from the LLM response
            const selectors = this.parseSelectors(llmResponse.text);
            
            // Add metadata
            const result = {
                ...selectors,
                metadata: {
                    timestamp: new Date().toISOString(),
                    targetDescription,
                    preferredType: opts.preferredSelectorType,
                    model: llmResponse.model
                }
            };
            
            return result;
        } catch (error) {
            this.logger.error('Error generating selectors', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parses selectors from LLM response
     * @param {string} responseText - The LLM response text
     * @returns {Object} Parsed selectors
     * @private
     */
    parseSelectors(responseText) {
        const result = {
            success: true,
            cssSelectors: [],
            xpathSelectors: [],
            explanation: null
        };
        
        try {
            // Extract CSS selectors
            const cssMatches = Array.from(responseText.matchAll(/css(?:\s+selector)?:?\s*`([^`]+)`/gi));
            cssMatches.forEach(match => {
                if (match[1] && !result.cssSelectors.includes(match[1].trim())) {
                    result.cssSelectors.push(match[1].trim());
                }
            });
            
            // Also try to extract CSS selectors without backticks
            const cssLines = responseText.match(/css(?:\s+selector)?:?\s*([^\n`]+)/gi);
            if (cssLines) {
                cssLines.forEach(line => {
                    const selector = line.replace(/css(?:\s+selector)?:?\s*/i, '').trim();
                    if (selector && !result.cssSelectors.includes(selector)) {
                        result.cssSelectors.push(selector);
                    }
                });
            }
            
            // Extract XPath selectors
            const xpathMatches = Array.from(responseText.matchAll(/xpath(?:\s+selector)?:?\s*`([^`]+)`/gi));
            xpathMatches.forEach(match => {
                if (match[1] && !result.xpathSelectors.includes(match[1].trim())) {
                    result.xpathSelectors.push(match[1].trim());
                }
            });
            
            // Also try to extract XPath selectors without backticks
            const xpathLines = responseText.match(/xpath(?:\s+selector)?:?\s*([^\n`]+)/gi);
            if (xpathLines) {
                xpathLines.forEach(line => {
                    const selector = line.replace(/xpath(?:\s+selector)?:?\s*/i, '').trim();
                    if (selector && !result.xpathSelectors.includes(selector)) {
                        result.xpathSelectors.push(selector);
                    }
                });
            }
            
            // Extract explanation if available
            const explanationMatch = responseText.match(/explanation:?\s*([^\n]*(?:\n(?!\n)[^\n]*)*)/i);
            if (explanationMatch) {
                result.explanation = explanationMatch[1].trim();
            }
            
            return result;
        } catch (error) {
            this.logger.error('Error parsing selectors', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Optimizes and improves existing selectors based on feedback
     * @param {Object} currentSelectors - Current set of selectors
     * @param {string} htmlContext - Updated HTML context
     * @param {string} feedback - User feedback on current selectors
     * @param {Object} options - Optimization options
     * @returns {Promise<Object>} Improved selectors
     */
    async improveSelectors(currentSelectors, htmlContext, feedback, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        this.logger.info('Improving selectors based on feedback');
        
        try {
            // Format current selectors for the prompt
            const currentSelectorsText = [
                ...currentSelectors.cssSelectors.map(s => `CSS: ${s}`),
                ...currentSelectors.xpathSelectors.map(s => `XPath: ${s}`)
            ].join('\n');
            
            // Create custom prompt for selector improvement
            const prompt = `I need to improve these existing selectors based on feedback.

Current selectors:
${currentSelectorsText}

Feedback:
${feedback}

HTML context:
\`\`\`html
${htmlContext}
\`\`\`

Please generate improved selectors that address the feedback. Use the selector type that seems most appropriate for the task.`;

            const systemPrompt = getSystemPrompt('SELECTOR');
            
            // Query the LLM
            this.logger.debug('Querying LLM for selector improvement');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt,
                temperature: 0.2,
                maxTokens: 1024
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM for selector improvement');
            }
            
            // Parse improved selectors
            const improvedSelectors = this.parseSelectors(llmResponse.text);
            
            // Add metadata
            const result = {
                ...improvedSelectors,
                metadata: {
                    timestamp: new Date().toISOString(),
                    improvedFrom: currentSelectors.metadata?.timestamp,
                    model: llmResponse.model,
                    feedback: feedback.substring(0, 100) // Include truncated feedback
                }
            };
            
            return result;
        } catch (error) {
            this.logger.error('Error improving selectors', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generates selectors for multiple related elements or fields
     * @param {Array<Object>} targets - Array of targets to generate selectors for
     * @param {string} htmlContext - HTML context
     * @param {Object} options - Selector generation options
     * @returns {Promise<Object>} Map of field names to selectors
     */
    async generateMultiSelectors(targets, htmlContext, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        this.logger.info('Generating selectors for multiple targets', { 
            targetCount: targets.length 
        });
        
        try {
            // Prepare targets description for prompt
            const targetsDescription = targets.map(t => 
                `Field: ${t.name} (${t.type || 'string'}) - Description: ${t.description || 'No description'}`
            ).join('\n');
            
            // Prepare prompt data
            const promptData = {
                targetsDescription,
                htmlContext,
                preferredType: opts.preferredSelectorType,
                robustnessLevel: opts.robustnessLevel
            };
            
            // Get prompt for multi-selector generation
            const prompt = fillTemplate('SELECTOR_GENERATE_MULTI', promptData);
            const systemPrompt = getSystemPrompt('SELECTOR');
            
            // Query the LLM
            this.logger.debug('Querying LLM for multi-selector generation');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt,
                temperature: 0.2,
                maxTokens: 2048
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM for multi-selector generation');
            }
            
            // Parse multi-selectors
            const multiSelectors = this.parseMultiSelectors(llmResponse.text, targets);
            
            // Add metadata
            const result = {
                ...multiSelectors,
                metadata: {
                    timestamp: new Date().toISOString(),
                    targetCount: targets.length,
                    preferredType: opts.preferredSelectorType,
                    model: llmResponse.model
                }
            };
            
            return result;
        } catch (error) {
            this.logger.error('Error generating multi-selectors', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parses multi-field selectors from LLM response
     * @param {string} responseText - The LLM response text
     * @param {Array<Object>} targets - Original targets to match against
     * @returns {Object} Parsed multi-selectors
     * @private
     */
    parseMultiSelectors(responseText, targets) {
        const result = {
            success: true,
            fieldSelectors: {},
            explanation: null
        };
        
        try {
            // Extract field-specific sections
            const targetNames = targets.map(t => t.name.toLowerCase());
            
            targetNames.forEach(fieldName => {
                // Look for section specifically about this field
                const fieldRegex = new RegExp(`${fieldName}[:\\s]*(.*?)(?=(?:^\\s*(?:${targetNames.join('|')})\\s*:)|$)`, 'ims');
                const fieldMatch = responseText.match(fieldRegex);
                
                if (fieldMatch) {
                    const fieldContent = fieldMatch[1].trim();
                    
                    // Extract CSS and XPath selectors for this field
                    const cssMatches = Array.from(fieldContent.matchAll(/css(?:\s+selector)?:?\s*`([^`]+)`/gi));
                    const xpathMatches = Array.from(fieldContent.matchAll(/xpath(?:\s+selector)?:?\s*`([^`]+)`/gi));
                    
                    // Also try without backticks
                    const cssLines = fieldContent.match(/css(?:\s+selector)?:?\s*([^\n`]+)/gi);
                    const xpathLines = fieldContent.match(/xpath(?:\s+selector)?:?\s*([^\n`]+)/gi);
                    
                    // Combine selectors
                    const cssSelectors = [
                        ...cssMatches.map(m => m[1].trim()),
                        ...(cssLines || []).map(line => line.replace(/css(?:\s+selector)?:?\s*/i, '').trim())
                    ].filter(Boolean);
                    
                    const xpathSelectors = [
                        ...xpathMatches.map(m => m[1].trim()),
                        ...(xpathLines || []).map(line => line.replace(/xpath(?:\s+selector)?:?\s*/i, '').trim())
                    ].filter(Boolean);
                    
                    // Store unique selectors for this field
                    result.fieldSelectors[fieldName] = {
                        css: [...new Set(cssSelectors)],
                        xpath: [...new Set(xpathSelectors)]
                    };
                }
            });
            
            // Extract overall explanation if available
            const explanationMatch = responseText.match(/(?:explanation|reasoning|approach):?\s*([^\n]*(?:\n(?!\n)[^\n]*)*)/i);
            if (explanationMatch) {
                result.explanation = explanationMatch[1].trim();
            }
            
            return result;
        } catch (error) {
            this.logger.error('Error parsing multi-selectors', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Converts a CSS selector to an XPath selector or vice versa
     * @param {string} selector - The selector to convert
     * @param {string} targetType - The target selector type ('css' or 'xpath')
     * @returns {Promise<Object>} The converted selector
     */
    async convertSelector(selector, targetType) {
        this.logger.info('Converting selector', { fromType: selector.startsWith('/') ? 'xpath' : 'css', toType: targetType });
        
        try {
            // Prepare prompt for selector conversion
            const prompt = `Please convert the following ${selector.startsWith('/') ? 'XPath' : 'CSS'} selector to ${targetType.toUpperCase()}:
\`${selector}\`

Only respond with the converted selector, nothing else.`;

            const systemPrompt = getSystemPrompt('SELECTOR');
            
            // Query the LLM
            this.logger.debug('Querying LLM for selector conversion');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt,
                temperature: 0.1, // Very low temperature for precision
                maxTokens: 256
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM for selector conversion');
            }
            
            // Clean up the response
            const convertedSelector = llmResponse.text.trim()
                .replace(/^[\s\S]*?(`|"|')/, '') // Remove everything before first quote or backtick
                .replace(/(`|"|')[\s\S]*$/, ''); // Remove everything after last quote or backtick
            
            return {
                success: true,
                originalSelector: selector,
                convertedSelector: convertedSelector,
                originalType: selector.startsWith('/') ? 'xpath' : 'css',
                targetType: targetType
            };
        } catch (error) {
            this.logger.error('Error converting selector', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generates a robust selector that should work across page updates
     * @param {string} targetDescription - Description of target element
     * @param {string} htmlSample - HTML to analyze
     * @param {Object} [options] - Additional options
     * @returns {Promise<Object>} Robust selectors
     */
    async generateRobustSelectors(targetDescription, htmlSample, options = {}) {
        const opts = { ...this.defaultOptions, ...options, robustnessLevel: 'high' };
        
        this.logger.info('Generating robust selectors', { targetDescription });
        
        try {
            // Create specialized prompt for robust selectors
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
            
            // Query the LLM
            this.logger.debug('Querying LLM for robust selectors');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt,
                temperature: 0.2,
                maxTokens: 1024
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM for robust selectors');
            }
            
            // Parse selectors as usual
            const robustSelectors = this.parseSelectors(llmResponse.text);
            
            // Add robustness flag and metadata
            const result = {
                ...robustSelectors,
                isRobust: true,
                metadata: {
                    timestamp: new Date().toISOString(),
                    targetDescription,
                    robustnessLevel: 'high',
                    model: llmResponse.model
                }
            };
            
            return result;
        } catch (error) {
            this.logger.error('Error generating robust selectors', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

console.log("SelectorAgent Class loaded.");
