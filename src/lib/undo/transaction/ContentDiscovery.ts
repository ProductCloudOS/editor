/**
 * ContentDiscovery - Automatically discovers and registers content sources.
 *
 * Listens for focus events and registers FlowingTextContent instances
 * with the TextMutationObserver when they become active.
 */

import { EventEmitter } from '../../events/EventEmitter';
import { FlowingTextContent } from '../../text/FlowingTextContent';
import { TextMutationObserver } from './TextMutationObserver';
import { ContentSourceId } from './types';
import { TableObject, TextBoxObject, BaseEmbeddedObject } from '../../objects';

/**
 * Interface for the document that provides FlowingTextContent.
 */
export interface DocumentProvider {
  bodyFlowingContent: FlowingTextContent;
  headerFlowingContent: FlowingTextContent;
  footerFlowingContent: FlowingTextContent;
}

/**
 * Interface for the canvas manager that provides focus events.
 */
export interface FocusEventSource extends EventEmitter {
  // Expected events:
  // 'tablecell-focused': { table: TableObject; cell: any; row: number; col: number }
  // 'textbox-editing-started': { textBox: TextBoxObject }
  // 'textbox-editing-ended': {}
  // 'table-editing-ended': {}
}

/**
 * ContentDiscovery manages automatic content registration.
 */
export class ContentDiscovery {
  private mutationObserver: TextMutationObserver;
  private document: DocumentProvider;
  private focusEventSource: FocusEventSource;

  // Track currently focused content
  private currentFocusedContent: FlowingTextContent | null = null;
  private currentSourceId: ContentSourceId | null = null;

  // Track all registered content
  private registeredContent: Map<FlowingTextContent, ContentSourceId> = new Map();

  constructor(
    mutationObserver: TextMutationObserver,
    document: DocumentProvider,
    focusEventSource: FocusEventSource
  ) {
    this.mutationObserver = mutationObserver;
    this.document = document;
    this.focusEventSource = focusEventSource;

    this.registerDocumentContent();
    this.setupFocusTracking();
  }

  /**
   * Register body/header/footer content (always present).
   */
  private registerDocumentContent(): void {
    // Register body
    this.registerContent(this.document.bodyFlowingContent, { type: 'body' });

    // Register header
    this.registerContent(this.document.headerFlowingContent, { type: 'header' });

    // Register footer
    this.registerContent(this.document.footerFlowingContent, { type: 'footer' });
  }

  /**
   * Set up tracking for dynamic content (tables, text boxes).
   */
  private setupFocusTracking(): void {
    // When a table cell gains focus, register its content
    this.focusEventSource.on('tablecell-focused', (data: {
      table: TableObject;
      cell: any;
      row: number;
      col: number;
    }) => {
      if (data.cell && 'flowingContent' in data.cell) {
        const content = data.cell.flowingContent as FlowingTextContent;
        const sourceId: ContentSourceId = {
          type: 'tablecell',
          objectId: data.table.id,
          cellAddress: { row: data.row, col: data.col }
        };
        this.registerContent(content, sourceId);
        this.setCurrentFocus(content, sourceId);
      }
    });

    // When a text box gains focus, register its content
    this.focusEventSource.on('textbox-editing-started', (data: { textBox: TextBoxObject }) => {
      if (data.textBox) {
        const content = data.textBox.flowingContent;
        const sourceId: ContentSourceId = {
          type: 'textbox',
          objectId: data.textBox.id
        };
        this.registerContent(content, sourceId);
        this.setCurrentFocus(content, sourceId);
      }
    });

    // When text box editing ends, clear focus
    this.focusEventSource.on('textbox-editing-ended', () => {
      this.clearCurrentFocus();
    });

    // When table editing ends, clear focus
    this.focusEventSource.on('table-editing-ended', () => {
      this.clearCurrentFocus();
    });

    // Track section focus changes
    this.focusEventSource.on('section-focused', (data: { section: 'body' | 'header' | 'footer' }) => {
      const content = this.getContentForSection(data.section);
      if (content) {
        this.setCurrentFocus(content, { type: data.section });
      }
    });
  }

  /**
   * Register a FlowingTextContent with the mutation observer.
   */
  registerContent(content: FlowingTextContent, sourceId: ContentSourceId): void {
    // Register with mutation observer
    this.mutationObserver.observe(content, sourceId);

    // Track registration
    this.registeredContent.set(content, sourceId);
  }

