import {
  FlowedPage,
  FlowedLine,
  TextFormattingStyle,
  FlowedSubstitutionField,
  FlowedEmbeddedObject,
  RepeatingSection,
  DEFAULT_FORMATTING,
  TextPositionCalculator,
  EditableTextRegion,
  FlowingTextContent
} from '../text';
import { Document } from '../core/Document';
import { Page } from '../core/Page';
import { Point, Rect, EditingSection } from '../types';
import { EventEmitter } from '../events/EventEmitter';
import { BaseEmbeddedObject, TextBoxObject, TableObject } from '../objects';

// Control character symbols
const CONTROL_CHAR_COLOR = '#87CEEB'; // Light blue
const PARAGRAPH_MARK = '¶';
const SPACE_DOT = '·';
const TAB_ARROW = '→';

// Repeating section indicator styling
const LOOP_INDICATOR_COLOR = '#6B46C1'; // Purple
const LOOP_LABEL_PADDING = 4;
const LOOP_LABEL_RADIUS = 4;
const LOOP_LINE_DASH = [4, 4];

// Table continuation tracking for multi-page tables
interface TableContinuation {
  table: TableObject;
  sliceIndex: number;
  pageLayout: import('../objects/table/types').TablePageLayout;
}

export class FlowingTextRenderer extends EventEmitter {
  private document: Document;
  private flowedPages: Map<string, FlowedPage[]> = new Map();
  private headerFlowedPage: FlowedPage | null = null;
  private footerFlowedPage: FlowedPage | null = null;
  private _focusedRegion: EditableTextRegion | null = null;
  private selectedText: { start: number; end: number } | null = null;
  private showControlCharacters: boolean = false;
  // Track tables that continue onto subsequent pages
  private tableContinuations: Map<string, TableContinuation> = new Map();

  constructor(document: Document) {
    super();
    this.document = document;
    this.setupFlowingContentListeners();
  }

  /**
   * Set whether control characters are shown.
   */
  setShowControlCharacters(show: boolean): void {
    this.showControlCharacters = show;
  }

  // ============================================
  // On-Demand Cursor Position Calculation
  // ============================================

  /**
   * Find the cursor location (page, line) for a given text index in body content.
   * Returns null if not found.
   */
  private findCursorLocationInBody(textIndex: number): {
    pageIndex: number;
    lineIndex: number;
    line: FlowedLine;
    flowedPage: FlowedPage;
  } | null {
    const firstPage = this.document.pages[0];
    if (!firstPage) return null;

    const flowedPages = this.flowedPages.get(firstPage.id);
    if (!flowedPages || flowedPages.length === 0) return null;

    for (let pageIndex = 0; pageIndex < flowedPages.length; pageIndex++) {
      const flowedPage = flowedPages[pageIndex];
      for (let lineIndex = 0; lineIndex < flowedPage.lines.length; lineIndex++) {
        const line = flowedPage.lines[lineIndex];
        if (textIndex >= line.startIndex && textIndex <= line.endIndex) {
          return { pageIndex, lineIndex, line, flowedPage };
        }
      }
    }

    // Cursor at end of text - return last line
    if (flowedPages.length > 0) {
      const lastPageIndex = flowedPages.length - 1;
      const lastPage = flowedPages[lastPageIndex];
      if (lastPage.lines.length > 0) {
        const lastLineIndex = lastPage.lines.length - 1;
        return {
          pageIndex: lastPageIndex,
          lineIndex: lastLineIndex,
          line: lastPage.lines[lastLineIndex],
          flowedPage: lastPage
        };
      }
    }

    return null;
  }

  /**
   * Find the cursor location (line) for a given text index in header/footer.
   */
  private findCursorLocationInSection(
    textIndex: number,
    section: 'header' | 'footer'
  ): { lineIndex: number; line: FlowedLine; flowedPage: FlowedPage } | null {
    const flowedPage = section === 'header' ? this.headerFlowedPage : this.footerFlowedPage;
    if (!flowedPage || flowedPage.lines.length === 0) return null;

    for (let lineIndex = 0; lineIndex < flowedPage.lines.length; lineIndex++) {
      const line = flowedPage.lines[lineIndex];
      if (textIndex >= line.startIndex && textIndex <= line.endIndex) {
        return { lineIndex, line, flowedPage };
      }
    }

    // Cursor at end - return last line
    const lastLineIndex = flowedPage.lines.length - 1;
    return {
      lineIndex: lastLineIndex,
      line: flowedPage.lines[lastLineIndex],
      flowedPage
    };
  }

  /**
   * Calculate the cursor position for rendering.
   * This is called on-demand during rendering instead of caching.
   */
  private calculateCursorPosition(
    ctx: CanvasRenderingContext2D
  ): { x: number; y: number; height: number; pageIndex: number } | null {
    const activeContent = this.getActiveFlowingContent();
    if (!activeContent) return null;

    const textIndex = activeContent.getCursorPosition();
    const firstPage = this.document.pages[0];
    if (!firstPage) return null;

    if (this.getActiveSection() === 'body') {
      const location = this.findCursorLocationInBody(textIndex);
      if (!location) return null;

      const contentBounds = firstPage.getContentBounds();
      const maxWidth = contentBounds.size.width;
      const alignmentOffset = TextPositionCalculator.getAlignmentOffset(location.line, maxWidth);
      const xOffset = TextPositionCalculator.getXPositionForTextIndex(location.line, textIndex, ctx);

      // Calculate Y position
      let y = contentBounds.position.y;

      // Add heights of previous pages
      const flowedPages = this.flowedPages.get(firstPage.id) || [];
      for (let p = 0; p < location.pageIndex; p++) {
        for (const line of flowedPages[p].lines) {
          y += line.height;
        }
      }

      // Add heights of lines before cursor line on current page
      for (let l = 0; l < location.lineIndex; l++) {
        y += location.flowedPage.lines[l].height;
      }

      return {
        x: contentBounds.position.x + alignmentOffset + xOffset,
        y,
        height: location.line.height,
        pageIndex: location.pageIndex
      };
    } else {
      // Header or footer
      const section = this.getActiveSection() as 'header' | 'footer';
      const location = this.findCursorLocationInSection(textIndex, section);
      if (!location) return null;

      const bounds = section === 'header'
        ? firstPage.getHeaderBounds()
        : firstPage.getFooterBounds();
      const maxWidth = bounds.size.width;
      const alignmentOffset = TextPositionCalculator.getAlignmentOffset(location.line, maxWidth);
      const xOffset = TextPositionCalculator.getXPositionForTextIndex(location.line, textIndex, ctx);

      // Calculate Y position
      let y = bounds.position.y;
      for (let l = 0; l < location.lineIndex; l++) {
        y += location.flowedPage.lines[l].height;
      }

      return {
        x: bounds.position.x + alignmentOffset + xOffset,
        y,
        height: location.line.height,
        pageIndex: 0
      };
    }
  }

  /**
   * Set the focused region.
   * This replaces the old setActiveSection method.
   * The region provides both the FlowingTextContent and section type.
   */
  setFocusedRegion(region: EditableTextRegion | null): void {
    this._focusedRegion = region;
  }

  /**
   * Get the focused region.
   */
  getFocusedRegion(): EditableTextRegion | null {
    return this._focusedRegion;
  }

  /**
   * Get the currently active section.
   * Returns the section type derived from the focused region.
   */
  getActiveSection(): EditingSection {
    if (this._focusedRegion) {
      const type = this._focusedRegion.type;
      if (type === 'textbox' || type === 'tablecell') {
        // Text boxes and table cells are treated as part of the body section for legacy compatibility
        return 'body';
      }
      return type;
    }
    // Default to body if no region is focused
    return 'body';
  }

  /**
   * Get the FlowingTextContent for the focused region.
   */
  private getActiveFlowingContent() {
    if (this._focusedRegion) {
      return this._focusedRegion.flowingContent;
    }
    // Default to body if no region is focused
    const firstPage = this.document.pages[0];
    return firstPage?.flowingContent || null;
  }

  private setupFlowingContentListeners(): void {
    // Listen to content changes from the first page's flowing content (body)
    if (this.document.pages.length > 0) {
      const firstPage = this.document.pages[0];

      firstPage.flowingContent.on('content-changed', () => {
        // Forward the event so CanvasManager can check for empty pages
        this.emit('content-changed');
      });

      firstPage.flowingContent.on('selection-changed', (data) => {
        if (this.getActiveSection() === 'body') {
          // Update the selection display
          if (data.selection) {
            this.setTextSelection(data.selection.start, data.selection.end);
          } else {
            this.clearTextSelection();
          }
          // Trigger a render to show the updated selection
          this.emit('selection-changed', data);
        }
      });
    }

    // Listen to header content changes
    this.document.headerFlowingContent.on('content-changed', () => {
      this.emit('header-content-changed');
      this.emit('content-changed');
    });

    this.document.headerFlowingContent.on('selection-changed', (data) => {
      if (this.getActiveSection() === 'header') {
        if (data.selection) {
          this.setTextSelection(data.selection.start, data.selection.end);
        } else {
          this.clearTextSelection();
        }
        this.emit('selection-changed', data);
      }
    });

    // Listen to footer content changes
    this.document.footerFlowingContent.on('content-changed', () => {
      this.emit('footer-content-changed');
      this.emit('content-changed');
    });

    this.document.footerFlowingContent.on('selection-changed', (data) => {
      if (this.getActiveSection() === 'footer') {
        if (data.selection) {
          this.setTextSelection(data.selection.start, data.selection.end);
        } else {
          this.clearTextSelection();
        }
        this.emit('selection-changed', data);
      }
    });
  }

