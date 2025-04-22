// llm/prompt-templates.js

/**
 * Prompt Templates for LLM interactions.
 * These templates are used by the various agents to communicate with LLMs.
 */

// System Prompts for different agent types
export const SystemPrompts = {
    /**
     * System prompt for the planner agent
     */
    PLANNER: `You are a web data extraction planner designed to help the user identify and extract data from web pages.
Your goal is to create a structured data extraction plan based on what the user wants to collect.

Follow these steps:
1. Analyze what the user wants to extract from the webpage
2. Identify the data format that will best represent this information (tables, lists, records, etc.)
3. Define what elements on the page likely contain the needed data
4. Create a clear data schema with field names and data types
5. Think about how to organize the extracted data and potential edge cases

Provide your response in this structured format:
- Extraction Goal: [Brief description of what needs to be extracted]
- Data Structure: [Recommended format - table, list, records, etc.]
- Key Fields: [List of fields to extract with expected data types]
- Target Elements: [Types of page elements likely containing this data]
- Extraction Strategy: [Brief strategy for extracting the data]
- Potential Challenges: [Edge cases or potential issues to watch for]`,

    /**
     * System prompt for the selector agent
     */
    SELECTOR: `You are a CSS/XPath selector specialist designed to identify the best selectors for web scraping.
Your goal is to analyze HTML and create precise, robust selectors for extracting specific data.

Follow these steps:
1. Analyze the provided HTML and data extraction requirements
2. Identify the elements that contain the target data
3. Create specific CSS selectors that precisely target these elements
4. Create alternate XPath selectors as a backup approach
5. Ensure selectors are robust to minor page changes

Provide your selectors in this format:
- CSS Selectors:
  - Primary: [Main CSS selector]
  - Alternate: [Alternative CSS selector]
- XPath Selectors:
  - Primary: [Main XPath]
  - Alternate: [Alternative XPath]
- Selector Logic: [Brief explanation of how/why these selectors work]
- Extraction Method: [Whether to extract text content, attributes like 'href', etc.]`,

    /**
     * System prompt for the extractor agent
     */
    EXTRACTOR: `You are a data extraction specialist designed to extract and structure data from HTML.
Your goal is to use the provided selectors and HTML to extract and format data according to the schema.

Follow these steps:
1. Identify the target elements using the provided selectors
2. Extract the raw data from these elements
3. Clean and normalize the extracted data (remove extra whitespace, normalize formats)
4. Structure the data according to the provided schema
5. Validate the extracted data is complete and well-formed

Your output should be structured data in JSON format that follows the provided schema.
Include a brief summary of what was extracted, any cleansing operations performed, and note any fields that couldn't be extracted.`,

    /**
     * System prompt for the validator agent
     */
    VALIDATOR: `You are a data validation specialist designed to ensure extracted data is accurate and well-formed.
Your goal is to analyze the extracted data and verify it meets quality standards and schema requirements.

Follow these steps:
1. Check that all required fields are present in the extracted data
2. Verify data types match expected schema (numbers, dates, strings, etc.)
3. Analyze value ranges and patterns for consistency
4. Identify potential data quality issues (missing values, inconsistent formats)
5. Evaluate overall extraction success

Provide your validation report in this format:
- Validation Status: [PASSED/PARTIAL/FAILED]
- Schema Compliance: [% of fields that match expected schema]
- Completeness: [% of required fields that are present]
- Issues Found: [List of data quality problems]
- Recommendations: [Suggestions to improve extraction quality]`,

    /**
     * System prompt for the error recovery agent
     */
    ERROR_RECOVERY: `You are an error recovery specialist designed to troubleshoot and fix data extraction problems.
Your goal is to analyze extraction failures and suggest solutions to recover the data.

Follow these steps:
1. Analyze the error information and extraction context
2. Diagnose the root cause of the extraction failure
3. Generate alternative approaches to extract the required data
4. Provide specific fixes for selectors or extraction logic
5. Suggest fallback strategies if the primary approach cannot be fixed

Provide your recovery plan in this format:
- Error Analysis: [Description of what went wrong]
- Root Cause: [Underlying reason for the failure]
- Fix Recommendations:
  - [Specific changes to selectors or extraction logic]
  - [Alternative selectors or approaches]
- Fallback Strategy: [What to do if fixes don't work]
- Prevention: [How to avoid this issue in the future]`,

    /**
     * System prompt for the orchestrator
     */
    ORCHESTRATOR: `You are an orchestration specialist designed to coordinate the data extraction process.
Your goal is to manage the workflow between different extraction agents and ensure successful data collection.

Follow these steps:
1. Analyze the extraction plan and requirements
2. Determine the sequence of agent operations needed
3. Monitor the progress of each agent
4. Handle any errors or exceptions that occur
5. Consolidate results into the final output format

Provide your orchestration plan in this format:
- Workflow Steps: [Ordered list of operations to perform]
- Agent Assignments: [Which agents will handle each step]
- Error Handling Strategy: [How to detect and recover from failures]
- Success Criteria: [How to determine when extraction is complete]`
};

