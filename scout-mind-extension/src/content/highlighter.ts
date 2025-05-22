// scout-mind-extension/src/content/highlighter.ts
import { Logger } from '../utils/logger';

const HIGHLIGHT_CLASS = 'scoutmind-smx-highlight';
// const LABEL_CLASS = 'scoutmind-smx-highlight-label'; // For optional labels

export class Highlighter {
  private logger: Logger;
  private highlightedElements: Set<HTMLElement>;
  // private labels: Set<HTMLElement>; // For optional labels

  constructor(loggerInstance?: Logger) {
    this.logger = loggerInstance || new Logger('Highlighter');
    this.highlightedElements = new Set();
    // this.labels = new Set();
    this.logger.debug('Highlighter initialized.');
  }

  public highlightElement(element: HTMLElement, category?: string): void {
    if (!element || typeof element.classList === 'undefined') {
      this.logger.warn('Invalid element provided for highlighting.', { element });
      return;
    }
    element.classList.add(HIGHLIGHT_CLASS);
    this.highlightedElements.add(element);
    
    // Optional: Add a label
    // if (category) {
    //   const label = document.createElement('div');
    //   label.className = LABEL_CLASS;
    //   label.textContent = category;
    //   document.body.appendChild(label); // Or position relative to element
    //   this.labels.add(label);
    //   // Position label logic would go here
    // }
    this.logger.debug(`Highlighted element with category: ${category || 'N/A'}`, { tagName: element.tagName, id: element.id, classes: element.className });
  }

  public highlightElementsBySelector(selector: string, category?: string): number {
    if (!selector) {
      this.logger.warn('No selector provided for highlighting.');
      return 0;
    }
    this.logger.info(`Highlighting elements by selector: "${selector}", category: "${category || 'N/A'}"`);
    let count = 0;
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      elements.forEach(element => {
        this.highlightElement(element, category);
        count++;
      });
      this.logger.info(`Highlighted ${count} element(s) for selector "${selector}".`);
    } catch (error: any) {
      this.logger.error(`Error highlighting elements by selector "${selector}": ${error.message}`, error);
    }
    return count;
  }

  public clearHighlights(selector?: string): void {
    if (selector) {
      this.logger.info(`Clearing highlights for selector: "${selector}"`);
      try {
        const elements = document.querySelectorAll<HTMLElement>(selector);
        elements.forEach(element => {
          if (element.classList.contains(HIGHLIGHT_CLASS)) {
            element.classList.remove(HIGHLIGHT_CLASS);
            this.highlightedElements.delete(element);
          }
        });
      } catch (error: any) {
         this.logger.error(`Error clearing highlights for selector "${selector}": ${error.message}`, error);
      }
    } else {
      this.logger.info('Clearing all highlights.');
      this.highlightedElements.forEach(element => {
        element.classList.remove(HIGHLIGHT_CLASS);
      });
      this.highlightedElements.clear();
      
      // Optional: Clear labels
      // this.labels.forEach(label => label.remove());
      // this.labels.clear();
    }
  }

  public destroy(): void {
    this.logger.debug('Destroying highlighter, clearing all highlights.');
    this.clearHighlights();
    // Any other cleanup if needed
  }
}
