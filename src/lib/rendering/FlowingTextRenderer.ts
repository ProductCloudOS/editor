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
  FlowingTextContent,
  ListMarker,
  Hyperlink
} from '../text';
import { Document } from '../core/Document';
import { Page } from '../core/Page';
import { Point, Rect, EditingSection } from '../types';
import { EventEmitter } from '../events/EventEmitter';
import { BaseEmbeddedObject, TextBoxObject, TableObject } from '../objects';
import { HitTestManager, HIT_PRIORITY } from '../hit-test';

// Control character symbols
const CONTROL_CHAR_COLOR = '#87CEEB'; // Light blue
const PARAGRAPH_MARK = '¶';
const SPACE_DOT = '·';
const TAB_ARROW = '→';

// Page break indicator styling
const PAGE_BREAK_COLOR = '#888888';
const PAGE_BREAK_SUBTLE_COLOR = '#CCCCCC';
const PAGE_BREAK_LABEL = 'Page Break';
const PAGE_BREAK_HEIGHT = 16;

// Repeating section indicator styling
const LOOP_INDICATOR_COLOR = '#6B46C1'; // Purple
const LOOP_LABEL_PADDING = 4;
const LOOP_LABEL_RADIUS = 4;
const LOOP_LINE_DASH = [4, 4];

