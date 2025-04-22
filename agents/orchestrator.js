// agents/orchestrator.js
import { Logger } from '../utils/logger.js';
import { PlannerAgent } from './planner-agent.js';
import { SelectorAgent } from './selector-agent.js';
import { ExtractorAgent } from './extractor-agent.js';
import { ValidatorAgent } from './validator-agent.js';

export class AgentOrchestrator {
    /**
     * @param {LLMBridge} llmBridge - An instance of the LLM Bridge.
     * @param {Logger} [logger] - Optional logger instance.
     * @param {function} sendMessageToContentScript - Function to send messages to content script.
     * @param {function} sendMessageToOffscreen - Function to send messages to offscreen document.
     */
    constructor(llmBridge, logger = new Logger('AgentOrchestrator'), sendMessageToContentScript, sendMessageToOffscreen) {
        this.logger = logger;
        if (!llmBridge) throw new Error("AgentOrchestrator requires LLMBridge.");
        if (typeof sendMessageToContentScript !== 'function') throw new Error("AgentOrchestrator requires sendMessageToContentScript function.");
        if (typeof sendMessageToOffscreen !== 'function') throw new Error("AgentOrchestrator requires sendMessageToOffscreen function.");

        this.llmBridge = llmBridge;
        this.sendMessageToContentScript = sendMessageToContentScript;
        this.sendMessageToOffscreen = sendMessageToOffscreen;

        // Instantiate agents, passing dependencies
        try {
            this.plannerAgent = new PlannerAgent(this.llmBridge, this.logger);
            this.selectorAgent = new SelectorAgent(this.llmBridge, this.logger);
            this.extractorAgent = new ExtractorAgent(this.logger, this.sendMessageToContentScript);
            this.validatorAgent = new ValidatorAgent(this.llmBridge, this.logger); // Pass LLM bridge if needed for advanced validation
            this.errorRecoveryAgent = new ErrorRecoveryAgent(this.llmBridge, this.logger, this.sendMessageToContentScript);
            // Add other agents like NavigationAgent if/when implemented
        } catch (error) {
             this.logger.error(`AgentOrchestrator: Failed to initialize agents. ${error.message}`, error);
             // This is critical, maybe throw or set a 'disabled' state
             throw new Error(`Failed to initialize agents: ${error.message}`);
        }

        this.logger.log("Agent Orchestrator Initialized.");
    }

