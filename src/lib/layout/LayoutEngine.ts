import { Document } from '../core/Document';
import { EventEmitter } from '../events/EventEmitter';
import { FlowManager } from './FlowManager';

export interface LayoutOptions {
  autoFlow: boolean;
  snapToGrid: boolean;
  gridSize: number;
  allowOrphans: boolean;
  minimumContentHeight: number;
}

/**
 * LayoutEngine provides layout management for the document.
 * Note: With the removal of regular elements, layout is now primarily
 * handled by FlowingTextContent for text flow. This class maintains
 * the interface for compatibility.
 */
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
      // Layout is now primarily handled by FlowingTextContent
      this.emit('layout-complete', { hadOverflow: false });
    } catch (error) {
      this.emit('layout-error', { error });
    } finally {
      this.isLayouting = false;
    }
  }

  insertPageBreak(_elementId: string): void {
    // No-op: page breaks are handled by FlowingTextContent
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
  }

  getLayoutOptions(): LayoutOptions {
    return { ...this.options };
  }

  updateLayoutOptions(options: Partial<LayoutOptions>): void {
    this.options = { ...this.options, ...options };
    this.emit('layout-options-changed', { options: this.options });
  }

  reflowDocument(): void {
    this.performLayout();
  }

  getDocumentMetrics(): {
    totalPages: number;
    totalContentHeight: number;
    averagePageUtilization: number;
    hasOverflow: boolean;
  } {
    return {
      totalPages: this.document.pages.length,
      totalContentHeight: 0,
      averagePageUtilization: 0,
      hasOverflow: false
    };
  }

  destroy(): void {
    this.removeAllListeners();
    this.flowManager.removeAllListeners();
  }
}
