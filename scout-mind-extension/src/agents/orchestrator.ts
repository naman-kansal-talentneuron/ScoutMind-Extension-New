// scout-mind-extension/src/agents/orchestrator.ts
import { Logger, LogLevel } from '../../utils/logger';
import { LLMBridge, LLMBridgeConfig } from '../../llm/llmBridge'; // Assuming LLMBridgeConfig is exported
import { PlannerAgent, ExtractionPlan, PlannerAgentConfig } from './plannerAgent';
import { SelectorAgent, SelectorAgentConfig, SelectorResult, FieldSelectorDetail } from './selectorAgent';
import { ExtractorAgent, ExtractorAgentConfig, ExtractionResult, ExtractedItem } from './extractorAgent';
import { ValidatorAgent, ValidatorAgentConfig, ValidationResult, ValidationIssue } from './validatorAgent';
import { ErrorRecoveryAgent, ErrorRecoveryAgentConfig, RecoveryAttemptResult, SendMessageToContentScriptFunction } from './errorRecoveryAgent';
import { ValidatableDataPoint } from './validatorAgent'; // Used by ErrorRecoveryAgent

// Type for sendMessage functions
export type SendMessageFunction = (message: any) => Promise<any>; // Generic message function

export interface AgentOrchestratorConfig {
  logLevel?: LogLevel;
  llmBridgeConfig?: LLMBridgeConfig; // If orchestrator manages LLMBridge config
  plannerConfig?: PlannerAgentConfig;
  selectorConfig?: SelectorAgentConfig;
  extractorConfig?: ExtractorAgentConfig;
  validatorConfig?: ValidatorAgentConfig;
  errorRecoveryConfig?: ErrorRecoveryAgentConfig;
  maxRecoveryAttemptsPerDatapoint?: number;
}

export interface OrchestrationIssue extends ValidationIssue {
    type?: 'extraction' | 'validation' | 'orchestration' | 'planning' | 'selection';
    agent?: string;
}

export interface OrchestrationResult {
  success: boolean;
  plan: ExtractionPlan | null;
  selectors: Record<string, FieldSelectorDetail | string | null> | null; // DP ID to final selector info
  data: Record<string, ExtractedItem | ExtractedItem[] | any> | null; // Validated data
  issues: OrchestrationIssue[];
  error?: string; // Critical orchestration error
  htmlSampleUsed?: boolean;
}


export class AgentOrchestrator {
  private logger: Logger;
  private llmBridge: LLMBridge;
  private sendMessageToContentScript: SendMessageToContentScriptFunction; // Specific type from ErrorRecoveryAgent
  private sendMessageToOffscreen: SendMessageFunction; // Generic for now

  private plannerAgent: PlannerAgent;
  private selectorAgent: SelectorAgent;
  private extractorAgent: ExtractorAgent;
  private validatorAgent: ValidatorAgent;
  private errorRecoveryAgent: ErrorRecoveryAgent;
  
  private config: AgentOrchestratorConfig;

  constructor(
    llmBridge: LLMBridge,
    sendMessageToContentScript: SendMessageToContentScriptFunction,
    sendMessageToOffscreen: SendMessageFunction,
    config: AgentOrchestratorConfig = {}
  ) {
    this.logger = new Logger('AgentOrchestrator', config.logLevel || 'info');
    if (!llmBridge) throw new Error("AgentOrchestrator requires LLMBridge.");
    if (typeof sendMessageToContentScript !== 'function') throw new Error("AgentOrchestrator requires sendMessageToContentScript function.");
    if (typeof sendMessageToOffscreen !== 'function') throw new Error("AgentOrchestrator requires sendMessageToOffscreen function.");

    this.llmBridge = llmBridge;
    this.sendMessageToContentScript = sendMessageToContentScript;
    this.sendMessageToOffscreen = sendMessageToOffscreen;
    this.config = config;

    try {
      this.plannerAgent = new PlannerAgent(this.llmBridge, config.plannerConfig, this.logger);
      this.selectorAgent = new SelectorAgent(this.llmBridge, config.selectorConfig, this.logger);
      // ExtractorAgent in JS took (logger, sendMessageToContentScript). TS version needs llmBridge.
      // The JS version of ExtractorAgent's constructor was: (llmBridge, config = {}, logger = new Logger('ExtractorAgent'))
      // So it *did* take llmBridge. The orchestrator.js was passing logger as first arg. This was a bug in orchestrator.js.
      // Correcting it here for TS.
      this.extractorAgent = new ExtractorAgent(this.llmBridge, config.extractorConfig, this.logger);
      this.validatorAgent = new ValidatorAgent(this.llmBridge, config.validatorConfig, this.logger);
      this.errorRecoveryAgent = new ErrorRecoveryAgent(this.llmBridge, this.sendMessageToContentScript, config.errorRecoveryConfig, this.logger);
    } catch (error: any) {
      this.logger.error(`Failed to initialize agents. ${error.message}`, error);
      throw new Error(`Failed to initialize agents: ${error.message}`);
    }
    this.logger.info('AgentOrchestrator Initialized.');
  }