    /**
     * Processes a user's natural language extraction request.
     * @param {string} naturalLanguageInstruction - The user's request.
     * @param {string} targetUrl - The URL of the target page.
     * @param {string} [llmProvider] - Optional preferred LLM provider.
     * @param {number} tabId - The ID of the target tab.
     * @returns {Promise<object>} - A promise resolving with the final results { plan, selectors, data, issues }.
     */
    async processRequest(naturalLanguageInstruction, targetUrl, llmProvider, tabId) {
        this.logger.log(`Orchestrator: Starting request for "${naturalLanguageInstruction}" on ${targetUrl} (Tab ${tabId})`);

        let plan = null;
        let htmlSample = null;
        let rawData = {};
        let validatedData = {};
        let validationIssues = [];
        let extractionErrors = [];
        let finalSelectors = {}; // Store the selectors actually used/validated

        try {
            // --- 1. Fetch HTML Sample ---
            this.logger.log("Orchestrator: Fetching HTML sample via offscreen document...");
            htmlSample = await this.fetchHtmlSample(targetUrl);
            this.logger.log(`Orchestrator: Fetched HTML sample (${htmlSample?.length || 0} chars).`);

            // --- 2. Create Extraction Plan ---
            this.logger.log("Orchestrator: Calling Planner Agent...");
            plan = await this.plannerAgent.createPlan(naturalLanguageInstruction, targetUrl, htmlSample);
            if (!plan || !plan.dataPoints || plan.dataPoints.length === 0) {
                 throw new Error("Planning failed: No data points were identified.");
            }

            // --- 3. Generate Initial Selectors ---
            this.logger.log("Orchestrator: Calling Selector Agent...");
            plan = await this.selectorAgent.generateSelectors(plan, htmlSample);

            // --- 4. Initial Extraction Attempt ---
            this.logger.log("Orchestrator: Calling Extractor Agent (Attempt 1)...");
            const extractionResult = await this.extractorAgent.extractData(plan, tabId);
            rawData = extractionResult.rawData;
            extractionErrors = extractionResult.extractionErrors;

            // --- 5. Error Recovery / Refinement Loop (Optional but Recommended) ---
            if (extractionErrors.length > 0) {
                this.logger.warn(`Orchestrator: Initial extraction encountered ${extractionErrors.length} errors. Attempting recovery...`);

                const recoveryAttempts = []; // Keep track of attempts per DP

                for (const errorInfo of extractionErrors) {
                    const failedDp = plan.dataPoints.find(dp => dp.id === errorInfo.dpId);
                    if (!failedDp) continue;

                    // Limit recovery attempts per data point?
                    const attemptCount = (recoveryAttempts[failedDp.id] || 0) + 1;
                    if (attemptCount > 2) { // Limit to e.g., 2 recovery attempts
                         this.logger.warn(`Orchestrator: Max recovery attempts reached for DP ${failedDp.id}.`);
                         continue;
                    }
                    recoveryAttempts[failedDp.id] = attemptCount;


                    this.logger.log(`Orchestrator: Calling Error Recovery Agent for DP ${failedDp.id}...`);
                    const recoveryResult = await this.errorRecoveryAgent.attemptRecovery(
                        failedDp,
                        errorInfo.selector, // The selector that failed
                        errorInfo.error,    // The error message
                        htmlSample,         // Pass HTML sample again
                        tabId               // Pass tabId for testing
                    );

                    if (recoveryResult.recoverySuccessful && recoveryResult.alternativeSelectors.length > 0) {
                        this.logger.log(`Orchestrator: Recovery successful for DP ${failedDp.id}. Found alternatives:`, recoveryResult.alternativeSelectors);
                        // Update the plan with the working alternative(s)
                        // Replace or add to potentialSelectors? Replace for now.
                        failedDp.potentialSelectors = recoveryResult.alternativeSelectors;

                        // --- Re-extract ONLY the recovered data point ---
                        this.logger.log(`Orchestrator: Re-extracting recovered DP ${failedDp.id}...`);
                        try {
                            const reExtractResponse = await this.sendMessageToContentScript(tabId, {
                                action: 'extractData',
                                selector: failedDp.potentialSelectors[0], // Use the first working alternative
                                extractionType: this.extractorAgent.getExtractionDetails(failedDp).type, // Use helper if available
                                attributeName: this.extractorAgent.getExtractionDetails(failedDp).attribute
                            });

                            if (reExtractResponse?.success) {
                                const results = reExtractResponse.data || [];
                                if (failedDp.isList) {
                                    rawData[failedDp.id] = results;
                                } else {
                                    rawData[failedDp.id] = results.length > 0 ? results[0] : null;
                                }
                                this.logger.log(`Orchestrator: Successfully re-extracted data for DP ${failedDp.id}.`);
                                // Remove the error for this DP from the list
                                extractionErrors = extractionErrors.filter(e => e.dpId !== failedDp.id);
                            } else {
                                 this.logger.warn(`Orchestrator: Re-extraction failed for DP ${failedDp.id} even after recovery. Error: ${reExtractResponse?.error}`);
                                 // Keep the original error or update it? Keep original for now.
                            }
                        } catch (reExtractError) {
                             this.logger.error(`Orchestrator: Error during re-extraction for DP ${failedDp.id}. ${reExtractError.message}`);
                             // Keep the original error.
                        }
                    } else {
                         this.logger.warn(`Orchestrator: Recovery failed for DP ${failedDp.id}.`);
                    }
                }
            } // End of error recovery block

            // --- 6. Validate Extracted Data ---
            this.logger.log("Orchestrator: Calling Validator Agent...");
            const validationResult = await this.validatorAgent.validateData(rawData, plan);
            validatedData = validationResult.validatedData;
            validationIssues = validationResult.validationIssues;

            // Combine extraction errors with validation issues for final report
            const allIssues = [...extractionErrors, ...validationIssues];

            // Store final selectors used (first one from potentialSelectors after recovery)
            plan.dataPoints.forEach(dp => {
                 finalSelectors[dp.id] = dp.potentialSelectors?.[0] || null;
            });


            this.logger.log("Orchestrator: Request processing finished.", { plan, finalSelectors, validatedData, allIssues });

            return {
                success: true,
                plan: plan, // The final state of the plan
                selectors: finalSelectors, // Map of DP ID to the selector used
                data: validatedData, // The cleaned and validated data
                issues: allIssues // Combined list of extraction errors and validation issues
            };

        } catch (error) {
            this.logger.error(`Orchestrator: Request processing failed critically. ${error.message}`, error);
            return {
                success: false,
                error: `Orchestration failed: ${error.message}`,
                plan: plan, // Return partial plan if available
                selectors: finalSelectors,
                data: validatedData, // Return partial data if available
                issues: [...extractionErrors, ...validationIssues, { type: 'orchestration', error: error.message }] // Add orchestration error
            };
        }
    }

    /**
     * Fetches HTML content using the offscreen document.
     * @param {string} url - The URL to fetch.
     * @returns {Promise<string>} - HTML content as a string.
     * @throws {Error} If fetching fails.
     */
    async fetchHtmlSample(url) {
        try {
            const response = await this.sendMessageToOffscreen({
                action: 'fetchAndParse', // Action handled by offscreen.js
                url: url
            });

            if (response?.success && typeof response.htmlContent === 'string') {
                return response.htmlContent;
            } else {
                throw new Error(response?.error || 'Offscreen document failed to fetch or return HTML content.');
            }
        } catch (error) {
            this.logger.error(`Orchestrator: Error fetching HTML via offscreen. ${error.message}`, error);
            throw new Error(`Failed to fetch page content for planning/extraction: ${error.message}`);
        }
    }
}

// Make available in the background script context
// self.AgentOrchestrator = AgentOrchestrator;
console.log("Agent Orchestrator Class loaded.");
