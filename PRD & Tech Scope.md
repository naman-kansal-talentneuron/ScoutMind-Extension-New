## In-Depth Comparison of Reference Materials

After analyzing the reference web scraping implementations, I can provide a detailed comparison highlighting the unique approach ScoutMind takes compared to existing solutions.

### Architectural Approaches

| Tool | Architecture | UI Framework | DOM Interaction | Data Processing |
|------|--------------|-------------|-----------------|-----------------|
| **Agenty Advanced** | Component-based | Angular | SelectorGadget + DOM API | Advanced transformation pipeline |
| **Octaparse-voc** | React components | React | Shadow DOM + Custom Overlay | E-commerce specialized parsers |
| **Simple Scraper** | Minimal encapsulated | Vanilla JS | Shadow DOM isolation | Basic extraction only |
| **Web Scraper** | DevTools panel | jQuery | Content script injection | Rule-based transformation |
| **Instant Data Scraper** | Popup-based | Vanilla JS | Table detection algorithms | Table-focused processing |
| **ScoutMind** | Multi-agent system | Modern web components | Hybrid approach + LLM | Intelligent transformation |

### Selector Generation Methods

| Tool | Primary Method | Intelligence Level | User Input Required | Adaptability |
|------|---------------|-------------------|---------------------|-------------|
| **Agenty Advanced** | Visual point-and-click | Rule-based | High (manual selection) | Medium (templates) |
| **Octaparse-voc** | Marketplace-specific templates | Pre-configured | Medium (template selection) | Low (fixed patterns) |
| **Simple Scraper** | Manual | None (user-driven) | Very High (all manual) | Low |
| **Web Scraper** | Element inspection | Rule-based | High (manual configuration) | Low |
| **Instant Data Scraper** | Automatic table detection | Algorithm-based | Low (for tables only) | Medium |
| **ScoutMind** | Natural language + LLM | AI-powered | Very Low (description only) | Very High (learning) |

### Visual Feedback & UI Design

| Tool | UI Approach | Element Highlighting | Interactive Refinement | User Experience |
|------|------------|---------------------|------------------------|----------------|
| **Agenty Advanced** | Complex dashboard | Advanced overlay system | Manual adjustments | Professional but complex |
| **Octaparse-voc** | E-commerce focused panels | Category-color coded | Limited to templates | Domain-specific clarity |
| **Simple Scraper** | Minimalist popup | Basic highlighting | Manual selector editing | Clean but technical |
| **Web Scraper** | DevTools integration | Basic border highlights | Selector testing | Technical, developer-focused |
| **Instant Data Scraper** | One-click simplicity | Table row/column highlights | Limited | Extremely simple, limited |
| **ScoutMind** | Split-pane modern UI | Intelligent highlighting | Preview-based refinement | Natural language simplicity |

### Data Handling Capabilities

| Tool | Data Types | Transformation | Validation | Export Options |
|------|-----------|---------------|------------|----------------|
| **Agenty Advanced** | General web data | Advanced pipeline | Rule-based | Multiple formats |
| **Octaparse-voc** | E-commerce specific | Marketplace-optimized | E-commerce validation | Structured reports |
| **Simple Scraper** | Basic text/attributes | Minimal | None | CSV only |
| **Web Scraper** | General web data | Basic transformations | Simple validation | JSON/CSV |
| **Instant Data Scraper** | Tabular data only | Table normalization | Basic type checking | CSV/Excel |
| **ScoutMind** | Any web content | Intelligent processing | LLM-powered validation | Multiple with schema |

## ScoutMind's Unique Value Proposition

### 1. Natural Language-Driven Architecture

**What makes it unique:** While all reference implementations require technical understanding of web scraping concepts, ScoutMind is the only solution that uses natural language as the primary interface.

```
Reference tools: "Select elements using CSS selectors like '.product-price'"
ScoutMind: "Extract all product prices from this page"
```

The multi-agent architecture translates natural language into technical selectors behind the scenes:

