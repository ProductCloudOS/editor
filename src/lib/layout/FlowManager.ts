import { Document } from '../core/Document';
import { Page } from '../core/Page';
import { ElementData, Rect } from '../types';
import { EventEmitter } from '../events/EventEmitter';
import { BaseElement } from '../elements/BaseElement';
import { ElementFactory } from '../elements/ElementFactory';

export interface FlowableElement extends BaseElement {
  canFlow: boolean;
  flowPriority: number;
}

export interface PageBreak {
  elementId: string;
  type: 'before' | 'after' | 'avoid';
}

export class FlowManager extends EventEmitter {
  private document: Document;
  private autoFlow: boolean = true;

  constructor(document: Document) {
    super();
    this.document = document;
  }

  setAutoFlow(enabled: boolean): void {
    this.autoFlow = enabled;
    this.emit('auto-flow-changed', { enabled });
  }

  getAutoFlow(): boolean {
    return this.autoFlow;
  }

  checkContentOverflow(): boolean {
    let hasOverflow = false;
    
    this.document.pages.forEach(page => {
      const overflow = this.getPageContentOverflow(page);
      if (overflow.overflowElements.length > 0) {
        hasOverflow = true;
        if (this.autoFlow) {
          this.handlePageOverflow(page, overflow);
        }
      }
    });

    return hasOverflow;
  }

  private getPageContentOverflow(page: Page): {
    overflowElements: BaseElement[];
    availableSpace: Rect;
    usedSpace: number;
  } {
    const contentBounds = page.getContentBounds();
    const elements = page.content.getAllElements();
    
    const overflowElements: BaseElement[] = [];
    let usedSpace = 0;

    // Sort elements by vertical position
    const sortedElements = elements.sort((a, b) => a.getBounds().y - b.getBounds().y);

    for (const element of sortedElements) {
      const elementBounds = element.getBounds();
      const elementBottom = elementBounds.y + elementBounds.height;
      const contentBottom = contentBounds.position.y + contentBounds.size.height;

      usedSpace = Math.max(usedSpace, elementBottom - contentBounds.position.y);

      // Check if element overflows the content area
      if (elementBottom > contentBottom) {
        overflowElements.push(element);
      }
    }

    return {
      overflowElements,
      availableSpace: {
        x: contentBounds.position.x,
        y: contentBounds.position.y,
        width: contentBounds.size.width,
        height: contentBounds.size.height
      },
      usedSpace
    };
  }

  private handlePageOverflow(page: Page, overflow: { overflowElements: BaseElement[] }): void {
    if (overflow.overflowElements.length === 0) return;

    // Create new page for overflow content
    const newPage = this.createNewPage();
    const newPageIndex = this.document.pages.indexOf(page) + 1;
    
    this.document.addPage(newPage, newPageIndex);

    // Move overflow elements to new page
    overflow.overflowElements.forEach(element => {
      const elementData = element.toData();
      
      // Remove from current page
      page.content.removeElement(element.id);
      
      // Adjust position for new page (relative to new content area)
      const newPageContentBounds = newPage.getContentBounds();
      const currentPageContentBounds = page.getContentBounds();
      
      elementData.position.y = elementData.position.y - currentPageContentBounds.size.height + newPageContentBounds.position.y;
      
      // Add to new page
      newPage.content.addElement(this.recreateElement(elementData));
    });

    this.emit('page-overflow-handled', { 
      originalPage: page, 
      newPage,
      movedElements: overflow.overflowElements.length 
    });
  }

  private createNewPage(): Page {
    const existingPage = this.document.pages[0];
    const newPageData = {
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      header: {
        height: existingPage.header.height,
        elements: existingPage.header.getElements() // Copy header elements
      },
      content: {
        elements: [] // Empty content
      },
      footer: {
        height: existingPage.footer.height,
        elements: existingPage.footer.getElements() // Copy footer elements
      }
    };

    return new Page(newPageData, existingPage.settings);
  }

  private recreateElement(elementData: ElementData): BaseElement {
    return ElementFactory.createElement(elementData);
  }

  insertPageBreak(afterElementId: string): void {
    const page = this.findPageWithElement(afterElementId);
    if (!page) return;

    const element = page.content.getElement(afterElementId) ||
                   page.header.getElement(afterElementId) ||
                   page.footer.getElement(afterElementId);
    
    if (!element) return;

    this.splitPageAfterElement(page, element);
  }

  private splitPageAfterElement(page: Page, element: BaseElement): void {
    const elementBounds = element.getBounds();
    const allElements = page.content.getAllElements();
    
    // Find elements that come after this element (vertically)
    const elementsToMove = allElements.filter(el => {
      const bounds = el.getBounds();
      return bounds.y > elementBounds.y + elementBounds.height;
    });

    if (elementsToMove.length === 0) return;

    // Create new page
    const newPage = this.createNewPage();
    const pageIndex = this.document.pages.indexOf(page) + 1;
    this.document.addPage(newPage, pageIndex);

    // Move elements to new page
    const newPageContentBounds = newPage.getContentBounds();
    
    elementsToMove.forEach(el => {
      const elementData = el.toData();
      
      // Remove from current page
      page.content.removeElement(el.id);
      
      // Adjust position for new page
      elementData.position.y = elementData.position.y - elementBounds.y - elementBounds.height + newPageContentBounds.position.y;
      
      // Add to new page
      newPage.content.addElement(this.recreateElement(elementData));
    });

    this.emit('page-break-inserted', { 
      originalPage: page, 
      newPage,
      afterElement: element.id 
    });
  }

  private findPageWithElement(elementId: string): Page | null {
    for (const page of this.document.pages) {
      if (page.content.getElement(elementId) ||
          page.header.getElement(elementId) ||
          page.footer.getElement(elementId)) {
        return page;
      }
    }
    return null;
  }

  reflowDocument(): void {
    // Consolidate content from multiple pages back into optimal pagination
    this.consolidatePages();
    this.checkContentOverflow();
    this.emit('document-reflowed');
  }

  private consolidatePages(): void {
    if (this.document.pages.length <= 1) return;

    const mainPage = this.document.pages[0];
    const allContentElements: BaseElement[] = [];

    // Collect all content elements from all pages
    for (let i = 0; i < this.document.pages.length; i++) {
      const page = this.document.pages[i];
      allContentElements.push(...page.content.getAllElements());
    }

    // Remove all pages except the first
    const pagesToRemove = this.document.pages.slice(1);
    pagesToRemove.forEach(page => {
      this.document.removePage(page.id);
    });

    // Clear the main page content
    mainPage.content.clear();

    // Sort elements by vertical position and re-add them
    allContentElements
      .sort((a, b) => a.getBounds().y - b.getBounds().y)
      .forEach(element => {
        mainPage.content.addElement(element);
      });
  }

  getPageMetrics(page: Page): {
    contentHeight: number;
    availableHeight: number;
    utilizationPercent: number;
    hasOverflow: boolean;
  } {
    const overflow = this.getPageContentOverflow(page);
    const contentHeight = overflow.usedSpace;
    const availableHeight = overflow.availableSpace.height;
    
    return {
      contentHeight,
      availableHeight,
      utilizationPercent: (contentHeight / availableHeight) * 100,
      hasOverflow: overflow.overflowElements.length > 0
    };
  }
}