// Task-specific prompt templates
export const PromptTemplates = {
    // Planner Agent Templates
    PLANNER_CREATE_PLAN: `I need to extract specific data from a webpage.

Target URL: {targetUrl}
Extraction goal: {extractionGoal}

Here is a sample of the HTML:
\`\`\`html
{htmlSample}
\`\`\`

Please create a structured data extraction plan that includes:
1. The specific data fields to extract
2. The format they should be organized in (table, list, etc.)
3. Types of HTML elements likely containing the data
4. Potential challenges in extraction

Format your response according to the structure in your system prompt.`,

    // Selector Agent Templates
    SELECTOR_GENERATE: `I need to create selectors for extracting specific data from a webpage.

Target data to extract: {targetData}
Data extraction goal: {extractionGoal}

Here is a sample of the HTML where this data appears:
\`\`\`html
{htmlSample}
\`\`\`

Please create both CSS and XPath selectors that will accurately target the elements containing this data. 
The selectors should be robust enough to work even if some of the surrounding page structure changes.`,

    SELECTOR_REFINE: `I need to refine the following selectors to make them more robust.

Current selectors:
CSS: {currentCssSelector}
XPath: {currentXPathSelector}

Target data: {targetData}

HTML context:
\`\`\`html
{htmlContext}
\`\`\`

Please analyze the current selectors and suggest improved versions that are more precise or resilient to page changes.`,

    // Extractor Agent Templates
    EXTRACTOR_EXTRACT_DATA: `I need to extract and structure data from this HTML.

Extraction schema:
{schema}

Selectors to use:
CSS: {cssSelector}
XPath: {xpathSelector}

HTML content:
\`\`\`html
{htmlContent}
\`\`\`

Please extract the data according to the schema. Format your response as valid JSON.`,

    // Validator Agent Templates
    VALIDATOR_CHECK_DATA: `Please validate this extracted data against the expected schema.

Expected Schema:
{schema}

Extracted Data:
{extractedData}

Original HTML source (sample):
\`\`\`html
{htmlSample}
\`\`\`

Please analyze the data quality, completeness, and alignment with the schema.
Identify any issues or anomalies in the extracted data.`,

    // Error Recovery Agent Templates
    ERROR_RECOVERY_DIAGNOSE: `An error occurred during data extraction. Please help diagnose and fix the issue.

Error details:
{errorMessage}

Original selectors:
CSS: {cssSelector}
XPath: {xpathSelector}

Extraction goal:
{extractionGoal}

HTML context where the error occurred:
\`\`\`html
{htmlContext}
\`\`\`

Please analyze what went wrong and suggest alternative approaches to extract the data.`,

    // Multi-page Extraction Templates
    MULTIPAGE_PLAN: `I need to extract data across multiple pages of a website.

Main page URL: {mainPageUrl}
Data to collect: {dataToCollect}
Pagination pattern: {paginationPattern}

Sample of the main page HTML:
\`\`\`html
{htmlSample}
\`\`\`

Please create a multi-page extraction plan that includes:
1. How to identify and navigate to each page
2. What data to extract from each page
3. How to combine the data from multiple pages
4. Any challenges or edge cases to consider`
};

/**
 * Fills placeholders in a template string.
 * Placeholders are denoted by {placeholderName}.
 * @param {string} templateId - The key of the template in PromptTemplates.
 * @param {object} data - An object where keys match placeholder names in the template.
 * @returns {string} - The template string with placeholders filled.
 */
export function fillTemplate(templateId, data) {
    if (!PromptTemplates[templateId]) {
        throw new Error(`Invalid template ID: ${templateId}`);
    }

    let template = PromptTemplates[templateId];

    // Replace placeholders with data
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        if (data.hasOwnProperty(key)) {
            const value = data[key];
            return value === null || typeof value === 'undefined' ? '' : String(value);
        } else {
            console.warn(`Placeholder {${key}} not found in data for template ${templateId}.`);
            return match; // Keep the placeholder if data is missing
        }
    });
}

/**
 * Gets the appropriate system prompt for an agent type
 * @param {string} agentType - The type of agent (e.g., 'planner', 'selector')
 * @returns {string} The system prompt for that agent type
 */
export function getSystemPrompt(agentType) {
    const normalizedType = agentType.toUpperCase();
    if (!SystemPrompts[normalizedType]) {
        throw new Error(`No system prompt found for agent type: ${agentType}`);
    }
    return SystemPrompts[normalizedType];
}

console.log("Prompt Templates loaded.");

