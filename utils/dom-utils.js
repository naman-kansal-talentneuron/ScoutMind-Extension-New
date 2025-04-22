import { Logger } from './logger.js';

/**
 * DOM Utilities for interacting with web page elements.
 * Provides methods for selecting, analyzing, and manipulating the DOM.
 */
export class DOMUtils {
    /**
     * Creates a new DOMUtils instance
     * @param {Logger} [logger] - Optional logger instance
     */
    constructor(logger = new Logger('DOMUtils')) {
        this.logger = logger;
    }

    /**
     * Finds elements in the document using a CSS selector
     * @param {string} selector - CSS selector to find elements
     * @param {Element|Document} [context=document] - Element to search within
     * @returns {Array<Element>} Array of matching elements
     */
    findElements(selector, context = document) {
        try {
            const elements = Array.from(context.querySelectorAll(selector));
            this.logger.debug(`Found ${elements.length} elements matching selector: ${selector}`);
            return elements;
        } catch (error) {
            this.logger.error(`Error finding elements with selector: ${selector}`, error);
            return [];
        }
    }

    /**
     * Finds a single element in the document using a CSS selector
     * @param {string} selector - CSS selector to find the element
     * @param {Element|Document} [context=document] - Element to search within
     * @returns {Element|null} Matching element or null if not found
     */
    findElement(selector, context = document) {
        try {
            const element = context.querySelector(selector);
            this.logger.debug(`Element found: ${!!element} for selector: ${selector}`);
            return element;
        } catch (error) {
            this.logger.error(`Error finding element with selector: ${selector}`, error);
            return null;
        }
    }

    /**
     * Finds elements in the document using an XPath expression
     * @param {string} xpath - XPath expression to find elements
     * @param {Element|Document} [context=document] - Element to search within
     * @returns {Array<Element>} Array of matching elements
     */
    findElementsByXPath(xpath, context = document) {
        try {
            const result = document.evaluate(
                xpath,
                context,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );
            
            const elements = [];
            for (let i = 0; i < result.snapshotLength; i++) {
                elements.push(result.snapshotItem(i));
            }
            
            this.logger.debug(`Found ${elements.length} elements matching XPath: ${xpath}`);
            return elements;
        } catch (error) {
            this.logger.error(`Error finding elements with XPath: ${xpath}`, error);
            return [];
        }
    }

    /**
     * Gets the XPath for an element
     * @param {Element} element - The element to get the XPath for
     * @returns {string|null} XPath for the element or null if not possible
     */
    getElementXPath(element) {
        if (!element) return null;
        
        try {
            // Variables to hold path parts
            const parts = [];
            let current = element;
            let hasId = false;
            
            // If element has an ID, we can construct a simple XPath
            if (current.id) {
                return `//*[@id="${current.id}"]`;
            }
            
            // Otherwise, we need to construct the full path
            while (current && current.nodeType === Node.ELEMENT_NODE) {
                // Get the position of this element among its siblings
                let siblings = Array.from(current.parentNode.children).filter(
                    child => child.nodeName === current.nodeName
                );
                
                if (siblings.length > 1) {
                    let index = siblings.indexOf(current) + 1;
                    parts.unshift(`${current.nodeName.toLowerCase()}[${index}]`);
                } else {
                    parts.unshift(current.nodeName.toLowerCase());
                }
                
                current = current.parentNode;
            }
            
            return '/' + parts.join('/');
        } catch (error) {
            this.logger.error('Error generating XPath for element', error);
            return null;
        }
    }

    /**
     * Gets the CSS selector for an element
     * @param {Element} element - The element to get the selector for
     * @returns {string|null} CSS selector for the element or null if not possible
     */
    getElementSelector(element) {
        if (!element) return null;
        
        try {
            // If element has an ID, use that
            if (element.id) {
                return `#${CSS.escape(element.id)}`;
            }
            
            // Build a selector using classes, attributes, or position
            const parts = [];
            let current = element;
            
            while (current && current.nodeType === Node.ELEMENT_NODE) {
                let part = current.nodeName.toLowerCase();
                
                if (current.className && typeof current.className === 'string') {
                    const classes = current.className.trim().split(/\s+/);
                    if (classes.length > 0) {
                        part += classes.map(cls => `.${CSS.escape(cls)}`).join('');
                    }
                }
                
                // Check if we need to add positional information
                const parent = current.parentNode;
                if (parent && parent.nodeType === Node.ELEMENT_NODE) {
                    const siblings = Array.from(parent.children).filter(
                        child => child.nodeName === current.nodeName
                    );
                    
                    if (siblings.length > 1) {
                        const index = siblings.indexOf(current);
                        part += `:nth-child(${index + 1})`;
                    }
                }
                
                parts.unshift(part);
                
                // If we have a unique path, we can stop
                if (document.querySelectorAll(parts.join(' > ')).length === 1) {
                    break;
                }
                
                // Move up to the parent
                current = current.parentNode;
                
                // Avoid generating extremely long selectors
                if (parts.length >= 5) {
                    break;
                }
            }
            
            return parts.join(' > ');
        } catch (error) {
            this.logger.error('Error generating CSS selector for element', error);
            return null;
        }
    }

