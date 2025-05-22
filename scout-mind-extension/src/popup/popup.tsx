import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Ensure Tailwind styles are imported
import { Logger } from '../utils/logger';

const logger = new Logger('Popup');

// Define a type for the extraction result for better state management
interface ExtractionResponseData {
  // Define based on what AgentOrchestrator.processRequest returns
  // Example:
  plan?: any;
  selectors?: any;
  data?: any;
  issues?: any;
  // Add any other fields that might come from the orchestrator's response
}

const Popup = () => {
  const [currentTabId, setCurrentTabId] = useState<number | undefined>(undefined);
  const [urlInput, setUrlInput] = useState<string>('');
  const [instructionInput, setInstructionInput] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('ollama'); // Default provider
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResponseData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // const [extractionIssues, setExtractionIssues] = useState<any[]>([]); // Optional separate state for issues

  const llmProviders = ['ollama', 'openai', 'mistral']; // Static list for now

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        setCurrentTabId(tabs[0].id);
        logger.info(`Current active tab ID: ${tabs[0].id}`);
        if (tabs[0].url && !tabs[0].url.startsWith('chrome://') && !tabs[0].url.startsWith('about:')) {
          setUrlInput(tabs[0].url);
        } else {
          setUrlInput(''); // Clear URL if it's a chrome or about page
        }
      } else {
        logger.warn("Could not get active tab ID. User might be on a new tab page or other restricted page.");
        // Error message for no tab ID is handled in JSX rendering
      }
    });
  }, []);

  const handleExtractData = () => {
    if (!currentTabId) {
      // This case should ideally be prevented by disabling the button, but as a fallback:
      setErrorMessage("Active tab ID not found. Please ensure you are on a valid webpage.");
      logger.error("No active tab ID available for extraction.");
      return;
    }
    if (!urlInput.trim()) {
      setErrorMessage("Target URL is required.");
      return;
    }
    if (!instructionInput.trim()) {
      setErrorMessage("Extraction instructions are required.");
      return;
    }

    logger.info(`Starting extraction for URL: ${urlInput} with instruction: "${instructionInput}" using provider: ${selectedProvider}`);
    setIsLoading(true);
    setExtractionResult(null);
    setErrorMessage(null);
    // setExtractionIssues([]); // Clear previous issues

    const requestPayload = {
      action: "process_extraction_request",
      data: {
        naturalLanguageInstruction: instructionInput,
        targetUrl: urlInput,
        tabId: currentTabId,
        llmProvider: selectedProvider, // Pass selected provider
      }
    };

    chrome.runtime.sendMessage(requestPayload, (response) => {
      setIsLoading(false);
      if (chrome.runtime.lastError) {
        logger.error("Error sending extraction request:", chrome.runtime.lastError.message);
        setErrorMessage(`Communication Error: ${chrome.runtime.lastError.message}`);
      } else {
        logger.info("Received response for extraction request:", response);
        if (response?.success) {
          setExtractionResult(response.data); // Main data
          if (response.data?.issues && Array.isArray(response.data.issues) && response.data.issues.length > 0) {
            const issuesString = response.data.issues.map((issue: any) => 
              `Issue Type: ${issue.type || 'N/A'}, Message: ${issue.message || issue.error || 'No details'}${issue.dpId ? ', DP ID: ' + issue.dpId : ''}`
            ).join('\n');
            // Append issues to a general message or use a dedicated display area.
            // For simplicity, appending to error message here.
            setErrorMessage(prev => {
                const baseMessage = "Extraction completed with issues.";
                const newIssuesMessage = `Issues Found:\n${issuesString}`;
                return prev ? `${prev}\n\n${newIssuesMessage}` : `${baseMessage}\n${newIssuesMessage}`;
            });
            // Or set a separate state: setExtractionIssues(response.data.issues);
          } else if (!response.data && response.success) {
            logger.info("Extraction successful but no data returned.");
            setErrorMessage("Extraction successful, but no data was returned from the page.");
          }
        } else { // response.success === false
          let detailedError = response?.error || "Unknown error during extraction.";
          // Check if response.data (which could be OrchestrationResult) also has an error or issues
          if (response?.data) {
            if (response.data.error && response.data.error !== detailedError) {
                detailedError += ` Details: ${response.data.error}`;
            }
            if (response.data.issues && Array.isArray(response.data.issues) && response.data.issues.length > 0) {
              const issuesString = response.data.issues.map((issue: any) => 
                `Issue Type: ${issue.type || 'N/A'}, Message: ${issue.message || issue.error || 'No details'}${issue.dpId ? ', DP ID: ' + issue.dpId : ''}`
              ).join('\n');
              detailedError += `\n\nIssues Found:\n${issuesString}`;
            }
          }
          setErrorMessage(detailedError);
          if(response?.data) setExtractionResult(response.data); // Store partial data if available on error
        }
      }
    });
  };
  
  // Remove or comment out old ping/test buttons and their handlers
  // const handlePingBackground = () => { /* ... */ };
  // const handlePingContentScript = () => { /* ... */ };
  // const handleTestExtraction = () => { /* ... */ };


  return (
    <div className="p-4 space-y-4 w-[400px] bg-slate-50">
      <h1 className="text-xl font-semibold text-slate-700 mb-3">ScoutMind SMX</h1>

      <div>
        <label htmlFor="url-input" className="block text-sm font-medium text-slate-600 mb-1">Target URL:</label>
        <input
          type="text"
          id="url-input"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://example.com"
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-slate-100"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="instruction-input" className="block text-sm font-medium text-slate-600 mb-1">Extraction Instructions:</label>
        <textarea
          id="instruction-input"
          value={instructionInput}
          onChange={(e) => setInstructionInput(e.target.value)}
          rows={3}
          placeholder="e.g., Extract all product names, prices, and ratings"
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-slate-100"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="provider-select" className="block text-sm font-medium text-slate-600 mb-1">LLM Provider:</label>
        <select
          id="provider-select"
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-slate-100"
          disabled={isLoading}
        >
          {llmProviders.map(provider => (
            <option key={provider} value={provider}>{provider.charAt(0).toUpperCase() + provider.slice(1)}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleExtractData}
        disabled={isLoading || currentTabId === undefined}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Extracting...' : 'Extract Data'}
      </button>
      
      {currentTabId === undefined && !isLoading && 
        <p className="text-sm text-red-600 text-center p-2 bg-red-100 rounded-md">
          ScoutMind needs an active page. Please navigate to a webpage and reload the popup if necessary.
        </p>
      }

      {errorMessage && (
         <div className={`mt-3 p-3 rounded-md text-xs ${extractionResult && extractionResult.issues && extractionResult.issues.length > 0 ? 'bg-yellow-100 border border-yellow-300 text-yellow-700' : 'bg-red-100 border border-red-300 text-red-700'}`}>
          <h3 className="font-semibold mb-1">{extractionResult && extractionResult.issues && extractionResult.issues.length > 0 ? 'Extraction Completed with Issues:' : 'Error:'}</h3>
          <pre className="whitespace-pre-wrap break-all">{errorMessage}</pre>
        </div>
      )}

      {extractionResult && (!extractionResult.issues || extractionResult.issues.length === 0) && !errorMessage && (
        <div className="mt-3 p-3 bg-green-50 text-xs border border-slate-200 rounded-md">
          <h3 className="font-semibold mb-1 text-slate-700">Extraction Result (Success):</h3>
          <pre className="whitespace-pre-wrap break-all bg-slate-100 p-2 rounded text-slate-600 max-h-60 overflow-auto">
            {JSON.stringify(extractionResult.data || extractionResult, null, 2)} 
          </pre>
        </div>
      )}
      
      {/* Display partial data even if there were issues, but not if it's already part of errorMessage */}
      {extractionResult && extractionResult.issues && extractionResult.issues.length > 0 && extractionResult.data && (
         <div className="mt-3 p-3 bg-slate-50 text-xs border border-slate-200 rounded-md">
           <h3 className="font-semibold mb-1 text-slate-700">Partial Data (if any):</h3>
           <pre className="whitespace-pre-wrap break-all bg-slate-100 p-2 rounded text-slate-600 max-h-60 overflow-auto">
             {JSON.stringify(extractionResult.data, null, 2)}
           </pre>
         </div>
      )}
      
      {/* Comment out or remove old test buttons if they exist in the file */}
      {/* 
      // const handlePingBackground = () => {
      //   logger.info("Sending 'ping_background' to service worker...");
      //   chrome.runtime.sendMessage({ action: "ping_background" }, (response) => {
      //     if (chrome.runtime.lastError) {
      //       logger.error("Error pinging background:", chrome.runtime.lastError.message);
      //       alert("Error pinging background: " + chrome.runtime.lastError.message);
      //     } else {
      //       logger.info("Received from background:", response);
      //       alert("From Background: " + response?.message + " (Services initialized: " + response?.servicesInitialized + ")");
      //     }
      //   });
      // };

      // const handlePingContentScript = () => {
      //   logger.info("Sending 'ping_content' to content script...");
      //   if (!currentTabId) {
      //        logger.error("No active tab ID available for pinging content script.");
      //        alert("No active tab ID found.");
      //        return;
      //   }
      //   chrome.tabs.sendMessage(currentTabId, { action: "ping_content" }, (response) => {
      //     if (chrome.runtime.lastError) {
      //       logger.error("Error pinging content script:", chrome.runtime.lastError.message);
      //       alert("Error pinging content script: " + chrome.runtime.lastError.message);
      //     } else {
      //       logger.info("Received from content script:", response);
      //       alert("From Content Script: " + response?.message + " on URL: " + response?.url);
      //     }
      //   });
      // };

      // const handleTestExtraction = () => { // Old test button
      //   logger.info("Sending 'process_extraction_request' to service worker...");
      //   if (currentTabId === undefined) {
      //       logger.error("No active tab ID available for extraction test.");
      //       alert("Active tab ID not found. Cannot run extraction test.");
      //       return;
      //   }
      //   const requestPayload = {
      //     action: "process_extraction_request",
      //     data: {
      //       naturalLanguageInstruction: "Extract the main title and the first paragraph.",
      //       targetUrl: "https://example.com", 
      //       tabId: currentTabId 
      //     }
      //   };
      //   chrome.runtime.sendMessage(requestPayload, (response) => {
      //     if (chrome.runtime.lastError) {
      //       logger.error("Error sending extraction request:", chrome.runtime.lastError.message);
      //       alert("Error sending extraction request: " + chrome.runtime.lastError.message);
      //     } else {
      //       logger.info("Received response for extraction request:", response);
      //       if (response?.success) {
      //         alert("Extraction Test - Success (simulated): " + JSON.stringify(response.data, null, 2));
      //       } else {
      //         alert("Extraction Test - Failed (simulated): " + response?.error + "\nDetails: " + JSON.stringify(response.data, null, 2));
      //       }
      //     }
      //   });
      // };
      */}
    </div>
  );
};

const container = document.getElementById('popup-root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
} else {
  logger.error("Popup root element 'popup-root' not found in popup.html.");
}
