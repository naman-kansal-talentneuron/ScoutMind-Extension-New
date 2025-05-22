// scout-mind-extension/src/background/background.ts
import { Logger, LogLevel } from '../utils/logger';
import { StorageManager } from '../utils/storageManager';
import { LLMBridge, LLMBridgeConfig } from '../llm/llmBridge'; // Assuming LLMBridgeConfig is exported
import { AgentOrchestrator } from '../agents/orchestrator';
// Import any necessary types/interfaces for request/response payloads if defined

const logger = new Logger('BackgroundService', 'debug'); // Set default log level, e.g., 'debug'

// Settings storage key
const LLM_SETTINGS_KEY = 'llm_config_settings';

// Interface for LLM settings (mirror from options.tsx or a shared types file)
interface LLMSettings {
  openaiApiKey?: string;
  mistralApiKey?: string;
  ollamaEndpoint?: string;
  defaultProvider?: string; // Assuming this might be a setting
}


logger.info("ScoutMind SMX Service Worker loaded and initializing backend services...");

let storageManager: StorageManager;
let llmBridge: LLMBridge;
let agentOrchestrator: AgentOrchestrator;
let servicesInitialized = false;

async function initializeServices() {
  try {
    storageManager = new StorageManager('local', logger.getLevel() as LogLevel);
    logger.info('StorageManager instantiated.');

    // Load LLM config from storage or use defaults
    const savedSettings = await storageManager.getItem<LLMSettings>(LLM_SETTINGS_KEY);
    logger.info('Initial LLM settings loaded from storage:', savedSettings);

    const llmBridgeConfig: LLMBridgeConfig = {
      defaultProvider: savedSettings?.defaultProvider || 'ollama',
      ollama: { // Ensure ollama property exists
        endpoint: savedSettings?.ollamaEndpoint || 'http://localhost:11434',
      },
      external: { // Ensure external property exists for API keys
        apiKeys: {
          openai: savedSettings?.openaiApiKey,
          mistral: savedSettings?.mistralApiKey,
        },
      },
      logLevel: logger.getLevel() as LogLevel,
    };

    llmBridge = new LLMBridge(llmBridgeConfig, new Logger('LLMBridge', logger.getLevel() as LogLevel));
    await llmBridge.initialize();
    logger.info('LLMBridge initialized with current settings.');

    agentOrchestrator = new AgentOrchestrator(
      llmBridge,
      new Logger('AgentOrchestrator', logger.getLevel() as LogLevel),
      sendMessageToContentScript,
      sendMessageToOffscreenDoc // Renamed for clarity
    );
    logger.info('AgentOrchestrator instantiated.');
    servicesInitialized = true;
    logger.info('All backend services initialized successfully.');

  } catch (error: any) {
    logger.error('Error during service initialization:', error.message, error);
    servicesInitialized = false;
  }
}

// --- Communication Functions ---
async function sendMessageToContentScript(tabId: number, action: string, payload?: any): Promise<any> {
  logger.debug(`Sending message to content script on tab ${tabId}:`, { action, payload });
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action, ...(payload || {}) });
    logger.debug(`Response from content script on tab ${tabId}:`, response);
    return response;
  } catch (error: any) {
    logger.error(`Error sending message to content script on tab ${tabId}: ${error.message}`, { action, payload, error });
    // It's common for this to error if the content script isn't injected on the page (e.g., chrome:// pages)
    // Or if the tab is not accessible.
    if (error.message?.includes("Could not establish connection") || error.message?.includes("No matching message handler")) {
        // Non-critical error if content script is not there or not listening for this specific action
        return { success: false, error: "Content script not available or not responding.", details: error.message };
    }
    throw error; // Re-throw other errors
  }
}

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// hasOffscreenDocument function (ensure it's the version from Phase 2, Step 5, or similar)
async function hasOffscreenDocument(): Promise<boolean> {
   if (!chrome.offscreen) {
       logger.debug('chrome.offscreen API not available in this context.'); // Use debug_ for less critical logs
       return false;
   }
   try {
       // @ts-ignore clients is not in d.ts for offscreen, but available in new versions
       const matchedClients = await globalThis.clients?.matchAll() || [];
       for (const client of matchedClients) {
           if (client.url && client.url.endsWith(OFFSCREEN_DOCUMENT_PATH)) {
               logger.debug(`Found active offscreen document via clients.matchAll(): ${client.url}`);
               return true;
           }
       }
       // Fallback for older @types/chrome or if above fails.
       if (chrome.offscreen.hasDocument) {
           const hasDoc = await chrome.offscreen.hasDocument();
           logger.debug(`chrome.offscreen.hasDocument() reported: ${hasDoc}`);
           return hasDoc;
       }
   } catch (e: any) {
       logger.warn(`Error checking for offscreen document: ${e.message}`, e);
   }
   logger.debug('No active offscreen document found by any check.');
   return false;
}


