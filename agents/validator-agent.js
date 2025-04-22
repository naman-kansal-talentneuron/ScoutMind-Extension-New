/**
 * ValidatorAgent validates and cleans extracted data according to an extraction plan.
 */
export class ValidatorAgent {
    /**
     * @param {LLMBridge} [llmBridge] - Optional LLM Bridge for complex validation.
     * @param {Logger} [logger] - Optional logger instance.
     */
    constructor(llmBridge, logger = console) {
        this.llmBridge = llmBridge;
        this.logger = logger;
        this.logger.log("Validator Agent Initialized.");
    }

    /**
     * Validates the raw extracted data against the extraction plan.
     * @param {object} rawData - Extracted data keyed by data point ID.
     * @param {object} plan - The extraction plan object.
     * @returns {Promise<object>} - { validatedData, validationIssues }
     */
    async validateData(rawData, plan) {
        this.logger.log("Validator Agent: Starting data validation.", { rawData, plan });

        if (!rawData || !plan || !Array.isArray(plan.dataPoints)) {
            throw new Error("ValidatorAgent.validateData: Invalid rawData or plan provided.");
        }

        const validatedData = {};
        const validationIssues = [];

        for (const dp of plan.dataPoints) {
            const dpId = dp.id;
            const data = rawData.hasOwnProperty(dpId) ? rawData[dpId] : (dp.isList ? [] : null);
            const expectedType = dp.type;
            const isList = dp.isList;

            let currentData = data;

            // --- Rule-based Validation & Cleaning ---
            // 1. Handle List vs Single Item Mismatch
            if (isList && !Array.isArray(currentData)) {
                this.logger.warn(`Validator Agent (${dpId}): Expected a list but received non-array. Wrapping in array.`, currentData);
                validationIssues.push({ dpId, issue: "Type mismatch: Expected list, got single item.", value: currentData });
                currentData = (currentData === null || typeof currentData === 'undefined') ? [] : [currentData];
            } else if (!isList && Array.isArray(currentData)) {
                this.logger.warn(`Validator Agent (${dpId}): Expected single item but received array. Using first item.`, currentData);
                validationIssues.push({ dpId, issue: "Type mismatch: Expected single item, got list.", value: currentData });
                currentData = currentData.length > 0 ? currentData[0] : null;
            }

            // 2. Basic Cleaning & Type Coercion
            const cleanAndValidateItem = (item) => {
                if (item === null || typeof item === 'undefined') return null;
                let cleanedItem = item;
                if (typeof cleanedItem === 'string') {
                    cleanedItem = cleanedItem.trim().replace(/\s+/g, ' ');
                }
                switch (expectedType) {
                    case 'number':
                        if (typeof cleanedItem === 'string') {
                            const numericString = cleanedItem.replace(/[$,€£¥,\s]/g, '');
                            const parsedNum = parseFloat(numericString);
                            if (!isNaN(parsedNum)) {
                                cleanedItem = parsedNum;
                            } else {
                                validationIssues.push({ dpId, issue: `Type mismatch: Expected number, failed to parse from string "${item}".`, value: item });
                            }
                        } else if (typeof cleanedItem !== 'number') {
                            validationIssues.push({ dpId, issue: `Type mismatch: Expected number, got ${typeof cleanedItem}.`, value: item });
                        }
                        break;
                    case 'boolean':
                        if (typeof cleanedItem !== 'boolean') {
                            const lowerItem = String(cleanedItem).toLowerCase();
                            if (['true', 'yes', '1', 'on'].includes(lowerItem)) cleanedItem = true;
                            else if (['false', 'no', '0', 'off'].includes(lowerItem)) cleanedItem = false;
                            else {
                                validationIssues.push({ dpId, issue: `Type mismatch: Expected boolean, got ${typeof cleanedItem}.`, value: item });
                            }
                        }
                        break;
                    case 'url':
                    case 'image_url':
                        if (typeof cleanedItem !== 'string' || !isValidHttpUrl(cleanedItem)) {
                            if (typeof cleanedItem === 'string' && plan.targetUrl) {
                                try {
                                    const absoluteUrl = new URL(cleanedItem, plan.targetUrl).href;
                                    if (isValidHttpUrl(absoluteUrl)) {
                                        cleanedItem = absoluteUrl;
                                        this.logger.log(`Validator Agent (${dpId}): Resolved relative URL to ${absoluteUrl}`);
                                    } else {
                                        validationIssues.push({ dpId, issue: `Invalid URL: Expected valid URL, got "${item}".`, value: item });
                                    }
                                } catch (urlError) {
                                    validationIssues.push({ dpId, issue: `Invalid URL: Failed to parse or resolve "${item}".`, value: item });
                                }
                            } else {
                                validationIssues.push({ dpId, issue: `Type mismatch: Expected valid URL string, got ${typeof cleanedItem}.`, value: item });
                            }
                        }
                        break;
                    case 'date':
                        if (!(cleanedItem instanceof Date)) {
                            try {
                                const parsedDate = new Date(cleanedItem);
                                if (!isNaN(parsedDate.getTime())) {
                                    cleanedItem = parsedDate.toISOString();
                                } else {
                                    validationIssues.push({ dpId, issue: `Type mismatch: Expected date, failed to parse from "${item}".`, value: item });
                                }
                            } catch (dateError) {
                                validationIssues.push({ dpId, issue: `Type mismatch: Expected date, error parsing "${item}".`, value: item });
                            }
                        }
                        break;
                    case 'string':
                    default:
                        if (typeof cleanedItem !== 'string') {
                            validationIssues.push({ dpId, issue: `Type mismatch: Expected string, got ${typeof cleanedItem}. Converting.`, value: item });
                            cleanedItem = String(cleanedItem);
                        }
                        break;
                }
                return cleanedItem;
            };

            if (isList && Array.isArray(currentData)) {
                currentData = currentData.map(cleanAndValidateItem).filter(item => item !== null);
                if (rawData[dpId]?.length > 0 && currentData.length === 0) {
                    this.logger.warn(`Validator Agent (${dpId}): List became empty after cleaning/validation. Original count: ${rawData[dpId].length}`);
                    validationIssues.push({ dpId, issue: "List empty after validation/cleaning.", originalCount: rawData[dpId].length });
                } else if (currentData.length === 0 && dp.extractionNotes && !dp.extractionNotes.toLowerCase().includes('optional')) {
                    validationIssues.push({ dpId, issue: "Required list is empty.", value: [] });
                }
            } else if (!isList) {
                currentData = cleanAndValidateItem(currentData);
                if (currentData === null && dp.extractionNotes && !dp.extractionNotes.toLowerCase().includes('optional')) {
                    validationIssues.push({ dpId, issue: "Required item is missing or null.", value: null });
                }
            }

            validatedData[dpId] = currentData;
        }

        // --- Optional: LLM-based Validation (Example: Check sentiment, consistency) ---
        if (this.llmBridge /* && plan requires complex validation */) {
            // You can add LLM-based validation here if needed.
        }

        this.logger.log("Validator Agent: Validation complete.", { validatedData, validationIssues });
        return { validatedData, validationIssues };
    }
}

/**
 * Checks if a string is a valid HTTP or HTTPS URL.
 * @param {string} string - The string to check.
 * @returns {boolean} - True if it's a valid HTTP/HTTPS URL, false otherwise.
 */
function isValidHttpUrl(string) {
    if (typeof string !== 'string') return false;
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

// For service worker/global context (uncomment if needed):
// self.ValidatorAgent = ValidatorAgent;

console.log("Validator Agent Class loaded.");
