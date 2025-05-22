import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Import TailwindCSS styles
import { Logger } from '../utils/logger';

const logger = new Logger('OptionsPage');

interface LLMSettings {
  openaiApiKey?: string;
  mistralApiKey?: string;
  ollamaEndpoint?: string;
  // Add other settings like defaultProvider if managed here
}

const Options = () => {
  const [settings, setSettings] = useState<LLMSettings>({
    openaiApiKey: '',
    mistralApiKey: '',
    ollamaEndpoint: 'http://localhost:11434', // Default common endpoint
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // For initial loading
  const [isSaving, setIsSaving] = useState<boolean>(false); // For save button state

  useEffect(() => {
    logger.info("Requesting to load LLM settings.");
    setIsLoading(true); // Ensure loading state is true at the start
    chrome.runtime.sendMessage({ action: "load_llm_settings" }, (response) => {
      setIsLoading(false);
      if (chrome.runtime.lastError) {
        logger.error("Error loading settings (communication):", chrome.runtime.lastError.message);
        setStatusMessage(`Communication Error loading settings: ${chrome.runtime.lastError.message}`);
      } else if (response?.success && response.data) {
        logger.info("LLM settings loaded:", response.data);
        setSettings(prev => ({ ...prev, ...response.data }));
        // setStatusMessage("Settings loaded."); // Optional: brief success message on load
      } else if (response?.error) {
        logger.error("Failed to load settings (application):", response.error);
        setStatusMessage(`Failed to load settings: ${response.error}`);
      } else {
        logger.info("No settings found or unexpected response while loading, using defaults.");
        // Keep defaults already set in useState
        // setStatusMessage("No saved settings found. Using defaults."); // Optional
      }
      // setTimeout(() => setStatusMessage(null), 3000); // Optional: auto-clear load status
    });
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setSettings(prevSettings => ({
      ...prevSettings,
      [name]: value,
    }));
  };

  const handleSaveSettings = (event: React.FormEvent) => {
    event.preventDefault();
    logger.info("Saving LLM settings:", settings);
    setIsSaving(true);
    setStatusMessage("Saving...");

    chrome.runtime.sendMessage({ action: "save_llm_settings", data: settings }, (response) => {
      setIsSaving(false);
      if (chrome.runtime.lastError) {
        logger.error("Error saving settings (communication):", chrome.runtime.lastError.message);
        setStatusMessage(`Communication Error: ${chrome.runtime.lastError.message}`);
      } else if (response?.success) {
        logger.info("LLM settings saved successfully.");
        setStatusMessage("Settings saved successfully!");
      } else {
        logger.error("Failed to save settings (application):", response?.error);
        setStatusMessage(`Failed to save: ${response?.error || 'Unknown application error'}`);
      }
      setTimeout(() => setStatusMessage(null), 3000); // Clear message after 3s
    });
  };
  
  if (isLoading) {
     return <div className="text-center p-10">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">ScoutMind Settings</h1>
      
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div>
          <label htmlFor="ollamaEndpoint" className="block text-sm font-medium text-slate-700">Ollama Endpoint URL:</label>
          <input
            type="text"
            name="ollamaEndpoint"
            id="ollamaEndpoint"
            value={settings.ollamaEndpoint || ''}
            onChange={handleChange}
            placeholder="e.g., http://localhost:11434"
            className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="openaiApiKey" className="block text-sm font-medium text-slate-700">OpenAI API Key:</label>
          <input
            type="password"
            name="openaiApiKey"
            id="openaiApiKey"
            value={settings.openaiApiKey || ''}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="mistralApiKey" className="block text-sm font-medium text-slate-700">Mistral API Key:</label>
          <input
            type="password"
            name="mistralApiKey"
            id="mistralApiKey"
            value={settings.mistralApiKey || ''}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        
        {/* Add other settings fields here, e.g., default provider selection */}

        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
          {statusMessage && <p className={`text-sm ${statusMessage.startsWith('Error') || statusMessage.startsWith('Failed') || statusMessage.startsWith('Communication Error') ? 'text-red-600' : 'text-green-600'}`}>{statusMessage}</p>}
        </div>
      </form>
    </div>
  );
};

const container = document.getElementById('options-root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>
  );
} else {
  logger.error("Options root element 'options-root' not found in options.html.");
}
