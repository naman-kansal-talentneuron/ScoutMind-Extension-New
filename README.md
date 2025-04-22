# ScoutMind Chrome Extension

<img src="https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/icons/icon128.png" alt="ScoutMind Logo" width="120" align="right"/>

**ScoutMind** is an advanced Chrome extension designed to extract structured data from websites using natural language instructions. By leveraging local (Ollama) and potentially cloud-based Large Language Models (LLMs), ScoutMind interprets user requests, generates optimal extraction strategies, and delivers clean, structured datasets without requiring technical expertise in web scraping.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Choose your license -->

## Features (Up to Phase 3)

*   **Natural Language Instructions**: Describe the data you need in plain English (e.g., "Extract all product names and prices").
*   **AI-Powered Planning**: Automatically generates an extraction plan based on your request and page structure.
*   **AI-Powered Selector Generation**: Creates CSS selectors to target the desired data elements.
*   **Visual Feedback**: Highlights elements on the page as they are identified or extracted (via content script).
*   **Local LLM Support (Ollama)**: Perform extraction planning and selector generation locally for speed and privacy.
*   **Cloud LLM Support (Optional)**: Integrate with external providers like Mistral or OpenAI via the LLM Bridge (requires configuration).
*   **Structured Data Output**: View extracted data in a clean table format within the extension popup.
*   **Multi-Format Export**: Download extracted data as CSV, JSON, or XLSX (XLSX requires SheetJS library).
*   **Basic Error Recovery**: Attempts to find alternative selectors if initial ones fail.
*   **Cross-Origin Handling**: Implements header modifications (via Declarative Net Request) to mitigate common embedding restrictions (e.g., `X-Frame-Options`, `CSP`), though success is not guaranteed for all sites.
*   **Offscreen Document Usage**: Leverages Offscreen Documents for reliable background fetching and parsing.

## Architecture Overview

ScoutMind employs a multi-agent architecture running within the extension's service worker:

1.  **Orchestrator**: Manages the overall workflow.
2.  **Planner Agent**: Converts natural language instructions into a structured extraction plan using an LLM.
3.  **Selector Agent**: Generates and refines CSS selectors based on the plan and page HTML, using an LLM.
4.  **Extractor Agent**: Communicates with the content script to extract data using the generated selectors.
5.  **Validator Agent**: Cleans and validates the extracted data based on the plan's expected types.
6.  **Error Recovery Agent**: Attempts to find alternative selectors if extraction fails.

It uses an `LLMBridge` to abstract interactions with different LLM providers (local Ollama or external APIs). The UI is presented in a popup window, interacting with the background service worker and content scripts via standard Chrome extension messaging.

## Tech Stack