  renderPageFlowingText(
    page: Page,
    ctx: CanvasRenderingContext2D,
    contentBounds: Rect
  ): void {
    // Only flow text from the first page
    const pageIndex = this.document.pages.findIndex(p => p.id === page.id);

    if (pageIndex === 0) {
      // Clear table continuations when starting a new render cycle
      this.clearTableContinuations();

      // This is the first page, flow all text
      const flowedPages = this.flowTextForPage(page, ctx, contentBounds);
      this.flowedPages.set(page.id, flowedPages);

      // Check if we need additional pages for overflow
      if (flowedPages.length > 1) {
        this.emit('text-overflow', { 
          pageId: page.id, 
          overflowPages: flowedPages.slice(1),
          totalPages: flowedPages.length 
        });
      }
      
      // Render the first flowed page
      if (flowedPages.length > 0) {
        this.renderFlowedPage(flowedPages[0], ctx, contentBounds, 0, page.flowingContent);
      }
    } else {
      // For subsequent pages, get the flowed content from the first page
      const firstPageFlowed = this.flowedPages.get(this.document.pages[0].id);
      if (firstPageFlowed && firstPageFlowed.length > pageIndex) {
        this.renderFlowedPage(firstPageFlowed[pageIndex], ctx, contentBounds, pageIndex, this.document.pages[0].flowingContent);
      }
    }

    // Render cursor if visible and on this page (only when body is active)
    // Use FlowingTextContent's isCursorVisible() for proper blink state
    const bodyFlowingContent = page.flowingContent;
    if (this.getActiveSection() === 'body' && bodyFlowingContent.isCursorVisible()) {
      this.renderCursor(ctx, pageIndex);
    }

    // Render selection if any (only when body is active)
    if (this.getActiveSection() === 'body' && this.selectedText) {
      const flowedPagesForSelection = pageIndex === 0
        ? this.flowedPages.get(page.id)
        : this.flowedPages.get(this.document.pages[0].id);

      if (flowedPagesForSelection && flowedPagesForSelection.length > pageIndex) {
        this.renderTextSelection(flowedPagesForSelection[pageIndex], ctx, contentBounds);
      }
    }
  }

  /**
   * Render header text content.
   * @param page The page to get header bounds from
   * @param ctx Canvas rendering context
   * @param isActive Whether header is the active editing section
   */
  renderHeaderText(
    page: Page,
    ctx: CanvasRenderingContext2D,
    isActive: boolean,
    region?: EditableTextRegion
  ): void {
    const headerBounds = page.getHeaderBounds();
    const bounds: Rect = {
      x: headerBounds.position.x,
      y: headerBounds.position.y,
      width: headerBounds.size.width,
      height: headerBounds.size.height
    };

    // Flow the header content
    const headerContent = this.document.headerFlowingContent;
    const flowedPages = headerContent.flowText(bounds.width, bounds.height, ctx);

    if (flowedPages.length > 0) {
      this.headerFlowedPage = flowedPages[0];

      // Use unified renderRegion if region is provided
      if (region) {
        this.renderRegion(region, ctx, 0, {
          renderCursor: isActive,
          renderSelection: isActive
        });
      } else {
        // Fallback to old rendering path
        this.renderFlowedPage(flowedPages[0], ctx, bounds, 0, this.document.headerFlowingContent);

        // Render cursor if header is active (position calculated on-demand)
        if (isActive && this.document.headerFlowingContent.isCursorVisible()) {
          this.renderCursor(ctx, 0);
        }

        // Render selection if any and header is active
        if (isActive && this.selectedText) {
          this.renderTextSelection(flowedPages[0], ctx, bounds);
        }
      }
    } else {
      this.headerFlowedPage = null;
    }
  }

  /**
   * Render footer text content.
   * @param page The page to get footer bounds from
   * @param ctx Canvas rendering context
   * @param isActive Whether footer is the active editing section
   * @param region Optional region for unified rendering
   */
  renderFooterText(
    page: Page,
    ctx: CanvasRenderingContext2D,
    isActive: boolean,
    region?: EditableTextRegion
  ): void {
    const footerBounds = page.getFooterBounds();
    const bounds: Rect = {
      x: footerBounds.position.x,
      y: footerBounds.position.y,
      width: footerBounds.size.width,
      height: footerBounds.size.height
    };

    // Flow the footer content
    const footerContent = this.document.footerFlowingContent;
    const flowedPages = footerContent.flowText(bounds.width, bounds.height, ctx);

    if (flowedPages.length > 0) {
      this.footerFlowedPage = flowedPages[0];

      // Use unified renderRegion if region is provided
      if (region) {
        this.renderRegion(region, ctx, 0, {
          renderCursor: isActive,
          renderSelection: isActive
        });
      } else {
        // Fallback to old rendering path
        this.renderFlowedPage(flowedPages[0], ctx, bounds, 0, this.document.footerFlowingContent);

        // Render cursor if footer is active (position calculated on-demand)
        if (isActive && this.document.footerFlowingContent.isCursorVisible()) {
          this.renderCursor(ctx, 0);
        }

        // Render selection if any and footer is active
        if (isActive && this.selectedText) {
          this.renderTextSelection(flowedPages[0], ctx, bounds);
        }
      }
    } else {
      this.footerFlowedPage = null;
    }
  }

  /**
   * Unified click handler for any EditableTextRegion.
   *
   * @param region The text region that was clicked
   * @param point Click point in canvas coordinates
   * @param pageIndex The page index where the click occurred
   * @param ctx Canvas context for text measurement
   * @returns Object with textIndex and lineIndex if click was in text, or null
   */
  handleRegionClick(
    region: EditableTextRegion,
    point: Point,
    pageIndex: number,
    ctx: CanvasRenderingContext2D
  ): { textIndex: number; lineIndex: number } | null {
    // Convert global point to local coordinates
    const localPoint = region.globalToLocal(point, pageIndex);
    if (!localPoint) {
      return null; // Click is outside this region
    }

    // Get flowed lines from the renderer's cache based on region type
    // (Regions don't maintain their own cache - renderer is the source of truth)
    const flowedLines = this.getFlowedLinesForRegion(region, pageIndex);
    const maxWidth = this.getAvailableWidthForRegion(region, pageIndex);

    // Handle empty content - cursor at position 0
    if (flowedLines.length === 0) {
      region.flowingContent.setCursorPosition(0);
      region.flowingContent.resetCursorBlink();

      this.emit('text-clicked', { textIndex: 0, line: 0, section: region.type });
      this.emit('cursor-changed', { textIndex: 0, section: region.type });
      return { textIndex: 0, lineIndex: 0 };
    }

    // Find line at Y position using TextPositionCalculator
    const lineResult = TextPositionCalculator.findLineAtY(flowedLines, localPoint.y);

    if (lineResult) {
      const { line, lineIndex } = lineResult;

      // Calculate alignment offset for this line
      const alignmentOffset = TextPositionCalculator.getAlignmentOffset(line, maxWidth);
      const bounds = region.getRegionBounds(pageIndex);

      // Check for inline element click in any region (body, header, footer)
      if (bounds) {
        const lineY = bounds.y + lineResult.lineY;
        const lineStartX = bounds.x + alignmentOffset;
        const inlineElement = this.getInlineElementAtPoint(line, point, lineY, lineStartX);
        if (inlineElement) {
          this.emit('inline-element-clicked', { element: inlineElement, point, section: region.type });
          return null; // Let inline element handler manage this
        }

        // Check for substitution field click
        const field = this.getSubstitutionFieldAtPoint(line, point, lineY, lineStartX);
        if (field) {
          this.emit('substitution-field-clicked', { field, point, section: region.type });
          // Set cursor at the field position but don't return null - still process as text click
          // This allows the field to be selected while still setting cursor position
        }
      }

      // Find text index at X position
      const textX = localPoint.x - alignmentOffset;
      const textIndex = TextPositionCalculator.getTextIndexAtX(line, textX, ctx);

      // Set cursor position in the region's FlowingTextContent
      region.flowingContent.setCursorPosition(textIndex);
      region.flowingContent.resetCursorBlink();

      this.emit('text-clicked', { textIndex, line: lineIndex, section: region.type });
      this.emit('cursor-changed', { textIndex, section: region.type });
      return { textIndex, lineIndex };
    }

    // Click is below all lines - position cursor at end of last line
    const lastLineIndex = flowedLines.length - 1;
    const lastLine = flowedLines[lastLineIndex];
    const textIndex = lastLine.endIndex;

    region.flowingContent.setCursorPosition(textIndex);
    region.flowingContent.resetCursorBlink();

    this.emit('text-clicked', { textIndex, line: lastLineIndex, section: region.type });
    this.emit('cursor-changed', { textIndex, section: region.type });
    return { textIndex, lineIndex: lastLineIndex };
  }

