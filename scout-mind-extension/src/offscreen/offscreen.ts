// scout-mind-extension/src/offscreen/offscreen.ts - Script for the offscreen document, primarily for fetching HTML.
import { Logger, LogLevel } from '../utils/logger'; // Adjust path if utils is elsewhere relative to src/offscreen

const logger = new Logger('OffscreenDocument', 'debug');
logger.info('Offscreen document script loaded.');

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    logger.debug('Received message:', request);

    if (request.action === 'fetchAndParse') {
        if (!request.url || typeof request.url !== 'string') {
            logger.error('No valid URL provided for fetchAndParse.');
            sendResponse({ success: false, error: 'No valid URL provided.' });
            return false;
        }

        logger.info(`Fetching URL: ${request.url}`);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

            const response = await fetch(request.url, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                signal: controller.signal, // Add abort signal
            });
            
            clearTimeout(timeoutId); // Clear timeout if fetch completes

            if (!response.ok) {
                logger.error(`Fetch failed for ${request.url}: ${response.status} ${response.statusText}`);
                // Attempt to get error body for more details if possible
                let errorBody = '';
                try { errorBody = await response.text(); } catch (e) { /* ignore */ }
                sendResponse({ 
                    success: false, 
                    error: `Fetch failed: ${response.status} ${response.statusText}`, 
                    status: response.status,
                    errorBody: errorBody.substring(0, 500) // Send back a snippet of the error body
                });
                return false; 
            }
            const htmlContent = await response.text();
            logger.info(`Successfully fetched HTML (length: ${htmlContent.length}) from ${request.url}`);
            sendResponse({ success: true, htmlContent: htmlContent });

        } catch (error: any) {
            logger.error(`Exception during fetch for ${request.url}: ${error.message}`, error);
            let errorType = 'NetworkError';
            if (error.name === 'AbortError') {
                errorType = 'TimeoutError';
                logger.error(`Fetch timed out for URL: ${request.url}`);
            }
            sendResponse({ success: false, error: `Fetch exception: ${error.message}`, type: errorType });
        }
        return true; // Indicates asynchronous response
    }
    logger.warn(`Offscreen document received unhandled action: ${request.action}`);
    sendResponse({ success: false, error: `Unknown action: ${request.action}`});
    return false; 
});
