// scout-mind-extension/src/content/content.ts
import { Logger } from '../utils/logger';
import { Highlighter } from './highlighter';
import './contentStyles.css'; // Inject styles

const logger = new Logger('ContentScript');
const highlighter = new Highlighter(logger); // Pass existing logger instance

logger.info(`ScoutMind SMX Content Script loaded on: ${window.location.href}`);

/**
 * Sends a message to the background service worker.
 * @param payload The message payload.
 */
const sendMessageToBackground = (payload: any) => {
  logger.log("SMX Content Script: Sending message to background:", payload);
  chrome.runtime.sendMessage(payload, (response) => {
    if (chrome.runtime.lastError) {
      logger.error("SMX Content Script: Error sending message to background:", chrome.runtime.lastError.message);
    } else {
      logger.log("SMX Content Script: Received response from background:", response);
    }
  });
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.log("ScoutMind SMX Content Script received message:", { request, sender });

  if (request.action === "ping_content") {
    logger.log("SMX Content Script: Responding to ping_content");
    sendResponse({ success: true, message: "pong_from_content", url: window.location.href });
    return false; // Synchronous response
  }

  // Example:
  // if (request.action === "get_page_title") {
  //   sendResponse({ success: true, title: document.title });
  //   return false;
  // }

  // If no specific action matched and no async response is planned
  
  else if (request.action === "highlight_elements") {
    if (typeof request.selector === 'string') {
      logger.info(`Received request to highlight elements with selector: ${request.selector}`);
      const count = highlighter.highlightElementsBySelector(request.selector, request.category);
      sendResponse({ success: true, highlightedCount: count });
    } else {
      logger.error("Invalid 'highlight_elements' request: selector missing or not a string.", request);
      sendResponse({ success: false, error: "Selector is missing or invalid." });
    }
    return false; // Synchronous response
  }

  else if (request.action === "clear_highlights") {
    logger.info("Received request to clear highlights.", request.selector ? `Selector: ${request.selector}` : "All highlights.");
    highlighter.clearHighlights(request.selector); // selector can be undefined
    sendResponse({ success: true, message: "Highlights cleared." });
    return false; // Synchronous response
  }
  
  return false;
});

// Inform the background script that the content script is ready
sendMessageToBackground({
  action: "content_script_ready",
  data: {
    url: window.location.href,
    title: document.title,
  },
});

// Example of how to inject a simple UI element (for later use)
// const showOverlay = () => {
//   const overlayId = 'scoutmind-smx-overlay';
//   if (document.getElementById(overlayId)) return;

//   const overlay = document.createElement('div');
//   overlay.id = overlayId;
//   overlay.style.position = 'fixed';
//   overlay.style.top = '10px';
//   overlay.style.right = '10px';
//   overlay.style.padding = '10px';
//   overlay.style.background = 'rgba(0,0,0,0.7)';
//   overlay.style.color = 'white';
//   overlay.style.zIndex = '999999';
//   overlay.style.borderRadius = '5px';
//   overlay.textContent = 'ScoutMind SMX Active';
//   document.body.appendChild(overlay);

//   setTimeout(() => {
//     overlay.remove();
//   }, 5000);
// };

// showOverlay(); // Example: Call it on load
