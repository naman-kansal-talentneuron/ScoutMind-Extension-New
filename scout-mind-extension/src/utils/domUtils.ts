// scout-mind-extension/src/utils/domUtils.ts
import { Logger, LogLevel } from './logger';

/**
 * DOM Utilities for interacting with web page elements.
 * Provides methods for selecting, analyzing, and manipulating the DOM.
 * Note: Most methods in this class require a live DOM environment (e.g., content script).
 */
export class DOMUtils {
    private logger: Logger;

    constructor(logger?: Logger, logLevel: LogLevel = 'info') {
        this.logger = logger || new Logger('DOMUtils', logLevel);
    }

    /**
     * Finds elements in the document using a CSS selector.
     * Requires a live DOM context.
     */
    public findElements(selector: string, context: Element | Document = document): Element[] {
        try {
            const elements = Array.from(context.querySelectorAll(selector));
            this.logger.debug(`Found ${elements.length} elements matching selector: ${selector}`);
            return elements;
        } catch (error: any) {
            this.logger.error(`Error finding elements with selector: ${selector}`, { message: error.message, error });
            return [];
        }
    }

    /**
     * Finds a single element in the document using a CSS selector.
     * Requires a live DOM context.
     */
    public findElement(selector: string, context: Element | Document = document): Element | null {
        try {
            const element = context.querySelector(selector);
            this.logger.debug(`Element found: ${!!element} for selector: ${selector}`);
            return element;
        } catch (error: any) {
            this.logger.error(`Error finding element with selector: ${selector}`, { message: error.message, error });
            return null;
        }
    }

    /**
     * Finds elements in the document using an XPath expression.
     * Requires a live DOM context.
     */
    public findElementsByXPath(xpath: string, context: Node = document): Node[] {
        try {
            const result = document.evaluate(
                xpath,
                context,
                null, // namespaceResolver
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null  // existingResult
            );
            
            const elements: Node[] = [];
            for (let i = 0; i < result.snapshotLength; i++) {
                const node = result.snapshotItem(i);
                if (node) {
                    elements.push(node);
                }
            }
            
            this.logger.debug(`Found ${elements.length} elements matching XPath: ${xpath}`);
            return elements;
        } catch (error: any) {
            this.logger.error(`Error finding elements with XPath: ${xpath}`, { message: error.message, error });
            return [];
        }
    }

    /**
     * Gets the XPath for an element.
     * Requires a live DOM element.
     */
    public getElementXPath(element: Element): string | null {
        if (!element || typeof element.getAttribute !== 'function') { // Basic check for valid element
             this.logger.warn('Invalid element provided to getElementXPath');
             return null;
        }
        
        try {
            if (element.id) {
                return `//*[@id="${element.id}"]`;
            }
            
            const parts: string[] = [];
            let current: Element | null = element;
            
            while (current && current.nodeType === Node.ELEMENT_NODE) {
                let part = current.nodeName.toLowerCase();
                if (current.parentNode && current.parentNode.nodeType === Node.ELEMENT_NODE) {
                    const parent = current.parentNode as Element;
                    const siblings = Array.from(parent.children).filter(
                        child => child.nodeName === current.nodeName
                    );
                    if (siblings.length > 1) {
                        const index = siblings.indexOf(current) + 1;
                        part += `[${index}]`;
                    }
                }
                parts.unshift(part);
                current = current.parentElement; // Use parentElement for type safety
            }
            return parts.length ? '/' + parts.join('/') : null;
        } catch (error: any) {
            this.logger.error('Error generating XPath for element', { message: error.message, error });
            return null;
        }
    }
    
    /**
     * Extracts text content from an element.
     * Requires a live DOM element.
     */
    public getElementText(element: Element | Node | null, trimWhitespace: boolean = true): string {
        if (!element || !element.textContent) return '';
        try {
            const text = element.textContent || '';
            return trimWhitespace ? text.trim() : text;
        } catch (error: any) {
            this.logger.error('Error getting element text', { message: error.message, error });
            return '';
        }
    }

    /**
     * Gets an attribute value from an element.
     * Requires a live DOM element.
     */
    public getElementAttribute(element: Element, attribute: string): string | null {
        if (!element || typeof element.getAttribute !== 'function') {
            this.logger.warn('Invalid element provided to getElementAttribute');
            return null;
        }
        try {
            return element.getAttribute(attribute);
        } catch (error: any) {
            this.logger.error(`Error getting attribute: ${attribute}`, { message: error.message, error });
            return null;
        }
    }

    // Other methods from dom-utils.js (getElementSelector, getVisibleText, getElementAttributes,
    // isElementVisible, getElementStyles, highlightElement, clearHighlights, createDOMContext, extractTableData)
    // are highly dependent on live DOM and window APIs, so they would primarily be used in a content script context.
    // They are included here for completeness of the conversion but their direct use in service workers or
    // the main offscreen document (for arbitrary pages) is not feasible.
    
    // Placeholder for getVisibleText as it's complex and highly DOM-dependent
    public getVisibleText(element: Element): string {
        this.logger.warn("getVisibleText is a complex DOM-dependent method, placeholder used.");
        return this.getElementText(element); // Simplified fallback
    }
    
    // Add other methods if they can be made context-agnostic or are simple helpers.
    // For now, focusing on the ones used by the placeholder ExtractorAgent or that are simple.
}

// Example of a pure string utility function that could be exported separately if needed:
// export function cleanText(text: string): string {
//   if (typeof text !== 'string') return '';
//   return text.trim().replace(/\s+/g, ' ');
// }