async function sendMessageToOffscreenDoc(action: string, payload?: any, retryAttempt = 0): Promise<any> {
  logger.debug(`Attempting to send message to offscreen document (attempt ${retryAttempt + 1}):`, { action, payload });
  if (!chrome.offscreen) {
    logger.error('chrome.offscreen API not available.');
    return { success: false, error: 'Offscreen API not available.' };
  }

  if (!(await hasOffscreenDocument())) {
    logger.info('No existing offscreen document found. Creating one...');
    try {
      // Attempt to close any old one first, in case it's in a bad state
      // This might throw if no document exists, so catch it.
      try { await chrome.offscreen.closeDocument(); } catch (e) { /* ignore */ }

      await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['DOM_PARSER', 'USER_AGENT'], // Match reasons in manifest
        justification: 'To fetch and parse HTML for data extraction.',
      });
      logger.info('Offscreen document created successfully.');
    } catch (error: any) {
      logger.error('Error creating offscreen document:', error.message, error);
      return { success: false, error: `Failed to create offscreen document: ${error.message}` };
    }
  } else {
    logger.info('Offscreen document already exists.');
  }

  logger.debug('Sending message to offscreen document via chrome.runtime.sendMessage...');
  try {
    const response = await chrome.runtime.sendMessage({
      // No specific target needed for extension's own offscreen document
      action: action,
      ...payload,
    });
    logger.debug('Received response from offscreen document:', response);
    if (response === undefined && chrome.runtime.lastError) {
       // Handle cases where sendResponse might not have been called in offscreen
       // or other runtime errors occurred during messaging.
       throw new Error(chrome.runtime.lastError.message || "Undefined response from offscreen document.");
    }
    return response;
  } catch (error: any) {
    logger.error('Error sending message to offscreen document or receiving response:', error.message, error);
    
    if ((error.message?.includes("Could not establish connection") || 
         error.message?.includes("No PipedPiper instance") ||
         error.message?.includes("Target context invalidated")) 
        && retryAttempt < 1) {
      logger.warn("Connection to offscreen document failed. Attempting to close, recreate and retry once.");
      try { await chrome.offscreen.closeDocument(); } catch (e) { /* ignore if already closed or no doc */ }
      return sendMessageToOffscreenDoc(action, payload, retryAttempt + 1); // Retry
    }
    return { success: false, error: `Message passing to offscreen document failed: ${error.message}` };
  }
}


// --- Event Listeners ---
chrome.runtime.onInstalled.addListener((details) => {
  logger.info("ScoutMind SMX Extension Installed/Updated.", details);
  initializeServices(); // Initialize services on installation/update
});