```javascript
// ScoutMind's unique approach
async processRequest(naturalLanguageInstruction, webpage) {
  // 1. Generate extraction plan through LLM
  const plan = await this.plannerAgent.createPlan(naturalLanguageInstruction, webpage);
  
  // 2. Automatic selector generation
  const selectors = await this.selectorAgent.generateSelectors(plan, webpage);
  
  // Steps that follow are handled without user intervention
}
```

No other tool in the reference materials employs this natural language first approach with a sophisticated multi-agent system.

### 2. Intelligent Visual Feedback System

ScoutMind's visual highlighting system is more advanced than any reference implementation:

```javascript
// ScoutMind's highlighting includes explanation of why elements were selected
highlightElements(selector, category = {
  dataPoint: 'product_price',
  confidence: 0.95,
  reasoning: 'Contains currency symbol and numeric value in expected position'
})
```

While Agenty has a sophisticated overlay system, it doesn't provide the intelligent labeling and reasoning behind selections that ScoutMind offers through its LLM integration.

### 3. Hybrid Local/Cloud Intelligence

None of the reference implementations offer a hybrid approach to intelligence:

| Tool | Intelligence Source |
|------|---------------------|
| Reference Tools | Rule-based logic, pre-defined patterns |
| ScoutMind | LLM intelligence with both local (privacy) and cloud (power) options |

This represents a fundamental shift in the capability model:

```javascript
// Unique to ScoutMind
async query(prompt, options = {}) {
  const provider = options.provider || (this.privacyMode ? 'ollama' : 'openai');
  
  try {
    return await this.providers[provider].generateResponse(prompt, options);
  } catch (error) {
    // Intelligent fallback between local and cloud
    if (options.fallbackProvider) {
      return this.query(prompt, {
        ...options,
        provider: options.fallbackProvider
      });
    }
  }
}
```

### 4. Multi-Page and Batch Processing Approach

While some reference tools support pagination, ScoutMind's approach is fundamentally different:

```javascript
// ScoutMind's batch URL processing (unique capability)
async processBatchExtraction(instruction, urls) {
  const urlGroups = await this.plannerAgent.categorizeUrls(urls, instruction);
  const extractionStrategies = await this.plannerAgent.developCommonStrategy(urlGroups);
  
  // Apply extraction across multiple pages with shared strategy
  return this.orchestrator.executeBatchStrategy(extractionStrategies, urlGroups);
}
```

This enables batch processing from a single natural language instruction - a capability absent from the reference materials.

### 5. Error Recovery Intelligence

ScoutMind's error recovery system is fundamentally more advanced:

```javascript
// ScoutMind's unique error recovery
async recoverFromError(selector, originalError, htmlContext) {
  // Use LLM to understand the error context
  const errorAnalysis = await this.llmBridge.query(`
    Analyze why this selector "${selector}" might be failing on this HTML.
    ${htmlContext.substring(0, 3000)}...
  `);
  
  // Generate alternative approaches
  const alternatives = await this.generateAlternativeSelectors(errorAnalysis);
  
  // Test and validate alternatives
  return this.testAlternatives(alternatives);
}
```

None of the reference implementations show this level of intelligent error recovery.

### 6. Integrated Preview & Refinement System

ScoutMind uniquely combines immediate feedback with LLM-powered refinement:

```javascript
// Sample run feature
async performSampleRun(instruction, url) {
  // Extract from first URL only
  const sampleResult = await this.orchestrator.processRequest(instruction, url);
  
  // Get user feedback
  const feedback = await this.ui.presentSampleAndGetFeedback(sampleResult);
  
  // Refine extraction plan based on feedback
  const refinedPlan = await this.plannerAgent.refinePlan(
    instruction, 
    sampleResult.plan, 
    feedback
  );
  
  return refinedPlan;
}
```

This preview-feedback-refinement loop using LLM intelligence is entirely absent from reference tools, which rely on manual adjustments.

## Performance & Technical Innovation

### Integration of Modern Browser APIs

ScoutMind leverages modern browser capabilities more effectively:

```javascript
// ScoutMind's advanced browser API usage
async setupModernCapabilities() {
  // Set up service worker for background processing
  if (this.features.offscreen) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse DOM content in background'
    });
  }
  
  // Use more efficient MutationObserver API for dynamic content
  this.observer = new MutationObserver(mutations => {
    this.intelligentlyProcessMutations(mutations);
  });
}
```

