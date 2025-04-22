// agents/error-recovery-agent.js

class ErrorRecoveryAgent {
    /**
     * @param {LLMBridge} llmBridge - An instance of the LLM Bridge.
     * @param {Logger} [logger] - Optional logger instance.
     * @param {function} sendMessageToContentScript - Function to send messages to content script for testing.
     */
    constructor(llmBridge, logger = console, sendMessageToContentScript) {
        if (!llmBridge) {
            throw new Error("ErrorRecoveryAgent requires an LLMBridge instance.");
        }
         if (typeof sendMessageToContentScript !== 'function') {
            throw new Error("ErrorRecoveryAgent requires a sendMessageToContentScript function.");
        }
        this.llmBridge = llmBridge;
        this.logger = logger;
        this.sendMessageToContentScript = sendMessageToContentScript;

        // Define different recovery strategies
        this.fallbackStrategies = [
            this.tryAlternativeSelectorsLLM,
            // this.trySelectorGeneralization, // Example: Remove :nth-child()
            // this.tryParentChildRelationship, // Example: Look for parent/sibling selectors
            // this.tryAttributeBasedSelection, // Example: Find elements with similar attributes
        ];
        this.logger.log("Error Recovery Agent Initialized.");
    }

    /**
     * Attempts to recover from an extraction error for a specific data point.
     * @param {object} dataPoint - The data point object from the plan that failed.
     * @param {string} failedSelector - The selector that failed.
     * @param {string} errorMessage - The error message from the extractor.
     * @param {string} htmlSample - A sample of the webpage's HTML.
     * @param {number} tabId - The ID of the target tab for testing selectors.
     * @returns {Promise<object>} - A promise resolving with { recoverySuccessful: boolean, alternativeSelectors: string[] }.
     */
    async attemptRecovery(dataPoint, failedSelector, errorMessage, htmlSample, tabId) {
        this.logger.warn(`Error Recovery Agent: Attempting recovery for DP ${dataPoint.id} (${dataPoint.description}). Selector "${failedSelector}" failed with: ${errorMessage}`);

        const recoveryResult = {
            recoverySuccessful: false,
            alternativeSelectors: [],
        };

        // Truncate HTML sample
        const maxHtmlLength = 10000; // Use a decent sample for recovery context
        const truncatedHtmlSample = htmlSample.length > maxHtmlLength
            ? htmlSample.substring(0, maxHtmlLength) + '...'
            : htmlSample;

        // Try each fallback strategy
        for (const strategy of this.fallbackStrategies) {
            try {
                const strategyName = strategy.name;
                this.logger.log(`Error Recovery Agent: Trying strategy "${strategyName}"...`);

                // Call the strategy function (bound to 'this' context)
                const alternatives = await strategy.call(this, dataPoint, failedSelector, errorMessage, truncatedHtmlSample);

                if (alternatives && alternatives.length > 0) {
                    this.logger.log(`Error Recovery Agent: Strategy "${strategyName}" proposed alternatives:`, alternatives);

                    // --- Test proposed selectors ---
                    for (const altSelector of alternatives) {
                        if (await this.testSelector(altSelector, tabId)) {
                             this.logger.log(`Error Recovery Agent: Alternative selector "${altSelector}" successfully found elements.`);
                             recoveryResult.recoverySuccessful = true;
                             // Add only valid alternatives found
                             if (!recoveryResult.alternativeSelectors.includes(altSelector)) {
                                 recoveryResult.alternativeSelectors.push(altSelector);
                             }
                             // Optionally stop after finding the first working alternative
                             // break;
                        } else {
                             this.logger.warn(`Error Recovery Agent: Alternative selector "${altSelector}" failed validation (found 0 elements).`);
                        }
                    }
                } else {
                     this.logger.log(`Error Recovery Agent: Strategy "${strategyName}" did not propose any alternatives.`);
                }

                // If recovery was successful with this strategy, maybe stop trying others?
                if (recoveryResult.recoverySuccessful) {
                     this.logger.log(`Error Recovery Agent: Recovery successful using strategy "${strategyName}".`);
                     break; // Stop trying further strategies
                }

            } catch (strategyError) {
                this.logger.error(`Error Recovery Agent: Strategy "${strategy.name}" failed. ${strategyError.message}`, strategyError);
                // Continue to the next strategy
            }
        }

        if (!recoveryResult.recoverySuccessful) {
            this.logger.warn(`Error Recovery Agent: All recovery strategies failed for DP ${dataPoint.id}.`);
        }

        return recoveryResult;
    }

    /**
     * Tests a selector using the content script.
     * @param {string} selector - The CSS selector to test.
     * @param {number} tabId - The target tab ID.
     * @returns {Promise<boolean>} - True if the selector finds one or more elements, false otherwise.
     */
    async testSelector(selector, tabId) {
        try {
            const response = await this.sendMessageToContentScript(tabId, {
                action: 'testSelector',
                selector: selector
            });
            // Check if response is valid and count > 0
            return response?.success === true && response?.count > 0;
        } catch (error) {
            this.logger.error(`Error Recovery Agent: Failed to test selector "${selector}" on tab ${tabId}. ${error.message}`);
            return false; // Assume selector is invalid if testing fails
        }
    }


    // --- Fallback Strategy Implementations ---

    /**
     * Strategy: Ask LLM for alternative selectors based on the failed one and context.
     * @param {object} dataPoint - The failing data point.
     * @param {string} failedSelector - The selector that failed.
     * @param {string} errorMessage - The original error message.
     * @param {string} htmlSample - HTML context.
     * @returns {Promise<string[]>} - A promise resolving with an array of alternative selector strings.
     */
    async tryAlternativeSelectorsLLM(dataPoint, failedSelector, errorMessage, htmlSample) {
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
            const llmOptions = {
                modelConfig: {
                    format: 'json',
                    temperature: 0.3, // Allow some creativity but keep it focused
                }
            };
            const response = await this.llmBridge.query(prompt, llmOptions);

            let alternatives;
             try {
                 const cleanedResponse = response.replace(/^```json\s*|```\s*$/g, '').trim();
                 alternatives = JSON.parse(cleanedResponse);
            } catch (parseError) {
                this.logger.error("Error Recovery Agent (LLM Strategy): Failed to parse LLM response as JSON.", { response, parseError });
                return []; // Return empty on parse failure
            }

            if (!Array.isArray(alternatives) || !alternatives.every(s => typeof s === 'string')) {
                 this.logger.warn("Error Recovery Agent (LLM Strategy): LLM response was not a valid JSON array of strings.", alternatives);
                 return [];
            }

            // Filter out empty strings
            return alternatives.filter(s => s.trim() !== '');

        } catch (llmError) {
            this.logger.error(`Error Recovery Agent (LLM Strategy): LLM query failed. ${llmError.message}`, llmError);
            return []; // Return empty array if LLM query fails
        }
    }

    // --- Add more strategies here ---
    // async trySelectorGeneralization(...) { ... }
    // async tryParentChildRelationship(...) { ... }
    // async tryAttributeBasedSelection(...) { ... }

}

// Make available in the background script context
// self.ErrorRecoveryAgent = ErrorRecoveryAgent;
console.log("Error Recovery Agent Class loaded.");