  /**
   * Get flowed lines for a region from the renderer's cache.
   * This is the source of truth for flowed content.
   */
  private getFlowedLinesForRegion(region: EditableTextRegion, pageIndex: number): FlowedLine[] {
    switch (region.type) {
      case 'header':
        return this.headerFlowedPage?.lines || [];
      case 'footer':
        return this.footerFlowedPage?.lines || [];
      case 'body': {
        // Get the page ID for this page index
        const page = this.document.pages[pageIndex];
        if (!page) return [];
        const flowedPages = this.flowedPages.get(page.id);
        // For body, we use the first flowed page (pageIndex within the flowedPages array)
        // Since body content flows across pages, we need the lines for this specific page
        if (flowedPages && flowedPages.length > 0) {
          // The flowedPages array contains pages of content that flowed from the body
          // For a single page document, pageIndex 0 maps to flowedPages[0]
          return flowedPages[0]?.lines || [];
        }
        return [];
      }
      case 'textbox':
        // Text boxes maintain their own flowed lines
        return region.getFlowedLines(pageIndex);
      case 'tablecell':
        // Table cells maintain their own flowed lines
        return region.getFlowedLines(pageIndex);
      default:
        return [];
    }
  }

  /**
   * Get available width for a region.
   */
  private getAvailableWidthForRegion(region: EditableTextRegion, pageIndex: number): number {
    const bounds = region.getRegionBounds(pageIndex);
    return bounds?.width || 0;
  }

  /**
   * Unified rendering method for any EditableTextRegion.
   * This can render body, header, footer, or text box content.
   *
   * @param region The text region to render
   * @param ctx Canvas rendering context
   * @param pageIndex The page index to render for
   * @param options Rendering options
   */
  renderRegion(
    region: EditableTextRegion,
    ctx: CanvasRenderingContext2D,
    pageIndex: number,
    options: {
      renderCursor?: boolean;
      renderSelection?: boolean;
      clipToBounds?: boolean;
    } = {}
  ): void {
    const {
      renderCursor = true,
      renderSelection = true,
      clipToBounds = false
    } = options;

    const bounds = region.getRegionBounds(pageIndex);
    if (!bounds) return;

    // Get flowed lines from the renderer's cache (source of truth)
    const flowedLines = this.getFlowedLinesForRegion(region, pageIndex);
    const maxWidth = this.getAvailableWidthForRegion(region, pageIndex);
    const flowingContent = region.flowingContent;

    // Get cursor position for field selection highlighting
    const cursorTextIndex = flowingContent.getCursorPosition();

    // Setup clipping if requested (useful for text boxes)
    if (clipToBounds) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.clip();
    }

    // Render selection highlight first (behind text)
    if (renderSelection && flowingContent.hasFocus()) {
      const selection = flowingContent.getSelection();
      if (selection && selection.start !== selection.end) {
        this.renderRegionSelection(flowedLines, ctx, bounds, maxWidth, selection);
      }
    }

    // Render each line
    let y = bounds.y;
    for (let lineIndex = 0; lineIndex < flowedLines.length; lineIndex++) {
      const line = flowedLines[lineIndex];

      // Skip lines that are outside the visible bounds
      if (clipToBounds && y + line.height < bounds.y) {
        y += line.height;
        continue;
      }
      if (clipToBounds && y > bounds.y + bounds.height) {
        break;
      }

      this.renderFlowedLine(line, ctx, { x: bounds.x, y }, maxWidth, pageIndex, cursorTextIndex);
      y += line.height;
    }

    // Render cursor if this region is active and cursor should be shown
    if (renderCursor && flowingContent.hasFocus() && flowingContent.isCursorVisible()) {
      this.renderRegionCursor(flowedLines, ctx, bounds, maxWidth, cursorTextIndex);
    }