### Performance Optimization for LLM Integration

ScoutMind implements unique optimizations for LLM processing:

```javascript
// Unique to ScoutMind
async optimizeHTMLForLLM(html) {
  // Remove unnecessary elements that would waste tokens
  const cleanHtml = this.domUtils.removeIrrelevantNodes(html);
  
  // Focus on content-rich areas
  const contentAreas = await this.domUtils.identifyContentAreas(cleanHtml);
  
  // Summarize non-essential areas
  return this.domUtils.createCompressedContext(contentAreas, cleanHtml);
}
```

## Conclusion: ScoutMind's Unique Position

When comparing ScoutMind to the reference implementations, its uniqueness stems from fundamentally reimagining web scraping through:

1. **Natural language as the primary interface** - eliminating the technical barrier
2. **Multi-agent LLM architecture** - providing intelligence where other tools use rules
3. **Preview-feedback-refinement loop** - creating a collaborative experience
4. **Hybrid local/cloud processing** - balancing privacy and power
5. **Intelligent error recovery** - adapting to challenges automatically

These capabilities represent a generational leap beyond the reference implementations, which largely remain:
- Technically complex (requiring CSS/XPath knowledge)
- Rule-based (rather than intelligent)
- Manually configured (rather than language-driven)
- Single-approach (without fallback strategies)

ScoutMind's core innovation is transforming web scraping from a technical task requiring specialized knowledge into a collaborative process where users express their needs in natural language and the system handles the technical implementation intelligently.


## Product Requirements Document (PRD)

### 1. Executive Summary

ScoutMind is a browser extension that revolutionizes web data extraction by leveraging AI agents to interpret natural language instructions. Users simply provide URLs and describe what data they want to collect in plain English. The system autonomously creates extraction strategies, provides sample results for validation, and executes full data collection with minimal technical knowledge required.

### 2. Product Vision

**Mission Statement**:  
To democratize web data extraction by eliminating technical barriers through natural language processing and intelligent agent collaboration.

**Core Value Proposition**:  
ScoutMind transforms complex data extraction tasks from technical challenges requiring specialized knowledge (CSS selectors, DOM structure) into simple conversations where users describe their needs in everyday language and the system handles the technical implementation.

### 3. User Personas

#### 3.1 Business Analyst (Primary)
- **Name**: Morgan
- **Role**: Business analyst at a market research firm
- **Technical Skills**: Moderate (uses Excel, basic SQL)
- **Goals**: Gather competitive pricing data, product specifications, market trends
- **Pain Points**: Current tools require technical knowledge; manual data collection is time-consuming

#### 3.2 Digital Marketer
- **Name**: Alex
- **Role**: Digital marketing specialist
- **Technical Skills**: Low-to-moderate
- **Goals**: Track competitor content, gather review data, collect social proof
- **Pain Points**: Can't easily extract structured data without developer help

#### 3.3 Researcher
- **Role**: Academic or industry researcher
- **Technical Skills**: Variable (domain expertise but not necessarily technical)
- **Goals**: Collect data for analysis from multiple sources
- **Pain Points**: Current tools are either too simple or require programming

### 4. Feature Specifications

#### 4.1 Core Features

##### 4.1.1 Natural Language Instruction Interface
- Text input area for describing extraction needs in plain English
- Support for complex instructions (e.g., "Extract all product prices and their corresponding names, but only for items that are in stock")
- Instruction history with ability to reuse/modify previous instructions

##### 4.1.2 Multi-URL Processing
- Ability to input multiple URLs in batch
- URL categorization and grouping based on structure similarity
- Bulk processing with shared extraction strategy where appropriate
- Progress tracking for multiple URLs

##### 4.1.3 AI Agent System
- **Planner Agent**: Translates natural language to structured extraction plan
- **Selector Agent**: Generates optimal CSS/XPath selectors for target elements
- **Extractor Agent**: Executes extraction using selected strategies
- **Validator Agent**: Ensures data quality and appropriate formats
- **Recovery Agent**: Handles errors and edge cases adaptively

