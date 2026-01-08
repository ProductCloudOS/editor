import { Document } from '../core/Document';
import { Page } from '../core/Page';
import { EventEmitter } from '../events/EventEmitter';

export interface PageBreak {
  elementId: string;
  type: 'before' | 'after' | 'avoid';
}

/**
 * FlowManager handles content flow between pages.
 * Note: With the removal of regular elements, flow is now primarily
 * handled by FlowingTextContent. This class maintains the interface
 * for compatibility.
 */
export class FlowManager extends EventEmitter {
  private autoFlow: boolean = true;

  constructor(_document: Document) {
    super();
    // Document reference not currently used; flow is handled by FlowingTextContent
  }

  setAutoFlow(enabled: boolean): void {
    this.autoFlow = enabled;
    this.emit('auto-flow-changed', { enabled });
  }

  getAutoFlow(): boolean {
    return this.autoFlow;
  }

  checkContentOverflow(): boolean {
    // Content overflow is now handled by FlowingTextContent
    return false;
  }

  insertPageBreak(_afterElementId: string): void {
    // No-op: page breaks for flowing text are handled by FlowingTextContent
  }

  reflowDocument(): void {
    // No-op: reflow is now handled by FlowingTextContent
    this.emit('document-reflowed');
  }

  getPageMetrics(page: Page): {
    contentHeight: number;
    availableHeight: number;
    utilizationPercent: number;
    hasOverflow: boolean;
  } {
    const contentBounds = page.getContentBounds();
    const availableHeight = contentBounds.size.height;

    return {
      contentHeight: 0,
      availableHeight,
      utilizationPercent: 0,
      hasOverflow: false
    };
  }
}