    /**
     * Extracts text content from an element
     * @param {Element} element - The element to extract text from
     * @param {boolean} [trimWhitespace=true] - Whether to trim whitespace
     * @returns {string} The text content of the element
     */
    getElementText(element, trimWhitespace = true) {
        if (!element) return '';
        
        try {
            const text = element.textContent || '';
            return trimWhitespace ? text.trim() : text;
        } catch (error) {
            this.logger.error('Error getting element text', error);
            return '';
        }
    }

    /**
     * Extracts all visible text from an element
     * @param {Element} element - The element to extract visible text from
     * @returns {string} The visible text content of the element
     */
    getVisibleText(element) {
        if (!element) return '';
        
        try {
            // Get computed style
            const style = window.getComputedStyle(element);
            
            // Check if element is visible
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return '';
            }
            
            let text = '';
            
            // Get text from this element if it's a text node
            if (element.nodeType === Node.TEXT_NODE) {
                text = element.textContent.trim();
            }
            
            // Recursively get text from child nodes
            const children = element.childNodes;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                
                // Skip script and style elements
                if (child.nodeName === 'SCRIPT' || child.nodeName === 'STYLE') {
                    continue;
                }
                
                if (child.nodeType === Node.ELEMENT_NODE) {
                    text += ' ' + this.getVisibleText(child);
                } else if (child.nodeType === Node.TEXT_NODE) {
                    text += ' ' + child.textContent.trim();
                }
            }
            