##### 4.1.4 Sample Run & Refinement
- Automatic sample extraction from first URL before full execution
- Visual preview of selected elements with highlighting
- Feedback mechanism for users to approve/modify extraction strategy
- Intelligent refinement based on feedback

##### 4.1.5 Data Processing & Export
- Automatic data cleaning and normalization
- Type detection and conversion
- Export to CSV, JSON, and Excel formats
- Schema generation for extracted data
- Data preview in tabular and structured formats

#### 4.2 UI Components

##### 4.2.1 Main Interface
- Split-pane design with resizable panels
- Left panel: Configuration and instructions
- Right panel: Website preview with element highlighting
- Modern, clean aesthetic with intuitive controls

##### 4.2.2 Element Highlighting System
- Color-coded overlay for identified elements
- Hover information showing data point mapping
- Confidence indicators for selection accuracy
- Interactive selection refinement

##### 4.2.3 Results View
- Tabular data preview with sorting and filtering
- JSON structure view for hierarchical data
- Extraction metrics (success rate, element count)
- Error reporting with suggested fixes

##### 4.2.4 Settings Page
- LLM provider configuration (API keys, model selection)
- Local vs. cloud processing options
- Debug and logging settings
- Performance tuning options
- Export preferences

### 5. User Experience & Workflow

#### 5.1 Main Extraction Workflow
1. User inputs one or more URLs
2. User describes extraction needs in natural language
3. System analyzes pages and presents sample extraction
4. User reviews and provides feedback
5. System refines strategy based on feedback
6. System executes full extraction across all URLs
7. User previews results and exports in preferred format

#### 5.2 Advanced Workflows

##### 5.2.1 Template Creation & Reuse
1. User saves successful extraction as named template
2. Template can be applied to new URLs
3. Templates can be shared or exported

##### 5.2.2 Scheduled Extractions
1. User configures repeated extraction schedule
2. System runs extraction automatically at specified intervals
3. Results are stored for comparison/trend analysis

##### 5.2.3 Extraction Refinement
1. User reviews extraction results
2. User provides specific feedback on incorrect items
3. System learns from feedback and improves future extractions

### 6. Technical Requirements

#### 6.1 Extension Capabilities
- Chrome/Firefox/Edge browser support
- Content script injection for DOM access
- Background service worker for persistent operation
- Cross-origin resource access (when permitted)
- Local storage for configurations and templates

#### 6.2 LLM Integration
- Local processing via Ollama
- Cloud processing options (OpenAI, Mistral, others)
- API key management and security
- Prompt optimization for efficient token usage
- Caching mechanisms to reduce API calls

#### 6.3 Performance Targets
- Initial response (sample extraction) < 5 seconds
- Full extraction processing: < 2 seconds per URL (for standard pages)
- Memory usage < 200MB
- CPU usage < 25% during active extraction

### 7. Success Metrics

#### 7.1 Performance Metrics
- Extraction accuracy rate (target: >90%)
- Processing time per page
- Element selection precision
- Error recovery success rate (target: >80%)

#### 7.2 User Metrics
- Task completion rate
- Time saved vs. manual extraction
- User satisfaction scores
- Feature utilization rates

### 8. Timeline & Milestones

#### Phase 1: Foundation (8 weeks)
- Basic extension structure and UI
- Natural language processing with single LLM integration
- Simple extraction capabilities
- Basic export functionality

#### Phase 2: Agent System (6 weeks)
- Multi-agent architecture implementation
- Enhanced selector generation
- Error handling and recovery
- Sample run and feedback loop

#### Phase 3: Advanced Features (6 weeks)
- Multi-URL processing
- Template system
- Advanced data transformation
- Performance optimization

#### Phase 4: Refinement & Enterprise Features (6 weeks)
- Scheduled extractions
- Advanced export options
- Enterprise security features
- User analytics and telemetry

