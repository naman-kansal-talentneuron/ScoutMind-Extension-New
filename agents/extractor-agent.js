import { Logger } from '../utils/logger.js';
import { fillTemplate, getSystemPrompt } from '../llm/prompt-templates.js';
import { DOMUtils } from '../utils/dom-utils.js';

/**
 * ExtractorAgent is responsible for extracting structured data from web pages
 * based on the provided selectors and schema.
 */
export class ExtractorAgent {
    /**
     * Creates a new ExtractorAgent instance
     * @param {Object} llmBridge - The LLM bridge for AI assistance
     * @param {Object} config - Configuration options
     * @param {Logger} [logger] - Optional logger instance
     */
    constructor(llmBridge, config = {}, logger = new Logger('ExtractorAgent')) {
        this.llmBridge = llmBridge;
        this.config = config;
        this.logger = logger;
        this.domUtils = new DOMUtils(logger);
        
        // Default extraction options
        this.defaultOptions = {
            maxRetries: 2,
            fallbackToAi: true,
            includeMetadata: true,
            maxElementsPerBatch: 100,
            truncateHtmlAt: 50000 // Characters
        };
    }

    /**
     * Extracts data from a web page based on the provided selectors and schema
     * @param {Document} document - The document to extract from
     * @param {Object} extractionConfig - Configuration for this extraction
     * @param {Object} extractionConfig.selectors - The selectors to use (css, xpath)
     * @param {Object} extractionConfig.schema - The schema for structured data
     * @param {string} extractionConfig.extractionGoal - Description of what to extract
     * @param {Object} [options] - Additional options
     * @returns {Promise<Object>} The extracted data
     */
    async extract(document, extractionConfig, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        const { selectors, schema, extractionGoal } = extractionConfig;
        
        this.logger.info('Starting extraction', { extractionGoal });
        this.logger.debug('Extraction configuration', { selectors, schema });
        
        try {
            // First try with DOM-based extraction (faster)
            const domExtractedData = await this.extractWithDOM(document, selectors, schema, opts);
            
            // If DOM extraction succeeded, return the result
            if (domExtractedData && domExtractedData.success) {
                this.logger.info('DOM-based extraction successful', { 
                    itemsExtracted: domExtractedData.data.length 
                });
                return domExtractedData;
            }
            
            this.logger.info('DOM-based extraction had issues, falling back to LLM extraction');
            
            // Fall back to LLM-powered extraction if DOM extraction failed or was incomplete
            if (opts.fallbackToAi) {
                return await this.extractWithLLM(document, extractionConfig, opts);
            } else {
                return domExtractedData || { 
                    success: false, 
                    data: [], 
                    error: 'DOM extraction failed and AI fallback disabled'
                };
            }
        } catch (error) {
            this.logger.error('Extraction failed', error);
            return {
                success: false,
                data: [],
                error: error.message
            };
        }
    }

    /**
     * Extracts data using DOM manipulation via selectors
     * @param {Document} document - The document to extract from
     * @param {Object} selectors - The selectors to use
     * @param {Object} schema - The schema for structured data
     * @param {Object} options - Extraction options
     * @returns {Promise<Object>} The extracted data
     * @private
     */
    async extractWithDOM(document, selectors, schema, options) {
        try {
            let elementsFound = [];
            let extractedData = [];
            let cssSelectorsUsed = false;
            let xpathSelectorsUsed = false;
            
            // Try CSS selectors first
            if (selectors.css) {
                this.logger.debug(`Trying CSS selector: ${selectors.css}`);
                elementsFound = this.domUtils.findElements(selectors.css, document);
                cssSelectorsUsed = true;
            }
            
            // If CSS selectors didn't work, try XPath
            if (elementsFound.length === 0 && selectors.xpath) {
                this.logger.debug(`Trying XPath selector: ${selectors.xpath}`);
                elementsFound = this.domUtils.findElementsByXPath(selectors.xpath, document);
                xpathSelectorsUsed = true;
            }
            
            this.logger.debug(`Found ${elementsFound.length} elements for extraction`);
            
            if (elementsFound.length === 0) {
                return {
                    success: false,
                    data: [],
                    error: 'No elements found using the provided selectors'
                };
            }
            
            // Extract structured data from each element
            for (const element of elementsFound) {
                const item = this.extractDataFromElement(element, schema);
                
                if (item) {
                    extractedData.push(item);
                    
                    if (extractedData.length >= options.maxElementsPerBatch) {
                        this.logger.debug('Reached maximum elements per batch');
                        break;
                    }
                }
            }
            
            // Add metadata if requested
            if (options.includeMetadata) {
                const metadata = {
                    timestamp: new Date().toISOString(),
                    elementsFound: elementsFound.length,
                    elementsExtracted: extractedData.length,
                    selectors: {
                        css: cssSelectorsUsed ? selectors.css : null,
                        xpath: xpathSelectorsUsed ? selectors.xpath : null,
                        selectorType: cssSelectorsUsed ? 'css' : 'xpath'
                    }
                };
                
                return {
                    success: extractedData.length > 0,
                    data: extractedData,
                    metadata
                };
            } else {
                return {
                    success: extractedData.length > 0,
                    data: extractedData
                };
            }
        } catch (error) {
            this.logger.error('Error during DOM extraction', error);
            
            return {
                success: false,
                data: [],
                error: `DOM extraction failed: ${error.message}`
            };
        }
    }