// Hyperlink styling
const DEFAULT_HYPERLINK_COLOR = '#0066CC'; // Blue

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
  // Track the Y offset for text content on each page (due to table continuations)
  private pageTextOffsets: Map<number, number> = new Map();
  // Hit test manager for click/hover detection
  private _hitTestManager: HitTestManager = new HitTestManager();

  constructor(document: Document) {
    super();
    this.document = document;
    this.setupFlowingContentListeners();
  }

  /**
   * Get the hit test manager for querying hit targets.
   */
  get hitTestManager(): HitTestManager {
    return this._hitTestManager;
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
      // Account for list indentation
      const listIndent = location.line.listMarker?.indent ?? 0;

      // Calculate Y position relative to the current page's content bounds
      // Each page has its own canvas, so Y is relative to that page only
      let y = contentBounds.position.y;

      // Add table continuation offset for this page (if any)
      const textOffset = this.getPageTextOffset(location.pageIndex);
      y += textOffset;

      // Add heights of lines before cursor line on current page only
      for (let l = 0; l < location.lineIndex; l++) {
        y += location.flowedPage.lines[l].height;
      }

      return {
        x: contentBounds.position.x + alignmentOffset + listIndent + xOffset,
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
      // Account for list indentation
      const listIndent = location.line.listMarker?.indent ?? 0;

      // Calculate Y position
      let y = bounds.position.y;
      for (let l = 0; l < location.lineIndex; l++) {
        y += location.flowedPage.lines[l].height;
      }

      return {
        x: bounds.position.x + alignmentOffset + listIndent + xOffset,
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
    return this.document.bodyFlowingContent;
  }

  private setupFlowingContentListeners(): void {
    // Listen to content changes from the document's body flowing content
    const bodyFlowingContent = this.document.bodyFlowingContent;

    bodyFlowingContent.on('content-changed', () => {
      // Forward the event so CanvasManager can check for empty pages
      this.emit('content-changed');
    });

    bodyFlowingContent.on('selection-changed', (data) => {
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

      // Clear content hit targets - they will be re-registered during render
      this._hitTestManager.clearCategory('content');

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
        this.renderFlowedPage(flowedPages[0], ctx, contentBounds, 0, this.document.bodyFlowingContent);
      }
    } else {
      // For subsequent pages, get the flowed content from the first page
      const firstPageFlowed = this.flowedPages.get(this.document.pages[0].id);
      if (firstPageFlowed && firstPageFlowed.length > pageIndex) {
        this.renderFlowedPage(firstPageFlowed[pageIndex], ctx, contentBounds, pageIndex, this.document.bodyFlowingContent);
      } else {
        // No flowed text content for this page, but check for table continuations
        // This handles tables that span more pages than the text flow creates
        this.renderTableContinuationsForPage(ctx, pageIndex, contentBounds);
      }
    }

    // Render cursor if visible and on this page (only when body is active)
    // Use FlowingTextContent's isCursorVisible() for proper blink state
    // Body text flows from the FIRST page's flowingContent, so use that for cursor state
    const bodyFlowingContent = this.document.bodyFlowingContent;
    if (bodyFlowingContent && this.getActiveSection() === 'body' && bodyFlowingContent.isCursorVisible()) {
      this.renderCursor(ctx, pageIndex);
    }

    // Render selection if any (only when body is active)
    if (this.getActiveSection() === 'body' && this.selectedText) {
      const flowedPagesForSelection = pageIndex === 0
        ? this.flowedPages.get(page.id)
        : this.flowedPages.get(this.document.pages[0].id);

      if (flowedPagesForSelection && flowedPagesForSelection.length > pageIndex) {
        // Adjust bounds for table continuation offset
        const textOffset = this.getPageTextOffset(pageIndex);
        const adjustedBounds = textOffset > 0
          ? { ...contentBounds, y: contentBounds.y + textOffset }
          : contentBounds;
        this.renderTextSelection(flowedPagesForSelection[pageIndex], ctx, adjustedBounds);
      }
    }
  }

  /**
   * Render header text content.
   * @param page The page to get header bounds from
   * @param ctx Canvas rendering context
   * @param isActive Whether header is the active editing section
   * @param region Optional region for unified rendering
   * @param pageIndex The page index (for page number fields)
   */
  renderHeaderText(
    page: Page,
    ctx: CanvasRenderingContext2D,
    isActive: boolean,
    region?: EditableTextRegion,
    pageIndex: number = 0
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
        this.renderRegion(region, ctx, pageIndex, {
          renderCursor: isActive,
          renderSelection: isActive
        });
      } else {
        // Fallback to old rendering path
        this.renderFlowedPage(flowedPages[0], ctx, bounds, pageIndex, this.document.headerFlowingContent);

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
   * @param pageIndex The page index (for page number fields)
   */
  renderFooterText(
    page: Page,
    ctx: CanvasRenderingContext2D,
    isActive: boolean,
    region?: EditableTextRegion,
    pageIndex: number = 0
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
        this.renderRegion(region, ctx, pageIndex, {
          renderCursor: isActive,
          renderSelection: isActive
        });
      } else {
        // Fallback to old rendering path
        this.renderFlowedPage(flowedPages[0], ctx, bounds, pageIndex, this.document.footerFlowingContent);

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

    // For body content on pages with table continuations, adjust Y for the offset
    // (table continuations are rendered first, pushing text down)
    if (region.type === 'body') {
      const textOffset = this.getPageTextOffset(pageIndex);
      if (textOffset > 0) {
        localPoint.y -= textOffset;
      }
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
        // Body content flows from the first page, so flowedPages are stored under first page's ID
        const firstPage = this.document.pages[0];
        if (!firstPage) return [];
        const flowedPages = this.flowedPages.get(firstPage.id);
        // Get the lines for this specific page index
        if (flowedPages && flowedPages.length > pageIndex) {
          return flowedPages[pageIndex]?.lines || [];
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

    // Get total page count for page count fields
    const firstPage = this.document.pages[0];
    const pageCount = firstPage ? (this.flowedPages.get(firstPage.id)?.length || 1) : 1;

    // Get hyperlinks for rendering
    const hyperlinks = flowingContent.getAllHyperlinks();

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

      this.renderFlowedLine(line, ctx, { x: bounds.x, y }, maxWidth, pageIndex, cursorTextIndex, pageCount, hyperlinks);
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
        // Account for list indentation
        const listIndent = line.listMarker?.indent ?? 0;
        const startX = bounds.x + alignmentOffset + listIndent + TextPositionCalculator.getXPositionForTextIndex(line, lineSelStart, ctx);
        const endX = bounds.x + alignmentOffset + listIndent + TextPositionCalculator.getXPositionForTextIndex(line, lineSelEnd, ctx);

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
        // Account for list indentation
        const listIndent = line.listMarker?.indent ?? 0;
        const cursorX = bounds.x + alignmentOffset + listIndent + TextPositionCalculator.getXPositionForTextIndex(line, cursorTextIndex, ctx);

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
      // Account for list indentation
      const listIndent = lastLine.listMarker?.indent ?? 0;
      const cursorX = bounds.x + alignmentOffset + listIndent + TextPositionCalculator.getXPositionForTextIndex(lastLine, cursorTextIndex, ctx);

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
    _page: Page,
    ctx: CanvasRenderingContext2D,
    bounds: Rect
  ): FlowedPage[] {
    // Body content is document-level, not page-level
    // The page parameter is kept for API consistency but unused
    const flowingContent = this.document.bodyFlowingContent;
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

    // For subsequent pages, render any table continuations FIRST (before text content)
    // This handles the case where a table spans pages AND there's text after it
    if (pageIndex > 0 && this.tableContinuations.size > 0) {
      const continuationHeight = this.renderTableContinuationsAtPosition(ctx, pageIndex, bounds, y);
      y += continuationHeight;
      // Store the offset for click handling
      this.pageTextOffsets.set(pageIndex, continuationHeight);
    } else {
      this.pageTextOffsets.set(pageIndex, 0);
    }

    // Get cursor position from the specified FlowingTextContent, or fall back to body
    const contentForCursor = flowingContent || this.document.bodyFlowingContent;
    const cursorTextIndex = contentForCursor ? contentForCursor.getCursorPosition() : 0;

    // Get total page count for page count fields
    const firstPage = this.document.pages[0];
    const pageCount = firstPage ? (this.flowedPages.get(firstPage.id)?.length || 1) : 1;

    // Get hyperlinks for rendering
    const hyperlinks = contentForCursor ? contentForCursor.getAllHyperlinks() : [];

    // Track relative objects to render after all lines (so they appear on top)
    const relativeObjects: Array<{
      object: BaseEmbeddedObject;
      anchorX: number;
      anchorY: number;
    }> = [];

    for (let lineIndex = 0; lineIndex < flowedPage.lines.length; lineIndex++) {
      const line = flowedPage.lines[lineIndex];

      // Collect relative objects from this line
      if (line.embeddedObjects) {
        for (const embeddedObj of line.embeddedObjects) {
          if (embeddedObj.isAnchor && embeddedObj.object.position === 'relative') {
            relativeObjects.push({
              object: embeddedObj.object,
              anchorX: bounds.x,  // Line start X
              anchorY: y          // Line top Y
            });
          }
        }
      }

      this.renderFlowedLine(line, ctx, { x: bounds.x, y }, bounds.width, pageIndex, cursorTextIndex, pageCount, hyperlinks);

      y += line.height;
    }

    // Render relative objects on top of text
    this.renderRelativeObjects(relativeObjects, ctx, pageIndex);
  }

  /**
   * Render relative-positioned objects at their calculated positions.
   * These are rendered after all text so they appear on top.
   */
  private renderRelativeObjects(
    relativeObjects: Array<{ object: BaseEmbeddedObject; anchorX: number; anchorY: number }>,
    ctx: CanvasRenderingContext2D,
    pageIndex: number
  ): void {
    for (const { object, anchorX, anchorY } of relativeObjects) {
      const offset = object.relativeOffset;
      const elementX = anchorX + offset.x;
      const elementY = anchorY + offset.y;

      // Store rendered position for hit detection
      object.renderedPosition = { x: elementX, y: elementY };
      object.renderedPageIndex = pageIndex;

      // Register hit target
      if (!(object instanceof TableObject)) {
        this._hitTestManager.register(pageIndex, {
          type: 'embedded-object',
          category: 'content',
          bounds: { x: elementX, y: elementY, width: object.width, height: object.height },
          priority: HIT_PRIORITY.EMBEDDED_OBJECT,
          data: { type: 'embedded-object', object }
        });
      }

      // Render the object
      ctx.save();
      ctx.translate(elementX, elementY);

      if (object instanceof TextBoxObject) {
        const textBox = object;
        textBox.reflow(ctx);
        textBox.render(ctx);
        ctx.restore();
        this.renderRegion(textBox, ctx, pageIndex, {
          renderCursor: true,
          renderSelection: true,
          clipToBounds: true
        });
      } else {
        object.render(ctx);
        ctx.restore();
      }
    }
  }

  private renderFlowedLine(
    line: FlowedLine,
    ctx: CanvasRenderingContext2D,
    position: Point,
    maxWidth: number,
    pageIndex: number,
    cursorTextIndex?: number,
    pageCount?: number,
    hyperlinks?: Hyperlink[]
  ): void {
    // Apply list indent if present
    const listIndent = line.listMarker?.indent || 0;
    const effectiveMaxWidth = maxWidth - listIndent;
    const baseX = position.x + listIndent;

    // Calculate alignment offset based on effective width
    const alignmentOffset = this.getAlignmentOffset(line, effectiveMaxWidth);
    let x = baseX + alignmentOffset;

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Render list marker if this is the first line of a list item
    if (line.listMarker?.isFirstLineOfListItem && line.listMarker.text) {
      this.renderListMarker(line.listMarker, ctx, position, line.baseline, line.runs[0]?.formatting);
    }

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
          // Pass 1-based page number for page number fields
          const pageNumber = pageIndex + 1;
          x = this.renderSubstitutionField(field, ctx, { x, y: position.y }, line, isFieldSelected, pageNumber, pageCount);
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

          // Check if this character is within a hyperlink
          let hyperlink: Hyperlink | undefined;
          if (hyperlinks) {
            for (const h of hyperlinks) {
              if (charIndex >= h.startIndex && charIndex < h.endIndex) {
                hyperlink = h;
                break;
              }
            }
          }

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

          // Apply hyperlink styling if within a hyperlink
          if (hyperlink) {
            const hyperlinkColor = hyperlink.formatting?.color || DEFAULT_HYPERLINK_COLOR;
            ctx.fillStyle = hyperlinkColor;
            ctx.fillText(char, x, position.y + line.baseline);

            // Draw underline unless explicitly disabled
            if (hyperlink.formatting?.underline !== false) {
              const underlineY = position.y + line.baseline + 2;
              ctx.beginPath();
              ctx.strokeStyle = hyperlinkColor;
              ctx.lineWidth = 1;
              ctx.moveTo(x, underlineY);
              ctx.lineTo(x + charWidth, underlineY);
              ctx.stroke();
            }

            // Restore original color for next character
            ctx.fillStyle = run.formatting.color;
          } else {
            ctx.fillText(char, x, position.y + line.baseline);
          }
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
      const formatting = line.runs[line.runs.length - 1]?.formatting || DEFAULT_FORMATTING;
      ctx.font = this.getFontString(formatting);
      const markWidth = ctx.measureText(PARAGRAPH_MARK).width;
      // Ensure paragraph mark stays within the line bounds (for clipped regions like text boxes)
      const maxX = position.x + maxWidth - markWidth;
      const markX = Math.min(x, maxX);
      ctx.fillText(PARAGRAPH_MARK, markX, position.y + line.baseline);
    }

    // Draw page break indicator at end of line if it ends with a page break
    if (line.endsWithPageBreak) {
      this.renderPageBreakIndicator(ctx, position, line, maxWidth);
    }

    ctx.restore();
  }

  /**
   * Render a list marker (bullet or number) for a list item.
   */
  private renderListMarker(
    marker: ListMarker,
    ctx: CanvasRenderingContext2D,
    position: Point,
    baseline: number,
    formatting?: TextFormattingStyle
  ): void {
    const format = formatting || DEFAULT_FORMATTING;

    ctx.save();
    ctx.font = this.getFontString(format);
    ctx.fillStyle = format.color;
    ctx.textBaseline = 'alphabetic';

    // Position the marker: right-aligned within the indent area
    // Leave a small gap between marker and text
    const markerWidth = ctx.measureText(marker.text).width;
    const markerX = position.x + marker.indent - markerWidth - 6;  // 6px gap before text
    const markerY = position.y + baseline;

    ctx.fillText(marker.text, markerX, markerY);
    ctx.restore();
  }

  /**
   * Render a page break indicator.
   * When control characters are enabled: Dashed line with "Page Break" label.
   * When control characters are disabled: Subtle single-pixel horizontal rule.
   */
  private renderPageBreakIndicator(
    ctx: CanvasRenderingContext2D,
    position: Point,
    line: FlowedLine,
    contentWidth: number
  ): void {
    const indicatorY = position.y + line.height + PAGE_BREAK_HEIGHT / 2;

    ctx.save();

    if (this.showControlCharacters) {
      // Draw dashed line spanning content width
      ctx.strokeStyle = PAGE_BREAK_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(position.x, indicatorY);
      ctx.lineTo(position.x + contentWidth, indicatorY);
      ctx.stroke();

      // Draw centered label with background
      ctx.setLineDash([]);
      ctx.font = '11px Arial';
      const labelMetrics = ctx.measureText(PAGE_BREAK_LABEL);
      const labelWidth = labelMetrics.width + 8;
      const labelHeight = 14;
      const labelX = position.x + (contentWidth - labelWidth) / 2;
      const labelY = indicatorY - labelHeight / 2;

      // Label background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

      // Label border
      ctx.strokeStyle = PAGE_BREAK_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(labelX, labelY, labelWidth, labelHeight);

      // Label text
      ctx.fillStyle = PAGE_BREAK_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(PAGE_BREAK_LABEL, position.x + contentWidth / 2, indicatorY);
    } else {
      // Draw subtle single-pixel horizontal rule
      ctx.strokeStyle = PAGE_BREAK_SUBTLE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(position.x, indicatorY);
      ctx.lineTo(position.x + contentWidth, indicatorY);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render a substitution field as styled text.
   * Regular fields display as {{field: name}}.
   * Page number fields display as the actual page number.
   * Page count fields display as the total page count.
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
    isSelected: boolean = false,
    pageNumber?: number,
    pageCount?: number
  ): number {
    // Determine display text based on field type
    let displayText: string;
    const fieldType = field.field.fieldType;

    if (fieldType === 'pageNumber') {
      if (pageNumber !== undefined) {
        if (field.field.displayFormat) {
          displayText = field.field.displayFormat.replace(/%d/g, String(pageNumber));
        } else {
          displayText = String(pageNumber);
        }
      } else {
        displayText = '{{page}}';
      }
    } else if (fieldType === 'pageCount') {
      if (pageCount !== undefined) {
        if (field.field.displayFormat) {
          displayText = field.field.displayFormat.replace(/%d/g, String(pageCount));
        } else {
          displayText = String(pageCount);
        }
      } else {
        displayText = '{{pages}}';
      }
    } else {
      // Regular data field
      displayText = `{{field: ${field.field.fieldName}}}`;
    }

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

    // Draw background for field
    // Page number/count fields use light blue, data fields use light gray
    const isPageField = fieldType === 'pageNumber' || fieldType === 'pageCount';
    const defaultBackground = isPageField ? '#d4ebff' : '#e8e8e8';  // Light blue for page fields
    const defaultBorder = isPageField ? '#87CEEB' : '#cccccc';      // Darker blue border for page fields
    ctx.fillStyle = formatting.backgroundColor || defaultBackground;
    ctx.fillRect(position.x, backgroundY, textWidth, fieldHeight);

    // Draw border around field (only if using default background)
    if (!formatting.backgroundColor) {
      ctx.strokeStyle = defaultBorder;
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

    // Handle relative-positioned objects: render anchor symbol, not the object itself
    // The actual object is rendered in a separate pass
    if (embeddedObj.isAnchor) {
      // Render anchor symbol if control characters are visible
      // Position it in the left margin so it doesn't overlap content
      if (this.showControlCharacters) {
        ctx.save();
        ctx.fillStyle = CONTROL_CHAR_COLOR;
        ctx.font = '12px Arial';
        const anchorWidth = ctx.measureText('⚓').width || 12;
        // Position anchor in left margin (to the left of content area)
        const anchorX = lineStartX - anchorWidth - 4;
        ctx.fillText('⚓', anchorX, position.y + line.baseline);
        ctx.restore();

        // Register hit target for anchor symbol - clicking it selects the relative object
        this._hitTestManager.register(pageIndex, {
          type: 'embedded-object',
          category: 'content',
          bounds: { x: anchorX, y: position.y, width: anchorWidth, height: line.height },
          priority: HIT_PRIORITY.EMBEDDED_OBJECT,
          data: { type: 'embedded-object', object }
        });
      }
      // Don't render the object here - it will be rendered in renderRelativeObjects
      return position.x; // No width consumed
    }

    switch (object.position) {
      case 'block':
        // Block objects: center horizontally (or align based on line alignment)
        if (line.alignment === 'right') {
          elementX = lineStartX + maxWidth - object.width;
        } else if (line.alignment === 'center') {
          elementX = lineStartX + (maxWidth - object.width) / 2;
        } else {
          // left or justify: align left
          elementX = lineStartX;
        }
        elementY = position.y; // No vertical centering for block objects
        break;
      case 'relative': {
        // Relative objects: position at anchor + offset
        // (This case is for when relative object is NOT marked as anchor-only)
        const offset = object.relativeOffset;
        elementX = lineStartX + offset.x;
        elementY = position.y + offset.y;
        break;
      }
      case 'inline':
      default:
        elementX = position.x;
        break;
    }

    // Store the rendered position and page index for hit detection
    object.renderedPosition = { x: elementX, y: elementY };
    object.renderedPageIndex = pageIndex;

    // Register hit target for this embedded object (tables are handled separately due to slicing)
    if (!(object instanceof TableObject)) {
      this._hitTestManager.register(pageIndex, {
        type: 'embedded-object',
        category: 'content',
        bounds: { x: elementX, y: elementY, width: object.width, height: object.height },
        priority: HIT_PRIORITY.EMBEDDED_OBJECT,
        data: { type: 'embedded-object', object }
      });
    }

    // Check if this is a TextBoxObject - delegate text rendering to renderRegion
    if (object instanceof TextBoxObject) {
      const textBox = object;

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
      const table = object;

      // CRITICAL: Force layout recalculation before any page split decisions
      // This ensures row heights are accurate for page layout calculations
      table.calculateLayout(ctx, true);

      // Reflow text in each cell to ensure accurate content heights
      for (const row of table.rows) {
        for (const cell of row.cells) {
          cell.reflow(ctx);
        }
      }

      // Recalculate layout again after cell reflow to get accurate heights
      table.calculateLayout(ctx, true);

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
        table.renderedPageIndex = pageIndex;

        ctx.save();
        ctx.translate(elementX, elementY);
        table.renderSlice(ctx, slice, continuation.pageLayout);
        ctx.restore();

        // Render cell text for rows in this slice
        const rowsToRender = table.getRowsForSlice(slice, continuation.pageLayout);
        this.renderTableCellText(table, rowsToRender, ctx, pageIndex, elementX, elementY, slice, continuation.pageLayout);

        // Calculate actual slice height from the rows that were rendered
        let actualSliceHeight = 0;
        for (const row of rowsToRender) {
          actualSliceHeight += row.calculatedHeight;
        }

        // Draw selection handles with slice-specific size
        // Determine slice position: 'middle' or 'last'
        const isLastSlice = continuation.sliceIndex === continuation.pageLayout.slices.length - 1;
        const slicePosition = isLastSlice ? 'last' : 'middle';
        const sliceYOffset = continuation.pageLayout.slices[continuation.sliceIndex].yOffset;
        const sliceHeaderHeight = continuation.pageLayout.headerHeight;

        // Store slice info for hit detection
        table.setRenderedSlice(pageIndex, { x: elementX, y: elementY }, actualSliceHeight, slicePosition, continuation.sliceIndex, sliceYOffset, sliceHeaderHeight);
        this.registerTableSliceHitTarget(table, pageIndex, { x: elementX, y: elementY }, actualSliceHeight);

        if (table.selected) {
          this.drawEmbeddedObjectHandles(ctx, table, { x: elementX, y: elementY }, {
            width: table.width,
            height: actualSliceHeight
          }, slicePosition);
        }

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
          table.renderedPageIndex = pageIndex;

          // Render first slice
          const firstSlice = pageLayout.slices[0];

          ctx.save();
          ctx.translate(elementX, elementY);
          table.renderSlice(ctx, firstSlice, pageLayout);
          ctx.restore();

          // Render cell text for rows in this slice
          const rowsToRender = table.getRowsForSlice(firstSlice, pageLayout);
          this.renderTableCellText(table, rowsToRender, ctx, pageIndex, elementX, elementY, firstSlice, pageLayout);

          // Calculate actual slice height from the rows that were rendered
          let actualSliceHeight = 0;
          for (const row of rowsToRender) {
            actualSliceHeight += row.calculatedHeight;
          }

          // Draw selection handles with slice-specific size
          // Determine slice position for handle display
          const slicePosition = pageLayout.slices.length === 1 ? 'only' : 'first';

          // Store slice info for hit detection (first page: yOffset=0, no repeated header)
          table.setRenderedSlice(pageIndex, { x: elementX, y: elementY }, actualSliceHeight, slicePosition, 0, 0, 0);
          this.registerTableSliceHitTarget(table, pageIndex, { x: elementX, y: elementY }, actualSliceHeight);

          if (table.selected) {
            this.drawEmbeddedObjectHandles(ctx, table, { x: elementX, y: elementY }, {
              width: table.width,
              height: actualSliceHeight
            }, slicePosition);
          }

          // Store continuation info for subsequent pages
          if (pageLayout.slices.length > 1) {
            this.tableContinuations.set(continuationKey, {
              table,
              sliceIndex: 1,
              pageLayout
            });

            // Emit event to trigger creation of additional pages for table continuation
            // We need pageIndex + slices.length total pages
            const firstPage = this.document.pages[0];
            if (firstPage) {
              this.emit('text-overflow', {
                pageId: firstPage.id,
                overflowPages: [],
                totalPages: pageIndex + pageLayout.slices.length
              });
            }
          }
        } else {
          // Table fits on current page - render normally
          table.renderedPosition = { x: elementX, y: elementY };
          table.renderedPageIndex = pageIndex;
          table.updateCellRenderedPositions();

          // Store slice info for hit detection (single page = 'only', yOffset=0, no repeated header)
          table.setRenderedSlice(pageIndex, { x: elementX, y: elementY }, table.height, 'only', 0, 0, 0);
          this.registerTableSliceHitTarget(table, pageIndex, { x: elementX, y: elementY }, table.height);

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

          // Draw selection handles (full size for non-sliced tables)
          if (table.selected) {
            this.drawEmbeddedObjectHandles(ctx, table, { x: elementX, y: elementY });
          }

          // Clear any stale continuation
          this.tableContinuations.delete(continuationKey);
        }
      } else {
        // No content bounds available - render normally (fallback)
        table.renderedPosition = { x: elementX, y: elementY };
        table.renderedPageIndex = pageIndex;
        table.updateCellRenderedPositions();

        // Store slice info for hit detection (fallback = 'only', yOffset=0, no repeated header)
        table.setRenderedSlice(pageIndex, { x: elementX, y: elementY }, table.height, 'only', 0, 0, 0);
        this.registerTableSliceHitTarget(table, pageIndex, { x: elementX, y: elementY }, table.height);

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

        // Draw selection handles (full size for non-sliced tables)
        if (table.selected) {
          this.drawEmbeddedObjectHandles(ctx, table, { x: elementX, y: elementY });
        }
      }
    } else {
      // For other embedded objects, render normally
      ctx.save();
      ctx.translate(elementX, elementY);

      object.render(ctx);

      ctx.restore();
    }

    // Draw selection/resize handles if selected (skip tables - handled separately with slice size)
    if (object.selected && !(object instanceof TableObject)) {
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

          // Store which page this cell was rendered on (for multi-page hit detection)
          cell.renderedPageIndex = pageIndex;

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

        // Store which page this cell was rendered on (for multi-page hit detection)
        cell.renderedPageIndex = pageIndex;

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
    this.pageTextOffsets.clear();
  }

  /**
   * Check if there are pending table continuations for the next page.
   */
  hasTableContinuations(): boolean {
    return this.tableContinuations.size > 0;
  }

  /**
   * Get the Y offset for text content on a specific page.
   * This accounts for table continuations that are rendered before text.
   */
  getPageTextOffset(pageIndex: number): number {
    return this.pageTextOffsets.get(pageIndex) || 0;
  }

  /**
   * Register a table slice as a hit target.
   * Tables are registered per-slice since they can span multiple pages.
   */
  private registerTableSliceHitTarget(
    table: TableObject,
    pageIndex: number,
    position: Point,
    sliceHeight: number
  ): void {
    this._hitTestManager.register(pageIndex, {
      type: 'embedded-object',
      category: 'content',
      bounds: { x: position.x, y: position.y, width: table.width, height: sliceHeight },
      priority: HIT_PRIORITY.EMBEDDED_OBJECT,
      data: { type: 'embedded-object', object: table }
    });
  }

  /**
   * Update resize handle hit targets for selected objects.
   * Call this when selection changes.
   */
  updateResizeHandleTargets(selectedObjects: BaseEmbeddedObject[]): void {
    // Clear existing resize handle targets
    this._hitTestManager.clearCategory('resize-handles');

    console.log('[updateResizeHandleTargets] selectedObjects:', selectedObjects.length);

    // Register resize handles for each selected object
    for (const object of selectedObjects) {
      if (!object.resizable) continue;

      // For tables, register handles based on slice info
      if (object instanceof TableObject) {
        this.registerTableResizeHandles(object);
      } else {
        // For regular objects, use renderedPosition
        const pos = object.renderedPosition;
        const pageIndex = object.renderedPageIndex;
        console.log('[updateResizeHandleTargets] object:', object.id, 'pageIndex:', pageIndex, 'pos:', pos);
        if (pos && pageIndex >= 0) {
          this.registerObjectResizeHandles(object, pageIndex, pos);
        }
      }
    }
  }

  /**
   * Register resize handles for a regular (non-table) embedded object.
   */
  private registerObjectResizeHandles(
    object: BaseEmbeddedObject,
    pageIndex: number,
    position: Point
  ): void {
    const handles = object.getResizeHandles();
    const handleSize = 12; // Hit area size

    for (const handle of handles) {
      // getHandlePosition returns top-left of handle box (already offset by -half)
      const handlePos = this.getHandlePosition(handle, position, object.width, object.height, handleSize);
      this._hitTestManager.register(pageIndex, {
        type: 'resize-handle',
        category: 'resize-handles',
        bounds: {
          x: handlePos.x,
          y: handlePos.y,
          width: handleSize,
          height: handleSize
        },
        priority: HIT_PRIORITY.RESIZE_HANDLE,
        data: { type: 'resize-handle', handle, element: object }
      });
    }
  }

  /**
   * Register resize handles for a table that may span multiple pages.
   */
  private registerTableResizeHandles(table: TableObject): void {
    const handleSize = 12;

    // Iterate through all pages where this table has rendered slices
    for (const pageIndex of this._hitTestManager.getPageIndices()) {
      const slice = table.getRenderedSlice(pageIndex);
      if (!slice) continue;

      // Determine which handles to show based on slice position
      let handles: string[];
      switch (slice.slicePosition) {
        case 'first':
          handles = ['nw', 'n', 'ne', 'w', 'e'];
          break;
        case 'middle':
          handles = ['w', 'e'];
          break;
        case 'last':
          handles = ['w', 'e', 'sw', 's', 'se'];
          break;
        case 'only':
        default:
          handles = table.getResizeHandles().map(h => h as string);
          break;
      }

      for (const handle of handles) {
        // getHandlePosition returns top-left of handle box (already offset by -half)
        const handlePos = this.getHandlePosition(
          handle as any,
          slice.position,
          table.width,
          slice.height,
          handleSize
        );
        this._hitTestManager.register(pageIndex, {
          type: 'resize-handle',
          category: 'resize-handles',
          bounds: {
            x: handlePos.x,
            y: handlePos.y,
            width: handleSize,
            height: handleSize
          },
          priority: HIT_PRIORITY.RESIZE_HANDLE,
          data: { type: 'resize-handle', handle: handle as any, element: table }
        });
      }
    }
  }

  /**
   * Update table divider hit targets for a focused table.
   * Call this when table focus changes.
   * @param table The focused table, or null to clear dividers
   */
  updateTableDividerTargets(table: TableObject | null): void {
    // Clear existing table divider targets
    this._hitTestManager.clearCategory('table-dividers');

    if (!table) return;

    const hitArea = 4; // Same as RESIZE_HANDLE_HIT_AREA in TableResizeHandler

    // Get all pages this table appears on
    const pageIndices = table.getRenderedPageIndices();

    for (const pageIndex of pageIndices) {
      const slice = table.getRenderedSlice(pageIndex);
      if (!slice) continue;

      const { position, height: sliceHeight } = slice;

      // Register column dividers (vertical lines between columns)
      const columnPositions = table.getColumnPositions();
      const columnWidths = table.getColumnWidths();

      for (let i = 0; i < columnPositions.length; i++) {
        const dividerX = position.x + columnPositions[i] + columnWidths[i];
        this._hitTestManager.register(pageIndex, {
          type: 'table-divider',
          category: 'table-dividers',
          bounds: {
            x: dividerX - hitArea,
            y: position.y,
            width: hitArea * 2,
            height: sliceHeight
          },
          priority: HIT_PRIORITY.TABLE_DIVIDER,
          data: { type: 'table-divider', table, dividerType: 'column', index: i }
        });
      }

      // Register row dividers (horizontal lines between rows)
      // Need to calculate which rows are visible in this slice
      let rowY = 0;
      const rows = table.rows;

      // For continuation pages, account for header row repetition
      const isFirstSlice = slice.slicePosition === 'only' || slice.slicePosition === 'first';
      const headerRowCount = table.headerRowCount;

      for (let i = 0; i < rows.length; i++) {
        const rowHeight = rows[i].calculatedHeight;
        rowY += rowHeight;

        // Skip rows not visible in this slice
        // For non-first slices, we need to check if this row is in the slice's yOffset range
        if (!isFirstSlice) {
          // On continuation pages, header rows are repeated at top
          // Data rows start after yOffset
          const sliceStartY = slice.yOffset;
          const sliceEndY = sliceStartY + sliceHeight - (headerRowCount > 0 ? slice.headerHeight : 0);

          // Skip header rows (they're repeated but shouldn't have dividers from main row list)
          if (i < headerRowCount) {
            // Register header row dividers at their repeated position
            let headerY = 0;
            for (let h = 0; h <= i; h++) {
              headerY += rows[h].calculatedHeight;
            }
            if (headerY <= slice.headerHeight) {
              this._hitTestManager.register(pageIndex, {
                type: 'table-divider',
                category: 'table-dividers',
                bounds: {
                  x: position.x,
                  y: position.y + headerY - hitArea,
                  width: table.width,
                  height: hitArea * 2
                },
                priority: HIT_PRIORITY.TABLE_DIVIDER,
                data: { type: 'table-divider', table, dividerType: 'row', index: i }
              });
            }
            continue;
          }

          // Check if this data row's divider is within the slice
          if (rowY < sliceStartY || rowY > sliceEndY + sliceStartY) {
            continue;
          }

          // Calculate Y position within the slice (after header)
          const dividerYInSlice = slice.headerHeight + (rowY - sliceStartY);
          if (dividerYInSlice > sliceHeight) continue;

          this._hitTestManager.register(pageIndex, {
            type: 'table-divider',
            category: 'table-dividers',
            bounds: {
              x: position.x,
              y: position.y + dividerYInSlice - hitArea,
              width: table.width,
              height: hitArea * 2
            },
            priority: HIT_PRIORITY.TABLE_DIVIDER,
            data: { type: 'table-divider', table, dividerType: 'row', index: i }
          });
        } else {
          // First slice or only slice - simple case
          if (rowY > sliceHeight) continue;

          this._hitTestManager.register(pageIndex, {
            type: 'table-divider',
            category: 'table-dividers',
            bounds: {
              x: position.x,
              y: position.y + rowY - hitArea,
              width: table.width,
              height: hitArea * 2
            },
            priority: HIT_PRIORITY.TABLE_DIVIDER,
            data: { type: 'table-divider', table, dividerType: 'row', index: i }
          });
        }
      }
    }
  }

  /**
   * Render table continuations for a page that has no regular text flow content.
   * This handles the case where a table spans more pages than the text flow creates.
   */
  private renderTableContinuationsForPage(
    ctx: CanvasRenderingContext2D,
    pageIndex: number,
    contentBounds: Rect
  ): void {
    // Iterate through all pending continuations and render them
    for (const [continuationKey, continuation] of this.tableContinuations.entries()) {
      if (continuation.sliceIndex >= continuation.pageLayout.slices.length) {
        continue;
      }

      const table = continuation.table;
      const slice = continuation.pageLayout.slices[continuation.sliceIndex];

      // Position table at top of content area for continuation pages
      const tableX = contentBounds.x;
      const tableY = contentBounds.y;

      // Update table rendered position
      table.renderedPosition = { x: tableX, y: tableY };
      table.renderedPageIndex = pageIndex;

      ctx.save();
      ctx.translate(tableX, tableY);
      table.renderSlice(ctx, slice, continuation.pageLayout);
      ctx.restore();

      // Render cell text for rows in this slice
      const rowsToRender = table.getRowsForSlice(slice, continuation.pageLayout);
      this.renderTableCellText(table, rowsToRender, ctx, pageIndex, tableX, tableY, slice, continuation.pageLayout);

      // Calculate actual slice height from the rows that were rendered
      let actualSliceHeight = 0;
      for (const row of rowsToRender) {
        actualSliceHeight += row.calculatedHeight;
      }

      // Draw selection handles if selected (with slice-specific size)
      // Determine slice position: 'middle' or 'last'
      const isLastSlice = continuation.sliceIndex === continuation.pageLayout.slices.length - 1;
      const slicePosition = isLastSlice ? 'last' : 'middle';
      const sliceYOffset = continuation.pageLayout.slices[continuation.sliceIndex].yOffset;
      const sliceHeaderHeight = continuation.pageLayout.headerHeight;

      // Store slice info for hit detection
      table.setRenderedSlice(pageIndex, { x: tableX, y: tableY }, actualSliceHeight, slicePosition, continuation.sliceIndex, sliceYOffset, sliceHeaderHeight);
      this.registerTableSliceHitTarget(table, pageIndex, { x: tableX, y: tableY }, actualSliceHeight);

      if (table.selected) {
        this.drawEmbeddedObjectHandles(ctx, table, { x: tableX, y: tableY }, {
          width: table.width,
          height: actualSliceHeight
        }, slicePosition);
      }

      // Update continuation for next page if there are more slices
      if (continuation.sliceIndex + 1 < continuation.pageLayout.slices.length) {
        this.tableContinuations.set(continuationKey, {
          ...continuation,
          sliceIndex: continuation.sliceIndex + 1
        });

        // Emit event to ensure we have enough pages
        const firstPage = this.document.pages[0];
        if (firstPage) {
          this.emit('text-overflow', {
            pageId: firstPage.id,
            overflowPages: [],
            totalPages: pageIndex + continuation.pageLayout.slices.length - continuation.sliceIndex
          });
        }
      } else {
        this.tableContinuations.delete(continuationKey);
      }
    }
  }

  /**
   * Render table continuations at a specific Y position within a page.
   * Used when there's both table continuations AND text content on the same page.
   * Returns the total height consumed by the continuations.
   */
  private renderTableContinuationsAtPosition(
    ctx: CanvasRenderingContext2D,
    pageIndex: number,
    contentBounds: Rect,
    startY: number
  ): number {
    let totalHeight = 0;

    for (const [continuationKey, continuation] of this.tableContinuations.entries()) {
      if (continuation.sliceIndex >= continuation.pageLayout.slices.length) {
        continue;
      }

      const table = continuation.table;
      const slice = continuation.pageLayout.slices[continuation.sliceIndex];

      // Position table at the current Y position
      const tableX = contentBounds.x;
      const tableY = startY + totalHeight;

      // Update table rendered position
      table.renderedPosition = { x: tableX, y: tableY };
      table.renderedPageIndex = pageIndex;

      ctx.save();
      ctx.translate(tableX, tableY);
      table.renderSlice(ctx, slice, continuation.pageLayout);
      ctx.restore();

      // Render cell text for rows in this slice
      const rowsToRender = table.getRowsForSlice(slice, continuation.pageLayout);
      this.renderTableCellText(table, rowsToRender, ctx, pageIndex, tableX, tableY, slice, continuation.pageLayout);

      // Calculate actual slice height from the rows that were rendered
      let actualSliceHeight = 0;
      for (const row of rowsToRender) {
        actualSliceHeight += row.calculatedHeight;
      }

      totalHeight += actualSliceHeight;

      // Draw selection handles if selected
      const isLastSlice = continuation.sliceIndex === continuation.pageLayout.slices.length - 1;
      const slicePosition = isLastSlice ? 'last' : 'middle';
      const sliceYOffset = continuation.pageLayout.slices[continuation.sliceIndex].yOffset;
      const sliceHeaderHeight = continuation.pageLayout.headerHeight;

      // Store slice info for hit detection
      table.setRenderedSlice(pageIndex, { x: tableX, y: tableY }, actualSliceHeight, slicePosition, continuation.sliceIndex, sliceYOffset, sliceHeaderHeight);
      this.registerTableSliceHitTarget(table, pageIndex, { x: tableX, y: tableY }, actualSliceHeight);

      if (table.selected) {
        this.drawEmbeddedObjectHandles(ctx, table, { x: tableX, y: tableY }, {
          width: table.width,
          height: actualSliceHeight
        }, slicePosition);
      }

      // Update continuation for next page if there are more slices
      if (continuation.sliceIndex + 1 < continuation.pageLayout.slices.length) {
        this.tableContinuations.set(continuationKey, {
          ...continuation,
          sliceIndex: continuation.sliceIndex + 1
        });

        // Emit event to ensure we have enough pages
        const firstPage = this.document.pages[0];
        if (firstPage) {
          this.emit('text-overflow', {
            pageId: firstPage.id,
            overflowPages: [],
            totalPages: pageIndex + continuation.pageLayout.slices.length - continuation.sliceIndex
          });
        }
      } else {
        this.tableContinuations.delete(continuationKey);
      }
    }

    return totalHeight;
  }

  /**
   * Draw selection border and resize handles for an embedded object.
   * @param sizeOverride Optional size to use instead of object.size (for sliced tables)
   * @param slicePosition Position in multi-page sequence: 'only', 'first', 'middle', 'last'
   *                      - 'only': single page, show all handles
   *                      - 'first': first slice, show top + side handles
   *                      - 'middle': middle slice, show side handles only
   *                      - 'last': last slice, show bottom + side handles
   */
  private drawEmbeddedObjectHandles(
    ctx: CanvasRenderingContext2D,
    object: BaseEmbeddedObject,
    position: Point,
    sizeOverride?: { width: number; height: number },
    slicePosition: 'only' | 'first' | 'middle' | 'last' = 'only'
  ): void {
    const handleSize = 8;
    const width = sizeOverride?.width ?? object.size.width;
    const height = sizeOverride?.height ?? object.size.height;

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
      // Determine which handles to show based on slice position
      let handlesToShow: string[];
      switch (slicePosition) {
        case 'first':
          // Top handles + side handles
          handlesToShow = ['nw', 'n', 'ne', 'w', 'e'];
          break;
        case 'middle':
          // Side handles only
          handlesToShow = ['w', 'e'];
          break;
        case 'last':
          // Bottom handles + side handles
          handlesToShow = ['w', 'e', 'sw', 's', 'se'];
          break;
        case 'only':
        default:
          // All handles
          handlesToShow = object.getResizeHandles();
          break;
      }

      ctx.fillStyle = '#0066ff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;

      for (const handle of handlesToShow) {
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
      flowingContent = this.document.bodyFlowingContent;
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
        // Account for list indentation
        const listIndent = line.listMarker?.indent ?? 0;
        ctx.fillRect(
          bounds.x + alignmentOffset + listIndent + selectionBounds.x,
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
    // FlowedPages are stored under the first page's ID
    const firstPage = this.document.pages[0];
    if (!firstPage) return null;

    const flowedPages = this.flowedPages.get(firstPage.id);
    if (!flowedPages || flowedPages.length === 0) {
      return null;
    }

    const page = this.document.getPage(pageId);
    if (!page) {
      return null;
    }

    // Find the page index for the clicked page
    const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
    if (pageIndex < 0 || pageIndex >= flowedPages.length) {
      return null;
    }

    const flowedPage = flowedPages[pageIndex];
    if (!flowedPage || flowedPage.lines.length === 0) {
      return null;
    }

    const contentBounds = page.getContentBounds();
    const relativeY = point.y - contentBounds.position.y;
    const relativeX = point.x - contentBounds.position.x;
    const maxWidth = contentBounds.size.width;

    // If clicked above all lines, return start of this page's content
    if (relativeY < 0 && flowedPage.lines.length > 0) {
      return flowedPage.lines[0].startIndex;
    }

    let currentY = 0;
    for (let lineIndex = 0; lineIndex < flowedPage.lines.length; lineIndex++) {
      const line = flowedPage.lines[lineIndex];

      if (relativeY >= currentY && relativeY < currentY + line.height) {
        // Found the line, now find the character position
        // Subtract alignment offset so x is relative to text start
        const alignmentOffset = this.getAlignmentOffset(line, maxWidth);
        return this.getTextIndexInLine(line, relativeX - alignmentOffset);
      }

      currentY += line.height;
    }

    // If clicked below all lines, return end of this page's content
    if (flowedPage.lines.length > 0) {
      const lastLine = flowedPage.lines[flowedPage.lines.length - 1];
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

    // Get current text index and find cursor location (body content is document-level)
    const textIndex = this.document.bodyFlowingContent.getCursorPosition();
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

    // Body content is document-level
    const flowingContent = this.document.bodyFlowingContent;
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

  /**
   * Get a complete snapshot of all flowed content for PDF export.
   * Returns body pages, header, and footer content.
   */
  getFlowedPagesSnapshot(): {
    body: FlowedPage[];
    header: FlowedPage | null;
    footer: FlowedPage | null;
  } {
    const firstPage = this.document.pages[0];
    const bodyPages = firstPage ? this.flowedPages.get(firstPage.id) || [] : [];

    return {
      body: bodyPages,
      header: this.headerFlowedPage,
      footer: this.footerFlowedPage
    };
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