            return text.trim().replace(/\s+/g, ' ');
        } catch (error) {
            this.logger.error('Error getting visible text', error);
            return '';
        }
    }

    /**
     * Gets an attribute value from an element
     * @param {Element} element - The element to get the attribute from
     * @param {string} attribute - The attribute name
     * @returns {string|null} The attribute value or null if not present
     */
    getElementAttribute(element, attribute) {
        if (!element) return null;
        
        try {
            return element.getAttribute(attribute);
        } catch (error) {
            this.logger.error(`Error getting attribute: ${attribute}`, error);
            return null;
        }
    }

    /**
     * Gets all attributes from an element
     * @param {Element} element - The element to get attributes from
     * @returns {Object} Object containing all attributes
     */
    getElementAttributes(element) {
        if (!element) return {};
        
        try {
            const attributes = {};
            for (const attr of element.attributes) {
                attributes[attr.name] = attr.value;
            }
            return attributes;
        } catch (error) {
            this.logger.error('Error getting element attributes', error);
            return {};
        }
    }

    /**
     * Checks if an element is visible in the viewport
     * @param {Element} element - The element to check
     * @returns {boolean} Whether the element is visible
     */
    isElementVisible(element) {
        if (!element) return false;
        
        try {
            const rect = element.getBoundingClientRect();
            
            return (
                rect.width > 0 &&
                rect.height > 0 &&
                rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
                rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
                rect.bottom > 0 &&
                rect.right > 0
            );
        } catch (error) {
            this.logger.error('Error checking element visibility', error);
            return false;
        }
    }

    /**
     * Gets the computed style properties of an element
     * @param {Element} element - The element to get styles for
     * @param {Array<string>} [properties=[]] - The style properties to get
     * @returns {Object} Object containing the requested style properties
     */
    getElementStyles(element, properties = []) {
        if (!element) return {};
        
        try {
            const styles = window.getComputedStyle(element);
            
            // If no specific properties requested, return everything
            if (!properties.length) {
                const allStyles = {};
                for (const prop of styles) {
                    allStyles[prop] = styles.getPropertyValue(prop);
                }
                return allStyles;
            }
            
            // Otherwise return just the requested properties
            const requestedStyles = {};
            for (const prop of properties) {
                requestedStyles[prop] = styles.getPropertyValue(prop);
            }
            
            return requestedStyles;
        } catch (error) {
            this.logger.error('Error getting element styles', error);
            return {};
        }
    }

    /**
     * Creates an element highlight overlay
     * @param {Element} element - The element to highlight
     * @param {Object} [options] - Highlight options
     * @param {string} [options.color='rgba(255, 165, 0, 0.3)'] - Highlight color
     * @param {string} [options.border='2px solid orange'] - Border style
     * @param {number} [options.padding=0] - Padding around the element
     * @param {string} [options.label] - Label text to display with the highlight
     * @returns {Element} The created highlight element
     */
    highlightElement(element, options = {}) {
        if (!element) return null;
        
        try {
            const {
                color = 'rgba(255, 165, 0, 0.3)',
                border = '2px solid orange',
                padding = 0,
                label
            } = options;
            
            // Get element position and size
            const rect = element.getBoundingClientRect();
            
            // Create highlight overlay
            const highlight = document.createElement('div');
            
            // Style the highlight
            Object.assign(highlight.style, {
                position: 'absolute',
                zIndex: 9999,
                pointerEvents: 'none', // Makes the overlay non-interactive
                backgroundColor: color,
                border: border,
                top: `${rect.top - padding + window.scrollY}px`,
                left: `${rect.left - padding + window.scrollX}px`,
                width: `${rect.width + (padding * 2)}px`,
                height: `${rect.height + (padding * 2)}px`
            });
            
            // Add label if provided
            if (label) {
                const labelElement = document.createElement('div');
                
                Object.assign(labelElement.style, {
                    position: 'absolute',
                    top: '-24px',
                    left: '0',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap'
                });
                
                labelElement.textContent = label;
                highlight.appendChild(labelElement);
            }
            
            // Add to document
            document.body.appendChild(highlight);
            
            return highlight;
        } catch (error) {
            this.logger.error('Error highlighting element', error);
            return null;
        }
    }

    /**
     * Removes all element highlights
     */
    clearHighlights() {
        try {
            const highlights = document.querySelectorAll('[data-scoutmind-highlight]');
            highlights.forEach(highlight => highlight.remove());
            this.logger.debug(`Removed ${highlights.length} highlights`);
        } catch (error) {
            this.logger.error('Error clearing highlights', error);
        }
    }

    /**
     * Creates a compact representation of the DOM for LLM processing
     * @param {Element} [rootElement=document.body] - The root element to start from
     * @param {Object} [options] - Options for creating the context
     * @param {number} [options.maxDepth=3] - Maximum depth to traverse
     * @param {number} [options.maxElements=100] - Maximum number of elements to include
     * @param {boolean} [options.includeText=true] - Whether to include text content
     * @param {boolean} [options.includeAttributes=true] - Whether to include attributes
     * @returns {string} Compressed HTML representation
     */
    createDOMContext(rootElement = document.body, options = {}) {
        const {
            maxDepth = 3,
            maxElements = 100,
            includeText = true,
            includeAttributes = true
        } = options;
        
        try {
            let elementCount = 0;
            
            const processNode = (node, depth) => {
                if (elementCount >= maxElements || depth > maxDepth) {
                    return '';
                }
                
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    return text ? (includeText ? text : '') : '';
                }
                
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return '';
                }
                
                // Skip invisible elements
                try {
                    const style = window.getComputedStyle(node);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return '';
                    }
                } catch (e) {
                    // Ignore style errors
                }
                
                // Increment element count
                elementCount++;
                
                // Skip script, style, and hidden elements
                if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(node.nodeName)) {
                    return '';
                }
                
                // Build attributes string
                let attributes = '';
                if (includeAttributes) {
                    for (const attr of node.attributes) {
                        // Skip data- attributes and event handlers
                        if (attr.name.startsWith('data-') || attr.name.startsWith('on')) {
                            continue;
                        }
                        
                        // Include important attributes and classes
                        if (['id', 'class', 'href', 'src', 'alt', 'title'].includes(attr.name)) {
                            attributes += ` ${attr.name}="${attr.value}"`;
                        }
                    }
                }
                
                // Start tag
                let result = `<${node.nodeName.toLowerCase()}${attributes}>`;
                
                // Process children
                if (depth < maxDepth) {
                    for (const child of node.childNodes) {
                        result += processNode(child, depth + 1);
                    }
                }
                
                // End tag
                result += `</${node.nodeName.toLowerCase()}>`;
                
                return result;
            };
            
            return processNode(rootElement, 0);
        } catch (error) {
            this.logger.error('Error creating DOM context', error);
            return '';
        }
    }

    /**
     * Extracts structured data from a table element
     * @param {Element} tableElement - The table element to extract data from
     * @returns {Array<Object>|null} Array of objects representing table rows
     */
    extractTableData(tableElement) {
        if (!tableElement || tableElement.nodeName !== 'TABLE') {
            this.logger.error('Invalid table element provided');
            return null;
        }
        
        try {
            const headers = [];
            const rows = [];
            
            // Get table headers
            const headerCells = tableElement.querySelectorAll('thead th, tr:first-child th');
            
            if (headerCells.length > 0) {
                headerCells.forEach(cell => {
                    headers.push(this.getElementText(cell));
                });
            }
            
            // If no explicit headers found, try first row as headers
            if (headers.length === 0) {
                const firstRowCells = tableElement.querySelectorAll('tr:first-child td');
                firstRowCells.forEach(cell => {
                    headers.push(this.getElementText(cell));
                });
            }
            
            // Get table rows (skip header row if we used it for headers)
            const tableRows = headers.length > 0 ? 
                  Array.from(tableElement.querySelectorAll('tr')).slice(1) : 
                  tableElement.querySelectorAll('tr');
            
            tableRows.forEach(row => {
                const rowData = {};
                const cells = row.querySelectorAll('td');
                
                // If we have headers, use them as keys
                if (headers.length > 0) {
                    cells.forEach((cell, index) => {
                        if (index < headers.length) {
                            rowData[headers[index]] = this.getElementText(cell);
                        }
                    });
                } else {
                    // Otherwise just use numeric indices
                    cells.forEach((cell, index) => {
                        rowData[`col${index}`] = this.getElementText(cell);
                    });
                }
                
                if (Object.keys(rowData).length > 0) {
                    rows.push(rowData);
                }
            });
            
            return rows;
        } catch (error) {
            this.logger.error('Error extracting table data', error);
            return null;
        }
    }
}

console.log("DOMUtils Class loaded.");