    /**
     * Extracts data from an individual element based on the schema
     * @param {Element} element - The element to extract data from
     * @param {Object} schema - The schema to follow
     * @returns {Object|null} The extracted data
     * @private
     */
    extractDataFromElement(element, schema) {
        try {
            const result = {};
            
            // Process each field in the schema
            for (const [field, fieldConfig] of Object.entries(schema)) {
                const { selector, attribute, transform } = fieldConfig;
                
                let value = null;
                
                if (selector) {
                    // If there's a sub-selector, find the element
                    const subElement = this.domUtils.findElement(selector, element);
                    
                    if (subElement) {
                        if (attribute) {
                            // Extract attribute value
                            value = this.domUtils.getElementAttribute(subElement, attribute);
                        } else {
                            // Extract text content
                            value = this.domUtils.getElementText(subElement);
                        }
                    }
                } else {
                    if (attribute) {
                        // Extract attribute value from the current element
                        value = this.domUtils.getElementAttribute(element, attribute);
                    } else {
                        // Extract text content from the current element
                        value = this.domUtils.getElementText(element);
                    }
                }
                
                // Apply transformation if specified and the value exists
                if (transform && value) {
                    try {
                        switch (transform) {
                            case 'number':
                                value = Number(value.replace(/[^0-9.-]+/g, ''));
                                break;
                            case 'boolean':
                                value = Boolean(value);
                                break;
                            case 'trim':
                                value = value.trim();
                                break;
                            case 'lowercase':
                                value = value.toLowerCase();
                                break;
                            case 'uppercase':
                                value = value.toUpperCase();
                                break;
                            case 'url':
                                // Handle relative URLs
                                if (value.startsWith('/')) {
                                    const baseUrl = window.location.origin;
                                    value = baseUrl + value;
                                }
                                break;
                            default:
                                if (typeof transform === 'function') {
                                    value = transform(value);
                                }
                        }
                    } catch (e) {
                        this.logger.warn(`Transform error for field ${field}:`, e);
                    }
                }
                
                // Add the value to the result
                result[field] = value;
            }
            
            return result;
        } catch (error) {
            this.logger.error('Error extracting data from element:', error);
            return null;
        }
    }

    /**
     * Extracts data using LLM when DOM extraction fails or needs enhancement
     * @param {Document} document - The document to extract from
     * @param {Object} extractionConfig - The extraction configuration
     * @param {Object} options - Extraction options
     * @returns {Promise<Object>} The extracted data
     * @private
     */
    async extractWithLLM(document, extractionConfig, options) {
        const { selectors, schema, extractionGoal } = extractionConfig;
        
        try {
            this.logger.debug('Starting LLM-based extraction');
            
            // Get relevant HTML content
            let htmlContent = this.getRelevantHtml(document, selectors, options);
            
            // Prepare LLM prompt
            const promptData = {
                schema: JSON.stringify(schema, null, 2),
                cssSelector: selectors.css || 'Not provided',
                xpathSelector: selectors.xpath || 'Not provided',
                htmlContent: htmlContent
            };
            
            const prompt = fillTemplate('EXTRACTOR_EXTRACT_DATA', promptData);
            const systemPrompt = getSystemPrompt('EXTRACTOR');
            
            // Query the LLM
            this.logger.debug('Querying LLM for extraction');
            const llmResponse = await this.llmBridge.query(prompt, {
                systemPrompt: systemPrompt,
                temperature: 0.2, // Lower temperature for more deterministic results
                maxTokens: 4096
            });
            
            if (!llmResponse || !llmResponse.text) {
                throw new Error('Failed to get valid response from LLM');
            }
            
            // Try to extract JSON data from the response
            const extractedData = this.parseJsonFromLlmResponse(llmResponse.text);
            
            // Add metadata if needed
            if (options.includeMetadata) {
                const metadata = {
                    timestamp: new Date().toISOString(),
                    extractionMethod: 'llm',
                    model: llmResponse.model,
                    selectors: {
                        css: selectors.css,
                        xpath: selectors.xpath
                    }
                };
                
                return {
                    success: true,
                    data: Array.isArray(extractedData) ? extractedData : [extractedData],
                    metadata
                };
            } else {
                return {
                    success: true,
                    data: Array.isArray(extractedData) ? extractedData : [extractedData]
                };
            }
        } catch (error) {
            this.logger.error('LLM extraction failed', error);
            
            return {
                success: false,
                data: [],
                error: `LLM extraction failed: ${error.message}`
            };
        }
    }