*   **Languages**: JavaScript (ES6+), HTML, CSS
*   **Core APIs**: Chrome Extension APIs (Manifest V3), `chrome.storage`, `chrome.scripting`, `chrome.declarativeNetRequest`, `chrome.offscreen`, `chrome.downloads`, `fetch`
*   **Local LLM**: [Ollama](https://ollama.com/) (required for core functionality)
*   **External LLMs (Optional)**: OpenAI, Mistral (via API)
*   **Libraries (Optional for Export)**: [SheetJS/xlsx](https://sheetjs.com/) (for `.xlsx` export)

## Project Structure
ScoutMind/
├── agents/                          # AI agent logic (runs in background)
│   ├── orchestrator.js
│   ├── planner-agent.js
│   ├── selector-agent.js
│   ├── extractor-agent.js
│   ├── validator-agent.js
│   └── error-recovery-agent.js
├── background/                      # Service worker and related background scripts
│   ├── background.js               # Main service worker
│   └── messaging.js                # Background-specific messaging utils
├── content/                        # Scripts injected into web pages
│   ├── content-script.js          # Main content script for DOM interaction
│   └── basic-highlighter.js       # Highlighter class
├── data/                          # Data processing, validation, export logic
│   ├── data-extractor.js         # Utils related to extraction process
│   ├── data-transformer.js       # Cleaning and restructuring data
│   ├── export-manager.js         # Handles CSV, JSON, XLSX export
│   └── selector-validator.js     # Validates selectors via content script
├── icons/                         # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── llm/                          # LLM interaction logic
│   ├── llm-bridge.js            # Interface for multiple LLM providers
│   ├── ollama-connector.js      # Connects to local Ollama instance
│   ├── external-connector.js    # Connects to cloud LLM APIs
│   ├── prompt-templates.js      # Stores reusable LLM prompts
│   └── response-parsers.js      # Utilities for parsing LLM responses
├── options/                      # Optional settings page UI
│   ├── options.html
│   ├── options.css
│   └── options.js
├── ui/                          # Popup UI files
│   ├── popup.html              # Popup window structure
│   ├── popup.css              # Combined styles
│   ├── popup.js               # Popup window logic
│   ├── components/            # Reusable UI components
│   │   ├── Header.js
│   │   ├── InputField.js
│   │   └── EventLog.js
│   └── styles/                # CSS files for the UI
│       ├── main.css          # Main styles
│       └── theme.css         # Theme variables
├── utils/                     # Shared utility functions
│   ├── storage-manager.js    # Wrapper for chrome.storage
│   ├── messaging.js          # General messaging functions
│   ├── dom-utils.js         # HTML parsing/manipulation
│   ├── logger.js            # Simple console logger
│   └── performance-monitor.js # Basic timing utilities
├── offscreen.html            # HTML for offscreen document
├── offscreen.js             # Script for offscreen document
├── manifest.json            # Extension configuration
└── README.md               # This file


## Setup and Installation

### Prerequisites

1.  **Google Chrome** or a Chromium-based browser (Brave, Edge, etc.).
2.  **Ollama**: Install Ollama from [ollama.com](https://ollama.com/).
3.  **Ollama Model**: Pull a model suitable for planning and selector generation. `llama3` is a good default.
    ```bash
    ollama pull llama3
    ```
    Ensure Ollama is running in the background. By default, it serves at `http://localhost:11434`.

### Installation Steps

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
    cd YOUR_REPO
    ```
2.  **(Optional) Install Dependencies**: If using build tools or external libraries (like SheetJS for XLSX export), install them:
    ```bash
    # Example if using npm (adjust if not needed)
    # npm install
    ```
    *Note: The current structure doesn't strictly require a build step or npm unless you add external libraries.*
3.  **Load the Extension in Chrome**:
    *   Open Chrome and navigate to `chrome://extensions/`.
    *   Enable **"Developer mode"** using the toggle switch in the top-right corner.
    *   Click the **"Load unpacked"** button.
    *   Select the directory where you cloned the repository (the folder containing `manifest.json`).
    *   The ScoutMind extension should now appear in your extensions list.

## Configuration

1.  **Ollama**:
    *   Ensure the Ollama application is running before using the extension.
    *   The extension defaults to connecting to Ollama at `http://localhost:11434`. If your Ollama instance runs elsewhere, you may need to modify the `baseURL` in `llm/ollama-connector.js` or add a setting in the options page (if implemented).
    *   Make sure the default model (`llama3` or as configured in `llm/ollama-connector.js`) is available in Ollama (`ollama list`).
2.  **External LLMs (Optional)**:
    *   To use providers like OpenAI or Mistral, you need to obtain API keys from their respective platforms.
    *   **IMPORTANT**: Do not hardcode API keys directly in the source code.
    *   You will need to securely store and load these keys. This could be implemented via:
        *   An **Options page** (`options/options.html`) where the user can enter their keys, which are then saved using `chrome.storage.local`.
        *   Modifying `background/background.js` in the `initializeServices` function to load keys from `chrome.storage` before initializing the `LLMBridge`.

## Usage

1.  Navigate to the web page you want to extract data from.
2.  Click the ScoutMind extension icon in your browser toolbar to open the popup.
3.  The current page URL should automatically load in the right-hand webview panel. If not, paste the URL and click "Load".
4.  In the "Extraction Instructions" field, describe the data you want to extract (e.g., "Get all job titles and company names", "Extract the main article text and author").
5.  Select the desired LLM Provider (Ollama is the default local option).
6.  Click the "Extract Data" button.
7.  ScoutMind will:
    *   Generate a plan.
    *   Generate CSS selectors.
    *   Highlight the elements matching the primary selectors on the page (via content script).
    *   Extract the data.
    *   Validate and clean the data.
    *   Display the results in a table in the popup (replacing the webview).
8.  Review the extracted data.
9.  Select an export format (CSV, JSON, XLSX) and click "Download" to save the data.
10. Click the "X" button on the results panel to close it and return to the webview.

## Development

*   **Loading Changes**: After making code changes, go to `chrome://extensions/`, find the ScoutMind extension card, and click the reload icon (🔄). You may also need to refresh the target web page.
*   **Debugging**:
    *   **Popup**: Right-click inside the popup window and select "Inspect".
    *   **Service Worker**: On the `chrome://extensions/` page, click the "Service worker" link on the ScoutMind card.
    *   **Content Scripts**: Open the Developer Tools on the target web page (`F12` or right-click -> "Inspect") and look at the Console tab. You can also find the content scripts under the "Sources" tab -> "Content scripts".
    *   **Offscreen Document**: Navigate to `chrome://extensions/?id=YOUR_EXTENSION_ID` (replace with your extension's ID), find the "Inspect views" section, and click the `offscreen.html` link.
*   **Contributing**: (Add guidelines if this is an open project - e.g., fork, branch, PR).

## Troubleshooting

*   **"Could not connect to Ollama..."**: Ensure the Ollama application is running and accessible at `http://localhost:11434`. Check the Ollama server logs.
*   **"Ollama model '...' not found"**: Pull the required model using `ollama pull MODEL_NAME`.
*   **Extraction Fails / No Data**:
    *   The website might use heavy JavaScript rendering, making simple selector generation difficult.
    *   The website might have strong anti-scraping measures.
    *   The LLM might have generated incorrect selectors. Check the console logs in the service worker and content script for errors. Try refining the instructions.
*   **Webview Blank / Shows Error**: The target site likely has strict `X-Frame-Options` or `Content-Security-Policy` headers preventing it from being embedded in an iframe, even with header modifications. Extraction might still work via background fetching, but the visual preview is blocked.
*   **Highlighting Issues**: Ensure the content script is injected correctly (check manifest `matches` and console logs on the target page). CSS conflicts on the target page could also interfere.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details (or choose another license).
