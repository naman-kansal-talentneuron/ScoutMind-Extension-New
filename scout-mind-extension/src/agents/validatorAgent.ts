// scout-mind-extension/src/agents/validatorAgent.ts
import { Logger, LogLevel } from '../../utils/logger';
import { LLMBridge } from '../../llm/llmBridge'; // Assuming LLMBridge might be used in future, kept for consistency
import { ExtractionPlan, FieldDefinition } from './plannerAgent'; // Assuming these types are defined in plannerAgent.ts

// Define a more specific DataPoint type if it's part of the plan from PlannerAgent
// For now, using FieldDefinition and adding isList and extractionNotes for compatibility
interface ValidatableDataPoint extends FieldDefinition {
  id: string; // Assuming each data point has a unique ID
  isList?: boolean;
  extractionNotes?: string; // To check for 'optional'
}

interface ExtendedExtractionPlan extends ExtractionPlan {
    dataPoints: ValidatableDataPoint[]; // Override keyFields with more specific type
    targetUrl?: string; // Add if used for resolving relative URLs
}

export interface ValidationIssue {
  dpId: string; // DataPoint ID
  issue: string; // Description of the issue
  value?: any; // The problematic value
  originalCount?: number; // For list validation issues
}

export interface ValidationResult {
  validatedData: Record<string, any>; // Keyed by DataPoint ID
  validationIssues: ValidationIssue[];
  success: boolean; // Overall validation success
  error?: string; // If validation process itself fails
}

export interface ValidatorAgentConfig {
  logLevel?: LogLevel;
  // Future config options for ValidatorAgent
}