    /**
     * Extracts relevant HTML for LLM processing
     * @param {Document} document - The document to extract from
     * @param {Object} selectors - The selectors to use
     * @param {Object} options - Extraction options
     * @returns {string} The relevant HTML content
     * @private
     */
    getRelevantHtml(document, selectors, options) {
        try {
            let relevantHtml = '';
            let container = document.body;
            
            // Try to find a more specific container element
            if (selectors.containerSelector) {
                const containerElement = this.domUtils.findElement(selectors.containerSelector, document);
                if (containerElement) {
                    container = containerElement;
                    this.logger.debug('Using container selector for HTML extraction');
                }
            }
            
            // If we have selectors, try to find matching elements
            if (selectors.css || selectors.xpath) {
                let elements = [];
                
                if (selectors.css) {
                    elements = this.domUtils.findElements(selectors.css, document);
                }
                
                if (elements.length === 0 && selectors.xpath) {
                    elements = this.domUtils.findElementsByXPath(selectors.xpath, document);
                }
                
                if (elements.length > 0) {
                    // Get outerHTML of elements and their contexts
                    relevantHtml = elements
                        .slice(0, options.maxElementsPerBatch)
                        .map(el => {
                            // Include parent for context
                            const parent = el.parentNode;
                            return parent ? parent.outerHTML : el.outerHTML;
                        })
                        .join('\n');
                }
            }
            
            // If no relevant HTML found with selectors, use the container
            if (!relevantHtml) {
                relevantHtml = container.outerHTML;
            }
            
            // Truncate to avoid token limits
            if (relevantHtml.length > options.truncateHtmlAt) {
                this.logger.debug(`Truncating HTML from ${relevantHtml.length} to ${options.truncateHtmlAt} characters`);
                relevantHtml = relevantHtml.substring(0, options.truncateHtmlAt) + 
                    '<!-- HTML truncated for size limits -->';
            }
            
            return relevantHtml;
        } catch (error) {
            this.logger.error('Error getting relevant HTML', error);
            return document.body.outerHTML.substring(0, options.truncateHtmlAt);
        }
    }

    /**
     * Parses JSON from LLM response text
     * @param {string} responseText - The text response from the LLM
     * @returns {Object|Array} Parsed JSON data
     * @private
     */
    parseJsonFromLlmResponse(responseText) {
        try {
            // Try to extract JSON from the response text
            const jsonMatches = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                              responseText.match(/{[\s\S]*}/) ||
                              responseText.match(/\[[\s\S]*\]/);
            
            const jsonStr = jsonMatches ? jsonMatches[1] || jsonMatches[0] : responseText;
            
            return JSON.parse(jsonStr);
        } catch (error) {
            this.logger.error('Error parsing JSON from LLM response', error);
            throw new Error('Failed to parse JSON from LLM response');
        }
    }

    /**
     * Tests the extraction capability with the provided selectors and schema
     * @param {Document} document - The document to test extraction on
     * @param {Object} selectors - The selectors to test
     * @param {Object} schema - The schema to use
     * @returns {Promise<Object>} Test results with sample data
     */
    async testExtraction(document, selectors, schema) {
        try {
            const extractionConfig = {
                selectors,
                schema,
                extractionGoal: 'Test extraction'
            };
            
            const options = {
                ...this.defaultOptions,
                maxElementsPerBatch: 5, // Limit for testing
                includeMetadata: true
            };
            
            // Try DOM extraction first
            const domResult = await this.extractWithDOM(document, selectors, schema, options);
            
            // If DOM extraction succeeded, return the result
            if (domResult.success && domResult.data.length > 0) {
                return {
                    success: true,
                    method: 'dom',
                    data: domResult.data,
                    metadata: domResult.metadata
                };
            }
            
            // Otherwise try LLM extraction
            this.logger.debug('DOM extraction test failed, trying LLM extraction');
            const llmResult = await this.extractWithLLM(document, extractionConfig, options);
            
            return {
                success: llmResult.success,
                method: 'llm',
                data: llmResult.data,
                metadata: llmResult.metadata
            };
        } catch (error) {
            this.logger.error('Extraction test failed', error);
            return {
                success: false,
                error: `Test extraction failed: ${error.message}`
            };
        }
    }
}

console.log("ExtractorAgent Class loaded.");
