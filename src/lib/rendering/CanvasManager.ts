import { Document } from '../core/Document';
import { Page } from '../core/Page';
import { EditorOptions, ElementData, Point, PageDimensions, Size, Rect, EditingSection } from '../types';
import { EventEmitter } from '../events/EventEmitter';
import { ElementFactory } from '../elements/ElementFactory';
import { BaseElement } from '../elements/BaseElement';
import { FlowingTextRenderer } from './FlowingTextRenderer';
import { TextBoxObject } from '../objects/TextBoxObject';
import { TableObject, TableResizeHandler } from '../objects/table';
import { Focusable } from '../text/types';
import {
  RegionManager,
  BodyTextRegion,
  HeaderTextRegion,
  FooterTextRegion,
  FlowingTextContent
} from '../text';

// Double-click detection constants
const DOUBLE_CLICK_THRESHOLD = 300; // ms
const DOUBLE_CLICK_DISTANCE = 5; // pixels

export class CanvasManager extends EventEmitter {
  private container: HTMLElement;
  private document: Document;
  private options: Required<Omit<EditorOptions, 'customPageSize'>> & { customPageSize?: PageDimensions };
  private canvases: Map<string, HTMLCanvasElement> = new Map();
  private contexts: Map<string, CanvasRenderingContext2D> = new Map();
  private zoomLevel: number = 1;
  private selectedElements: Set<string> = new Set();
  private isDragging: boolean = false;
  private dragStart: Point | null = null;
  private isResizing: boolean = false;
  private resizeHandle: string | null = null;
  private resizeStartSize: Size | null = null;
  private resizeStartPos: Point | null = null;
  private flowingTextRenderer: FlowingTextRenderer;
  private showMargins: boolean = true;
  private isHandlingOverflow: boolean = false;
  private isSelectingText: boolean = false;
  private textSelectionStartPageId: string | null = null;
  private selectedSectionId: string | null = null;
  private _activeSection: EditingSection = 'body';
  private lastClickTime: number = 0;
  private lastClickPosition: Point | null = null;
  private editingTextBox: TextBoxObject | null = null;
  private _editingTextBoxPageId: string | null = null;
  private _focusedControl: Focusable | null = null;
  private _cursorSuspended: boolean = false;
  private isSelectingTextInTextBox: boolean = false;
  private regionManager: RegionManager;
  private tableResizeHandler: TableResizeHandler = new TableResizeHandler();
  private isSelectingTableCells: boolean = false;
  private tableCellSelectionPending: boolean = false;
  private tableCellSelectionStart: { row: number; col: number } | null = null;
  private tableCellSelectionStartPoint: Point | null = null;
  private tableCellSelectionTable: TableObject | null = null;
  private isSelectingTextInTableCell: boolean = false;
  private static readonly CELL_SELECTION_THRESHOLD = 5; // Minimum pixels to drag before cell selection starts

  constructor(container: HTMLElement, document: Document, options: Required<Omit<EditorOptions, 'customPageSize'>> & { customPageSize?: PageDimensions }) {
    super();
    this.container = container;
    this.document = document;
    this.options = options;
    this.flowingTextRenderer = new FlowingTextRenderer(document);
    this.regionManager = new RegionManager();
    this.setupFlowingTextListeners();
    this.initializeRegions();
  }

  /**
   * Initialize text regions from the document.
   */
  private initializeRegions(): void {
    const page = this.document.pages[0];
    if (!page) return;

    // Create body region
    const bodyRegion = new BodyTextRegion(
      page.flowingContent,
      (pageIndex: number) => this.document.pages[pageIndex] || null
    );
    this.regionManager.setBodyRegion(bodyRegion);

    // Create header region
    const headerRegion = new HeaderTextRegion(
      this.document.headerFlowingContent,
      (pageIndex: number) => this.document.pages[pageIndex] || null
    );
    this.regionManager.setHeaderRegion(headerRegion);

    // Create footer region
    const footerRegion = new FooterTextRegion(
      this.document.footerFlowingContent,
      (pageIndex: number) => this.document.pages[pageIndex] || null
    );
    this.regionManager.setFooterRegion(footerRegion);
  }

  async initialize(): Promise<void> {
    this.createCanvases();
    this.setupEventListeners();

    // Set initial focus on the body flowing content
    const page = this.document.pages[0];
    if (page?.flowingContent) {
      this.setFocus(page.flowingContent);
    }

    this.render();
  }