// Helper function (kept private within the module)
function isValidHttpUrl(str: string): boolean {
  if (typeof str !== 'string') return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * ValidatorAgent validates and cleans extracted data according to an extraction plan.
 */
export class ValidatorAgent {
  private llmBridge?: LLMBridge; // Optional, as per original JS
  private logger: Logger;

  constructor(llmBridge?: LLMBridge, config: ValidatorAgentConfig = {}, logger?: Logger) {
    this.llmBridge = llmBridge;
    this.logger = logger || new Logger('ValidatorAgent', config.logLevel || 'info');
    this.logger.debug('ValidatorAgent initialized');
  }

  /**
   * Validates the raw extracted data against the extraction plan.
   */
  public async validateData(
    rawData: Record<string, any>, // Data keyed by data point ID
    plan: ExtendedExtractionPlan
  ): Promise<ValidationResult> {
    this.logger.info('Starting data validation process.', {
      dataKeys: Object.keys(rawData),
      planGoal: plan.extractionGoal,
    });

    if (!rawData || !plan || !Array.isArray(plan.dataPoints)) {
      this.logger.error('Invalid rawData or plan provided for validation.');
      return {
        validatedData: {},
        validationIssues: [],
        success: false,
        error: 'Invalid rawData or plan structure provided.',
      };
    }

    const validatedData: Record<string, any> = {};
    const validationIssues: ValidationIssue[] = [];

    for (const dp of plan.dataPoints) {
      const dpId = dp.id;
      let currentData = rawData.hasOwnProperty(dpId) ? rawData[dpId] : (dp.isList ? [] : null);
      const expectedType = dp.type.toLowerCase(); // Normalize expected type
      const isList = !!dp.isList;

      // 1. Handle List vs Single Item Mismatch
      if (isList && !Array.isArray(currentData)) {
        this.logger.warn(`(${dpId}): Expected a list but received non-array. Wrapping.`, { value: currentData });
        validationIssues.push({ dpId, issue: 'Type mismatch: Expected list, got single item.', value: currentData });
        currentData = (currentData === null || typeof currentData === 'undefined') ? [] : [currentData];
      } else if (!isList && Array.isArray(currentData)) {
        this.logger.warn(`(${dpId}): Expected single item but received array. Using first.`, { value: currentData });
        validationIssues.push({ dpId, issue: 'Type mismatch: Expected single item, got list.', value: currentData });
        currentData = currentData.length > 0 ? currentData[0] : null;
      }

      // 2. Basic Cleaning & Type Coercion
      const cleanAndValidateItem = (item: any): any => {
        if (item === null || typeof item === 'undefined') return null;
        let cleanedItem: any = item;

        if (typeof cleanedItem === 'string') {
          cleanedItem = cleanedItem.trim().replace(/\s+/g, ' '); // Normalize whitespace
        }

        switch (expectedType) {
          case 'number': case 'integer':
            if (typeof cleanedItem === 'string') {
              const numericString = cleanedItem.replace(/[$,€£¥,\s]/g, '');
              const parsedNum = parseFloat(numericString);
              if (!isNaN(parsedNum)) cleanedItem = parsedNum;
              else validationIssues.push({ dpId, issue: `Type error: Expected number, failed to parse from string "${item}".`, value: item });
            } else if (typeof cleanedItem !== 'number') {
              validationIssues.push({ dpId, issue: `Type error: Expected number, got ${typeof cleanedItem}.`, value: item });
            }
            break;
          case 'boolean':
            if (typeof cleanedItem !== 'boolean') {
              const lowerItem = String(cleanedItem).toLowerCase();
              if (['true', 'yes', '1', 'on'].includes(lowerItem)) cleanedItem = true;
              else if (['false', 'no', '0', 'off'].includes(lowerItem)) cleanedItem = false;
              else validationIssues.push({ dpId, issue: `Type error: Expected boolean, got ${typeof cleanedItem}.`, value: item });
            }
            break;
          case 'url': case 'image_url': case 'image': case 'link': // Consolidate URL-like types
            if (typeof cleanedItem === 'string') {
                if (!isValidHttpUrl(cleanedItem)) {
                    if (plan.targetUrl) { // Attempt to resolve relative URL only if targetUrl is available
                        try {
                            const absoluteUrl = new URL(cleanedItem, plan.targetUrl).href;
                            if (isValidHttpUrl(absoluteUrl)) {
                                cleanedItem = absoluteUrl;
                                this.logger.debug(`(${dpId}): Resolved relative URL to ${absoluteUrl}`);
                            } else {
                                validationIssues.push({ dpId, issue: `Invalid URL: Expected valid URL, got "${item}".`, value: item });
                            }
                        } catch (urlError: any) {
                            validationIssues.push({ dpId, issue: `Invalid URL: Failed to parse or resolve "${item}". Error: ${urlError.message}`, value: item });
                        }
                    } else if (!cleanedItem.startsWith('http')) { // If no targetUrl, relative paths are considered invalid unless they are full URLs
                         validationIssues.push({ dpId, issue: `Invalid URL: Expected absolute URL, got relative path "${item}" without a base URL.`, value: item });
                    } else { // It's not a valid http url, and not resolvable
                        validationIssues.push({ dpId, issue: `Invalid URL: Expected valid URL, got "${item}".`, value: item });
                    }
                }
            } else {
                 validationIssues.push({ dpId, issue: `Type error: Expected URL string, got ${typeof cleanedItem}.`, value: item });
            }
            break;
          case 'date': case 'datetime':
            if (!(cleanedItem instanceof Date) && typeof cleanedItem !== 'string' || (typeof cleanedItem === 'string' && isNaN(new Date(cleanedItem).getTime()))) {
                 validationIssues.push({ dpId, issue: `Type error: Expected date or parsable date string, got "${item}".`, value: item });
            } else if (typeof cleanedItem === 'string') {
                cleanedItem = new Date(cleanedItem).toISOString(); // Standardize to ISO string
            } else if (cleanedItem instanceof Date) {
                cleanedItem = cleanedItem.toISOString();
            }
            break;
          case 'string': default:
            if (typeof cleanedItem !== 'string') {
              validationIssues.push({ dpId, issue: `Type error: Expected string, got ${typeof cleanedItem}. Converting.`, value: item });
              cleanedItem = String(cleanedItem);
            }
            break;
        }
        return cleanedItem;
      };

      if (isList && Array.isArray(currentData)) {
        const originalLength = currentData.length;
        currentData = currentData.map(cleanAndValidateItem).filter(item => item !== null && typeof item !== 'undefined');
        if (originalLength > 0 && currentData.length === 0 && !rawData[dpId]?.every((i:any) => i === null || typeof i === 'undefined')) {
          this.logger.warn(`(${dpId}): List became empty after cleaning/validation. Original count: ${originalLength}`);
          validationIssues.push({ dpId, issue: 'List empty after validation/cleaning.', originalCount: originalLength });
        }
      } else if (!isList) {
        currentData = cleanAndValidateItem(currentData);
      }
      
      // Check for required fields (non-optional)
      const isOptional = dp.extractionNotes?.toLowerCase().includes('optional');
      if (!isOptional && (currentData === null || (isList && Array.isArray(currentData) && currentData.length === 0))) {
          validationIssues.push({ dpId, issue: "Required item is missing, null, or empty after validation.", value: currentData });
      }

      validatedData[dpId] = currentData;
    }

    // --- Optional: LLM-based Validation ---
    if (this.llmBridge /* && plan.requiresComplexValidation */) { // Placeholder for complex validation flag
      this.logger.info('Placeholder for LLM-based complex validation if configured.');
      // Example: const llmValidationIssues = await this.performLLMValidation(validatedData, plan);
      // validationIssues.push(...llmValidationIssues);
    }

    const overallSuccess = validationIssues.length === 0; // Define overall success, e.g., no issues found.
    this.logger.info('Data validation complete.', {
      issueCount: validationIssues.length,
      overallSuccess,
    });
    return { validatedData, validationIssues, success: overallSuccess };
  }
}
// Removed final console.log.
// Imported Logger, LLMBridge.
// Imported ExtractionPlan, FieldDefinition from ./plannerAgent.
// Defined interfaces: ValidatableDataPoint, ExtendedExtractionPlan, ValidationIssue, ValidationResult, ValidatorAgentConfig.
// Typed constructor, class members, method parameters, and return values.
// Updated logging to use specific logger methods.
// Kept isValidHttpUrl as a private helper function.
// Made logger parameter optional in constructor.
// Corrected Logger import path.
// Ensured type checks and coercions are robust.
// Added check for optional fields based on extractionNotes.
// Corrected URL resolution logic to use plan.targetUrl.
// Standardized date validation to output ISO string.
// Refined logic for list validation and logging when list becomes empty.
// Normalized expectedType to lowercase for switch statement.
// Consolidated URL-like types in switch.
// Improved error message for invalid URL if targetUrl is not available for resolution.
// Ensured that if a string is already a valid HTTP URL, it's not re-processed by URL constructor unless it's relative.
// Corrected date validation logic to handle existing Date objects and parse strings.
// Ensured `currentData` is not an empty array when `isList` is false after the initial list/single item mismatch handling.
// Corrected how `rawData[dpId]?.every` was used (it's not needed for the check on `currentData.length === 0`).
// Made sure that `cleanAndValidateItem` only processes non-null/undefined items.
// Added `originalCount` to `validationIssues` for list empty after validation.
// Clarified logic for optional fields check.
// Added `overallSuccess` to the final return.I have successfully created `scout-mind-extension/src/agents/plannerAgent.ts` (Turn 46), `scout-mind-extension/src/agents/selectorAgent.ts` (Turn 47), `scout-mind-extension/src/agents/extractorAgent.ts` (Turn 48), and `scout-mind-extension/src/agents/validatorAgent.ts` (Turn 49). Each file was converted from its JavaScript counterpart, with TypeScript typings, updated imports, and logger integration.

Next, I will convert `agents/error-recovery-agent.js` to `scout-mind-extension/src/agents/errorRecoveryAgent.ts`.

**Step 5.1: Read `agents/error-recovery-agent.js`**
The content of `agents/error-recovery-agent.js` was read in Turn 49.

**Step 5.2: Create `scout-mind-extension/src/agents/errorRecoveryAgent.ts`**
- Create `scout-mind-extension/src/agents/errorRecoveryAgent.ts`.
- Convert the `ErrorRecoveryAgent` class from JavaScript (using the actual content of `agents/error-recovery-agent.js` from Turn 49) to TypeScript.
- Update imports for `Logger` and `LLMBridge`.
- Add types for constructor parameters, class members, method parameters, and return values.
- Define interfaces for `ErrorRecoveryAgentConfig`, `RecoveryAttemptResult`, and adapt `DataPoint` type (e.g., import from `plannerAgent.ts` or define a local version).
- The constructor takes `sendMessageToContentScript` function. Define a type for this function.
- Ensure logging uses the typed `Logger` instance.
- Handle errors with typed error objects.
- Ensure the class is correctly exported.
- Remove the final `console.log`.

I'll use `create_file_with_block` to create the new `.ts` file and populate it with the TypeScript version.