### 9. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Website anti-scraping measures | High | High | Multiple extraction strategies, header modification, rate limiting |
| LLM API costs for cloud processing | Medium | High | Local LLM options, efficient prompt design, caching |
| Browser extension store policies | High | Medium | Compliance review, clear privacy policy, user consent |
| DOM structure changes breaking extraction | High | High | Resilient selector strategies, error recovery system |
| Performance issues with complex pages | Medium | Medium | Worker processes, memory management, partial extraction |

---

# Technical Architecture Document
## ScoutMind Browser Extension

### 1. System Architecture Overview

ScoutMind implements a multi-layered architecture with service workers, content scripts, and LLM integration to provide intelligent data extraction capabilities while maintaining a responsive user interface.

#### 1.1 High-Level Architecture

```
┌─────────────────────────────────────┐
│            User Interface           │
│  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │  Popup  │ │ Options │ │Content │ │
│  │   UI    │ │  Page   │ │Overlay │ │
│  └─────────┘ └─────────┘ └────────┘ │
└───────────┬─────────────────┬───────┘
            │                 │
┌───────────▼─────────┐ ┌────▼─────────────┐
│   Service Worker    │ │  Content Scripts  │
│  ┌───────────────┐  │ │ ┌──────────────┐ │
│  │ Agent System  │  │ │ │  DOM Access  │ │
│  └───────┬───────┘  │ │ └──────┬───────┘ │
│          │          │ │        │         │
│  ┌───────▼───────┐  │ │ ┌──────▼───────┐ │
│  │  LLM Bridge   │  │ │ │ UI Renderer  │ │
│  └───────────────┘  │ │ └──────────────┘ │
└─────────┬───────────┘ └──────────────────┘
          │
┌─────────▼─────────┐
│  External Services │
│ ┌────────────────┐│
│ │   LLM APIs     ││
│ └────────────────┘│
└───────────────────┘
```

#### 1.2 Agent System Architecture

```
┌─────────────────────────────────────────────┐
│              Agent Orchestrator             │
└───────────┬───────────┬───────────┬─────────┘
            │           │           │
┌───────────▼─┐ ┌───────▼───┐ ┌─────▼─────┐ ┌───────────┐
│ Planner     │ │ Selector  │ │ Extractor │ │ Validator │
│ Agent       │ │ Agent     │ │ Agent     │ │ Agent     │
└───────────┬─┘ └───────────┘ └───────────┘ └───────────┘
            │
┌───────────▼─┐
│ Recovery    │
│ Agent       │
└─────────────┘
```

### 2. Component Breakdown

#### 2.1 UI Components

1. **Popup Interface**
   - React-based component architecture
   - Split-pane layout with resize handlers
   - Material Design or Tailwind CSS for styling
   - Dark/light mode support

2. **Content Overlay**
   - Shadow DOM encapsulation
   - Element highlighting system
   - Feedback collection interface

3. **Settings Page**
   - API key management
   - Provider configuration
   - Debug settings
   - Export preferences

#### 2.2 Service Worker Components

1. **Agent System**
   - Agent Orchestrator
   - Individual specialized agents
   - Message handling system

2. **LLM Bridge**
   - Provider abstraction layer
   - Request optimization
   - Caching system
   - Fallback handling

3. **Storage Manager**
   - Configuration persistence
   - Template storage
   - Result caching

#### 2.3 Content Script Components

1. **DOM Interaction**
   - Element selection
   - Content extraction
   - Event handling

2. **UI Renderer**
   - Highlighting overlay
   - Selection feedback
   - Progress indicators

### 3. Data Flow Diagrams

#### 3.1 Main Extraction Flow

```
┌────────────┐  Instruction   ┌────────────┐  Extraction   ┌────────────┐
│            │───────────────>│            │ Plan          │            │
│   User     │                │  Planner   ├─────────────> │ Selector   │
│ Interface  │                │   Agent    │               │   Agent    │
│            │                │            │               │            │
└────────────┘                └────────────┘               └─────┬──────┘
      ▲                                                          │
      │                                                          │
      │                                                    CSS/XPath
      │                                                    Selectors
      │                                                          │
      │                                                          ▼
┌─────┴──────┐   Validated    ┌────────────┐  Raw Data    ┌────────────┐
│            │   Data         │            │◄─────────────│            │
│ Validator  │◄──────────────│ Extractor  │              │   DOM      │
│   Agent    │               │   Agent    │              │ Interaction │
│            │               │            │              │            │
└────────────┘               └────────────┘              └────────────┘
```