  private createCanvases(): void {
    this.document.pages.forEach(page => {
      const canvas = document.createElement('canvas');
      canvas.id = `canvas-${page.id}`;
      canvas.style.display = 'block';
      canvas.style.margin = '20px auto';
      canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      
      const dimensions = page.getPageDimensions();
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      
      this.container.appendChild(canvas);
      this.canvases.set(page.id, canvas);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        this.contexts.set(page.id, ctx);
      }
    });
  }

  setDocument(document: Document): void {
    this.clearCanvases();
    this.document = document;
    this.flowingTextRenderer.destroy();
    this.flowingTextRenderer = new FlowingTextRenderer(document);
    this.setupFlowingTextListeners();
    this.createCanvases();
    this.setupEventListeners();
    this.render();
  }

  private clearCanvases(): void {
    this.canvases.forEach(canvas => canvas.remove());
    this.canvases.clear();
    this.contexts.clear();
  }

  render(): void {
    this.document.pages.forEach(page => {
      const ctx = this.contexts.get(page.id);
      if (!ctx) return;

      const canvas = this.canvases.get(page.id);
      if (!canvas) return;

      // 1. BACKGROUND: Clear canvas and draw grid
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (this.options.showGrid) {
        this.drawGrid(ctx, canvas.width, canvas.height);
      }

      // 2. CONTENT: Render all text and elements
      const pageIndex = this.document.pages.findIndex(p => p.id === page.id);

      // Render header content
      const headerRegion = this.regionManager.getHeaderRegion();
      this.flowingTextRenderer.renderHeaderText(page, ctx, this._activeSection === 'header', headerRegion ?? undefined);

      // Render body (flowing text content)
      const contentBounds = page.getContentBounds();
      const contentRect: Rect = {
        x: contentBounds.position.x,
        y: contentBounds.position.y,
        width: contentBounds.size.width,
        height: contentBounds.size.height
      };
      this.flowingTextRenderer.renderPageFlowingText(page, ctx, contentRect);

      // Render footer content
      const footerRegion = this.regionManager.getFooterRegion();
      this.flowingTextRenderer.renderFooterText(page, ctx, this._activeSection === 'footer', footerRegion ?? undefined);

      // Render repeating section indicators (only in body)
      // Always get sections from the first page's flowingContent since body text flows from page 0
      const bodyFlowingContent = this.document.pages[0]?.flowingContent;
      const sections = bodyFlowingContent?.getRepeatingSections() ?? [];
      if (sections.length > 0) {
        const flowedPages = this.flowingTextRenderer.getFlowedPagesForPage(this.document.pages[0].id);
        if (flowedPages && flowedPages[pageIndex]) {
          const pageDimensions = page.getPageDimensions();
          const pageBounds: Rect = { x: 0, y: 0, width: pageDimensions.width, height: pageDimensions.height };
          this.flowingTextRenderer.renderRepeatingSectionIndicators(
            sections,
            pageIndex,
            ctx,
            contentRect,
            flowedPages[pageIndex],
            pageBounds,
            this.selectedSectionId
          );
        }
      }

      // Render all elements (without selection marks)
      this.renderPageElements(page, ctx);

      // 3. DISABLEMENT OVERLAYS: Draw overlays on inactive sections
      this.drawInactiveSectionOverlays(ctx, page);

      // 4. MARGIN LINES: Draw on top of overlays so they're always visible
      this.drawMarginLines(ctx, page);

      // 5. SELECTION MARKS: Draw resize handles last so they're always on top
      this.renderSelectionMarks(page, ctx);
    });
  }

  /**
   * Draw transparent white overlays on inactive sections.
   * Overlays span the full page width.
   */
  private drawInactiveSectionOverlays(ctx: CanvasRenderingContext2D, page: Page): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

    const pageDimensions = page.getPageDimensions();
    const contentBounds = page.getContentBounds();

    // Header area: from top of page to top of content area (full width)
    const headerHeight = contentBounds.position.y;

    // Footer area: from bottom of content area to bottom of page (full width)
    const footerY = contentBounds.position.y + contentBounds.size.height;
    const footerHeight = pageDimensions.height - footerY;

    // Draw overlay on header if not active
    if (this._activeSection !== 'header') {
      ctx.fillRect(0, 0, pageDimensions.width, headerHeight);
    }

    // Draw overlay on body if not active
    if (this._activeSection !== 'body') {
      ctx.fillRect(0, headerHeight, pageDimensions.width, contentBounds.size.height);
    }

    // Draw overlay on footer if not active
    if (this._activeSection !== 'footer') {
      ctx.fillRect(0, footerY, pageDimensions.width, footerHeight);
    }

    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    const gridSize = this.options.gridSize * this.zoomLevel;

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderPageElements(page: any, ctx: CanvasRenderingContext2D): void {
    // Collect all elements from all sections
    const elements: BaseElement[] = [];

    // Get elements from each section
    if (page.header && typeof page.header.getAllElements === 'function') {
      elements.push(...page.header.getAllElements());
    }
    if (page.content && typeof page.content.getAllElements === 'function') {
      elements.push(...page.content.getAllElements());
    }
    if (page.footer && typeof page.footer.getAllElements === 'function') {
      elements.push(...page.footer.getAllElements());
    }

    // Sort by z-index
    elements.sort((a, b) => a.zIndex - b.zIndex);

    // Render each element (without selection marks)
    elements.forEach(element => {
      element.render(ctx);
    });
  }

  /**
   * Render selection marks (resize handles) for selected elements.
   * Called separately to ensure selection marks are drawn on top of all other content.
   */
  private renderSelectionMarks(page: any, ctx: CanvasRenderingContext2D): void {
    // Collect all elements from all sections
    const elements: BaseElement[] = [];

    if (page.header && typeof page.header.getAllElements === 'function') {
      elements.push(...page.header.getAllElements());
    }
    if (page.content && typeof page.content.getAllElements === 'function') {
      elements.push(...page.content.getAllElements());
    }
    if (page.footer && typeof page.footer.getAllElements === 'function') {
      elements.push(...page.footer.getAllElements());
    }

    // Draw resize handles for selected elements
    elements.forEach(element => {
      if (element.selected && !element.locked) {
        this.drawResizeHandles(ctx, element);
      }
    });
  }
  
  private drawResizeHandles(ctx: CanvasRenderingContext2D, element: BaseElement): void {
    const bounds = element.getBounds();
    const handleSize = 8;
    const handles = this.getResizeHandles(bounds);
    
    ctx.save();
    ctx.fillStyle = '#0066ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    
    Object.entries(handles).forEach(([_, pos]) => {
      ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
    });
    
    ctx.restore();
  }
  
  private getResizeHandles(bounds: Rect): { [key: string]: Point } {
    return {
      'nw': { x: bounds.x, y: bounds.y },
      'n': { x: bounds.x + bounds.width / 2, y: bounds.y },
      'ne': { x: bounds.x + bounds.width, y: bounds.y },
      'e': { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
      'se': { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      's': { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
      'sw': { x: bounds.x, y: bounds.y + bounds.height },
      'w': { x: bounds.x, y: bounds.y + bounds.height / 2 }
    };
  }

  private setupEventListeners(): void {
    this.canvases.forEach((canvas, pageId) => {
      canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e, pageId));
      canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e, pageId));
      canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e, pageId));
      canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e, pageId));
      canvas.addEventListener('click', (e) => this.handleClick(e, pageId));
    });
  }

  private handleMouseDown(e: MouseEvent, pageId: string): void {
    const point = this.getMousePosition(e);

    // Check if clicking on a resize handle
    const handle = this.getResizeHandleAt(point, pageId);
    if (handle) {
      console.log('Mouse down on resize handle:', handle.handle, 'for element:', handle.element.id);
      this.isResizing = true;
      this.resizeHandle = handle.handle;
      this.dragStart = point;

      const element = this.getSelectedElementAt(pageId);
      if (element) {
        this.resizeStartSize = { ...element.size };
        this.resizeStartPos = { ...element.position };
      }

      e.preventDefault();
      return;
    }

    // Check if clicking on a table resize handle (column/row dividers)
    const tableResizeHandle = this.getTableResizeHandleAt(point);
    if (tableResizeHandle && tableResizeHandle.handleInfo) {
      const { table, handleInfo, tablePosition } = tableResizeHandle;
      this.tableResizeHandler.startResize(table, handleInfo, tablePosition);
      e.preventDefault();
      return;
    }

    // Check if clicking inside an editing table - handle cell selection or text selection
    if (this._focusedControl instanceof TableObject) {
      const table = this._focusedControl;
      if (table.renderedPosition && table.containsPoint(point, table.renderedPosition)) {
        const localPoint = {
          x: point.x - table.renderedPosition.x,
          y: point.y - table.renderedPosition.y
        };
        const cellAddr = table.getCellAtPoint(localPoint);
        if (cellAddr) {
          const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
          const ctx = this.contexts.get(pageId);

          // Handle Shift+Click for range selection
          if (e.shiftKey && table.focusedCell) {
            // Extend selection from focused cell to clicked cell
            table.selectRange({
              start: table.focusedCell,
              end: cellAddr
            });
            this.render();
            e.preventDefault();
            return;
          }

          // Check if clicking in the same cell that's already focused
          const isSameCell = table.focusedCell &&
            table.focusedCell.row === cellAddr.row &&
            table.focusedCell.col === cellAddr.col;

          if (isSameCell) {
            // Clicking in the same cell - start text selection within the cell
            const cell = table.getCell(cellAddr.row, cellAddr.col);
            if (cell && ctx && pageIndex >= 0) {
              const flowingContent = cell.flowingContent;

              // Clear any existing selection
              flowingContent.clearSelection();

              // Position cursor using unified region click handler
              this.flowingTextRenderer.handleRegionClick(cell, point, pageIndex, ctx);
              flowingContent.setSelectionAnchor();

              // Start text selection mode in table cell
              this.isSelectingTextInTableCell = true;
              this.tableCellSelectionTable = table;

              // Emit cursor changed event for table cell
              this.emit('tablecell-cursor-changed', {
                table,
                cell,
                cursorPosition: flowingContent.getCursorPosition()
              });
            }
          } else {
            // Clicking in a different cell - prepare for potential cell range selection
            // Don't start cell selection immediately - wait for minimum drag distance
            this.tableCellSelectionPending = true;
            this.tableCellSelectionStart = cellAddr;
            this.tableCellSelectionStartPoint = { ...point };
            this.tableCellSelectionTable = table;
            table.clearSelection();

            // Focus the clicked cell
            table.focusCell(cellAddr.row, cellAddr.col);

            // Get the cell and handle click for cursor positioning
            const cell = table.getCell(cellAddr.row, cellAddr.col);
            if (cell && ctx && pageIndex >= 0) {
              this.flowingTextRenderer.handleRegionClick(cell, point, pageIndex, ctx);

              // Emit cursor changed event for table cell
              this.emit('tablecell-cursor-changed', {
                table,
                cell,
                cursorPosition: cell.flowingContent.getCursorPosition()
              });
            }
          }

          this.render();
          e.preventDefault();
          return;
        }
      }
    }

    // Check if clicking inside an editing text box - start text selection
    if (this.editingTextBox && this._editingTextBoxPageId === pageId) {
      const textBox = this.editingTextBox;
      const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
      const ctx = this.contexts.get(pageId);

      if (ctx && pageIndex >= 0 && textBox.containsPointInRegion(point, pageIndex)) {
        const flowingContent = textBox.flowingContent;

        // Clear any existing selection
        flowingContent.clearSelection();

        // Position cursor using unified region click handler
        this.flowingTextRenderer.handleRegionClick(textBox, point, pageIndex, ctx);
        flowingContent.setSelectionAnchor();

        // Start text selection mode in text box
        this.isSelectingTextInTextBox = true;

        this.render();
        e.preventDefault();
        return;
      }
    }

    // Check if clicking on a regular element
    const element = this.getElementAtPoint(point, pageId);
    if (element) {
      this.isDragging = true;
      this.dragStart = point;
      return;
    }

    // Check if clicking on an embedded object in the active section
    // Object selection is handled in handleClick
    const activeFlowingContent = this.getFlowingContentForActiveSection();

    if (activeFlowingContent) {
      const embeddedObjects = activeFlowingContent.getEmbeddedObjects();
      for (const [, obj] of embeddedObjects.entries()) {
        if (obj.renderedPosition) {
          const objBounds = {
            x: obj.renderedPosition.x,
            y: obj.renderedPosition.y,
            width: obj.width,
            height: obj.height
          };
          if (point.x >= objBounds.x && point.x <= objBounds.x + objBounds.width &&
              point.y >= objBounds.y && point.y <= objBounds.y + objBounds.height) {
            // Clicking on embedded object - don't start text selection
            // handleClick will handle object selection
            return;
          }
        }
      }
    }

    // Check if clicking on text - start text selection for all sections
    const flowingContentForSection = this.getFlowingContentForActiveSection();
    if (flowingContentForSection) {
      // Use region-based click detection for unified handling
      const region = this.getRegionForActiveSection();
      const ctx = this.contexts.get(pageId);
      const pageIndex = this.document.pages.findIndex(p => p.id === pageId);

      if (region && ctx && pageIndex >= 0) {
        const result = this.flowingTextRenderer.handleRegionClick(region, point, pageIndex, ctx);
        if (result) {
          // Clear any existing selection and element selection
          this.clearSelection();
          flowingContentForSection.clearSelection();

          // Set selection anchor for drag selection
          flowingContentForSection.setSelectionAnchor(result.textIndex);

          // Start text selection mode
          this.isSelectingText = true;
          this.textSelectionStartPageId = pageId;

          this.render();
          e.preventDefault();
          return;
        }
      }
    }

    this.isDragging = true;
    this.dragStart = point;
  }

  private handleMouseMove(e: MouseEvent, pageId: string): void {
    const point = this.getMousePosition(e);

    // Handle text selection in text box
    if (this.isSelectingTextInTextBox && this.editingTextBox && this._editingTextBoxPageId === pageId) {
      const textBox = this.editingTextBox;
      const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
      const ctx = this.contexts.get(pageId);
      if (ctx && pageIndex >= 0) {
        // Update cursor position (selection extends from anchor)
        this.flowingTextRenderer.handleRegionClick(textBox, point, pageIndex, ctx);
        this.render();
      }
      e.preventDefault();
      return;
    }

    // Handle text selection in table cell
    if (this.isSelectingTextInTableCell && this.tableCellSelectionTable) {
      const table = this.tableCellSelectionTable;
      if (table.focusedCell) {
        const cell = table.getCell(table.focusedCell.row, table.focusedCell.col);
        if (cell) {
          const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
          const ctx = this.contexts.get(pageId);
          if (ctx && pageIndex >= 0) {
            // Update cursor position (selection extends from anchor)
            this.flowingTextRenderer.handleRegionClick(cell, point, pageIndex, ctx);
            this.render();
          }
        }
      }
      e.preventDefault();
      return;
    }

    // Handle text selection for all sections (body, header, footer)
    if (this.isSelectingText && this.textSelectionStartPageId) {
      const region = this.getRegionForActiveSection();
      const ctx = this.contexts.get(pageId);
      const pageIndex = this.document.pages.findIndex(p => p.id === pageId);

      if (region && ctx && pageIndex >= 0) {
        const result = this.flowingTextRenderer.handleRegionClick(region, point, pageIndex, ctx);
        if (result) {
          // Cursor position is already set by handleRegionClick
          // Selection extends from anchor (set on mousedown) to current position
          this.render();
        }
      }
      e.preventDefault();
      return;
    }

    // Handle table column/row resizing
    if (this.tableResizeHandler.isResizing) {
      if (this.tableResizeHandler.updateResize(point)) {
        this.render();
      }
      e.preventDefault();
      return;
    }

    // Handle pending table cell selection - check if we've exceeded the threshold
    if (this.tableCellSelectionPending && this.tableCellSelectionStartPoint && this.tableCellSelectionTable) {
      const dx = point.x - this.tableCellSelectionStartPoint.x;
      const dy = point.y - this.tableCellSelectionStartPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= CanvasManager.CELL_SELECTION_THRESHOLD) {
        // Threshold exceeded - activate cell selection
        this.tableCellSelectionPending = false;
        this.isSelectingTableCells = true;

        // Continue to the cell selection handling below
      } else {
        // Haven't exceeded threshold yet - wait for more movement
        e.preventDefault();
        return;
      }
    }

    // Handle table cell selection drag
    if (this.isSelectingTableCells && this.tableCellSelectionStart && this.tableCellSelectionTable) {
      const table = this.tableCellSelectionTable;
      if (table.renderedPosition) {
        const localPoint = {
          x: point.x - table.renderedPosition.x,
          y: point.y - table.renderedPosition.y
        };
        const cellAddr = table.getCellAtPoint(localPoint);
        if (cellAddr) {
          // Update selection range
          table.selectRange({
            start: this.tableCellSelectionStart,
            end: cellAddr
          });
          this.render();
        }
      }
      e.preventDefault();
      return;
    }

    // Handle resizing
    if (this.isResizing && this.dragStart && this.resizeHandle) {
      const deltaX = point.x - this.dragStart.x;
      const deltaY = point.y - this.dragStart.y;

      const element = this.getSelectedElementAt(pageId);
      if (element && this.resizeStartSize && this.resizeStartPos) {
        const newSize = this.calculateNewSize(
          this.resizeHandle,
          this.resizeStartSize,
          this.resizeStartPos,
          deltaX,
          deltaY
        );

        if (newSize.size.width > 20 && newSize.size.height > 20) {
          // Check if this is an embedded object by looking in all flowing content sources
          const page = this.document.getPage(pageId);
          let isEmbeddedObject = false;

          const flowingContents = [
            page?.flowingContent,
            this.document.headerFlowingContent,
            this.document.footerFlowingContent
          ];

          for (const flowingContent of flowingContents) {
            if (flowingContent) {
              const embeddedObjectManager = flowingContent.getEmbeddedObjectManager();
              const entry = embeddedObjectManager.findById(element.id);

              if (entry) {
                isEmbeddedObject = true;
                // Update the embedded object's size directly on the manager's object
                entry.object.size = { width: newSize.size.width, height: newSize.size.height };
                break;
              }
            }
          }

          if (!isEmbeddedObject) {
            // Regular element - update position and size
            element.position = newSize.position;
            element.size = newSize.size;
          }
        }
      }

      this.render();
      return;
    }
    
    // Handle dragging
    if (this.isDragging && this.dragStart) {
      const deltaX = point.x - this.dragStart.x;
      const deltaY = point.y - this.dragStart.y;
      
      // Move selected elements (both regular and inline elements)
      this.selectedElements.forEach(elementId => {
        const page = this.document.getPage(pageId);
        if (!page) return;
        
        // Check regular elements
        const element = page.content.getElement(elementId) ||
                       page.header.getElement(elementId) ||
                       page.footer.getElement(elementId);
        
        if (element && !element.locked) {
          element.move(deltaX, deltaY);
          return;
        }
        
        // Check embedded objects - for now, we'll only allow resizing, not moving
        // since moving embedded objects would require changing their position in the text flow
        const flowingContent = page.flowingContent;
        if (flowingContent) {
          const embeddedObjects = flowingContent.getEmbeddedObjects();
          for (const [, embeddedObj] of embeddedObjects.entries()) {
            if (embeddedObj.id === elementId && !embeddedObj.locked) {
              // For embedded objects, we only allow resizing, not dragging position
              // The position is determined by the text flow
              break;
            }
          }
        }
      });
      
      this.dragStart = point;
      this.render();
    }
    
    // Update cursor based on hover
    this.updateCursor(point, pageId);
  }

  private handleMouseUp(_e: MouseEvent, _pageId: string): void {
    // Finalize text selection in text box
    if (this.isSelectingTextInTextBox) {
      this.isSelectingTextInTextBox = false;
      // Selection state is already maintained by FlowingTextContent
    }

    // Finalize text selection in table cell
    if (this.isSelectingTextInTableCell) {
      this.isSelectingTextInTableCell = false;
      // Selection state is already maintained by FlowingTextContent
    }

    // Finalize text selection
    if (this.isSelectingText) {
      this.isSelectingText = false;
      this.textSelectionStartPageId = null;
      // Selection state is already maintained by FlowingTextContent
    }

    // Finalize table resize
    if (this.tableResizeHandler.isResizing) {
      this.tableResizeHandler.endResize();
    }

    // Finalize table cell selection (including pending state)
    if (this.isSelectingTableCells || this.tableCellSelectionPending) {
      this.isSelectingTableCells = false;
      this.tableCellSelectionPending = false;
      this.tableCellSelectionStart = null;
      this.tableCellSelectionStartPoint = null;
      this.tableCellSelectionTable = null;
      // Selection state is maintained by the TableObject
    }

    this.isDragging = false;
    this.isResizing = false;
    this.dragStart = null;
    this.resizeHandle = null;
    this.resizeStartSize = null;
    this.resizeStartPos = null;
  }

  private handleMouseLeave(_e: MouseEvent, _pageId: string): void {
    // End any active dragging operations when mouse leaves the canvas
    // Finalize text selection in text box if active
    if (this.isSelectingTextInTextBox) {
      this.isSelectingTextInTextBox = false;
    }

    // Finalize text selection in table cell if active
    if (this.isSelectingTextInTableCell) {
      this.isSelectingTextInTableCell = false;
    }

    // Finalize text selection if active
    if (this.isSelectingText) {
      this.isSelectingText = false;
      this.textSelectionStartPageId = null;
    }

    // Cancel table resize if active
    if (this.tableResizeHandler.isResizing) {
      this.tableResizeHandler.cancelResize();
    }

    // Finalize table cell selection if active (including pending state)
    if (this.isSelectingTableCells || this.tableCellSelectionPending) {
      this.isSelectingTableCells = false;
      this.tableCellSelectionPending = false;
      this.tableCellSelectionStart = null;
      this.tableCellSelectionStartPoint = null;
      this.tableCellSelectionTable = null;
    }

    this.isDragging = false;
    this.isResizing = false;
    this.dragStart = null;
    this.resizeHandle = null;
    this.resizeStartSize = null;
    this.resizeStartPos = null;

    // Reset cursor since we're no longer hovering
    const canvas = this.canvases.get(_pageId);
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }

  private handleClick(e: MouseEvent, pageId: string): void {
    const point = this.getMousePosition(e);
    const now = Date.now();

    // Check for double-click
    if (this.lastClickPosition) {
      const timeDiff = now - this.lastClickTime;
      const distance = Math.sqrt(
        Math.pow(point.x - this.lastClickPosition.x, 2) +
        Math.pow(point.y - this.lastClickPosition.y, 2)
      );

      if (timeDiff < DOUBLE_CLICK_THRESHOLD && distance < DOUBLE_CLICK_DISTANCE) {
        // This is a double-click
        this.handleDoubleClick(point, pageId);
        this.lastClickTime = 0;
        this.lastClickPosition = null;
        return;
      }
    }

    // Store click info for double-click detection
    this.lastClickTime = now;
    this.lastClickPosition = { ...point };

    // Handle focused table - clicks inside are handled by mousedown
    if (this._focusedControl instanceof TableObject) {
      const table = this._focusedControl;
      console.log('[handleClick] Focused table detected, checking if click is inside');
      console.log('[handleClick] Table renderedPosition:', table.renderedPosition);
      console.log('[handleClick] Click point:', point);
      if (table.renderedPosition && table.containsPoint(point, table.renderedPosition)) {
        // Click inside focused table - already handled by mousedown
        console.log('[handleClick] Click INSIDE focused table - returning early (mousedown handles it)');
        return;
      } else {
        // Click outside focused table - exit editing mode
        console.log('[handleClick] Click OUTSIDE focused table - exiting edit mode');
        this.setFocus(null);
      }
    } else {
      console.log('[handleClick] No focused table. _focusedControl:', this._focusedControl);
    }

    // Handle text box editing
    if (this.editingTextBox) {
      const textBox = this.editingTextBox;
      const renderedPos = textBox.renderedPosition;

      if (renderedPos) {
        // Check if click is inside the editing text box
        const textBoxBounds = {
          x: renderedPos.x,
          y: renderedPos.y,
          width: textBox.width,
          height: textBox.height
        };

        if (point.x >= textBoxBounds.x && point.x <= textBoxBounds.x + textBoxBounds.width &&
            point.y >= textBoxBounds.y && point.y <= textBoxBounds.y + textBoxBounds.height) {
          // Check if there's an active text selection (from drag-select)
          // If so, don't reposition cursor
          const selection = textBox.flowingContent.getSelection();
          if (selection && selection.start !== selection.end) {
            return;
          }
          // Click inside editing text box - position cursor (handled by mousedown now)
          // This is just a fallback for simple clicks
          return;
        } else {
          // Click outside editing text box - exit editing mode
          this.setEditingTextBox(null);
        }
      }
    }

    // Get the page for later use
    const page = this.document.getPage(pageId);

    // Check if we clicked on a regular element FIRST (before checking text selection)
    // This allows clicking on tables/text boxes even when text is selected
    const element = this.getElementAtPoint(point, pageId);
    if (element) {
      // Clear any text selection in the active section
      const flowingContent = this.getFlowingContentForActiveSection();
      if (flowingContent) {
        flowingContent.clearSelection();
      }
      if (!e.shiftKey) {
        this.clearSelection();
      }
      this.selectElement(element.id);
      return;
    }

    // Check if we clicked on an embedded object (inline table/text box in text flow)
    // This must be checked BEFORE the text selection early return
    const activeFlowingContent = this.getFlowingContentForActiveSection();

    if (activeFlowingContent) {
      const embeddedObjects = activeFlowingContent.getEmbeddedObjects();
      for (const [, obj] of embeddedObjects.entries()) {
        if (obj.renderedPosition) {
          const objBounds = {
            x: obj.renderedPosition.x,
            y: obj.renderedPosition.y,
            width: obj.width,
            height: obj.height
          };
          if (point.x >= objBounds.x && point.x <= objBounds.x + objBounds.width &&
              point.y >= objBounds.y && point.y <= objBounds.y + objBounds.height) {
            // Clicked on embedded object - clear text selection and select it
            if (activeFlowingContent) {
              activeFlowingContent.clearSelection();
            }
            this.clearSelection();
            this.selectInlineElement(obj);
            return;
          }
        }
      }
    }

    // Check if there's an active text selection - if so, don't process click
    // (this happens after drag-selecting text, prevents accidentally clearing selection)
    const selectionFlowingContent = this.getFlowingContentForActiveSection();
    if (selectionFlowingContent) {
      const selection = selectionFlowingContent.getSelection();
      if (selection && selection.start !== selection.end) {
        // There's an active selection, don't reset cursor
        return;
      }
    }

    // First check if we clicked on a repeating section indicator
    if (page && page.flowingContent) {
      const sections = page.flowingContent.getRepeatingSections();
      if (sections.length > 0) {
        const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
        const flowedPages = this.flowingTextRenderer.getFlowedPagesForPage(this.document.pages[0].id);
        if (flowedPages && flowedPages[pageIndex]) {
          const contentBounds = page.getContentBounds();
          const contentRect: Rect = {
            x: contentBounds.position.x,
            y: contentBounds.position.y,
            width: contentBounds.size.width,
            height: contentBounds.size.height
          };
          const pageDimensions = page.getPageDimensions();
          const pageBounds: Rect = { x: 0, y: 0, width: pageDimensions.width, height: pageDimensions.height };

          const clickedSection = this.flowingTextRenderer.getRepeatingSectionAtPoint(
            point,
            sections,
            pageIndex,
            pageBounds,
            contentRect,
            flowedPages[pageIndex]
          );

          if (clickedSection) {
            this.clearSelection();
            this.selectedSectionId = clickedSection.id;
            this.render();
            this.emit('repeating-section-clicked', { section: clickedSection });
            return;
          }
        }
      }
    }

    // If no regular element was clicked, try flowing text using unified region click handler
    const ctx = this.contexts.get(pageId);
    const pageIndex = this.document.pages.findIndex(p => p.id === pageId);

    if (ctx && pageIndex >= 0 && page) {
      // Detect which section was clicked and update active section
      const targetSection = this.getSectionAtPoint(point, page);
      if (targetSection !== this._activeSection) {
        this.setActiveSection(targetSection);
      }

      // Get the appropriate region based on active section
      const region = this.getRegionForActiveSection();

      if (region) {
        const result = this.flowingTextRenderer.handleRegionClick(region, point, pageIndex, ctx);

        if (result) {
          // Text was clicked - clear element selection for all sections
          this.clearSelection();

          // Clear text selection in the appropriate flowing content
          const flowingContent = this.getFlowingContentForActiveSection();
          if (flowingContent) {
            flowingContent.clearSelection();
          }

          this.render();
          return;
        }
      }

      // Check for inline elements in any region (handleRegionClick returns null for inline element clicks)
      // The inline-element-clicked event is emitted by handleRegionClick
      // Check if we should return without clearing selection
      const activeRegion = this.getRegionForActiveSection();
      if (activeRegion) {
        const localPoint = activeRegion.globalToLocal(point, pageIndex);
        if (localPoint) {
          // Point is in active region but no text was clicked - might be inline element
          // The event was already emitted, just return
          return;
        }
      }
    }

    // Nothing was clicked, clear selection
    this.clearSelection();
  }

  /**
   * Get the EditableTextRegion for the currently active section.
   */
  private getRegionForActiveSection() {
    switch (this._activeSection) {
      case 'header':
        return this.regionManager.getHeaderRegion();
      case 'footer':
        return this.regionManager.getFooterRegion();
      case 'body':
      default:
        return this.regionManager.getBodyRegion();
    }
  }

  /**
   * Get the FlowingTextContent for the currently active section.
   */
  getFlowingContentForActiveSection(): FlowingTextContent | null {
    switch (this._activeSection) {
      case 'header':
        return this.document.headerFlowingContent;
      case 'footer':
        return this.document.footerFlowingContent;
      case 'body':
      default:
        return this.document.pages[0]?.flowingContent || null;
    }
  }

  private getMousePosition(e: MouseEvent): Point {
    const canvas = e.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.zoomLevel,
      y: (e.clientY - rect.top) / this.zoomLevel
    };
  }

  private getResizeHandleAt(point: Point, pageId: string): { handle: string; element: BaseElement } | null {
    const page = this.document.getPage(pageId);
    if (!page) return null;
    
    // Check selected elements for resize handles
    for (const elementId of this.selectedElements) {
      // Check regular elements
      const element = page.header.getElement(elementId) ||
                     page.content.getElement(elementId) ||
                     page.footer.getElement(elementId);
      
      if (element && !element.locked) {
        const bounds = element.getBounds();
        const handles = this.getResizeHandles(bounds);
        const handleSize = 8;
        
        for (const [handleKey, handlePos] of Object.entries(handles)) {
          const distance = Math.sqrt(
            Math.pow(point.x - handlePos.x, 2) + Math.pow(point.y - handlePos.y, 2)
          );
          
          if (distance <= handleSize / 2) {
            return { handle: handleKey, element };
          }
        }
      }
      
      // Check embedded objects in all flowing content sources
      const flowingContents = [
        page.flowingContent,
        this.document.headerFlowingContent,
        this.document.footerFlowingContent
      ];

      for (const flowingContent of flowingContents) {
        if (flowingContent) {
          const embeddedObjects = flowingContent.getEmbeddedObjects();
          for (const [, embeddedObj] of embeddedObjects.entries()) {
            if (embeddedObj.id === elementId && !embeddedObj.locked) {
              // Use the rendered position for accurate handle detection
              const renderedPos = embeddedObj.renderedPosition;
              if (!renderedPos) continue;

              const bounds = {
                x: renderedPos.x,
                y: renderedPos.y,
                width: embeddedObj.width,
                height: embeddedObj.height
              };
              const handles = this.getResizeHandles(bounds);
              const handleSize = 8; // Match the handle size used in drawing

              for (const [handleKey, handlePos] of Object.entries(handles)) {
                const distance = Math.sqrt(
                  Math.pow(point.x - handlePos.x, 2) + Math.pow(point.y - handlePos.y, 2)
                );

                if (distance <= handleSize) {
                  return { handle: handleKey, element: embeddedObj as any };
                }
              }
            }
          }
        }
      }
    }
    
    return null;
  }

  private getSelectedElementAt(pageId: string): BaseElement | null {
    if (this.selectedElements.size === 0) return null;
    
    const page = this.document.getPage(pageId);
    if (!page) return null;
    
    const firstSelected = Array.from(this.selectedElements)[0];
    
    // Check regular elements first
    const regularElement = page.header.getElement(firstSelected) ||
                          page.content.getElement(firstSelected) ||
                          page.footer.getElement(firstSelected);
    
    if (regularElement) {
      return regularElement;
    }
    
    // Check embedded objects in all flowing content sources
    const flowingContents = [
      page.flowingContent,
      this.document.headerFlowingContent,
      this.document.footerFlowingContent
    ];

    for (const flowingContent of flowingContents) {
      if (flowingContent) {
        const embeddedObjects = flowingContent.getEmbeddedObjects();
        for (const [, embeddedObj] of embeddedObjects.entries()) {
          if (embeddedObj.id === firstSelected) {
            return embeddedObj as any;
          }
        }
      }
    }

    return null;
  }

  private calculateNewSize(
    handle: string,
    originalSize: Size,
    originalPos: Point,
    deltaX: number,
    deltaY: number
  ): { size: Size; position: Point } {
    const newSize = { ...originalSize };
    const newPos = { ...originalPos };

    switch (handle) {
      case 'nw':
        newSize.width = originalSize.width - deltaX;
        newSize.height = originalSize.height - deltaY;
        newPos.x = originalPos.x + deltaX;
        newPos.y = originalPos.y + deltaY;
        break;
      case 'n':
        newSize.height = originalSize.height - deltaY;
        newPos.y = originalPos.y + deltaY;
        break;
      case 'ne':
        newSize.width = originalSize.width + deltaX;
        newSize.height = originalSize.height - deltaY;
        newPos.y = originalPos.y + deltaY;
        break;
      case 'e':
        newSize.width = originalSize.width + deltaX;
        break;
      case 'se':
        newSize.width = originalSize.width + deltaX;
        newSize.height = originalSize.height + deltaY;
        break;
      case 's':
        newSize.height = originalSize.height + deltaY;
        break;
      case 'sw':
        newSize.width = originalSize.width - deltaX;
        newSize.height = originalSize.height + deltaY;
        newPos.x = originalPos.x + deltaX;
        break;
      case 'w':
        newSize.width = originalSize.width - deltaX;
        newPos.x = originalPos.x + deltaX;
        break;
    }

    return { size: newSize, position: newPos };
  }

  private updateCursor(point: Point, pageId: string): void {
    const canvas = this.canvases.get(pageId);
    if (!canvas) return;

    // Check for element resize handles
    const handle = this.getResizeHandleAt(point, pageId);
    if (handle) {
      const cursors: { [key: string]: string } = {
        'nw': 'nw-resize',
        'n': 'n-resize',
        'ne': 'ne-resize',
        'e': 'e-resize',
        'se': 'se-resize',
        's': 's-resize',
        'sw': 'sw-resize',
        'w': 'w-resize'
      };
      canvas.style.cursor = cursors[handle.handle] || 'default';
      return;
    }

    // Check for table resize handles
    const tableHandle = this.getTableResizeHandleAt(point);
    if (tableHandle && tableHandle.handleInfo) {
      canvas.style.cursor = TableResizeHandler.getCursorForHandle(tableHandle.handleInfo.type);
      return;
    }

    canvas.style.cursor = 'default';
  }

  /**
   * Get table resize handle at a point, if any.
   */
  private getTableResizeHandleAt(point: Point): {
    table: TableObject;
    handleInfo: ReturnType<TableResizeHandler['detectResizeHandle']>;
    tablePosition: Point;
  } | null {
    // Get the active flowing content
    const activeFlowingContent = this.getFlowingContentForActiveSection();
    if (!activeFlowingContent) return null;

    const embeddedObjects = activeFlowingContent.getEmbeddedObjects();
    for (const [, obj] of embeddedObjects.entries()) {
      if (obj instanceof TableObject && obj.renderedPosition) {
        const handleInfo = this.tableResizeHandler.detectResizeHandle(
          obj,
          point,
          obj.renderedPosition
        );
        if (handleInfo) {
          return {
            table: obj,
            handleInfo,
            tablePosition: obj.renderedPosition
          };
        }
      }
    }

    return null;
  }

  addElement(elementData: ElementData, pageId: string): void {
    const page = this.document.getPage(pageId);
    if (!page) return;

    const element = ElementFactory.createElement(elementData);
    page.content.addElement(element);
    
    
    this.render();
    this.emit('element-added', { element: elementData, pageId });
  }

  removeElement(elementId: string): void {
    // Find and remove element from any section
    this.document.pages.forEach(page => {
      if (page.header.getElement(elementId)) {
        page.header.removeElement(elementId);
      } else if (page.content.getElement(elementId)) {
        page.content.removeElement(elementId);
      } else if (page.footer.getElement(elementId)) {
        page.footer.removeElement(elementId);
      }
    });
    
    // Remove from selection
    this.selectedElements.delete(elementId);
    
    this.render();
    this.emit('element-removed', { elementId });
  }

  selectElement(elementId: string): void {
    console.log('Selecting element:', elementId);
    this.selectedElements.add(elementId);
    
    // Update element's selected state
    this.document.pages.forEach(page => {
      const element = page.header.getElement(elementId) ||
                     page.content.getElement(elementId) ||
                     page.footer.getElement(elementId);
      if (element) {
        console.log('Found element to select:', element.id);
        element.selected = true;
      }
    });
    
    console.log('Selected elements after selection:', Array.from(this.selectedElements));
    this.render();
    this.emit('selection-change', { selectedElements: Array.from(this.selectedElements) });
  }

  clearSelection(): void {
    console.log('clearSelection called, current selected elements:', Array.from(this.selectedElements));
    // Clear selected state on all elements (including inline elements)
    this.selectedElements.forEach(elementId => {
      console.log('Clearing selection for element:', elementId);
      this.document.pages.forEach(page => {
        // Check regular elements
        const element = page.header.getElement(elementId) ||
                       page.content.getElement(elementId) ||
                       page.footer.getElement(elementId);
        if (element) {
          console.log('Clearing selection on regular element:', elementId);
          element.selected = false;
        }

        // Check embedded objects in all flowing content sources (body, header, footer)
        const flowingContents = [
          page.flowingContent,
          this.document.headerFlowingContent,
          this.document.footerFlowingContent
        ].filter(Boolean);

        for (const flowingContent of flowingContents) {
          const embeddedObjects = flowingContent.getEmbeddedObjects();
          for (const [, embeddedObj] of embeddedObjects.entries()) {
            if (embeddedObj.id === elementId) {
              console.log('Clearing selection on embedded object:', elementId);
              embeddedObj.selected = false;
            }
          }
        }
      });
    });
    
    this.selectedElements.clear();
    this.selectedSectionId = null;
    console.log('About to render after clearing selection...');
    this.render();
    this.emit('selection-change', { selectedElements: [] });
  }

  /**
   * Get the IDs of all currently selected elements.
   */
  getSelectedElements(): string[] {
    return Array.from(this.selectedElements);
  }

  selectEmbeddedObject(embeddedObject: any, isPartOfRangeSelection: boolean = false): void {
    // Mark the embedded object as selected
    const obj = embeddedObject.object || embeddedObject;
    obj.selected = true;
    this.selectedElements.add(obj.id);

    // Also mark the object in the flowing content's embedded objects map
    // This ensures the selected state persists through text reflow
    // Check all flowing content sources (body, header, footer)
    const page = this.document.pages[0];
    const flowingContents = [
      page?.flowingContent,
      this.document.headerFlowingContent,
      this.document.footerFlowingContent
    ].filter(Boolean);

    let targetFlowingContent: any = null;
    for (const fc of flowingContents) {
      const embeddedObjects = fc.getEmbeddedObjects();
      for (const [, embeddedObj] of embeddedObjects.entries()) {
        if (embeddedObj.id === obj.id) {
          // Set selected on the object
          embeddedObj.selected = true;
          targetFlowingContent = fc;
          break;
        }
      }
      if (targetFlowingContent) break;
    }

    // If not part of a range selection, position cursor after object
    // (cursor visibility is handled by isCursorAfterFieldOrObject check in FlowingTextRenderer)
    if (!isPartOfRangeSelection && targetFlowingContent) {
      // Position cursor after the object (textIndex + 1 for the replacement char)
      const textIndex = embeddedObject.textIndex ?? obj.textIndex;
      if (textIndex !== undefined) {
        targetFlowingContent.setCursorPosition(textIndex + 1);
        targetFlowingContent.clearSelection();
      }
    }

    this.render();
    this.emit('selection-change', { selectedElements: Array.from(this.selectedElements) });
  }

  /**
   * @deprecated Use selectEmbeddedObject instead
   */
  selectInlineElement(inlineElement: any): void {
    this.selectEmbeddedObject(inlineElement);
  }

  getElementAtPoint(point: Point, pageId: string): ElementData | null {
    const page = this.document.getPage(pageId);
    if (!page) return null;
    
    // Check elements in reverse order (top to bottom)
    const allElements: BaseElement[] = [];
    
    if (page.header && typeof page.header.getAllElements === 'function') {
      allElements.push(...page.header.getAllElements());
    }
    if (page.content && typeof page.content.getAllElements === 'function') {
      allElements.push(...page.content.getAllElements());
    }
    if (page.footer && typeof page.footer.getAllElements === 'function') {
      allElements.push(...page.footer.getAllElements());
    }
    
    // Sort by z-index descending
    allElements.sort((a, b) => b.zIndex - a.zIndex);
    
    // Find first element that contains the point
    for (const element of allElements) {
      if (element.containsPoint(point)) {
        return element.toData();
      }
    }
    
    return null;
  }

  zoomIn(): void {
    this.setZoom(this.zoomLevel * 1.2);
  }

  zoomOut(): void {
    this.setZoom(this.zoomLevel / 1.2);
  }

  setZoom(level: number): void {
    this.zoomLevel = Math.max(0.1, Math.min(5, level));
    this.updateCanvasScale();
    this.emit('zoom-change', { zoom: this.zoomLevel });
  }

  private updateCanvasScale(): void {
    this.canvases.forEach(canvas => {
      canvas.style.transform = `scale(${this.zoomLevel})`;
      canvas.style.transformOrigin = 'top center';
    });
  }

  fitToWidth(): void {
    if (this.canvases.size === 0) return;
    
    const firstCanvas = this.canvases.values().next().value;
    if (!firstCanvas) return;

    const containerWidth = this.container.clientWidth - 40;
    const canvasWidth = firstCanvas.width;
    this.setZoom(containerWidth / canvasWidth);
  }

  fitToPage(): void {
    if (this.canvases.size === 0) return;
    
    const firstCanvas = this.canvases.values().next().value;
    if (!firstCanvas) return;

    const containerWidth = this.container.clientWidth - 40;
    const containerHeight = this.container.clientHeight - 40;
    const canvasWidth = firstCanvas.width;
    const canvasHeight = firstCanvas.height;
    
    const widthRatio = containerWidth / canvasWidth;
    const heightRatio = containerHeight / canvasHeight;
    
    this.setZoom(Math.min(widthRatio, heightRatio));
  }

  private setupFlowingTextListeners(): void {
    this.flowingTextRenderer.on('text-clicked', (data) => {
      this.emit('text-clicked', data);
    });
    
    this.flowingTextRenderer.on('cursor-changed', (data) => {
      this.emit('cursor-changed', data);
      this.render(); // Re-render to show field selection highlight
    });
    
    this.flowingTextRenderer.on('cursor-blink', () => {
      this.render();
    });
    
    this.flowingTextRenderer.on('selection-changed', (data) => {
      this.emit('text-selection-changed', data);
      this.render(); // Re-render to show selection highlight
    });
    
    this.flowingTextRenderer.on('text-overflow', (data) => {
      this.handleTextOverflow(data);
    });
    
    this.flowingTextRenderer.on('content-changed', () => {
      this.checkForEmptyPages();
    });
    
    this.flowingTextRenderer.on('inline-element-clicked', (data) => {
      console.log('[inline-element-clicked] Event received. Element:', data.element?.constructor?.name);
      console.log('[inline-element-clicked] _focusedControl:', this._focusedControl?.constructor?.name);
      console.log('[inline-element-clicked] _focusedControl === data.element:', this._focusedControl === data.element);

      // If we're editing a table and the clicked element is the same table, ignore this event
      // (the click is for cell navigation within the table, not for selecting the table)
      if (this._focusedControl instanceof TableObject && this._focusedControl === data.element) {
        console.log('[inline-element-clicked] Ignoring - same table is focused');
        return;
      }

      // If we're editing a text box and the clicked element is the same text box, ignore this event
      if (this.editingTextBox === data.element) {
        console.log('[inline-element-clicked] Ignoring - same text box is being edited');
        return;
      }

      // Select the inline element
      console.log('[inline-element-clicked] Selecting inline element and clearing selection');
      this.clearSelection();
      this.selectInlineElement(data.element);
    });

    // Handle substitution field clicks
    this.flowingTextRenderer.on('substitution-field-clicked', (data) => {
      console.log('[substitution-field-clicked] Field:', data.field?.fieldName, 'Section:', data.section);
      // Emit event for external handling (e.g., showing field properties panel)
      this.emit('substitution-field-clicked', data);
    });
  }
  
  private handleTextOverflow(data: any): void {
    // Prevent recursive overflow handling
    if (this.isHandlingOverflow) return;
    
    const { pageId, totalPages } = data;
    
    // Create additional pages for overflow content
    const currentPageIndex = this.document.pages.findIndex(p => p.id === pageId);
    if (currentPageIndex === -1) return;
    
    // Calculate how many new pages we need
    const existingPages = this.document.pages.length;
    const neededPages = currentPageIndex + totalPages;
    
    if (neededPages <= existingPages) {
      // We already have enough pages
      return;
    }
    
    this.isHandlingOverflow = true;
    
    try {
      // Add needed pages
      for (let i = existingPages; i < neededPages; i++) {
        this.createNewPage();
      }
      
      // Rebuild canvases for consistency
      this.clearCanvases();
      this.createCanvases();
      this.setupEventListeners();
      
      // Defer the render to break the synchronous call chain
      setTimeout(() => {
        this.isHandlingOverflow = false;
        this.render();
      }, 0);
      
      this.emit('pages-added', { newPageCount: this.document.pages.length - existingPages });
    } catch (error) {
      this.isHandlingOverflow = false;
      throw error;
    }
  }
  
  private createNewPage(): void {
    const existingPage = this.document.pages[0];
    if (!existingPage) return;
    
    const newPageData = {
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      header: {
        height: 0,
        elements: []
      },
      content: {
        elements: []
      },
      footer: {
        height: 0,
        elements: []
      }
    };
    
    const newPage = new Page(newPageData, this.document.settings);
    this.document.addPage(newPage);
  }

  showTextCursor(): void {
    // Focus the active section's FlowingTextContent to show cursor
    const flowingContent = this.getFlowingContentForActiveSection();
    if (flowingContent) {
      this.setFocus(flowingContent);
    }
    this.render();
  }

  hideTextCursor(): void {
    // Just suspend the cursor blink without clearing focus
    // This preserves the selection state when the editor loses browser focus
    this.suspendCursor();
    this.render();
  }

  /**
   * Suspend the cursor (stop blinking) without clearing focus.
   * Used when the editor loses browser focus but we want to preserve selection.
   */
  suspendCursor(): void {
    if (this._focusedControl && !this._cursorSuspended) {
      this._focusedControl.offCursorBlink(this.handleFocusedCursorBlink);
      this._cursorSuspended = true;
    }
  }

  /**
   * Resume the cursor after it was suspended.
   * Used when the editor regains browser focus.
   */
  resumeCursor(): void {
    if (this._focusedControl && this._cursorSuspended) {
      this._focusedControl.onCursorBlink(this.handleFocusedCursorBlink);
      this._cursorSuspended = false;
      this.render();
    }
  }

  /**
   * Check if cursor is currently suspended.
   */
  isCursorSuspended(): boolean {
    return this._cursorSuspended;
  }

  /**
   * Move cursor vertically by visual lines, maintaining X position.
   * Returns the new text index, or null if can't move.
   */
  moveCursorVertical(direction: -1 | 1): number | null {
    if (this.document.pages.length === 0) return null;
    const pageId = this.document.pages[0].id;
    return this.flowingTextRenderer.moveCursorVertical(direction, pageId);
  }

  private drawMarginLines(ctx: CanvasRenderingContext2D, page: any): void {
    if (!this.showMargins) return;
    
    const contentBounds = page.getContentBounds();
    const pageDimensions = page.getPageDimensions();
    
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    
    // Top margin
    ctx.beginPath();
    ctx.moveTo(0, contentBounds.position.y);
    ctx.lineTo(pageDimensions.width, contentBounds.position.y);
    ctx.stroke();
    
    // Bottom margin
    const bottomY = contentBounds.position.y + contentBounds.size.height;
    ctx.beginPath();
    ctx.moveTo(0, bottomY);
    ctx.lineTo(pageDimensions.width, bottomY);
    ctx.stroke();
    
    // Left margin
    ctx.beginPath();
    ctx.moveTo(contentBounds.position.x, 0);
    ctx.lineTo(contentBounds.position.x, pageDimensions.height);
    ctx.stroke();
    
    // Right margin
    const rightX = contentBounds.position.x + contentBounds.size.width;
    ctx.beginPath();
    ctx.moveTo(rightX, 0);
    ctx.lineTo(rightX, pageDimensions.height);
    ctx.stroke();
    
    ctx.restore();
  }
  

  checkForEmptyPages(): void {
    // Don't remove pages if we're in the middle of handling overflow
    if (this.isHandlingOverflow) return;
    
    // Always keep at least one page
    if (this.document.pages.length <= 1) return;
    
    // Get the current text flow to determine needed pages
    const firstPageFlowed = this.flowingTextRenderer.getFlowedPagesForPage(this.document.pages[0].id);
    if (!firstPageFlowed) return;
    
    const neededPages = firstPageFlowed.length;
    const currentPages = this.document.pages.length;
    
    if (currentPages === neededPages) return; // Nothing to do
    
    // Remove extra pages (always from the end)
    if (currentPages > neededPages && neededPages >= 1) {
      for (let i = currentPages - 1; i >= neededPages; i--) {
        this.document.removePage(this.document.pages[i].id);
      }
      
      // Rebuild canvases
      this.clearCanvases();
      this.createCanvases();
      this.setupEventListeners();
      
      // Defer render to avoid conflicts
      setTimeout(() => {
        this.render();
      }, 0);
      
      this.emit('pages-removed', { removedCount: currentPages - neededPages });
    }
  }

  /**
   * Set whether control characters are shown.
   */
  setShowControlCharacters(show: boolean): void {
    this.options.showControlCharacters = show;
    this.flowingTextRenderer.setShowControlCharacters(show);
    this.render();
  }

  /**
   * Set whether the grid is shown.
   */
  setShowGrid(show: boolean): void {
    this.options.showGrid = show;
    this.render();
  }

  /**
   * Get whether the grid is shown.
   */
  getShowGrid(): boolean {
    return this.options.showGrid;
  }

  /**
   * Set whether margin lines are shown.
   */
  setShowMarginLines(show: boolean): void {
    this.showMargins = show;
    this.render();
  }

  /**
   * Get whether margin lines are shown.
   */
  getShowMarginLines(): boolean {
    return this.showMargins;
  }

  /**
   * Get the currently active editing section.
   */
  getActiveSection(): EditingSection {
    return this._activeSection;
  }

  /**
   * Set the active editing section.
   * This changes which section receives keyboard input and cursor positioning.
   * Uses the unified focus system for cursor blink management.
   */
  setActiveSection(section: EditingSection): void {
    if (this._activeSection !== section) {
      const previousSection = this._activeSection;
      this._activeSection = section;

      // Get the appropriate region and set it as focused
      let region = null;
      if (section === 'body') {
        region = this.regionManager.getBodyRegion();
      } else if (section === 'header') {
        region = this.regionManager.getHeaderRegion();
      } else if (section === 'footer') {
        region = this.regionManager.getFooterRegion();
      }
      this.flowingTextRenderer.setFocusedRegion(region);

      // Use the unified focus system to manage focus on the appropriate FlowingTextContent
      const flowingContent = region?.flowingContent as Focusable | null;
      this.setFocus(flowingContent);

      this.render();
      this.emit('section-focus-changed', { section, previousSection });
    }
  }

  /**
   * Detect which section a point is in based on Y coordinate.
   * Uses full page width areas (not just content bounds).
   */
  private getSectionAtPoint(point: Point, page: Page): EditingSection {
    const contentBounds = page.getContentBounds();

    // Header area: from top of page to top of content area
    if (point.y < contentBounds.position.y) {
      return 'header';
    }

    // Footer area: from bottom of content area to bottom of page
    if (point.y >= contentBounds.position.y + contentBounds.size.height) {
      return 'footer';
    }

    // Default to body
    return 'body';
  }

  /**
   * Handle double-click to switch between sections or enter text box editing.
   */
  private handleDoubleClick(point: Point, pageId: string): void {
    const page = this.document.getPage(pageId);
    if (!page) return;

    // Check if we double-clicked on a text box (embedded object)
    const flowingContent = this.getFlowingContentForActiveSection();

    if (flowingContent) {
      const embeddedObjects = flowingContent.getEmbeddedObjects();
      const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
      for (const [, obj] of embeddedObjects.entries()) {
        if (obj instanceof TextBoxObject && obj.renderedPosition) {
          // Check if point is inside the text box using region interface
          if (obj.containsPointInRegion(point, pageIndex)) {
            // Enter editing mode for this text box
            this.setEditingTextBox(obj, pageId);
            // Position cursor at click point using unified region click handler
            const ctx = this.contexts.get(pageId);
            if (ctx && pageIndex >= 0) {
              this.flowingTextRenderer.handleRegionClick(obj, point, pageIndex, ctx);
            }
            this.render();
            return;
          }
        }

        // Handle TableObject double-clicks (enter editing mode)
        if (obj instanceof TableObject && obj.renderedPosition) {
          console.log('[handleDoubleClick] Found TableObject, checking containsPoint');
          console.log('[handleDoubleClick] Table renderedPosition:', obj.renderedPosition, 'size:', obj.size);
          console.log('[handleDoubleClick] Click point:', point);
          // Check if point is inside the table
          if (obj.containsPoint(point, obj.renderedPosition)) {
            console.log('[handleDoubleClick] Point IS inside table');
            const ctx = this.contexts.get(pageId);
            if (ctx && pageIndex >= 0) {
              // Convert point to table-local coordinates
              const localPoint = {
                x: point.x - obj.renderedPosition.x,
                y: point.y - obj.renderedPosition.y
              };

              // Find which cell was double-clicked
              const cellAddr = obj.getCellAtPoint(localPoint);
              console.log('[handleDoubleClick] Cell at point:', cellAddr);
              if (cellAddr) {
                // Clear any existing text box editing
                if (this.editingTextBox) {
                  this.setEditingTextBox(null);
                }

                // Focus the clicked cell
                console.log('[handleDoubleClick] Focusing cell:', cellAddr);
                obj.focusCell(cellAddr.row, cellAddr.col);

                // Get the cell and handle click for cursor positioning
                const cell = obj.getCell(cellAddr.row, cellAddr.col);
                console.log('[handleDoubleClick] Got cell:', cell?.id);
                if (cell) {
                  // Set this table as the focused control
                  console.log('[handleDoubleClick] Setting focus to table via setFocus()');
                  this.setFocus(obj);

                  // Position cursor using handleRegionClick
                  this.flowingTextRenderer.handleRegionClick(cell, point, pageIndex, ctx);
                }

                this.render();
                return;
              }
            }
          }
        }
      }
    }

    const targetSection = this.getSectionAtPoint(point, page);

    if (targetSection !== this._activeSection) {
      this.setActiveSection(targetSection);
    }

    // If clicking in header/footer, also handle text click using unified handler
    if (targetSection === 'header' || targetSection === 'footer') {
      const ctx = this.contexts.get(pageId);
      const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
      const region = targetSection === 'header'
        ? this.regionManager.getHeaderRegion()
        : this.regionManager.getFooterRegion();

      if (ctx && pageIndex >= 0 && region) {
        const result = this.flowingTextRenderer.handleRegionClick(region, point, pageIndex, ctx);
        if (result) {
          // Note: Don't call clearSelection() as it would reset the cursor position
          this.render();
        }
      }
    }
  }

  /**
   * Set the currently editing text box.
   * Uses the unified focus system internally.
   */
  setEditingTextBox(textBox: TextBoxObject | null, pageId?: string): void {
    const previousTextBox = this.editingTextBox;

    // Skip if same text box
    if (previousTextBox === textBox) return;

    this.editingTextBox = textBox;
    this._editingTextBoxPageId = pageId || null;

    if (textBox) {
      // Use the unified focus system to handle focus/blur and cursor blink
      // This blurs the previous control, hiding its cursor
      this.setFocus(textBox);

      // Clear selection in main flowing content
      const page = this.document.pages[0];
      if (page?.flowingContent) {
        page.flowingContent.clearSelection();
      }
      // Select the text box
      this.clearSelection();
      this.selectInlineElement({ type: 'embedded-object', object: textBox, textIndex: textBox.textIndex });
      this.emit('textbox-editing-started', { textBox });
    } else {
      // Restore focus to the active section's FlowingTextContent
      // This starts the cursor blink in the focused control
      const activeFlowingContent = this.getFlowingContentForActiveSection();
      if (activeFlowingContent) {
        this.setFocus(activeFlowingContent);
      } else {
        // Clear focus if no active section
        this.setFocus(null);
      }
      this.emit('textbox-editing-ended', {});
    }
  }

  /**
   * Get the currently editing text box.
   */
  getEditingTextBox(): TextBoxObject | null {
    return this.editingTextBox;
  }

  /**
   * Check if a text box is currently being edited.
   */
  isEditingTextBox(): boolean {
    return this.editingTextBox !== null;
  }

  /**
   * Get the page ID where text box is being edited.
   */
  getEditingTextBoxPageId(): string | null {
    return this._editingTextBoxPageId;
  }

  /**
   * Get the canvas rendering context for a page.
   */
  getContext(pageId: string): CanvasRenderingContext2D | null {
    return this.contexts.get(pageId) || null;
  }

  // ============================================
  // Unified Focus Management
  // ============================================

  /**
   * Set the currently focused control.
   * Handles blurring the previous control and focusing the new one.
   * Also manages cursor blink subscriptions for re-rendering.
   */
  setFocus(control: Focusable | null): void {
    if (this._focusedControl === control) {
      return;
    }

    // Blur the previous control and unsubscribe from cursor blink
    if (this._focusedControl) {
      this._focusedControl.offCursorBlink(this.handleFocusedCursorBlink);
      this._focusedControl.blur();
    }

    this._focusedControl = control;

    // Focus the new control and subscribe to cursor blink
    if (control) {
      control.focus();
      control.onCursorBlink(this.handleFocusedCursorBlink);
      this.emit('focus-changed', { control });
    } else {
      this.emit('focus-changed', { control: null });
    }
  }

  /**
   * Get the currently focused control.
   */
  getFocusedControl(): Focusable | null {
    return this._focusedControl;
  }

  /**
   * Handler for cursor blink events from the focused control.
   * Triggers a re-render to update cursor visibility.
   */
  private handleFocusedCursorBlink = (): void => {
    this.render();
  };

  destroy(): void {
    this.flowingTextRenderer.destroy();
    this.clearCanvases();
    this.removeAllListeners();
  }
}