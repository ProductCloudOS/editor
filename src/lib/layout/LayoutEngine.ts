import { Document } from '../core/Document';
import { EventEmitter } from '../events/EventEmitter';
import { FlowManager } from './FlowManager';
import { ElementData, Point } from '../types';
import { ElementFactory } from '../elements/ElementFactory';

export interface LayoutOptions {
  autoFlow: boolean;
  snapToGrid: boolean;
  gridSize: number;
  allowOrphans: boolean;
  minimumContentHeight: number;
}

export class LayoutEngine extends EventEmitter {
  private document: Document;
  private flowManager: FlowManager;
  private options: LayoutOptions;
  private isLayouting: boolean = false;

  constructor(document: Document, options?: Partial<LayoutOptions>) {
    super();
    this.document = document;
    this.flowManager = new FlowManager(document);
    this.options = {
      autoFlow: true,
      snapToGrid: false,
      gridSize: 10,
      allowOrphans: false,
      minimumContentHeight: 50,
      ...options
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for document changes
    this.document.on('change', () => {
      if (!this.isLayouting && this.options.autoFlow) {
        this.requestLayout();
      }
    });

    // Listen for flow manager events
    this.flowManager.on('page-overflow-handled', (data) => {
      this.emit('page-added', data);
    });

    this.flowManager.on('page-break-inserted', (data) => {
      this.emit('page-break-created', data);
    });
  }

  private requestLayout(): void {
    // Debounce layout requests
    if (this.isLayouting) return;
    
    setTimeout(() => {
      this.performLayout();
    }, 100);
  }

  performLayout(): void {
    this.isLayouting = true;
    this.emit('layout-start');

    try {
      // 1. Check for content overflow and handle it
      const hadOverflow = this.flowManager.checkContentOverflow();
      
      // 2. Apply grid snapping if enabled
      if (this.options.snapToGrid) {
        this.applyGridSnapping();
      }
      
      // 3. Check for orphaned content
      if (!this.options.allowOrphans) {
        this.handleOrphanedContent();
      }
      
      // 4. Optimize page usage
      this.optimizePageUsage();
      
      this.emit('layout-complete', { hadOverflow });
    } catch (error) {
      this.emit('layout-error', { error });
    } finally {
      this.isLayouting = false;
    }
  }

  private applyGridSnapping(): void {
    this.document.pages.forEach(page => {
      const elements = page.content.getAllElements();
      elements.forEach(element => {
        const bounds = element.getBounds();
        const snappedPosition = this.snapToGrid(bounds);
        if (snappedPosition.x !== bounds.x || snappedPosition.y !== bounds.y) {
          element.position = snappedPosition;
        }
      });
    });
  }

  private snapToGrid(position: Point): Point {
    const gridSize = this.options.gridSize;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  }

  private handleOrphanedContent(): void {
    // Remove pages with very little content and merge with previous page
    for (let i = this.document.pages.length - 1; i > 0; i--) {
      const page = this.document.pages[i];
      const metrics = this.flowManager.getPageMetrics(page);
      
      if (metrics.contentHeight < this.options.minimumContentHeight) {
        // Move content to previous page
        const previousPage = this.document.pages[i - 1];
        const elements = page.content.getAllElements();
        
        elements.forEach(element => {
          const elementData = element.toData();
          page.content.removeElement(element.id);
          
          // Adjust position for previous page
          const prevPageMetrics = this.flowManager.getPageMetrics(previousPage);
          elementData.position.y += prevPageMetrics.contentHeight;
          
          // Recreate and add element
          const newElement = ElementFactory.createElement(elementData);
          previousPage.content.addElement(newElement);
        });
        
        // Remove the now-empty page
        this.document.removePage(page.id);
        this.emit('orphan-page-removed', { pageId: page.id });
      }
    }
  }

  private optimizePageUsage(): void {
    // Try to fit more content on each page by moving elements up
    this.document.pages.forEach((page, pageIndex) => {
      if (pageIndex === 0) return; // Skip first page
      
      const elements = page.content.getAllElements();
      if (elements.length === 0) return;
      
      const previousPage = this.document.pages[pageIndex - 1];
      const prevPageMetrics = this.flowManager.getPageMetrics(previousPage);
      
      // Check if we can move some elements from this page to the previous page
      elements
        .sort((a, b) => a.getBounds().y - b.getBounds().y)
        .forEach(element => {
          const elementBounds = element.getBounds();
          const prevPageBounds = previousPage.getContentBounds();
          
          // Check if element would fit on previous page
          const wouldFitHeight = prevPageMetrics.contentHeight + elementBounds.height <= prevPageBounds.size.height;
          
          if (wouldFitHeight) {
            const elementData = element.toData();
            page.content.removeElement(element.id);
            
            // Adjust position for previous page
            elementData.position.y = prevPageMetrics.contentHeight + prevPageBounds.position.y;
            
            // Recreate and add element
            const newElement = ElementFactory.createElement(elementData);
            previousPage.content.addElement(newElement);
            
            // Update metrics
            prevPageMetrics.contentHeight += elementBounds.height;
          }
        });
    });
  }

  insertPageBreak(elementId: string): void {
    this.flowManager.insertPageBreak(elementId);
  }

  setAutoFlow(enabled: boolean): void {
    this.options.autoFlow = enabled;
    this.flowManager.setAutoFlow(enabled);
    
    if (enabled) {
      this.performLayout();
    }
  }

  setSnapToGrid(enabled: boolean, gridSize?: number): void {
    this.options.snapToGrid = enabled;
    if (gridSize) {
      this.options.gridSize = gridSize;
    }
    
    if (enabled) {
      this.applyGridSnapping();
      this.emit('grid-snap-applied');
    }
  }

  getLayoutOptions(): LayoutOptions {
    return { ...this.options };
  }

  updateLayoutOptions(options: Partial<LayoutOptions>): void {
    this.options = { ...this.options, ...options };
    this.emit('layout-options-changed', { options: this.options });
  }

  reflowDocument(): void {
    this.flowManager.reflowDocument();
    this.performLayout();
  }

  getDocumentMetrics(): {
    totalPages: number;
    totalContentHeight: number;
    averagePageUtilization: number;
    hasOverflow: boolean;
  } {
    const pages = this.document.pages;
    let totalContentHeight = 0;
    let totalUtilization = 0;
    let hasOverflow = false;

    pages.forEach(page => {
      const metrics = this.flowManager.getPageMetrics(page);
      totalContentHeight += metrics.contentHeight;
      totalUtilization += metrics.utilizationPercent;
      if (metrics.hasOverflow) {
        hasOverflow = true;
      }
    });

    return {
      totalPages: pages.length,
      totalContentHeight,
      averagePageUtilization: totalUtilization / pages.length,
      hasOverflow
    };
  }

  addElement(elementData: ElementData, pageId?: string): void {
    const targetPageId = pageId || this.document.pages[0]?.id;
    if (!targetPageId) return;

    // Add element to the document (this will trigger layout if autoFlow is enabled)
    this.emit('element-add-requested', { elementData, pageId: targetPageId });
  }

  destroy(): void {
    this.removeAllListeners();
    this.flowManager.removeAllListeners();
  }
}