    if (clipToBounds) {
      ctx.restore();
    }
  }

  /**
   * Render selection highlight for a region.
   */
  private renderRegionSelection(
    flowedLines: FlowedLine[],
    ctx: CanvasRenderingContext2D,
    bounds: Rect,
    maxWidth: number,
    selection: { start: number; end: number }
  ): void {
    const selStart = Math.min(selection.start, selection.end);
    const selEnd = Math.max(selection.start, selection.end);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 102, 204, 0.3)';

    let y = bounds.y;
    for (const line of flowedLines) {
      // Check if this line overlaps with selection
      if (selEnd > line.startIndex && selStart < line.endIndex) {
        const lineSelStart = Math.max(selStart, line.startIndex);
        const lineSelEnd = Math.min(selEnd, line.endIndex);

        const alignmentOffset = TextPositionCalculator.getAlignmentOffset(line, maxWidth);
        const startX = bounds.x + alignmentOffset + TextPositionCalculator.getXPositionForTextIndex(line, lineSelStart, ctx);
        const endX = bounds.x + alignmentOffset + TextPositionCalculator.getXPositionForTextIndex(line, lineSelEnd, ctx);

        ctx.fillRect(startX, y, endX - startX, line.height);
      }
      y += line.height;
    }

    ctx.restore();
  }

  /**
   * Render cursor for a region.
   */
  private renderRegionCursor(
    flowedLines: FlowedLine[],
    ctx: CanvasRenderingContext2D,
    bounds: Rect,
    maxWidth: number,
    cursorTextIndex: number
  ): void {
    // Find the line containing the cursor
    let y = bounds.y;
    for (const line of flowedLines) {
      if (cursorTextIndex >= line.startIndex && cursorTextIndex <= line.endIndex) {
        const alignmentOffset = TextPositionCalculator.getAlignmentOffset(line, maxWidth);
        const cursorX = bounds.x + alignmentOffset + TextPositionCalculator.getXPositionForTextIndex(line, cursorTextIndex, ctx);

        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cursorX, y);
        ctx.lineTo(cursorX, y + line.height);
        ctx.stroke();
        ctx.restore();
        return;
      }
      y += line.height;
    }

    // Cursor at end of content (after last line)
    if (flowedLines.length > 0) {
      const lastLine = flowedLines[flowedLines.length - 1];
      const alignmentOffset = TextPositionCalculator.getAlignmentOffset(lastLine, maxWidth);
      const cursorX = bounds.x + alignmentOffset + TextPositionCalculator.getXPositionForTextIndex(lastLine, cursorTextIndex, ctx);

      // Calculate Y for last line
      y = bounds.y;
      for (let i = 0; i < flowedLines.length - 1; i++) {
        y += flowedLines[i].height;
      }

      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorX, y);
      ctx.lineTo(cursorX, y + lastLine.height);
      ctx.stroke();
      ctx.restore();
    } else {
      // Empty content - render cursor at start
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bounds.x, bounds.y);
      ctx.lineTo(bounds.x, bounds.y + 14); // Default height
      ctx.stroke();
      ctx.restore();
    }
  }

  private flowTextForPage(
    page: Page,
    ctx: CanvasRenderingContext2D,
    bounds: Rect
  ): FlowedPage[] {
    const flowingContent = page.flowingContent;
    return flowingContent.flowText(bounds.width, bounds.height, ctx);
  }

  private renderFlowedPage(
    flowedPage: FlowedPage,
    ctx: CanvasRenderingContext2D,
    bounds: Rect,
    pageIndex: number,
    flowingContent?: FlowingTextContent
  ): void {
    let y = bounds.y;

    // Get cursor position from the specified FlowingTextContent, or fall back to body
    const contentForCursor = flowingContent || this.document.pages[0]?.flowingContent;
    const cursorTextIndex = contentForCursor ? contentForCursor.getCursorPosition() : 0;

    for (let lineIndex = 0; lineIndex < flowedPage.lines.length; lineIndex++) {
      const line = flowedPage.lines[lineIndex];

      this.renderFlowedLine(line, ctx, { x: bounds.x, y }, bounds.width, pageIndex, cursorTextIndex);

      y += line.height;
    }
  }

  private renderFlowedLine(
    line: FlowedLine,
    ctx: CanvasRenderingContext2D,
    position: Point,
    maxWidth: number,
    pageIndex: number,
    cursorTextIndex?: number
  ): void {
    // Calculate alignment offset
    const alignmentOffset = this.getAlignmentOffset(line, maxWidth);
    let x = position.x + alignmentOffset;

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Create maps for quick lookup by text index
    const substitutionFieldMap = new Map<number, FlowedSubstitutionField>();
    if (line.substitutionFields) {
      line.substitutionFields.forEach(f => {
        substitutionFieldMap.set(f.textIndex, f);
      });
    }

    const embeddedObjectMap = new Map<number, FlowedEmbeddedObject>();
    if (line.embeddedObjects) {
      line.embeddedObjects.forEach(o => {
        embeddedObjectMap.set(o.textIndex, o);
      });
    }

    // Render each text run in the line
    for (const run of line.runs) {
      ctx.font = this.getFontString(run.formatting);
      ctx.fillStyle = run.formatting.color;

      // Process character by character to handle embedded content
      for (let i = 0; i < run.text.length; i++) {
        const charIndex = run.startIndex + i;
        const char = run.text[i];

        // Check for substitution field
        const field = substitutionFieldMap.get(charIndex);
        if (field) {
          // Field is selected when cursor is right after it (since clicking positions cursor after field)
          const isFieldSelected = cursorTextIndex === charIndex + 1;
          x = this.renderSubstitutionField(field, ctx, { x, y: position.y }, line, isFieldSelected);
          continue;
        }

        // Check for embedded object
        const embeddedObj = embeddedObjectMap.get(charIndex);
        if (embeddedObj) {
          x = this.renderEmbeddedObject(embeddedObj, ctx, { x, y: position.y }, line, maxWidth, position.x, pageIndex);
          continue;
        }

        // Regular character (skip orphaned replacement chars)
        if (char !== '\uFFFC') {
          // Tab characters need special handling (4 spaces width)
          const charWidth = char === '\t'
            ? ctx.measureText('    ').width
            : ctx.measureText(char).width;

          if (run.formatting.backgroundColor) {
            // Calculate background position based on this character's font size
            const charBaseline = run.formatting.fontSize * 0.8;
            const charHeight = run.formatting.fontSize * 1.2;
            const textY = position.y + line.baseline;
            const backgroundY = textY - charBaseline;

            ctx.fillStyle = run.formatting.backgroundColor;
            ctx.fillRect(x, backgroundY, charWidth, charHeight);
            ctx.fillStyle = run.formatting.color;
          }

          // Handle control characters
          if (this.showControlCharacters) {
            if (char === ' ') {
              // Draw space as centered dot
              ctx.fillStyle = CONTROL_CHAR_COLOR;
              ctx.fillText(SPACE_DOT, x, position.y + line.baseline);
              ctx.fillStyle = run.formatting.color;
              x += charWidth;
              // Add extra word spacing for justify mode
              if (line.alignment === 'justify' && line.extraWordSpacing) {
                x += line.extraWordSpacing;
              }
              continue;
            } else if (char === '\t') {
              // Draw tab as arrow
              ctx.fillStyle = CONTROL_CHAR_COLOR;
              ctx.fillText(TAB_ARROW, x, position.y + line.baseline);
              ctx.fillStyle = run.formatting.color;
              x += charWidth;
              // Add extra word spacing for justify mode
              if (line.alignment === 'justify' && line.extraWordSpacing) {
                x += line.extraWordSpacing;
              }
              continue;
            } else if (char === '\n') {
              // Draw newline as paragraph mark
              ctx.fillStyle = CONTROL_CHAR_COLOR;
              ctx.fillText(PARAGRAPH_MARK, x, position.y + line.baseline);
              ctx.fillStyle = run.formatting.color;
              x += charWidth;
              continue;
            }
          } else if (char === '\t') {
            // Tab without control chars - just advance x, don't draw
            x += charWidth;
            // Add extra word spacing for justify mode
            if (line.alignment === 'justify' && line.extraWordSpacing) {
              x += line.extraWordSpacing;
            }
            continue;
          }

          ctx.fillText(char, x, position.y + line.baseline);
          x += charWidth;

          // Add extra word spacing for justify mode after whitespace
          if (line.alignment === 'justify' && line.extraWordSpacing && /\s/.test(char)) {
            x += line.extraWordSpacing;
          }
        }
      }
    }

    // Draw paragraph mark at end of line if it ends with a newline and control chars are enabled
    if (this.showControlCharacters && line.endsWithNewline) {
      ctx.fillStyle = CONTROL_CHAR_COLOR;
      ctx.font = this.getFontString(line.runs[line.runs.length - 1]?.formatting || DEFAULT_FORMATTING);
      ctx.fillText(PARAGRAPH_MARK, x, position.y + line.baseline);
    }

    ctx.restore();
  }

  /**
   * Render a substitution field as styled text {{field: name}}.
   * Returns the new x position after rendering.
   *
   * Note: position.y is the TOP of the line, and line.baseline is the
   * distance from the top to the text baseline.
   */
  private renderSubstitutionField(
    field: FlowedSubstitutionField,
    ctx: CanvasRenderingContext2D,
    position: Point,
    line: FlowedLine,
    isSelected: boolean = false
  ): number {
    const displayText = `{{field: ${field.field.fieldName}}}`;
    const formatting = field.field.formatting || DEFAULT_FORMATTING;

    ctx.save();

    // Set font for field
    ctx.font = this.getFontString(formatting);

    // Calculate field-specific dimensions based on its font size
    const fieldBaseline = formatting.fontSize * 0.8;
    const fieldHeight = formatting.fontSize * 1.2;
    const textWidth = ctx.measureText(displayText).width;

    // Text is drawn at the line's baseline position
    const textY = position.y + line.baseline;
    // Background should start at the top of this field's text area
    const backgroundY = textY - fieldBaseline;

    // Draw background for field (use field's backgroundColor or default light gray)
    ctx.fillStyle = formatting.backgroundColor || '#e8e8e8';
    ctx.fillRect(position.x, backgroundY, textWidth, fieldHeight);

    // Draw border around field (only if using default background)
    if (!formatting.backgroundColor) {
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(position.x, backgroundY, textWidth, fieldHeight);
    }

    // Draw selection rectangle if field is selected (blue dashed border)
    if (isSelected) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(position.x - 1, backgroundY - 1, textWidth + 2, fieldHeight + 2);
      ctx.setLineDash([]);
    }

    // Draw field text using the field's formatting color
    ctx.fillStyle = formatting.color;
    ctx.fillText(displayText, position.x, textY);

    ctx.restore();

    return position.x + textWidth;
  }

  /**
   * Render an embedded object.
   * Returns the new x position after rendering.
   *
   * Note: position.y is the TOP of the line. Objects are vertically
   * centered within the line height.
   */
  private renderEmbeddedObject(
    embeddedObj: FlowedEmbeddedObject,
    ctx: CanvasRenderingContext2D,
    position: Point,
    line: FlowedLine,
    maxWidth: number,
    lineStartX: number,
    pageIndex: number
  ): number {
    const object = embeddedObj.object;
    let elementX = position.x;
    // Center the object vertically within the line
    let elementY = position.y + (line.height - object.height) / 2;

    switch (object.position) {
      case 'float-left':
        elementX = lineStartX;
        break;
      case 'float-right':
        elementX = lineStartX + maxWidth - object.width;
        break;
      case 'inline':
      default:
        elementX = position.x;
        break;
    }

    // Store the rendered position for hit detection
    object.renderedPosition = { x: elementX, y: elementY };

    // Check if this is a TextBoxObject - delegate text rendering to renderRegion
    if (object instanceof TextBoxObject) {
      const textBox = object as TextBoxObject;

      // Flow text before rendering (populates _flowedLines)
      textBox.reflow(ctx);

      // Save context and translate to object position
      ctx.save();
      ctx.translate(elementX, elementY);

      // Render container (background, border, selection indicators)
      textBox.render(ctx);

      ctx.restore();

      // Render text content using unified renderRegion
      // (uses absolute coordinates from getRegionBounds)
      this.renderRegion(textBox, ctx, pageIndex, {
        renderCursor: true,
        renderSelection: true,
        clipToBounds: true
      });
    } else if (object instanceof TableObject) {
      const table = object as TableObject;

      // Calculate table layout (computes cell bounds and row heights)
      table.calculateLayout(ctx);

      // Reflow text in each cell
      for (const row of table.rows) {
        for (const cell of row.cells) {
          cell.reflow(ctx);
        }
      }

      // Get content bounds to calculate available height
      const page = this.document.pages[pageIndex];
      const contentBounds = page?.getContentBounds();
      const continuationKey = table.id;

      // Check if this is a continuation from a previous page
      const continuation = this.tableContinuations.get(continuationKey);

      if (continuation && continuation.sliceIndex < continuation.pageLayout.slices.length) {
        // This is a continuation - render the appropriate slice
        const slice = continuation.pageLayout.slices[continuation.sliceIndex];

        // Update table rendered position for this slice
        table.renderedPosition = { x: elementX, y: elementY };

        ctx.save();
        ctx.translate(elementX, elementY);
        table.renderSlice(ctx, slice, continuation.pageLayout);
        ctx.restore();

        // Render cell text for rows in this slice
        const rowsToRender = table.getRowsForSlice(slice, continuation.pageLayout);
        this.renderTableCellText(table, rowsToRender, ctx, pageIndex, elementX, elementY, slice, continuation.pageLayout);

        // Update continuation for next page if there are more slices
        if (continuation.sliceIndex + 1 < continuation.pageLayout.slices.length) {
          this.tableContinuations.set(continuationKey, {
            ...continuation,
            sliceIndex: continuation.sliceIndex + 1
          });
        } else {
          this.tableContinuations.delete(continuationKey);
        }
      } else if (contentBounds) {
        const availableHeight = contentBounds.position.y + contentBounds.size.height - elementY;

        if (table.needsPageSplit(availableHeight)) {
          // Table needs to be split - calculate page layout
          const availableHeightOtherPages = contentBounds.size.height;
          const pageLayout = table.calculatePageLayout(availableHeight, availableHeightOtherPages);

          // Update table rendered position
          table.renderedPosition = { x: elementX, y: elementY };

          // Render first slice
          const firstSlice = pageLayout.slices[0];

          ctx.save();
          ctx.translate(elementX, elementY);
          table.renderSlice(ctx, firstSlice, pageLayout);
          ctx.restore();

          // Render cell text for rows in this slice
          const rowsToRender = table.getRowsForSlice(firstSlice, pageLayout);
          this.renderTableCellText(table, rowsToRender, ctx, pageIndex, elementX, elementY, firstSlice, pageLayout);

          // Store continuation info for subsequent pages
          if (pageLayout.slices.length > 1) {
            this.tableContinuations.set(continuationKey, {
              table,
              sliceIndex: 1,
              pageLayout
            });
          }
        } else {
          // Table fits on current page - render normally
          table.renderedPosition = { x: elementX, y: elementY };
          table.updateCellRenderedPositions();

          ctx.save();
          ctx.translate(elementX, elementY);
          table.render(ctx);
          ctx.restore();

          // Render text content for all cells
          for (const row of table.rows) {
            for (const cell of row.cells) {
              this.renderRegion(cell, ctx, pageIndex, {
                renderCursor: cell.editing,
                renderSelection: cell.editing,
                clipToBounds: true
              });
            }
          }

          // Clear any stale continuation
          this.tableContinuations.delete(continuationKey);
        }
      } else {
        // No content bounds available - render normally (fallback)
        table.renderedPosition = { x: elementX, y: elementY };
        table.updateCellRenderedPositions();

        ctx.save();
        ctx.translate(elementX, elementY);
        table.render(ctx);
        ctx.restore();

        // Render text content for all cells
        for (const row of table.rows) {
          for (const cell of row.cells) {
            this.renderRegion(cell, ctx, pageIndex, {
              renderCursor: cell.editing,
              renderSelection: cell.editing,
              clipToBounds: true
            });
          }
        }
      }
    } else {
      // For other embedded objects, render normally
      ctx.save();
      ctx.translate(elementX, elementY);

      object.render(ctx);

      ctx.restore();
    }

    // Draw selection/resize handles if selected
    if (object.selected) {
      this.drawEmbeddedObjectHandles(ctx, object, { x: elementX, y: elementY });
    }

    // Return new x position (only advance for inline objects)
    if (object.position === 'inline') {
      return position.x + object.width + 2; // Add spacing
    }
    return position.x;
  }

  /**
   * Render text content for table cells in a specific page slice.
   * This handles proper positioning for cells within the slice, including
   * header row repetition on continuation pages.
   */
  private renderTableCellText(
    table: TableObject,
    rows: import('../objects/table/TableRow').TableRow[],
    ctx: CanvasRenderingContext2D,
    pageIndex: number,
    tableX: number,
    tableY: number,
    slice: import('../objects/table/types').TablePageSlice,
    pageLayout: import('../objects/table/types').TablePageLayout
  ): void {
    const columnPositions = table.getColumnPositions();
    const columnWidths = table.getColumnWidths();
    let y = 0;

    // Track which rows we've rendered (to handle header rows correctly)
    const renderedRowIds = new Set<string>();

    // On continuation pages, first render header row text
    if (slice.isContinuation && pageLayout.headerRowIndices.length > 0) {
      for (const headerRowIdx of pageLayout.headerRowIndices) {
        const row = table.rows[headerRowIdx];
        if (!row) continue;

        renderedRowIds.add(row.id);

        for (let colIdx = 0; colIdx < row.cellCount; colIdx++) {
          const cell = row.getCell(colIdx);
          if (!cell) continue;

          // Calculate cell width including colSpan
          let cellWidth = 0;
          for (let c = colIdx; c < colIdx + cell.colSpan && c < table.columnCount; c++) {
            cellWidth += columnWidths[c];
          }

          // Set cell's rendered position for text rendering
          cell.setRenderedPosition({
            x: tableX + columnPositions[colIdx],
            y: tableY + y
          });

          // Update cell bounds for this slice
          cell.setBounds({
            x: columnPositions[colIdx],
            y: y,
            width: cellWidth,
            height: row.calculatedHeight
          });

          // Render cell text
          this.renderRegion(cell, ctx, pageIndex, {
            renderCursor: cell.editing,
            renderSelection: cell.editing,
            clipToBounds: true
          });
        }
        y += row.calculatedHeight;
      }
    }

    // Render text for data rows in this slice
    for (const row of rows) {
      // Skip header rows if already rendered
      if (renderedRowIds.has(row.id)) continue;

      for (let colIdx = 0; colIdx < row.cellCount; colIdx++) {
        const cell = row.getCell(colIdx);
        if (!cell) continue;

        // Calculate cell width including colSpan
        let cellWidth = 0;
        for (let c = colIdx; c < colIdx + cell.colSpan && c < table.columnCount; c++) {
          cellWidth += columnWidths[c];
        }

        // Set cell's rendered position for text rendering
        cell.setRenderedPosition({
          x: tableX + columnPositions[colIdx],
          y: tableY + y
        });

        // Update cell bounds for this slice
        cell.setBounds({
          x: columnPositions[colIdx],
          y: y,
          width: cellWidth,
          height: row.calculatedHeight
        });

        // Render cell text
        this.renderRegion(cell, ctx, pageIndex, {
          renderCursor: cell.editing,
          renderSelection: cell.editing,
          clipToBounds: true
        });
      }
      y += row.calculatedHeight;
    }
  }

  /**
   * Clear table continuation tracking.
   * Call this when reflowing text to reset multi-page table state.
   */
  clearTableContinuations(): void {
    this.tableContinuations.clear();
  }

  /**
   * Check if there are pending table continuations for the next page.
   */
  hasTableContinuations(): boolean {
    return this.tableContinuations.size > 0;
  }

  /**
   * Draw selection border and resize handles for an embedded object.
   */
  private drawEmbeddedObjectHandles(
    ctx: CanvasRenderingContext2D,
    object: BaseEmbeddedObject,
    position: Point
  ): void {
    const handleSize = 8;
    const { width, height } = object.size;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw selection border
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(position.x, position.y, width, height);
    ctx.setLineDash([]);

    // Draw resize handles if resizable
    if (object.resizable) {
      const handles = object.getResizeHandles();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1;

      for (const handle of handles) {
        const handlePos = this.getHandlePosition(handle, position, width, height, handleSize);
        ctx.fillRect(handlePos.x, handlePos.y, handleSize, handleSize);
        ctx.strokeRect(handlePos.x, handlePos.y, handleSize, handleSize);
      }
    }

    ctx.restore();
  }

  /**
   * Get the position of a resize handle.
   */
  private getHandlePosition(
    handle: string,
    objectPos: Point,
    width: number,
    height: number,
    handleSize: number
  ): Point {
    const half = handleSize / 2;

    switch (handle) {
      case 'nw':
        return { x: objectPos.x - half, y: objectPos.y - half };
      case 'n':
        return { x: objectPos.x + width / 2 - half, y: objectPos.y - half };
      case 'ne':
        return { x: objectPos.x + width - half, y: objectPos.y - half };
      case 'e':
        return { x: objectPos.x + width - half, y: objectPos.y + height / 2 - half };
      case 'se':
        return { x: objectPos.x + width - half, y: objectPos.y + height - half };
      case 's':
        return { x: objectPos.x + width / 2 - half, y: objectPos.y + height - half };
      case 'sw':
        return { x: objectPos.x - half, y: objectPos.y + height - half };
      case 'w':
        return { x: objectPos.x - half, y: objectPos.y + height / 2 - half };
      default:
        return objectPos;
    }
  }

  /**
   * Convert formatting to CSS font string.
   * Uses the same logic as TextMeasurer for consistency.
   */
  private getFontString(formatting: TextFormattingStyle): string {
    return `${formatting.fontStyle || ''} ${formatting.fontWeight || ''} ${formatting.fontSize}px ${formatting.fontFamily}`.trim();
  }

  /**
   * Calculate the X offset for a line based on its alignment.
   */
  private getAlignmentOffset(line: FlowedLine, maxWidth: number): number {
    switch (line.alignment) {
      case 'center':
        return (maxWidth - line.width) / 2;
      case 'right':
        return maxWidth - line.width;
      case 'justify':
      case 'left':
      default:
        return 0;
    }
  }

  /**
   * Check if the cursor is positioned right after a substitution field or embedded object.
   * This is used to hide the cursor when a field/object is "selected".
   */
  private isCursorAfterFieldOrObject(): boolean {
    let flowingContent;

    if (this.getActiveSection() === 'body') {
      const page = this.document.pages[0];
      flowingContent = page?.flowingContent;
    } else if (this.getActiveSection() === 'header') {
      flowingContent = this.document.headerFlowingContent;
    } else if (this.getActiveSection() === 'footer') {
      flowingContent = this.document.footerFlowingContent;
    }

    if (!flowingContent) return false;

    const cursorPos = flowingContent.getCursorPosition();
    if (cursorPos <= 0) return false;

    // Check if there's a field at the position before the cursor
    const fieldManager = flowingContent.getSubstitutionFieldManager();
    const fieldAtPrevPos = fieldManager.getFieldAt(cursorPos - 1);
    if (fieldAtPrevPos !== undefined) return true;

    // Check if there's an embedded object at the position before the cursor
    const embeddedObjects = flowingContent.getEmbeddedObjects();
    for (const [, obj] of embeddedObjects.entries()) {
      if (obj.textIndex === cursorPos - 1 && obj.selected) {
        return true;
      }
    }

    return false;
  }

  private renderCursor(ctx: CanvasRenderingContext2D, pageIndex: number): void {
    // Use the active FlowingTextContent's cursor visibility (handles blinking)
    const activeContent = this.getActiveFlowingContent();
    if (!activeContent || !activeContent.isCursorVisible()) return;

    // Don't render cursor if it's positioned right after a field or selected object
    if (this.isCursorAfterFieldOrObject()) return;

    // Calculate cursor position on-demand
    const cursorPos = this.calculateCursorPosition(ctx);
    if (!cursorPos) return;

    // Only render cursor on the page it's on
    if (cursorPos.pageIndex !== pageIndex) return;

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cursorPos.x, cursorPos.y);
    ctx.lineTo(cursorPos.x, cursorPos.y + cursorPos.height);
    ctx.stroke();
    ctx.restore();
  }

  private renderTextSelection(
    flowedPage: FlowedPage,
    ctx: CanvasRenderingContext2D,
    bounds: Rect
  ): void {
    if (!this.selectedText) return;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';

    let y = bounds.y;
    for (const line of flowedPage.lines) {
      if (this.lineContainsSelection(line, this.selectedText)) {
        const selectionBounds = this.getSelectionBoundsInLine(line, this.selectedText);
        // Add alignment offset to position the selection correctly
        const alignmentOffset = this.getAlignmentOffset(line, bounds.width);
        ctx.fillRect(
          bounds.x + alignmentOffset + selectionBounds.x,
          y,
          selectionBounds.width,
          line.height
        );
      }
      y += line.height;
    }

    ctx.restore();
  }

  private lineContainsSelection(line: FlowedLine, selection: { start: number; end: number }): boolean {
    return !(line.endIndex <= selection.start || line.startIndex >= selection.end);
  }

  private getSelectionBoundsInLine(line: FlowedLine, selection: { start: number; end: number }): { x: number; width: number } {
    // Calculate accurate selection bounds using character-by-character measurement
    const selStart = Math.max(selection.start, line.startIndex);
    const selEnd = Math.min(selection.end, line.endIndex);

    const startX = this.getXPositionForTextIndex(line, selStart);
    const endX = this.getXPositionForTextIndex(line, selEnd);

    return {
      x: startX,
      width: endX - startX
    };
  }

  /**
   * Get the text index at a given point without moving the cursor.
   * Returns null if the point is not within text content.
   */
  getTextIndexAtPoint(point: Point, pageId: string): number | null {
    const flowedPages = this.flowedPages.get(pageId);
    if (!flowedPages || flowedPages.length === 0) {
      return null;
    }

    const page = this.document.getPage(pageId);
    if (!page) {
      return null;
    }

    const contentBounds = page.getContentBounds();
    const relativeY = point.y - contentBounds.position.y;
    const relativeX = point.x - contentBounds.position.x;
    const maxWidth = contentBounds.size.width;

    // If clicked above all lines, return start of content
    if (relativeY < 0 && flowedPages[0].lines.length > 0) {
      return flowedPages[0].lines[0].startIndex;
    }

    let currentY = 0;
    for (let lineIndex = 0; lineIndex < flowedPages[0].lines.length; lineIndex++) {
      const line = flowedPages[0].lines[lineIndex];

      if (relativeY >= currentY && relativeY < currentY + line.height) {
        // Found the line, now find the character position
        // Subtract alignment offset so x is relative to text start
        const alignmentOffset = this.getAlignmentOffset(line, maxWidth);
        return this.getTextIndexInLine(line, relativeX - alignmentOffset);
      }

      currentY += line.height;
    }

    // If clicked below all lines, return end of content
    if (flowedPages[0].lines.length > 0) {
      const lastLine = flowedPages[0].lines[flowedPages[0].lines.length - 1];
      return lastLine.endIndex;
    }

    return null;
  }

  private getTextIndexInLine(line: FlowedLine, x: number): number {
    // Create a temporary canvas context for text measurement
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return line.startIndex;

    // Build maps for quick lookup of substitution fields and embedded objects
    const substitutionFieldMap = new Map<number, FlowedSubstitutionField>();
    if (line.substitutionFields) {
      line.substitutionFields.forEach(f => substitutionFieldMap.set(f.textIndex, f));
    }

    const embeddedObjectMap = new Map<number, FlowedEmbeddedObject>();
    if (line.embeddedObjects) {
      line.embeddedObjects.forEach(o => embeddedObjectMap.set(o.textIndex, o));
    }

    let currentX = 0;
    const extraWordSpacing = line.extraWordSpacing || 0;

    for (const run of line.runs) {
      ctx.font = this.getFontString(run.formatting);

      // Process character by character to handle embedded content correctly
      for (let i = 0; i < run.text.length; i++) {
        const charIndex = run.startIndex + i;
        const char = run.text[i];
        let charWidth: number;

        // Check for substitution field
        const field = substitutionFieldMap.get(charIndex);
        if (field) {
          // Use the rendered field width
          charWidth = field.width;

          // For substitution fields, clicking anywhere on the field positions cursor after the field
          // This allows the field to be "selected" while cursor is positioned after it
          if (x >= currentX && x < currentX + charWidth) {
            return charIndex + 1; // Position cursor after the field
          }
          currentX += charWidth;
          // Add justify spacing after whitespace
          if (extraWordSpacing > 0 && /\s/.test(char)) {
            currentX += extraWordSpacing;
          }
          continue;
        }
        // Check for embedded object
        else if (embeddedObjectMap.has(charIndex)) {
          const embeddedObj = embeddedObjectMap.get(charIndex)!;
          charWidth = embeddedObj.object.width + 2; // Match the spacing from renderEmbeddedObject
        }
        // Regular character (skip orphaned replacement chars)
        else if (char !== '\uFFFC') {
          // Tab characters need special handling (4 spaces width)
          charWidth = char === '\t'
            ? ctx.measureText('    ').width
            : ctx.measureText(char).width;
        } else {
          // Orphaned replacement char - treat as zero width
          charWidth = 0;
        }

        // Check if click is within this character's bounds
        if (x >= currentX && x < currentX + charWidth) {
          // Click is on this character - return position before or after based on midpoint
          if (x < currentX + charWidth / 2) {
            return charIndex;
          } else {
            return charIndex + 1;
          }
        }

        currentX += charWidth;

        // Add justify spacing after whitespace characters
        if (extraWordSpacing > 0 && /\s/.test(char)) {
          currentX += extraWordSpacing;
        }
      }
    }

    return line.endIndex;
  }

  private getInlineElementAtPoint(line: FlowedLine, point: Point, lineY?: number, lineStartX?: number): any | null {
    // Check embedded objects (only if lineY and lineStartX are provided for accurate hit testing)
    if (line.embeddedObjects && lineY !== undefined && lineStartX !== undefined) {
      for (const embeddedObj of line.embeddedObjects) {
        const object = embeddedObj.object;
        // Calculate absolute object position (embeddedObj.x is relative to line start)
        const objectX = embeddedObj.x + lineStartX;
        const objectY = lineY + (line.height - object.height) / 2;

        if (object.containsPoint(point, { x: objectX, y: objectY })) {
          return { type: 'embedded-object', object, textIndex: embeddedObj.textIndex };
        }
      }
    }

    // Note: Substitution fields are text-based and handled via getSubstitutionFieldAtPoint method
    // They require line position context to calculate bounds accurately

    return null;
  }

  /**
   * Get an embedded object at a specific point in a line.
   * Note: lineY is the TOP of the line (same as position.y in render methods).
   * lineStartX is the content area's left edge (includes margin offset).
   */
  getEmbeddedObjectAtPoint(line: FlowedLine, point: Point, lineY: number, lineStartX: number): BaseEmbeddedObject | null {
    if (!line.embeddedObjects) return null;

    for (const embeddedObj of line.embeddedObjects) {
      const object = embeddedObj.object;
      // Calculate absolute object position (embeddedObj.x is relative to line start)
      const objectX = embeddedObj.x + lineStartX;
      const objectY = lineY + (line.height - object.height) / 2;

      if (object.containsPoint(point, { x: objectX, y: objectY })) {
        return object;
      }
    }

    return null;
  }

  /**
   * Get a substitution field at a specific point in a line.
   * Note: lineY is the TOP of the line (same as position.y in render methods).
   */
  getSubstitutionFieldAtPoint(
    line: FlowedLine,
    point: Point,
    lineY: number,
    lineStartX: number
  ): FlowedSubstitutionField | null {
    if (!line.substitutionFields) return null;

    for (const fieldRef of line.substitutionFields) {
      // Field background starts at top of line (matches renderSubstitutionField)
      if (point.x >= fieldRef.x + lineStartX &&
          point.x <= fieldRef.x + lineStartX + fieldRef.width &&
          point.y >= lineY &&
          point.y <= lineY + line.height) {
        return fieldRef;
      }
    }

    return null;
  }

  private getXPositionForTextIndex(line: FlowedLine, textIndex: number): number {
    if (textIndex <= line.startIndex) return 0;
    // For justify mode, return the full justified width at end of line
    if (textIndex >= line.endIndex) {
      if (line.alignment === 'justify' && line.extraWordSpacing) {
        // Calculate total justified width
        return line.width + (this.countWordGapsUpTo(line, line.endIndex) * line.extraWordSpacing);
      }
      return line.width;
    }

    // Create a temporary canvas context for text measurement
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    // Build maps for quick lookup of substitution fields and embedded objects
    const substitutionFieldMap = new Map<number, FlowedSubstitutionField>();
    if (line.substitutionFields) {
      line.substitutionFields.forEach(f => substitutionFieldMap.set(f.textIndex, f));
    }

    const embeddedObjectMap = new Map<number, FlowedEmbeddedObject>();
    if (line.embeddedObjects) {
      line.embeddedObjects.forEach(o => embeddedObjectMap.set(o.textIndex, o));
    }

    let x = 0;

    // Measure character by character to handle embedded content correctly
    for (const run of line.runs) {
      ctx.font = this.getFontString(run.formatting);

      for (let i = 0; i < run.text.length; i++) {
        const charIndex = run.startIndex + i;

        // If we've reached the target index, return current x
        if (charIndex >= textIndex) {
          return x;
        }

        const char = run.text[i];
        let charWidth: number;

        // Check for substitution field
        const field = substitutionFieldMap.get(charIndex);
        if (field) {
          charWidth = field.width;
        }
        // Check for embedded object
        else if (embeddedObjectMap.has(charIndex)) {
          const embeddedObj = embeddedObjectMap.get(charIndex)!;
          charWidth = embeddedObj.object.width + 2; // Match the spacing from renderEmbeddedObject
        }
        // Regular character (skip orphaned replacement chars)
        else if (char !== '\uFFFC') {
          // Tab characters need special handling (4 spaces width)
          charWidth = char === '\t'
            ? ctx.measureText('    ').width
            : ctx.measureText(char).width;
        } else {
          charWidth = 0;
        }

        x += charWidth;

        // Add extra word spacing for justify mode after whitespace
        if (line.alignment === 'justify' && line.extraWordSpacing && /\s/.test(char)) {
          x += line.extraWordSpacing;
        }
      }
    }

    return x;
  }

  /**
   * Count word gaps up to a certain text index for justify spacing calculation.
   */
  private countWordGapsUpTo(line: FlowedLine, textIndex: number): number {
    let gaps = 0;
    let inWord = false;

    for (let i = line.startIndex; i < Math.min(textIndex, line.endIndex); i++) {
      const charOffset = i - line.startIndex;
      if (charOffset >= line.text.length) break;

      const char = line.text[charOffset];
      const isWhitespace = /\s/.test(char);

      if (!isWhitespace && !inWord) {
        inWord = true;
      } else if (isWhitespace && inWord) {
        gaps++;
        inWord = false;
      }
    }

    return gaps;
  }

  /**
   * Move cursor vertically by visual lines, maintaining X position.
   * Returns the new text index. At document boundaries, moves to start/end of text.
   */
  moveCursorVertical(direction: -1 | 1, pageId: string): number | null {
    // Handle header/footer sections
    if (this.getActiveSection() === 'header') {
      return this.moveCursorVerticalInSection(direction, this.headerFlowedPage, pageId, 'header');
    }
    if (this.getActiveSection() === 'footer') {
      return this.moveCursorVerticalInSection(direction, this.footerFlowedPage, pageId, 'footer');
    }

    // Body section - use multi-page flowedPages
    const flowedPages = this.flowedPages.get(pageId);
    if (!flowedPages || flowedPages.length === 0) return null;

    const page = this.document.getPage(pageId);
    if (!page) return null;

    // Get current text index and find cursor location
    const textIndex = page.flowingContent.getCursorPosition();
    const location = this.findCursorLocationInBody(textIndex);
    if (!location) return null;

    const currentLine = location.lineIndex;
    const currentPage = location.pageIndex;

    // Get the page's flowed content
    const flowedPage = flowedPages[currentPage];
    if (!flowedPage) return null;

    // Calculate target line
    const targetLine = currentLine + direction;

    const contentBounds = page.getContentBounds();
    const maxWidth = contentBounds.size.width;

    // Get current X position for maintaining horizontal position
    const cursorRelativeX = this.calculateCursorRelativeX();

    // Check if we need to move to adjacent page
    if (targetLine < 0) {
      // Move to previous page
      if (currentPage > 0) {
        const prevPage = flowedPages[currentPage - 1];
        if (prevPage && prevPage.lines.length > 0) {
          const lastLineIndex = prevPage.lines.length - 1;
          const targetLineData = prevPage.lines[lastLineIndex];
          return this.getTextIndexAtVisualX(targetLineData, cursorRelativeX, maxWidth);
        }
      }
      // At top of document - move to start of text
      if (flowedPages[0].lines.length > 0) {
        return flowedPages[0].lines[0].startIndex;
      }
      return null;
    }

    if (targetLine >= flowedPage.lines.length) {
      // Move to next page
      if (currentPage < flowedPages.length - 1) {
        const nextPage = flowedPages[currentPage + 1];
        if (nextPage && nextPage.lines.length > 0) {
          const targetLineData = nextPage.lines[0];
          return this.getTextIndexAtVisualX(targetLineData, cursorRelativeX, maxWidth);
        }
      }
      // At bottom of document - move to end of text
      const lastPage = flowedPages[flowedPages.length - 1];
      if (lastPage && lastPage.lines.length > 0) {
        const lastLine = lastPage.lines[lastPage.lines.length - 1];
        return lastLine.endIndex;
      }
      return null;
    }

    // Move within the same page
    const targetLineData = flowedPage.lines[targetLine];
    return this.getTextIndexAtVisualX(targetLineData, cursorRelativeX, maxWidth);
  }

  /**
   * Move cursor vertically within a single-page section (header/footer).
   */
  private moveCursorVerticalInSection(
    direction: -1 | 1,
    flowedPage: FlowedPage | null,
    _pageId: string,
    section: 'header' | 'footer'
  ): number | null {
    if (!flowedPage || flowedPage.lines.length === 0) return null;

    const page = this.document.pages[0];
    if (!page) return null;

    const bounds = section === 'header' ? page.getHeaderBounds() : page.getFooterBounds();
    const maxWidth = bounds.size.width;

    // Get current text index and find cursor location
    const flowingContent = section === 'header'
      ? this.document.headerFlowingContent
      : this.document.footerFlowingContent;
    const textIndex = flowingContent.getCursorPosition();
    const location = this.findCursorLocationInSection(textIndex, section);

    const currentLine = location ? location.lineIndex : 0;
    const targetLine = currentLine + direction;

    // Clamp to valid line range
    if (targetLine < 0) {
      // Move to start of first line
      return flowedPage.lines[0].startIndex;
    }

    if (targetLine >= flowedPage.lines.length) {
      // Move to end of last line
      const lastLine = flowedPage.lines[flowedPage.lines.length - 1];
      return lastLine.endIndex;
    }

    // Move to target line, maintaining X position
    const targetLineData = flowedPage.lines[targetLine];
    const cursorRelativeX = this.calculateCursorRelativeXForSection(section);
    return this.getTextIndexAtVisualX(targetLineData, cursorRelativeX, maxWidth);
  }

  /**
   * Calculate the cursor's X position relative to the section area (on-demand).
   */
  private calculateCursorRelativeXForSection(section: 'header' | 'footer'): number {
    const flowingContent = section === 'header'
      ? this.document.headerFlowingContent
      : this.document.footerFlowingContent;
    const textIndex = flowingContent.getCursorPosition();
    const location = this.findCursorLocationInSection(textIndex, section);
    if (!location) return 0;

    // Create temporary canvas for measurement
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const firstPage = this.document.pages[0];
    if (!firstPage) return 0;

    const bounds = section === 'header'
      ? firstPage.getHeaderBounds()
      : firstPage.getFooterBounds();
    const maxWidth = bounds.size.width;

    const alignmentOffset = TextPositionCalculator.getAlignmentOffset(location.line, maxWidth);
    const xOffset = TextPositionCalculator.getXPositionForTextIndex(location.line, textIndex, ctx);

    return alignmentOffset + xOffset;
  }

  /**
   * Calculate the cursor's X position relative to the content area (on-demand).
   */
  private calculateCursorRelativeX(): number {
    const firstPage = this.document.pages[0];
    if (!firstPage) return 0;

    const flowingContent = firstPage.flowingContent;
    const textIndex = flowingContent.getCursorPosition();
    const location = this.findCursorLocationInBody(textIndex);
    if (!location) return 0;

    // Create temporary canvas for measurement
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const contentBounds = firstPage.getContentBounds();
    const maxWidth = contentBounds.size.width;

    const alignmentOffset = TextPositionCalculator.getAlignmentOffset(location.line, maxWidth);
    const xOffset = TextPositionCalculator.getXPositionForTextIndex(location.line, textIndex, ctx);

    return alignmentOffset + xOffset;
  }

  /**
   * Get the text index at a given visual X position on a line.
   * The visualX is relative to the content area start (includes alignment offset).
   * We subtract the target line's alignment offset to get X relative to text start.
   */
  private getTextIndexAtVisualX(line: FlowedLine, visualX: number, maxWidth: number): number {
    // Subtract alignment offset to get X relative to text start
    const alignmentOffset = this.getAlignmentOffset(line, maxWidth);
    const textX = visualX - alignmentOffset;
    return this.getTextIndexInLine(line, textX);
  }

  setTextSelection(start: number, end: number): void {
    this.selectedText = { start: Math.min(start, end), end: Math.max(start, end) };
    this.emit('selection-changed', this.selectedText);
  }

  clearTextSelection(): void {
    this.selectedText = null;
    this.emit('selection-cleared');
  }

  getFlowedPagesForPage(pageId: string): FlowedPage[] {
    return this.flowedPages.get(pageId) || [];
  }

  // ============================================
  // Repeating Section Indicators
  // ============================================

  /**
   * Render repeating section indicators for a page.
   * @param sections All repeating sections
   * @param pageIndex Current page index
   * @param ctx Canvas rendering context
   * @param contentBounds Content area bounds
   * @param flowedPage The flowed page content
   * @param pageBounds Full page bounds (including margins)
   * @param selectedSectionId ID of the currently selected section (for visual feedback)
   */
  renderRepeatingSectionIndicators(
    sections: RepeatingSection[],
    pageIndex: number,
    ctx: CanvasRenderingContext2D,
    contentBounds: Rect,
    flowedPage: FlowedPage,
    pageBounds: Rect,
    selectedSectionId: string | null = null
  ): void {
    for (const section of sections) {
      this.renderSectionIndicator(
        section,
        pageIndex,
        ctx,
        contentBounds,
        flowedPage,
        pageBounds,
        section.id === selectedSectionId
      );
    }
  }

  /**
   * Render a single repeating section indicator.
   */
  private renderSectionIndicator(
    section: RepeatingSection,
    pageIndex: number,
    ctx: CanvasRenderingContext2D,
    contentBounds: Rect,
    flowedPage: FlowedPage,
    pageBounds: Rect,
    isSelected: boolean = false
  ): void {
    // Find Y positions for start and end of section on this page
    const startInfo = this.findLineYForTextIndex(flowedPage, section.startIndex, contentBounds);
    const endInfo = this.findLineYForTextIndex(flowedPage, section.endIndex, contentBounds);

    // Simple overlap check: section overlaps page if ranges intersect
    const sectionOverlapsPage = section.startIndex < flowedPage.endIndex &&
                                 section.endIndex > flowedPage.startIndex;

    // If section doesn't overlap this page at all, skip
    if (!sectionOverlapsPage) {
      return;
    }

    // Determine what parts of the section are on this page
    const hasStart = startInfo !== null;  // Section starts on this page
    const hasEnd = endInfo !== null;      // Section ends on this page
    const startsBeforePage = section.startIndex < flowedPage.startIndex;
    const endsAfterPage = section.endIndex > flowedPage.endIndex;

    ctx.save();
    ctx.strokeStyle = LOOP_INDICATOR_COLOR;
    ctx.fillStyle = LOOP_INDICATOR_COLOR;
    ctx.lineWidth = 1;

    // Calculate label position (to the left of content area)
    const labelX = pageBounds.x + 5;
    const labelWidth = 32;
    const connectorX = labelX + labelWidth / 2;

    // Draw all lines first, then label on top

    // Draw start indicator lines if start is on this page
    if (hasStart) {
      const startY = startInfo.y;

      // Draw dotted horizontal line across content area
      ctx.setLineDash(LOOP_LINE_DASH);
      ctx.beginPath();
      ctx.moveTo(contentBounds.x, startY);
      ctx.lineTo(contentBounds.x + contentBounds.width, startY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw horizontal connector from label to content
      ctx.beginPath();
      ctx.moveTo(labelX + labelWidth, startY);
      ctx.lineTo(contentBounds.x, startY);
      ctx.stroke();
    } else if (startsBeforePage) {
      // Section continues from previous page - draw continuation indicator at top
      const topY = contentBounds.y;

      // Draw dotted horizontal line across content area at top
      ctx.setLineDash(LOOP_LINE_DASH);
      ctx.beginPath();
      ctx.moveTo(contentBounds.x, topY);
      ctx.lineTo(contentBounds.x + contentBounds.width, topY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw horizontal connector from vertical line to content
      ctx.beginPath();
      ctx.moveTo(connectorX, topY);
      ctx.lineTo(contentBounds.x, topY);
      ctx.stroke();
    }

    // Draw end indicator (dotted line) if end is on this page
    if (hasEnd) {
      const endY = endInfo.y;

      // Draw dotted horizontal line across content area
      ctx.setLineDash(LOOP_LINE_DASH);
      ctx.beginPath();
      ctx.moveTo(contentBounds.x, endY);
      ctx.lineTo(contentBounds.x + contentBounds.width, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw horizontal connector (elbow) from vertical line to end
      ctx.beginPath();
      ctx.moveTo(connectorX, endY);
      ctx.lineTo(contentBounds.x, endY);
      ctx.stroke();
    } else if (endsAfterPage) {
      // Section continues to next page - draw continuation indicator at bottom
      const bottomY = contentBounds.y + contentBounds.height;

      // Draw dotted horizontal line across content area at bottom
      ctx.setLineDash(LOOP_LINE_DASH);
      ctx.beginPath();
      ctx.moveTo(contentBounds.x, bottomY);
      ctx.lineTo(contentBounds.x + contentBounds.width, bottomY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw horizontal connector from vertical line to content
      ctx.beginPath();
      ctx.moveTo(connectorX, bottomY);
      ctx.lineTo(contentBounds.x, bottomY);
      ctx.stroke();
    }

    // Draw vertical connector line
    let verticalStartY: number;
    let verticalEndY: number;

    if (hasStart) {
      verticalStartY = startInfo.y;
    } else if (startsBeforePage) {
      // Section started on a previous page, start from top of content
      verticalStartY = contentBounds.y;
    } else {
      verticalStartY = contentBounds.y;
    }

    if (hasEnd) {
      verticalEndY = endInfo.y;
    } else if (endsAfterPage) {
      // Section continues to next page, end at bottom of content area
      verticalEndY = contentBounds.y + contentBounds.height;
    } else {
      verticalEndY = verticalStartY; // No vertical line if neither start nor end
    }

    if (verticalEndY > verticalStartY) {
      ctx.beginPath();
      ctx.moveTo(connectorX, verticalStartY);
      ctx.lineTo(connectorX, verticalEndY);
      ctx.stroke();
    }

    // Draw "Loop" label last so it's in front of all lines
    if (hasStart) {
      const startY = startInfo.y;
      this.drawLoopLabel(ctx, labelX, startY - 10, 'Loop', isSelected);
    }

    // Update section's visual state
    section.visualState = {
      startPageIndex: hasStart ? pageIndex : -1,
      startY: hasStart ? startInfo.y : 0,
      endPageIndex: hasEnd ? pageIndex : -1,
      endY: hasEnd ? endInfo.y : 0,
      spansMultiplePages: !hasStart || !hasEnd
    };

    ctx.restore();
  }

  /**
   * Draw the "Loop" label in a rounded rectangle.
   * When not selected, draws an outlined rectangle.
   * When selected, draws a filled rectangle.
   */
  private drawLoopLabel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    isSelected: boolean = false
  ): void {
    ctx.save();

    ctx.font = '10px Arial';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 10;

    const boxWidth = textWidth + LOOP_LABEL_PADDING * 2;
    const boxHeight = textHeight + LOOP_LABEL_PADDING * 2;

    ctx.beginPath();
    this.roundRect(ctx, x, y, boxWidth, boxHeight, LOOP_LABEL_RADIUS);

    if (isSelected) {
      // Selected: filled background with white text
      ctx.fillStyle = LOOP_INDICATOR_COLOR;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
    } else {
      // Not selected: white background, outlined with colored text
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = LOOP_INDICATOR_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = LOOP_INDICATOR_COLOR;
    }

    // Draw text
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + LOOP_LABEL_PADDING, y + boxHeight / 2);

    ctx.restore();
  }

  /**
   * Draw a rounded rectangle path.
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Find the Y position for a text index on a flowed page.
   * Returns the Y position at the TOP of the line containing the text index.
   */
  private findLineYForTextIndex(
    flowedPage: FlowedPage,
    textIndex: number,
    contentBounds: Rect
  ): { y: number; lineIndex: number } | null {
    let y = contentBounds.y;

    for (let i = 0; i < flowedPage.lines.length; i++) {
      const line = flowedPage.lines[i];

      // Check if this line contains the text index
      if (textIndex >= line.startIndex && textIndex <= line.endIndex) {
        return { y, lineIndex: i };
      }

      // Check if text index is exactly at the start of this line
      // (for section boundaries that are at paragraph starts)
      if (textIndex === line.startIndex) {
        return { y, lineIndex: i };
      }

      y += line.height;
    }

    // Check if text index is just past the last line (end of content)
    if (flowedPage.lines.length > 0) {
      const lastLine = flowedPage.lines[flowedPage.lines.length - 1];
      if (textIndex === lastLine.endIndex + 1) {
        return { y, lineIndex: flowedPage.lines.length - 1 };
      }
    }

    return null;
  }

  /**
   * Check if a section spans across a flowed page (starts before and ends after).
   */
  private sectionSpansPage(section: RepeatingSection, flowedPage: FlowedPage): boolean {
    if (flowedPage.lines.length === 0) return false;

    const pageStart = flowedPage.startIndex;
    const pageEnd = flowedPage.endIndex;

    // Section spans this page if it started before and ends after
    return section.startIndex < pageStart && section.endIndex > pageEnd;
  }

  /**
   * Get a repeating section at a point (for click detection).
   * Checks if the point is on the Loop label or vertical connector.
   */
  getRepeatingSectionAtPoint(
    point: Point,
    sections: RepeatingSection[],
    _pageIndex: number,
    pageBounds: Rect,
    contentBounds: Rect,
    flowedPage: FlowedPage
  ): RepeatingSection | null {
    const labelX = pageBounds.x + 5;
    const labelWidth = 32;
    const connectorX = labelX + labelWidth / 2;
    const hitRadius = 10; // Pixels for click detection

    for (const section of sections) {
      const startInfo = this.findLineYForTextIndex(flowedPage, section.startIndex, contentBounds);
      const endInfo = this.findLineYForTextIndex(flowedPage, section.endIndex, contentBounds);
      const sectionSpansThisPage = this.sectionSpansPage(section, flowedPage);

      if (!startInfo && !endInfo && !sectionSpansThisPage) {
        continue;
      }

      // Check if click is on the Loop label
      if (startInfo) {
        const labelY = startInfo.y - 10;
        const labelHeight = 18;

        if (
          point.x >= labelX &&
          point.x <= labelX + labelWidth &&
          point.y >= labelY &&
          point.y <= labelY + labelHeight
        ) {
          return section;
        }
      }

      // Check if click is on the vertical connector line
      let verticalStartY: number;
      let verticalEndY: number;

      if (startInfo) {
        verticalStartY = startInfo.y;
      } else {
        verticalStartY = contentBounds.y;
      }

      if (endInfo) {
        verticalEndY = endInfo.y;
      } else if (sectionSpansThisPage) {
        verticalEndY = contentBounds.y + flowedPage.height;
      } else {
        continue;
      }

      if (
        Math.abs(point.x - connectorX) <= hitRadius &&
        point.y >= verticalStartY &&
        point.y <= verticalEndY
      ) {
        return section;
      }
    }

    return null;
  }

  destroy(): void {
    this.removeAllListeners();
  }
}