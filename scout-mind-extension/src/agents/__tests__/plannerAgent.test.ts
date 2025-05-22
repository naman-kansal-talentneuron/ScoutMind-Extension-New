import { PlannerAgent, ExtractionPlan, PlannerAgentConfig } from '../plannerAgent'; // Assuming ExtractionPlan interface is exported
import { LLMBridge, GenericLLMResponse } from '../../llm/llmBridge';
import { Logger } from '../../utils/logger';
import { fillTemplate, getSystemPrompt } from '../../llm/promptTemplates';


jest.mock('../../llm/llmBridge');
jest.mock('../../utils/logger');
// Mock promptTemplates to ensure consistent output for tests
jest.mock('../../llm/promptTemplates', () => ({
  fillTemplate: jest.fn((templateId, data) => `Mocked prompt for ${templateId} with data: ${JSON.stringify(data)}`),
  getSystemPrompt: jest.fn(agentType => `Mocked system prompt for ${agentType}`),
}));


describe('PlannerAgent', () => {
  let plannerAgent: PlannerAgent;
  let mockLlmBridge: jest.Mocked<LLMBridge>;
  // Logger mock is implicitly handled by jest.mock above

  beforeEach(() => {
    // Create a new mock for LLMBridge before each test
    mockLlmBridge = new LLMBridge({} as any, new Logger('mock') as any) as jest.Mocked<LLMBridge>;
    mockLlmBridge.query = jest.fn(); // Ensure query is a mock function

    // Instantiate PlannerAgent with the mocked LLMBridge
    // Logger will be auto-mocked by jest.mock('../../utils/logger')
    const agentConfig: PlannerAgentConfig = {}; // Add any necessary config for tests
    plannerAgent = new PlannerAgent(mockLlmBridge, agentConfig);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear all mocks after each test
  });

  it('should create a basic plan from LLM response', async () => {
    const mockTargetUrl = 'http://example.com';
    const mockHtmlSample = '<html><body><h1>Title</h1><p>Paragraph 1</p></body></html>';
    const mockInstruction = 'Extract title and paragraph';
    
    // This is the raw string response expected from the LLM
    const mockLLMTextResponse = `
      Extraction Goal: Extract title and first paragraph.
      Data Structure: object
      Key Fields:
        - title [string] : The main title of the page
        - firstParagraph [string] : The first paragraph text
      Target Elements: H1, P
      Extraction Strategy: Direct text extraction
      Potential Challenges: None foreseen for this simple example.
    `;
    
    const llmResponse: GenericLLMResponse = {
        text: mockLLMTextResponse,
        provider: 'mock',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } 
    };
    mockLlmBridge.query.mockResolvedValue(llmResponse);

    const plan: ExtractionPlan = await plannerAgent.createExtractionPlan(mockTargetUrl, mockInstruction, mockHtmlSample);
    
    expect(fillTemplate).toHaveBeenCalledWith('PLANNER_CREATE_PLAN', {
        targetUrl: mockTargetUrl,
        extractionGoal: mockInstruction,
        htmlSample: mockHtmlSample, // Assuming no truncation for this test sample length
    });
    expect(getSystemPrompt).toHaveBeenCalledWith('PLANNER');
    expect(mockLlmBridge.query).toHaveBeenCalled();
    
    expect(plan).toBeDefined();
    expect(plan.success).toBe(true);
    expect(plan.extractionGoal).toEqual("Extract title and first paragraph.");
    expect(plan.dataStructure).toEqual("object");
    expect(plan.keyFields).toHaveLength(2);
    expect(plan.keyFields[0]).toEqual({ name: "title", type: "string", description: "The main title of the page" });
    expect(plan.keyFields[1]).toEqual({ name: "firstParagraph", type: "string", description: "The first paragraph text" });
    expect(plan.targetElements).toEqual(["H1, P"]); // Based on original parser logic, this might be a single string
    expect(plan.extractionStrategy).toEqual("Direct text extraction");
    expect(plan.potentialChallenges).toEqual(["None foreseen for this simple example."]);

    // Check metadata
    expect(plan.metadata).toBeDefined();
    expect(plan.metadata?.targetUrl).toBe(mockTargetUrl);
    expect(plan.metadata?.extractionGoal).toBe(mockInstruction);
    expect(plan.metadata?.model).toBe(llmResponse.model); // if model is returned by LLMBridge

    // Check schema generation
    expect(plan.schema).toBeDefined();
    expect(plan.schema?.title).toEqual({ selector: null, transform: 'trim' });
    expect(plan.schema?.firstParagraph).toEqual({ selector: null, transform: 'trim' });
  });

  it('should handle LLM query failure gracefully', async () => {
    mockLlmBridge.query.mockResolvedValue({ error: 'LLM failed', text: '' });

    const plan = await plannerAgent.createExtractionPlan('http://example.com', 'Test', '<html></html>');
    expect(plan.success).toBe(false);
    expect(plan.error).toContain('LLM failed');
  });
  
  it('should handle LLM response parsing errors gracefully', async () => {
    mockLlmBridge.query.mockResolvedValue({ text: "This is not a valid plan format.", provider: 'mock' });

    const plan = await plannerAgent.createExtractionPlan('http://example.com', 'Test', '<html></html>');
    // Depending on how strict parsing is, it might still extract parts or fail completely.
    // For this test, let's assume it extracts what it can.
    expect(plan.success).toBe(true); // parseExtractionPlan itself doesn't set success to false on partial parse
    expect(plan.extractionGoal).toBeNull(); // Or whatever default is set for unparsable fields
    expect(plan.keyFields).toEqual([]);
  });

  // Add more tests for refinePlan and createMultiPagePlan if desired
  // Example for refinePlan (stub):
  it('refinePlan should call LLM with refinement prompt', async () => {
      const currentPlan: ExtractionPlan = {
          success: true, extractionGoal: "Initial Goal", dataStructure: "list",
          keyFields: [{ name: "item", type: "string" }], targetElements: ["div.item"],
          extractionStrategy: "Initial strategy", potentialChallenges: [], schema: null,
          metadata: { timestamp: "ts1", targetUrl: "url", extractionGoal: "Initial Goal" }
      };
      const htmlSample = "<p>new content</p>";
      const feedback = "The old selectors miss items.";
      
      const mockLLMRefinedText = `
        Extraction Goal: Refined Goal
        Data Structure: list
        Key Fields:
          - item_new [string] : New item field
        Target Elements: .new-item
        Extraction Strategy: Refined strategy
        Potential Challenges: Still some challenges
      `;
      mockLlmBridge.query.mockResolvedValue({ text: mockLLMRefinedText, provider: 'mock' });

      const refinedPlan = await plannerAgent.refinePlan(currentPlan, htmlSample, feedback);
      
      expect(fillTemplate).toHaveBeenCalledWith(expect.stringContaining("refine an existing data extraction plan"), expect.any(Object)); // Check if refine-specific template/prompt is used
      expect(mockLlmBridge.query).toHaveBeenCalled();
      expect(refinedPlan.success).toBe(true);
      expect(refinedPlan.extractionGoal).toBe("Refined Goal");
      expect(refinedPlan.keyFields[0].name).toBe("item_new");
      expect(refinedPlan.metadata?.refined).toBe(true);
  });
});