#### 3.2 Error Recovery Flow

```
┌────────────┐  Error         ┌────────────┐  Alternative  ┌────────────┐
│            │ Information    │            │  Strategy     │            │
│ Extractor  ├─────────────> │ Recovery   ├─────────────> │ Selector   │
│   Agent    │               │   Agent    │               │   Agent    │
│            │               │            │               │            │
└────────────┘               └────────────┘               └────────────┘
                                   │
                                   │ Feedback
                                   ▼
                             ┌────────────┐
                             │            │
                             │  Planner   │
                             │   Agent    │
                             │            │
                             └────────────┘
```

### 4. Technology Stack & Dependencies

#### 4.1 Core Technologies

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Frontend Framework | React | 18.x | UI components |
| Styling | TailwindCSS | 3.x | Modern UI styling |
| State Management | Redux Toolkit | 2.x | Application state |
| Build System | Webpack | 5.x | Extension bundling |
| Testing | Jest + Testing Library | 29.x | Component testing |
| DOM Manipulation | Custom utilities | N/A | Element selection/extraction |

#### 4.2 Extension APIs

| API | Purpose |
|-----|---------|
| Chrome Extension API | Core extension functionality |
| Storage API | Configuration persistence |
| Tabs API | Browser tab interaction |
| Scripting API | Dynamic content script injection |
| DeclarativeNetRequest | Header modification |
| Offscreen API | Background DOM processing |

#### 4.3 External Dependencies

| Dependency | Purpose | Notes |
|------------|---------|-------|
| Ollama | Local LLM processing | Self-hosted option |
| OpenAI API | Cloud LLM processing | Optional advanced capabilities |
| Mistral AI | Alternative LLM provider | Privacy-focused option |
| PapaParse | CSV parsing/generation | For data export |
| DOMPurify | HTML sanitization | Security measure |
| Luxon | Date/time handling | Data normalization |

### 5. Security Considerations

#### 5.1 API Key Management
- Store API keys in secure extension storage
- Never expose keys in client-side code
- Implement API key rotation capability
- Include warning about cloud API usage

#### 5.2 Data Privacy
- Process data locally when possible
- Clear cache after processing
- Implement data minimization in LLM prompts
- Provide clear privacy policy

#### 5.3 Website Interaction
- Respect robots.txt directives
- Implement rate limiting
- Avoid excessive parallel requests
- Handle authentication cookies properly

### 6. Code Structure & Organization

#### 6.1 Directory Structure

```
ScoutMind/
├── manifest.json              # Extension configuration
├── popup/                     # Main UI
│   ├── components/            # React components
│   ├── hooks/                 # Custom React hooks
│   ├── store/                 # Redux state
│   ├── styles/                # CSS files
│   ├── popup.html
│   └── popup.js
├── settings/                  # Settings page
│   ├── components/
│   ├── settings.html
│   └── settings.js
├── background/                # Service worker
│   ├── index.js               # Main entry point
│   ├── messaging.js           # Message handling
│   └── header-rules.js        # Security header handling
├── content/                   # Content scripts
│   ├── index.js               # Main content script
│   ├── highlighter.js         # Element highlighting
│   ├── overlay.js             # UI overlay
│   └── dom-utils.js           # DOM manipulation
├── agents/                    # LLM-powered agents
│   ├── orchestrator.js        # Agent coordination
│   ├── planner-agent.js       # Extraction planning
│   ├── selector-agent.js      # Selector generation
│   ├── extractor-agent.js     # Data extraction
│   ├── validator-agent.js     # Data validation
│   └── recovery-agent.js      # Error handling
├── llm/                       # LLM integration
│   ├── llm-bridge.js          # Provider abstraction
│   ├── ollama-connector.js    # Local LLM connector
│   ├── external-connector.js  # Cloud LLM connector
│   └── prompt-templates.js    # Optimized prompts
├── utils/                     # Shared utilities
│   ├── storage-manager.js     # Data persistence
│   ├── logger.js              # Logging system
│   ├── url-utils.js           # URL processing
│   ├── selector-utils.js      # Selector helpers
│   └── debug-manager.js       # Debug utilities
├── tests/                     # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── assets/                    # Static assets
    ├── icons/
    └── images/
```

