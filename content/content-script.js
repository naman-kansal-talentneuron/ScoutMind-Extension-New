// content/content-script.js

// --- Initialization ---
let highlighter = null;
let isInitialized = false;

function initializeContentScript() {
    if (isInitialized) {
        console.log("Content script already initialized.");
        return;
    }
    console.log("ScoutMind Content Script Initializing...");

    // Check if the highlighter class is available (assuming basic-highlighter.js is loaded before this)
    if (typeof BasicHighlighter !== 'undefined') {
        highlighter = new BasicHighlighter();
    } else {
        console.error("BasicHighlighter class not found. Highlighting disabled.");
    }

    // Add listener for messages from background/popup
    chrome.runtime.onMessage.addListener(handleMessages);

    // Add listener for page unload to clean up
    window.addEventListener('unload', cleanupContentScript);

    isInitialized = true;
    console.log("ScoutMind Content Script Initialized Successfully.");

    // Optional: Send a message to background confirming injection/initialization
    // chrome.runtime.sendMessage({ action: "contentScriptReady", url: window.location.href });
}

// --- Message Handler ---
function handleMessages(request, sender, sendResponse) {
    // Optional: Check sender origin if needed (e.g., sender.id === chrome.runtime.id)
    console.log("Content script received message:", request);
    let isAsync = false; // Flag for async responses

    switch (request.action) {
        case "highlightElements":
            if (highlighter) {
                const count = highlighter.highlightElements(request.selector, request.category || 0);
                sendResponse({ success: true, highlightedCount: count });
            } else {
                sendResponse({ success: false, error: "Highlighter not available." });
            }
            break;

        case "clearHighlights":
            if (highlighter) {
                highlighter.clearHighlights(request.selector); // selector can be null/undefined to clear all
                sendResponse({ success: true, message: "Highlights cleared." });
            } else {
                sendResponse({ success: false, error: "Highlighter not available." });
            }
            break;

        case "getPageContent":
            // Consider security/performance implications of sending full HTML
            // Maybe send only body or specific parts if sufficient
            sendResponse({ success: true, htmlContent: document.documentElement.outerHTML });
            break;

        case "extractData":
            try {
                const data = extractDataFromSelector(request.selector, request.extractionType || 'text'); // Allow specifying type (text, html, attribute)
                sendResponse({ success: true, data: data });
            } catch (error) {
                console.error(`Error extracting data for selector "${request.selector}":`, error);
                sendResponse({ success: false, error: `Extraction error: ${error.message}` });
            }
            break;

        case "testSelector":
            try {
                const elements = document.querySelectorAll(request.selector);
                sendResponse({ success: true, count: elements.length });
            } catch (error) {
                // This usually happens with invalid selectors
                console.error(`Invalid selector "${request.selector}":`, error);
                sendResponse({ success: false, error: `Invalid selector: ${error.message}`, count: 0 });
            }
            break;

        case "getElementByXPath": // Example for XPath if needed
             try {
                const result = document.evaluate(request.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const element = result.singleNodeValue;
                // Send back some identifiable info, not the element itself
                sendResponse({ success: true, found: !!element, outerHTML: element ? element.outerHTML.substring(0, 200) + '...' : null });
             } catch (error) {
                 console.error(`Error evaluating XPath "${request.xpath}":`, error);
                 sendResponse({ success: false, error: `XPath error: ${error.message}` });
             }
             break;

        // Add more actions as needed (e.g., for interactive selection, triggering clicks for pagination)
        case "clickElement":
             isAsync = true; // Clicking might trigger navigation or async updates
             try {
                 const element = document.querySelector(request.selector);
                 if (element) {
                     console.log(`Clicking element:`, element);
                     element.click();
                     // It's hard to know exactly when the page finishes updating after a click.
                     // A simple delay might work for some cases, but MutationObservers or
                     // waiting for specific elements might be more robust.
                     setTimeout(() => {
                         sendResponse({ success: true, message: "Click initiated." });
                     }, 500); // Short delay, adjust as needed
                 } else {
                     sendResponse({ success: false, error: `Element not found for selector: ${request.selector}` });
                 }
             } catch (error) {
                 console.error(`Error clicking element "${request.selector}":`, error);
                 sendResponse({ success: false, error: `Click error: ${error.message}` });
             }
             break;


        default:
            console.log(`Content script ignoring unknown action: ${request.action}`);
            // No response needed for unhandled actions
            break;
    }

    return isAsync; // Return true if sendResponse will be called asynchronously
}

// --- Data Extraction Logic ---
/**
 * Extracts data based on a selector and type.
 * @param {string} selector - CSS selector.
 * @param {'text'|'html'|'attribute'} [type='text'] - Type of data to extract.
 * @param {string} [attributeName='href'] - Attribute name if type is 'attribute'.
 * @returns {Array<string|null>} - Array of extracted data.
 */
function extractDataFromSelector(selector, type = 'text', attributeName = 'href') {
    const elements = document.querySelectorAll(selector);
    const data = [];
    elements.forEach(el => {
        let value = null;
        switch (type) {
            case 'html':
                value = el.innerHTML;
                break;
            case 'attribute':
                value = el.getAttribute(attributeName);
                break;
            case 'text':
            default:
                // Try innerText first (respects visibility), fallback to textContent
                value = el.innerText && el.innerText.trim() ? el.innerText.trim() : (el.textContent ? el.textContent.trim() : null);
                break;
        }
        data.push(value);
    });
    return data;
}


// --- Cleanup Logic ---
function cleanupContentScript() {
    console.log("ScoutMind Content Script Cleaning up...");
    if (highlighter) {
        highlighter.destroy();
        highlighter = null;
    }
    // Remove message listener if possible (less critical in MV3)
    // chrome.runtime.onMessage.removeListener(handleMessages); // Might cause issues if listener is needed immediately on reload
    isInitialized = false;
    console.log("ScoutMind Content Script Cleanup Complete.");
}

// --- Run Initialization ---
// Use a simple check to avoid running multiple times if injected programmatically
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    // DOM is already ready
    initializeContentScript();
}