  /**
   * Unregister a FlowingTextContent.
   */
  unregisterContent(content: FlowingTextContent): void {
    this.mutationObserver.unobserve(content);
    this.registeredContent.delete(content);
  }

  /**
   * Set the currently focused content.
   */
  private setCurrentFocus(content: FlowingTextContent, sourceId: ContentSourceId): void {
    this.currentFocusedContent = content;
    this.currentSourceId = sourceId;
  }

  /**
   * Clear the current focus.
   */
  private clearCurrentFocus(): void {
    this.currentFocusedContent = null;
    this.currentSourceId = null;
  }

  /**
   * Get the currently focused content.
   */
  getCurrentFocus(): { content: FlowingTextContent; sourceId: ContentSourceId } | null {
    if (this.currentFocusedContent && this.currentSourceId) {
      return {
        content: this.currentFocusedContent,
        sourceId: this.currentSourceId
      };
    }
    return null;
  }

  /**
   * Get content for a document section.
   */
  private getContentForSection(section: 'body' | 'header' | 'footer'): FlowingTextContent {
    switch (section) {
      case 'body':
        return this.document.bodyFlowingContent;
      case 'header':
        return this.document.headerFlowingContent;
      case 'footer':
        return this.document.footerFlowingContent;
    }
  }

  /**
   * Get FlowingTextContent by source ID.
   */
  getContentBySourceId(sourceId: ContentSourceId): FlowingTextContent | null {
    // Check document sections
    if (sourceId.type === 'body') return this.document.bodyFlowingContent;
    if (sourceId.type === 'header') return this.document.headerFlowingContent;
    if (sourceId.type === 'footer') return this.document.footerFlowingContent;

    // Search registered content
    for (const [content, registeredId] of this.registeredContent) {
      if (this.sameSourceId(sourceId, registeredId)) {
        return content;
      }
    }

    return null;
  }

  /**
   * Check if two source IDs are the same.
   */
  private sameSourceId(a: ContentSourceId, b: ContentSourceId): boolean {
    if (a.type !== b.type) return false;
    if (a.objectId !== b.objectId) return false;

    if (a.cellAddress && b.cellAddress) {
      return a.cellAddress.row === b.cellAddress.row &&
             a.cellAddress.col === b.cellAddress.col;
    }

    return a.cellAddress === b.cellAddress;
  }

  /**
   * Register an embedded object for potential content tracking.
   * Called when an object is inserted or focused.
   */
  registerObject(object: BaseEmbeddedObject): void {
    // Check if it's a text box and register its content
    if (object instanceof TextBoxObject) {
      const content = object.flowingContent;
      const sourceId: ContentSourceId = {
        type: 'textbox',
        objectId: object.id
      };
      this.registerContent(content, sourceId);
    }

    // Check if it's a table and register all cell content
    if (object instanceof TableObject) {
      this.registerTableCells(object);
    }
  }

  /**
   * Register all cells of a table.
   */
  private registerTableCells(table: TableObject): void {
    const rows = table.rowCount;
    const cols = table.columnCount;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = table.getCell(row, col);
        if (cell && 'flowingContent' in cell) {
          const content = (cell as any).flowingContent as FlowingTextContent;
          const sourceId: ContentSourceId = {
            type: 'tablecell',
            objectId: table.id,
            cellAddress: { row, col }
          };
          this.registerContent(content, sourceId);
        }
      }
    }
  }

  /**
   * Unregister an object and its content.
   */
  unregisterObject(object: BaseEmbeddedObject): void {
    if (object instanceof TextBoxObject) {
      this.unregisterContent(object.flowingContent);
    }

    if (object instanceof TableObject) {
      this.unregisterTableCells(object);
    }
  }

  /**
   * Unregister all cells of a table.
   */
  private unregisterTableCells(table: TableObject): void {
    const rows = table.rowCount;
    const cols = table.columnCount;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = table.getCell(row, col);
        if (cell && 'flowingContent' in cell) {
          const content = (cell as any).flowingContent as FlowingTextContent;
          this.unregisterContent(content);
        }
      }
    }
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    for (const content of this.registeredContent.keys()) {
      this.mutationObserver.unobserve(content);
    }
    this.registeredContent.clear();
    this.currentFocusedContent = null;
    this.currentSourceId = null;
  }
}