#### 6.2 Module Dependencies

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    UI Layer     │────>│  Agent System   │────>│  LLM Bridge     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Content Scripts │     │  DOM Utilities  │     │ External APIs   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Storage Manager │     │ Selector Utils  │     │ Debug Manager   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 7. Coding Standards & Guidelines

#### 7.1 JavaScript Standards
- ES6+ features
- Async/await for asynchronous operations
- Strict TypeScript or JSDoc type annotations
- Functional programming patterns where appropriate

#### 7.2 React Component Guidelines
- Functional components with hooks
- Component composition over inheritance
- Container/presentational component separation
- Memoization for performance-critical components

#### 7.3 Error Handling
- Structured error objects with context
- Centralized error logging
- User-friendly error messages
- Graceful degradation

#### 7.4 Performance Guidelines
- Throttle/debounce DOM operations
- Optimize LLM prompt size
- Use Web Workers for CPU-intensive tasks
- Implement memory monitoring

### 8. Testing Strategy

#### 8.1 Unit Testing
- Agent logic
- LLM connectors (with mocks)
- Selector generation
- Data validation

#### 8.2 Integration Testing
- Agent orchestration
- UI state management
- Extension API interactions

#### 8.3 End-to-End Testing
- Complete extraction flows
- Browser extension functionality
- Cross-browser compatibility

#### 8.4 Performance Testing
- Response time benchmarks
- Memory usage profiling
- CPU utilization tracking

### 9. Required Dependencies Before Development

#### 9.1 Development Environment
- Node.js (18.x or later)
- npm/yarn
- Chrome browser (latest)
- VSCode or similar IDE with:
  - ESLint
  - Prettier
  - Chrome Debugger extension

#### 9.2 Build System Setup
- Webpack configuration for extension
- Babel for JS transpilation
- PostCSS for styling
- Type checking (TypeScript or JSDoc)

#### 9.3 Testing Framework
- Jest configuration
- Browser extension testing utilities
- Mock service worker for API testing

#### 9.4 External Services
- Ollama installation for local LLM
- OpenAI/Mistral API accounts (for testing)
- CI/CD pipeline

#### 9.5 Proxy Setup (Optional)
- CORS proxy for development
- Header modification testing

### 10. Implementation Plan

#### 10.1 Phase 1: Foundation (4 weeks)
1. **Week 1**: Core extension setup, manifest configuration
2. **Week 2**: Basic UI components and content script injection
3. **Week 3**: Initial LLM integration with simple prompting
4. **Week 4**: Basic extraction capabilities

#### 10.2 Phase 2: Agent System (6 weeks)
1. **Week 5-6**: Implement core agent architecture
2. **Week 7-8**: Develop specialized agents (planner, selector)
3. **Week 9-10**: Complete agent integration and orchestration

#### 10.3 Phase 3: UI & Experience (4 weeks)
1. **Week 11**: Element highlighting system
2. **Week 12**: Sample preview and feedback collection
3. **Week 13-14**: Settings page and configuration system

#### 10.4 Phase 4: Refinement (4 weeks)
1. **Week 15**: Performance optimization
2. **Week 16**: Error handling improvements
3. **Week 17**: Export enhancements
4. **Week 18**: Documentation and finishing touches

### 11. Development Best Practices

1. **Feature Branches**:
   - Use feature branches for all development
   - Pull requests with code review for merges
   - Maintain clean commit history

2. **Documentation**:
   - JSDoc for all functions and classes
   - README files for major components
   - Architecture diagrams kept updated

3. **Testing**:
   - Write tests alongside feature code
   - Maintain >80% test coverage
   - Test for edge cases and error conditions

4. **Performance**:
   - Regular performance profiling
   - Optimize critical paths
   - Monitor memory usage