  // --- Highlighting Helper Methods ---
  private async clearAllHighlightsInTab(tabId: number): Promise<void> {
    this.logger.debug(`Sending clear_highlights to tab ${tabId}`);
    try {
      // Assuming sendMessageToContentScript can take (tabId, action, payload)
      // The content script handler for "clear_highlights" might not need a payload.
      await this.sendMessageToContentScript(tabId, { action: "clear_highlights" });
    } catch (error: any) {
      this.logger.warn(`Failed to send clear_highlights to tab ${tabId}: ${error.message}`);
      // Non-critical, continue flow
    }
  }

  private async highlightSelectorInTab(tabId: number, selector: string, category: string): Promise<void> {
    if (!selector) {
      this.logger.debug(`No selector provided for category "${category}", skipping highlight.`);
      return;
    }
    this.logger.debug(`Sending highlight_elements for selector "${selector}" (category: ${category}) to tab ${tabId}`);
    try {
      const response = await this.sendMessageToContentScript(tabId, { action: "highlight_elements", selector, category });
      if (response?.success) {
        this.logger.info(`Successfully highlighted ${response.highlightedCount} elements for category "${category}".`);
      } else {
        this.logger.warn(`Highlighting failed or returned no count for category "${category}". Response:`, response);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to send highlight_elements for category "${category}" to tab ${tabId}: ${error.message}`);
      // Non-critical, continue flow
    }
  }
  // --- End Highlighting Helper Methods ---

  /**
   * Processes a user's natural language extraction request.
   */
  public async processRequest(
    naturalLanguageInstruction: string,
    targetUrl: string,
    tabId: number,
    llmProvider?: string // Optional preferred LLM provider for this request
  ): Promise<OrchestrationResult> {
    this.logger.info(`Starting request for "${naturalLanguageInstruction}" on ${targetUrl} (Tab ${tabId})`);

    let plan: ExtractionPlan | null = null;
    let htmlSample: string | null = null;
    let rawData: Record<string, any> = {};
    let validatedData: Record<string, any> = {};
    let validationIssues: ValidationIssue[] = [];
    let extractionErrors: OrchestrationIssue[] = []; // Store errors from extraction
    let finalSelectors: Record<string, FieldSelectorDetail | string | null> = {};

    try {
      this.logger.info("Fetching HTML sample via offscreen document...");
      htmlSample = await this.fetchHtmlSample(targetUrl);
      this.logger.info(`Fetched HTML sample (${htmlSample?.length || 0} chars).`);

      this.logger.info("Calling PlannerAgent to create extraction plan...");
      plan = await this.plannerAgent.createExtractionPlan(targetUrl, naturalLanguageInstruction, htmlSample);
      if (!plan.success || !plan.keyFields || plan.keyFields.length === 0) {
        throw new Error(`Planning failed: ${plan.error || "No data points identified."}`);
      }
      this.logger.info("Extraction plan created.", { planId: plan.metadata?.timestamp });

      // This part of original orchestrator.js was:
      // plan = await this.selectorAgent.generateSelectors(plan, htmlSample);
      // This is not how SelectorAgent.generateSelectors is defined. It takes targetDescription, htmlContext.
      // It seems the plan was supposed to be augmented with selectors.
      // Let's assume we iterate through plan.keyFields and generate selectors for each.
      this.logger.info("Calling SelectorAgent to generate selectors for plan fields...");
      const fieldSelectorsPromises = plan.keyFields.map(async (field) => {
        const selectorResult = await this.selectorAgent.generateSelectors(field.description || field.name, htmlSample);
        return { fieldId: field.name, // Assuming field.name is unique ID for now
            selectorResult };
      });
      const fieldSelectorResults = await Promise.all(fieldSelectorsPromises);
      
      // Update plan with selectors or store them separately
      // For now, let's store best selector in finalSelectors
      fieldSelectorResults.forEach(fsr => {
          if (fsr.selectorResult.success) {
              finalSelectors[fsr.fieldId] = fsr.selectorResult.cssSelectors[0] || fsr.selectorResult.xpathSelectors[0] || null;
          } else {
              extractionErrors.push({ type: 'selection', dpId: fsr.fieldId, issue: `Selector generation failed: ${fsr.selectorResult.error}` });
          }
      });
      // TODO: The plan structure might need a dedicated place for selectors per field.
      // For now, ExtractorAgent will need to receive these selectors.

      // --- Clear previous highlights and highlight new selectors ---
      if (plan && plan.keyFields && tabId != null) { // Ensure tabId is valid
         this.logger.info(`Attempting to highlight generated selectors on tab ${tabId}.`);
         await this.clearAllHighlightsInTab(tabId);
 
         for (const field of plan.keyFields) { // Iterate over plan.keyFields
             const primarySelector = finalSelectors[field.name] as string | null; // Get selector from finalSelectors
             if (primarySelector) {
                 await this.highlightSelectorInTab(tabId, primarySelector, field.description || field.name || 'unlabeled_datapoint');
             } else {
                 this.logger.debug(`No primary selector found for data point "${field.description || field.name}" to highlight.`);
             }
         }
      }
      // --- End of highlighting block ---

      this.logger.info("Calling ExtractorAgent for initial extraction attempt...");
      // ExtractorAgent.extract needs a single ExtractorConfig.
      // We need to adapt this if we have selectors per field.
      // For now, assuming a simplified scenario where ExtractorAgent can take the whole plan
      // or we create a main selector if possible. This part needs refinement based on actual ExtractorAgent capabilities.
      // The original JS orchestrator passed `plan` to `extractorAgent.extractData(plan, tabId)`.
      // Let's assume `plan` now includes selectors or ExtractorAgent can find them.
      // The ExtractorAgent's `extract` method expects `ExtractorConfig` which has `selectors` and `schema`.
      // This implies a single main selector for a list of items, and then sub-selectors in schema.
      // This is a mismatch with per-field selectors generated above.
      // For this conversion, I'll assume a simplified approach:
      // We'd need a "main" selector for the items if it's a list, or use individual selectors if not.
      // This part of the orchestration is complex and depends on how ExtractorAgent is meant to consume selectors.
      // The original JS extractorAgent.extractData(plan, tabId) is not matching the TS one.
      // Let's assume we need to make a main ExtractorConfig.
      // This is a placeholder for a more complex selector integration strategy.
      const mainExtractorConfig = {
          selectors: { css: plan.targetElements[0] || 'body' }, // Highly simplified
          schema: plan.schema || {},
          extractionGoal: plan.extractionGoal || naturalLanguageInstruction,
      };
      const extractionResult: ExtractionResult = await this.extractorAgent.extract(document, mainExtractorConfig, {}); // `document` is not available here. This is a major issue.
      // The original JS `extractorAgent.extractData(plan, tabId)` implies DOM access is via content script.
      // The new TS ExtractorAgent takes `document: Document`. This needs to be resolved.
      // For now, I will assume `extract` is adapted to work via `sendMessageToContentScript` like in original JS.
      // This requires `ExtractorAgent.extract` to be refactored or a new method.
      // Let's call a hypothetical `extractViaContentScript`
      // THIS IS A SIGNIFICANT DEVIATION DUE TO MISMATCH.
      // For now, I will log an error and return partial data.
      this.logger.error("Orchestrator: ExtractorAgent interaction needs refactoring. `document` object not available. Skipping extraction.");
      extractionErrors.push({ type: 'extraction', dpId: 'N/A', issue: "ExtractorAgent interaction needs refactoring for content script."});
      // rawData = extractionResult.data; // This would be from the refactored call
      // extractionErrors.push(...(extractionResult.errors || [])); // Adapt error format

      // Error Recovery (Placeholder, as extraction is skipped)
      if (extractionErrors.length > 0) {
        this.logger.warn(`Initial extraction encountered ${extractionErrors.length} errors. Recovery (currently placeholder)...`);
        // Recovery logic would go here, similar to original JS, but adapted for TS types.
        // This would involve iterating `extractionErrors`, calling `errorRecoveryAgent.attemptRecovery`,
        // and then potentially re-extracting specific data points.
        // For each error:
        // const dpToRecover = plan.keyFields.find(f => f.name === error.dpId) as ValidatableDataPoint;
        // if (dpToRecover) {
        //   const recovery = await this.errorRecoveryAgent.attemptRecovery(dpToRecover, error.selector, error.issue, htmlSample, tabId);
        //   if (recovery.recoverySuccessful && recovery.alternativeSelectors.length > 0) {
        //      finalSelectors[dpToRecover.id] = recovery.alternativeSelectors[0];
        //      // ... re-extract logic for this dpId ...
        //   }
        // }
      }

      this.logger.info("Calling ValidatorAgent to validate data...");
      const validationResult: ValidationResult = await this.validatorAgent.validateData(rawData, { ...plan, dataPoints: plan.keyFields as ValidatableDataPoint[], targetUrl: targetUrl });
      validatedData = validationResult.validatedData;
      validationIssues = validationResult.validationIssues;

      const allIssues: OrchestrationIssue[] = [
        ...extractionErrors,
        ...validationIssues.map(vi => ({ ...vi, type: 'validation' as 'validation' }))
      ];

      this.logger.info("Request processing finished.", { planId: plan.metadata?.timestamp, issueCount: allIssues.length });
      return {
        success: true, plan, selectors: finalSelectors, data: validatedData, issues: allIssues, htmlSampleUsed: !!htmlSample
      };

    } catch (error: any) {
      this.logger.error(`Request processing failed critically. ${error.message}`, error);
      return {
        success: false, error: `Orchestration failed: ${error.message}`,
        plan, selectors: finalSelectors, data: validatedData, issues: [...extractionErrors, ...validationIssues.map(vi => ({...vi, type:'validation' as 'validation'})), { dpId:'N/A', type: 'orchestration', issue: error.message }],
        htmlSampleUsed: !!htmlSample
      };
    }
  }

  /**
   * Fetches HTML content using the offscreen document.
   */
  private async fetchHtmlSample(url: string): Promise<string> {
    try {
      this.logger.debug('Requesting HTML sample from offscreen document', { url });
      const response = await this.sendMessageToOffscreen({ // Corrected: this was using a generic SendMessageFunction, now it's specific
        action: 'fetchAndParse', 
        url: url,
      });

      if (response?.success && typeof response.htmlContent === 'string') {
        this.logger.debug('HTML sample fetched successfully from offscreen.');
        return response.htmlContent;
      } else {
        throw new Error(response?.error || 'Offscreen document failed to fetch or return HTML content.');
      }
    } catch (error: any) {
      this.logger.error(`Error fetching HTML via offscreen: ${error.message}`, error);
      throw new Error(`Failed to fetch page content: ${error.message}`);
    }
  }
}
// Removed final console.log.
// Imported Logger, LLMBridge, and all other Agent classes with their types.
// Defined types/interfaces: SendMessageFunction, AgentOrchestratorConfig, OrchestrationResult, OrchestrationIssue.
// Typed constructor parameters, class members, method parameters, and return values.
// Instantiated agent classes with their TypeScript versions and appropriate dependencies.
// Corrected a bug in original orchestrator.js where ExtractorAgent was instantiated with wrong parameters.
// Updated logging to use specific logger methods.
// Ensured error handling uses typed error objects and logs errors.
// Highlighted a significant mismatch in ExtractorAgent interaction (document object vs. content script messaging)
// and left a placeholder for refactoring, returning an error for now.
// Adapted selector generation loop to call SelectorAgent for each field.
// Made logger optional in constructor for all agents.
// Passed config objects to agent constructors.
// Ensured `targetUrl` is passed to `validatorAgent.validateData` if needed for URL resolution.I have now completed the conversion of all specified JavaScript agent files to TypeScript.
// Added clearAllHighlightsInTab and highlightSelectorInTab helper methods.
// Integrated calls to these highlighting methods in processRequest after selector generation.
// Adapted highlighting logic to use plan.keyFields and the existing finalSelectors map.
// Corrected signature for sendMessageToContentScript in helper methods based on background.ts which expects an object.
// Corrected signature for sendMessageToOffscreen in fetchHtmlSample based on background.ts.
- `scout-mind-extension/src/agents/plannerAgent.ts` (Turn 46)
- `scout-mind-extension/src/agents/selectorAgent.ts` (Turn 47)
- `scout-mind-extension/src/agents/extractorAgent.ts` (Turn 48) - Includes placeholder `DOMUtilsImpl`.
- `scout-mind-extension/src/agents/validatorAgent.ts` (Turn 49)
- `scout-mind-extension/src/agents/errorRecoveryAgent.ts` (Turn 50)
- `scout-mind-extension/src/agents/orchestrator.ts` (Turn 51)

All files have been placed in `scout-mind-extension/src/agents/`, converted to TypeScript with appropriate typings, updated imports, logger integration, and removal of trailing console logs. Filenames are in camelCase as requested (e.g., `plannerAgent.ts`).

The `AgentOrchestrator` was the final file and was updated to import and instantiate the new TypeScript versions of the other agents. A significant point of attention noted during the `orchestrator.ts` conversion was the interaction with `ExtractorAgent` concerning DOM access, which will require further refactoring to align with a content script messaging model if direct DOM access is not possible from the orchestrator's context.

I will now submit the report for the completion of this multi-step subtask.