// Note: MV3 service workers are event-driven. `onStartup` is not guaranteed.
// Persistent initialization should ideally happen in `onInstalled` or be triggered by other events.
// If services are not initialized, messages might fail.
// For simplicity here, we call initializeServices() at top level too, but this might need refinement.
if (!servicesInitialized) {
    (async () => {
        await initializeServices();
    })();
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.info("Received message:", request, "from sender:", sender);

  if (!servicesInitialized && request.action !== "ping_background") {
    logger.error("Services not initialized. Cannot process request:", request.action);
    sendResponse({ success: false, error: "Background services are not ready." });
    return false; 
  }

  if (request.action === "ping_background") {
    logger.info("Responding to ping_background");
    sendResponse({ success: true, message: "pong_from_background", servicesInitialized });
    return false; // Synchronous response
  }

  if (request.action === "process_extraction_request") {
    if (!request.data || !request.data.naturalLanguageInstruction || !request.data.targetUrl || typeof request.data.tabId !== 'number') {
      logger.error("Invalid process_extraction_request: Missing data fields.", request.data);
      sendResponse({ success: false, error: "Invalid request data. Required: naturalLanguageInstruction, targetUrl, tabId." });
      return false; // Synchronous response for invalid request
    }
    
    const { naturalLanguageInstruction, targetUrl, tabId } = request.data;
    logger.info(`Processing extraction request for URL: ${targetUrl} with instruction: "${naturalLanguageInstruction}" on tab ${tabId}`);

    agentOrchestrator.processRequest(naturalLanguageInstruction, targetUrl, undefined /* llmProvider */, tabId)
      .then(result => {
        logger.info("Extraction processing completed. Result:", result);
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        logger.error("Error during extraction processing:", error.message, error);
        sendResponse({ success: false, error: `Extraction failed: ${error.message}` });
      });
    return true; // Indicates that sendResponse will be called asynchronously
  }
  
  // Handle content_script_ready message
  if (request.action === "content_script_ready") {
    logger.info(`Content script ready on URL: ${request.data?.url} (Tab ID: ${sender.tab?.id})`);
    // Optionally, do something with this info, like track active tabs
    sendResponse({ success: true, message: "Background acknowledged content_script_ready."});
    return false;
  }

  // Default: if no specific action matched for a synchronous response
  // logger.warn(`No specific handler for action: ${request.action}. If async, ensure 'return true;' was used.`);
  // sendResponse({ success: false, error: `Unknown action: ${request.action}`});
  
  else if (request.action === "load_llm_settings") {
    (async () => {
      try {
        const settings = await storageManager.getItem<LLMSettings>(LLM_SETTINGS_KEY);
        logger.info("Loaded LLM settings from storage for options page:", settings);
        sendResponse({ success: true, data: settings || {} }); // Send empty obj if null/undefined
      } catch (e: any) {
        logger.error("Error loading LLM settings for options page:", e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; // Async response
  } 
  
  else if (request.action === "save_llm_settings") {
    if (!request.data) {
      logger.error("Save LLM settings: No data provided.");
      sendResponse({ success: false, error: "No settings data provided." });
      return false;
    }
    (async () => {
      try {
        const newSettings: LLMSettings = request.data;
        await storageManager.setItem(LLM_SETTINGS_KEY, newSettings);
        logger.info("LLM settings saved to storage:", newSettings);
        
        if (llmBridge) {
          const newLlmBridgeConfig: Partial<LLMBridgeConfig> = {
            defaultProvider: newSettings.defaultProvider, // if defaultProvider is part of LLMSettings
            ollama: { // Ensure ollama property exists
              endpoint: newSettings.ollamaEndpoint,
            },
            external: { // Ensure external property exists
              apiKeys: {
                openai: newSettings.openaiApiKey,
                mistral: newSettings.mistralApiKey,
              },
              // defaultModel can also be part of LLMSettings and mapped here
            },
            // Pass other relevant parts of newSettings to LLMBridgeConfig
          };
          llmBridge.updateConfig(newLlmBridgeConfig); 
          logger.info("LLMBridge config updated with new settings.");
        }
        sendResponse({ success: true });
      } catch (e: any) {
        logger.error("Error saving LLM settings:", e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; // Async response
  }

  return false; 
});

logger.info('Background script message listeners set up.');
