import {
  FlowedPage,
  FlowedLine,
  TextFormattingStyle,
  FlowedSubstitutionField,
  FlowedEmbeddedObject,
  RepeatingSection,
  DEFAULT_FORMATTING
} from '../text';
import { Document } from '../core/Document';
import { Page } from '../core/Page';
import { Point, Rect, EditingSection } from '../types';
import { EventEmitter } from '../events/EventEmitter';
import { BaseEmbeddedObject } from '../objects';

export interface TextCursor {
  page: number;
  line: number;
  position: Point;
  height: number;
  visible: boolean;
  blinkState: boolean;
}

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

export class FlowingTextRenderer extends EventEmitter {
  private document: Document;
  private flowedPages: Map<string, FlowedPage[]> = new Map();
  private headerFlowedPage: FlowedPage | null = null;
  private footerFlowedPage: FlowedPage | null = null;
  private _activeSection: EditingSection = 'body';
  private cursor: TextCursor = {
    page: 0,
    line: 0,
    position: { x: 0, y: 0 },
    height: 14,
    visible: false,
    blinkState: true  // Start visible so cursor appears immediately when shown
  };
  private blinkInterval: number | null = null;
  private selectedText: { start: number; end: number } | null = null;
  private showControlCharacters: boolean = false;

  constructor(document: Document) {
    super();
    this.document = document;
    this.startCursorBlink();
    this.setupFlowingContentListeners();
  }

  /**
   * Set whether control characters are shown.
   */
  setShowControlCharacters(show: boolean): void {
    this.showControlCharacters = show;
  }

  /**
   * Set the active editing section.
   * Cursor is only rendered in the active section.
   */
  setActiveSection(section: EditingSection): void {
    this._activeSection = section;
  }

  /**
   * Get the currently active section.
   */
  getActiveSection(): EditingSection {
    return this._activeSection;
  }

  private setupFlowingContentListeners(): void {
    // Listen to cursor position changes from the first page's flowing content (body)
    if (this.document.pages.length > 0) {
      const firstPage = this.document.pages[0];

      firstPage.flowingContent.on('cursor-moved', (data) => {
        if (this._activeSection === 'body') {
          this.updateCursorFromTextPosition(data.position);
        }
      });

      firstPage.flowingContent.on('content-changed', () => {
        // Defer cursor position update to allow text reflow to complete
        setTimeout(() => {
          if (this._activeSection === 'body') {
            const cursorPos = firstPage.flowingContent.getCursorPosition();
            this.updateCursorFromTextPosition(cursorPos);
          }
        }, 10);

        // Forward the event so CanvasManager can check for empty pages
        this.emit('content-changed');
      });

      firstPage.flowingContent.on('selection-changed', (data) => {
        if (this._activeSection === 'body') {
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
    this.document.headerFlowingContent.on('cursor-moved', (data) => {
      if (this._activeSection === 'header') {
        this.updateCursorFromHeaderFooter(data.position, 'header');
      }
    });

    this.document.headerFlowingContent.on('content-changed', () => {
      this.emit('header-content-changed');
      this.emit('content-changed');
    });

    this.document.headerFlowingContent.on('selection-changed', (data) => {
      if (this._activeSection === 'header') {
        if (data.selection) {
          this.setTextSelection(data.selection.start, data.selection.end);
        } else {
          this.clearTextSelection();
        }
        this.emit('selection-changed', data);
      }
    });

    // Listen to footer content changes
    this.document.footerFlowingContent.on('cursor-moved', (data) => {
      if (this._activeSection === 'footer') {
        this.updateCursorFromHeaderFooter(data.position, 'footer');
      }
    });

    this.document.footerFlowingContent.on('content-changed', () => {
      this.emit('footer-content-changed');
      this.emit('content-changed');
    });

    this.document.footerFlowingContent.on('selection-changed', (data) => {
      if (this._activeSection === 'footer') {
        if (data.selection) {
          this.setTextSelection(data.selection.start, data.selection.end);
        } else {
          this.clearTextSelection();
        }
        this.emit('selection-changed', data);
      }
    });
  }

  /**
   * Update cursor position based on text position in header or footer.
   */
  private updateCursorFromHeaderFooter(textIndex: number, section: 'header' | 'footer'): void {
    const flowedPage = section === 'header' ? this.headerFlowedPage : this.footerFlowedPage;
    if (!flowedPage || flowedPage.lines.length === 0) return;

    // Find which line contains this text index
    for (let lineIdx = 0; lineIdx < flowedPage.lines.length; lineIdx++) {
      const line = flowedPage.lines[lineIdx];
      if (textIndex >= line.startIndex && textIndex <= line.endIndex) {
        this.cursor.page = 0;
        this.cursor.line = lineIdx;
        this.cursor.visible = true;
        this.restartCursorBlink();

        // Calculate X position (including alignment offset)
        const xOffset = this.getXPositionForTextIndex(line, textIndex);

        // Get bounds from page to calculate absolute position
        const firstPage = this.document.pages[0];
        if (firstPage) {
          const bounds = section === 'header'
            ? firstPage.getHeaderBounds()
            : firstPage.getFooterBounds();
          const alignmentOffset = this.getAlignmentOffset(line, bounds.size.width);
          this.cursor.position.x = bounds.position.x + alignmentOffset + xOffset;

          // Calculate Y position based on line index
          let cursorY = bounds.position.y;
          for (let i = 0; i < lineIdx; i++) {
            cursorY += flowedPage.lines[i].height;
          }
          this.cursor.position.y = cursorY;
          this.cursor.height = line.height;

          console.log(`Cursor position: x=${this.cursor.position.x.toFixed(1)}, y=${this.cursor.position.y.toFixed(1)}, xOffset=${xOffset.toFixed(1)}`);
        }

        this.emit('cursor-moved', { page: 0, line: lineIdx, textIndex });
        return;
      }
    }
  }
  
  private updateCursorFromTextPosition(textIndex: number): void {
    // First, force a reflow of the text to ensure we have up-to-date line information
    const firstPage = this.document.pages[0];
    if (!firstPage) return;
    
    // Create a temporary canvas for text measurement if needed
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get the content bounds for proper text flow calculation
    const contentBounds = firstPage.getContentBounds();
    const contentRect: Rect = {
      x: contentBounds.position.x,
      y: contentBounds.position.y,
      width: contentBounds.size.width,
      height: contentBounds.size.height
    };
    
    // Reflow the text
    const flowedPages = this.flowTextForPage(firstPage, ctx, contentRect);
    this.flowedPages.set(firstPage.id, flowedPages);
    
    // Now find which line contains this text index
    let foundPage = 0;

    // Helper to get the next line (may be on next page)
    const getNextLine = (pageIdx: number, lineIdx: number) => {
      const page = flowedPages[pageIdx];
      if (lineIdx + 1 < page.lines.length) {
        return page.lines[lineIdx + 1];
      }
      // Check first line of next page
      const nextPage = flowedPages[pageIdx + 1];
      if (nextPage && nextPage.lines.length > 0) {
        return nextPage.lines[0];
      }
      return null;
    };

    // Search through all flowed pages
    for (let pageIdx = 0; pageIdx < flowedPages.length; pageIdx++) {
      const page = flowedPages[pageIdx];

      for (let lineIdx = 0; lineIdx < page.lines.length; lineIdx++) {
        const line = page.lines[lineIdx];

        if (textIndex >= line.startIndex && textIndex <= line.endIndex) {
          // Check if we're at a wrapped line boundary - if so, cursor belongs on next line
          // A wrapped boundary occurs when this line's endIndex equals the next line's startIndex
          const nextLine = getNextLine(pageIdx, lineIdx);
          if (textIndex === line.endIndex && nextLine && textIndex === nextLine.startIndex) {
            // Skip this line - cursor should appear at start of next line
            continue;
          }

          foundPage = pageIdx;
          this.setCursor(foundPage, lineIdx, textIndex);

          // Trigger a render to show the updated cursor
          this.emit('cursor-moved', { page: foundPage, line: lineIdx, textIndex });
          return;
        }
      }
    }
    
    // If we didn't find the position (e.g., cursor at very end), place it at the end of the last line
    if (flowedPages.length > 0) {
      const lastPage = flowedPages[flowedPages.length - 1];
      if (lastPage.lines.length > 0) {
        this.setCursor(flowedPages.length - 1, lastPage.lines.length - 1, textIndex);
        this.emit('cursor-moved', { page: flowedPages.length - 1, line: lastPage.lines.length - 1, textIndex });
      }
    }
  }

  renderPageFlowingText(
    page: Page,
    ctx: CanvasRenderingContext2D,
    contentBounds: Rect
  ): void {
    // Only flow text from the first page
    const pageIndex = this.document.pages.findIndex(p => p.id === page.id);
    
    if (pageIndex === 0) {
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
        this.renderFlowedPage(flowedPages[0], ctx, contentBounds);
      }
    } else {
      // For subsequent pages, get the flowed content from the first page
      const firstPageFlowed = this.flowedPages.get(this.document.pages[0].id);
      if (firstPageFlowed && firstPageFlowed.length > pageIndex) {
        this.renderFlowedPage(firstPageFlowed[pageIndex], ctx, contentBounds);
      }
    }

    // Render cursor if visible and on this page (only when body is active)
    if (this._activeSection === 'body' && this.cursor.visible && this.cursor.page === pageIndex) {
      this.renderCursor(ctx);
    }

    // Render selection if any (only when body is active)
    if (this._activeSection === 'body' && this.selectedText) {
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
    isActive: boolean
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
      this.renderFlowedPage(flowedPages[0], ctx, bounds);

      // Render cursor if header is active
      if (isActive && this.cursor.visible) {
        // Get the current cursor position from the FlowingTextContent
        const cursorTextIndex = this.document.headerFlowingContent.getCursorPosition();

        // Find which line the cursor is on and update position
        let cursorY = bounds.y;
        for (let lineIndex = 0; lineIndex < flowedPages[0].lines.length; lineIndex++) {
          const line = flowedPages[0].lines[lineIndex];
          if (cursorTextIndex >= line.startIndex && cursorTextIndex <= line.endIndex) {
            // Update cursor position for this line (including alignment offset)
            this.cursor.line = lineIndex;
            const alignmentOffset = this.getAlignmentOffset(line, bounds.width);
            this.cursor.position.x = bounds.x + alignmentOffset + this.getXPositionForTextIndex(line, cursorTextIndex);
            this.cursor.position.y = cursorY;
            this.cursor.height = line.height;
            break;
          }
          cursorY += line.height;
        }
        this.renderCursor(ctx);
      }

      // Render selection if any and header is active
      if (isActive && this.selectedText) {
        this.renderTextSelection(flowedPages[0], ctx, bounds);
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
   */
  renderFooterText(
    page: Page,
    ctx: CanvasRenderingContext2D,
    isActive: boolean
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
      this.renderFlowedPage(flowedPages[0], ctx, bounds);

      // Render cursor if footer is active
      if (isActive && this.cursor.visible) {
        // Get the current cursor position from the FlowingTextContent
        const cursorTextIndex = this.document.footerFlowingContent.getCursorPosition();

        // Find which line the cursor is on and update position
        let cursorY = bounds.y;
        for (let lineIndex = 0; lineIndex < flowedPages[0].lines.length; lineIndex++) {
          const line = flowedPages[0].lines[lineIndex];
          if (cursorTextIndex >= line.startIndex && cursorTextIndex <= line.endIndex) {
            // Update cursor position for this line (including alignment offset)
            this.cursor.line = lineIndex;
            const alignmentOffset = this.getAlignmentOffset(line, bounds.width);
            this.cursor.position.x = bounds.x + alignmentOffset + this.getXPositionForTextIndex(line, cursorTextIndex);
            this.cursor.position.y = cursorY;
            this.cursor.height = line.height;
            break;
          }
          cursorY += line.height;
        }
        this.renderCursor(ctx);
      }

      // Render selection if any and footer is active
      if (isActive && this.selectedText) {
        this.renderTextSelection(flowedPages[0], ctx, bounds);
      }
    } else {
      this.footerFlowedPage = null;
    }
  }

  /**
   * Handle click in header area.
   * @returns 'text' if click was handled, false otherwise
   */
  handleHeaderClick(point: Point, page: Page): boolean | string {
    const headerBounds = page.getHeaderBounds();

    // Check if click is within header bounds
    if (point.y < headerBounds.position.y ||
        point.y >= headerBounds.position.y + headerBounds.size.height) {
      return false;
    }

    // If no lines yet (empty header), set cursor to position 0
    if (!this.headerFlowedPage || this.headerFlowedPage.lines.length === 0) {
      this.cursor.page = 0;
      this.cursor.line = 0;
      this.cursor.visible = true;
      this.cursor.position.x = headerBounds.position.x;
      this.cursor.position.y = headerBounds.position.y;
      this.cursor.height = 14; // Default cursor height for empty content
      this.restartCursorBlink();
      this.document.headerFlowingContent.setCursorPosition(0);
      this.emit('text-clicked', { textIndex: 0, line: 0, section: 'header' });
      return 'text';
    }

    const relativeY = point.y - headerBounds.position.y;
    const relativeX = point.x - headerBounds.position.x;
    const maxWidth = headerBounds.size.width;

    let currentY = 0;
    for (let lineIndex = 0; lineIndex < this.headerFlowedPage.lines.length; lineIndex++) {
      const line = this.headerFlowedPage.lines[lineIndex];

      if (relativeY >= currentY && relativeY < currentY + line.height) {
        // Found the line, now find the character position
        // Subtract alignment offset so x is relative to text start
        const alignmentOffset = this.getAlignmentOffset(line, maxWidth);
        const textIndex = this.getTextIndexInLine(line, relativeX - alignmentOffset);
        console.log(`Click: x=${point.x.toFixed(1)}, y=${point.y.toFixed(1)}, textPosition=${textIndex}`);

        // Update cursor
        this.cursor.page = 0;
        this.cursor.line = lineIndex;
        this.cursor.visible = true;
        this.restartCursorBlink();

        // Set cursor position in header's FlowingTextContent
        this.document.headerFlowingContent.setCursorPosition(textIndex);

        this.emit('text-clicked', { textIndex, line: lineIndex, section: 'header' });
        return 'text';
      }

      currentY += line.height;
    }

    // Click is below all lines - set cursor to end of last line
    const lastLineIndex = this.headerFlowedPage.lines.length - 1;
    const lastLine = this.headerFlowedPage.lines[lastLineIndex];
    const textIndex = lastLine.endIndex;

    this.cursor.page = 0;
    this.cursor.line = lastLineIndex;
    this.cursor.visible = true;
    this.restartCursorBlink();
    this.document.headerFlowingContent.setCursorPosition(textIndex);
    this.emit('text-clicked', { textIndex, line: lastLineIndex, section: 'header' });
    return 'text';
  }

  /**
   * Handle click in footer area.
   * @returns 'text' if click was handled, false otherwise
   */
  handleFooterClick(point: Point, page: Page): boolean | string {
    const footerBounds = page.getFooterBounds();

    // Check if click is within footer bounds
    if (point.y < footerBounds.position.y ||
        point.y >= footerBounds.position.y + footerBounds.size.height) {
      return false;
    }

    // If no lines yet (empty footer), set cursor to position 0
    if (!this.footerFlowedPage || this.footerFlowedPage.lines.length === 0) {
      this.cursor.page = 0;
      this.cursor.line = 0;
      this.cursor.visible = true;
      this.cursor.position.x = footerBounds.position.x;
      this.cursor.position.y = footerBounds.position.y;
      this.cursor.height = 14; // Default cursor height for empty content
      this.restartCursorBlink();
      this.document.footerFlowingContent.setCursorPosition(0);
      this.emit('text-clicked', { textIndex: 0, line: 0, section: 'footer' });
      return 'text';
    }

    const relativeY = point.y - footerBounds.position.y;
    const relativeX = point.x - footerBounds.position.x;
    const maxWidth = footerBounds.size.width;

    let currentY = 0;
    for (let lineIndex = 0; lineIndex < this.footerFlowedPage.lines.length; lineIndex++) {
      const line = this.footerFlowedPage.lines[lineIndex];

      if (relativeY >= currentY && relativeY < currentY + line.height) {
        // Found the line, now find the character position
        // Subtract alignment offset so x is relative to text start
        const alignmentOffset = this.getAlignmentOffset(line, maxWidth);
        const textIndex = this.getTextIndexInLine(line, relativeX - alignmentOffset);
        console.log(`Click: x=${point.x.toFixed(1)}, y=${point.y.toFixed(1)}, textPosition=${textIndex}`);

        // Update cursor
        this.cursor.page = 0;
        this.cursor.line = lineIndex;
        this.cursor.visible = true;
        this.restartCursorBlink();

        // Set cursor position in footer's FlowingTextContent
        this.document.footerFlowingContent.setCursorPosition(textIndex);

        this.emit('text-clicked', { textIndex, line: lineIndex, section: 'footer' });
        return 'text';
      }

      currentY += line.height;
    }

    // Click is below all lines - set cursor to end of last line
    const lastLineIndex = this.footerFlowedPage.lines.length - 1;
    const lastLine = this.footerFlowedPage.lines[lastLineIndex];
    const textIndex = lastLine.endIndex;

    this.cursor.page = 0;
    this.cursor.line = lastLineIndex;
    this.cursor.visible = true;
    this.restartCursorBlink();
    this.document.footerFlowingContent.setCursorPosition(textIndex);
    this.emit('text-clicked', { textIndex, line: lastLineIndex, section: 'footer' });
    return 'text';
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
    bounds: Rect
  ): void {
    let y = bounds.y;

    for (let lineIndex = 0; lineIndex < flowedPage.lines.length; lineIndex++) {
      const line = flowedPage.lines[lineIndex];

      // Get the current cursor text position from the document for field selection
      const currentPage = this.document.pages[0];
      const cursorTextIndex = currentPage ? currentPage.flowingContent.getCursorPosition() : 0;

      this.renderFlowedLine(line, ctx, { x: bounds.x, y }, bounds.width, cursorTextIndex);

      // Update cursor position if it's on this line (only for body content when body is active)
      // Header/footer cursor positions are handled separately in updateCursorFromHeaderFooter
      if (this._activeSection === 'body' && this.cursor.visible && this.cursor.line === lineIndex) {

        // Include alignment offset in cursor X position
        const alignmentOffset = this.getAlignmentOffset(line, bounds.width);
        this.cursor.position.x = bounds.x + alignmentOffset + this.getXPositionForTextIndex(line, cursorTextIndex);
        this.cursor.position.y = y;
        this.cursor.height = line.height;
      }

      y += line.height;
    }
  }

  private renderFlowedLine(
    line: FlowedLine,
    ctx: CanvasRenderingContext2D,
    position: Point,
    maxWidth: number,
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
          x = this.renderEmbeddedObject(embeddedObj, ctx, { x, y: position.y }, line, maxWidth, position.x);
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
    lineStartX: number
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

    // Save context and translate to object position
    ctx.save();
    ctx.translate(elementX, elementY);

    // Render the object
    object.render(ctx);

    ctx.restore();

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

    if (this._activeSection === 'body') {
      const page = this.document.pages[0];
      flowingContent = page?.flowingContent;
    } else if (this._activeSection === 'header') {
      flowingContent = this.document.headerFlowingContent;
    } else if (this._activeSection === 'footer') {
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

  private renderCursor(ctx: CanvasRenderingContext2D): void {
    if (!this.cursor.blinkState) return;

    // Don't render cursor if it's positioned right after a field or selected object
    if (this.isCursorAfterFieldOrObject()) return;

    console.log(`renderCursor: x=${this.cursor.position.x.toFixed(1)}, y=${this.cursor.position.y.toFixed(1)}, height=${this.cursor.height.toFixed(1)}, activeSection=${this._activeSection}`);

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.cursor.position.x, this.cursor.position.y);
    ctx.lineTo(this.cursor.position.x, this.cursor.position.y + this.cursor.height);
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

  handleClick(point: Point, pageId: string): boolean | string {
    const flowedPages = this.flowedPages.get(pageId);
    if (!flowedPages || flowedPages.length === 0) {
      return false;
    }

    const page = this.document.getPage(pageId);
    if (!page) {
      return false;
    }

    // Find which line was clicked
    const contentBounds = page.getContentBounds();
    const relativeY = point.y - contentBounds.position.y;
    const relativeX = point.x - contentBounds.position.x;
    const maxWidth = contentBounds.size.width;

    let currentY = 0;
    for (let lineIndex = 0; lineIndex < flowedPages[0].lines.length; lineIndex++) {
      const line = flowedPages[0].lines[lineIndex];

      if (relativeY >= currentY && relativeY < currentY + line.height) {
        // First check if we clicked on an inline element
        const lineY = contentBounds.position.y + currentY;
        const alignmentOffset = this.getAlignmentOffset(line, maxWidth);
        const lineStartX = contentBounds.position.x + alignmentOffset;
        const inlineElement = this.getInlineElementAtPoint(line, point, lineY, lineStartX);
        if (inlineElement) {
          // Clicked on an inline element, emit event but don't claim the click
          // The inline element event handler will handle selection
          this.emit('inline-element-clicked', { element: inlineElement, point });
          return 'inline-element';
        }

        // Found the line, now find the character position
        // Subtract alignment offset so x is relative to text start
        const textIndex = this.getTextIndexInLine(line, relativeX - alignmentOffset);
        
        // Update cursor
        const boundsRect: Rect = {
          x: contentBounds.position.x,
          y: contentBounds.position.y,
          width: contentBounds.size.width,
          height: contentBounds.size.height
        };
        this.setCursor(0, lineIndex, textIndex, boundsRect);
        page.flowingContent.setCursorPosition(textIndex);
        
        this.emit('text-clicked', { textIndex, line: lineIndex });
        return 'text';
      }
      
      currentY += line.height;
    }

    return false;
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

  setCursor(page: number, line: number, textIndex: number, bounds?: Rect): void {
    this.cursor.page = page;
    this.cursor.line = line;
    this.cursor.visible = true;
    this.restartCursorBlink();
    
    // Calculate cursor x position
    const flowedPages = this.flowedPages.get(this.document.pages[page]?.id);
    if (flowedPages && flowedPages[0] && flowedPages[0].lines[line]) {
      const lineData = flowedPages[0].lines[line];
      const xOffset = this.getXPositionForTextIndex(lineData, textIndex);
      
      // If bounds are provided, add the left margin offset
      if (bounds) {
        this.cursor.position.x = bounds.x + xOffset;
      } else {
        // Try to get bounds from the page
        const pageObj = this.document.pages[page];
        if (pageObj) {
          const contentBounds = pageObj.getContentBounds();
          this.cursor.position.x = contentBounds.position.x + xOffset;
        } else {
          this.cursor.position.x = xOffset;
        }
      }
    }

    this.emit('cursor-changed', { page, line, textIndex });
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
    if (this._activeSection === 'header') {
      return this.moveCursorVerticalInSection(direction, this.headerFlowedPage, pageId, 'header');
    }
    if (this._activeSection === 'footer') {
      return this.moveCursorVerticalInSection(direction, this.footerFlowedPage, pageId, 'footer');
    }

    // Body section - use multi-page flowedPages
    const flowedPages = this.flowedPages.get(pageId);
    if (!flowedPages || flowedPages.length === 0) return null;

    const page = this.document.getPage(pageId);
    if (!page) return null;

    const currentLine = this.cursor.line;
    const currentPage = this.cursor.page;

    // Get the page's flowed content
    const flowedPage = flowedPages[currentPage];
    if (!flowedPage) return null;

    // Calculate target line
    const targetLine = currentLine + direction;

    const contentBounds = page.getContentBounds();
    const maxWidth = contentBounds.size.width;

    // Check if we need to move to adjacent page
    if (targetLine < 0) {
      // Move to previous page
      if (currentPage > 0) {
        const prevPage = flowedPages[currentPage - 1];
        if (prevPage && prevPage.lines.length > 0) {
          const lastLineIndex = prevPage.lines.length - 1;
          const targetLineData = prevPage.lines[lastLineIndex];
          return this.getTextIndexAtVisualX(targetLineData, this.getCursorRelativeX(pageId), maxWidth);
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
          return this.getTextIndexAtVisualX(targetLineData, this.getCursorRelativeX(pageId), maxWidth);
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
    return this.getTextIndexAtVisualX(targetLineData, this.getCursorRelativeX(pageId), maxWidth);
  }

  /**
   * Move cursor vertically within a single-page section (header/footer).
   */
  private moveCursorVerticalInSection(
    direction: -1 | 1,
    flowedPage: FlowedPage | null,
    pageId: string,
    section: 'header' | 'footer'
  ): number | null {
    if (!flowedPage || flowedPage.lines.length === 0) return null;

    const page = this.document.getPage(pageId);
    if (!page) return null;

    const bounds = section === 'header' ? page.getHeaderBounds() : page.getFooterBounds();
    const maxWidth = bounds.size.width;

    const currentLine = this.cursor.line;
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
    return this.getTextIndexAtVisualX(targetLineData, this.getCursorRelativeXForSection(pageId, section), maxWidth);
  }

  /**
   * Get the cursor's X position relative to the section area.
   */
  private getCursorRelativeXForSection(pageId: string, section: 'header' | 'footer'): number {
    const page = this.document.getPage(pageId);
    if (!page) return 0;

    const bounds = section === 'header' ? page.getHeaderBounds() : page.getFooterBounds();
    return this.cursor.position.x - bounds.position.x;
  }

  /**
   * Get the cursor's X position relative to the content area.
   */
  private getCursorRelativeX(pageId: string): number {
    const page = this.document.getPage(pageId);
    if (!page) return 0;

    const contentBounds = page.getContentBounds();
    return this.cursor.position.x - contentBounds.position.x;
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

  showCursor(): void {
    this.cursor.visible = true;
    this.restartCursorBlink();
  }

  hideCursor(): void {
    this.cursor.visible = false;
    this.stopCursorBlink();
  }

  private startCursorBlink(): void {
    this.blinkInterval = window.setInterval(() => {
      this.cursor.blinkState = !this.cursor.blinkState;
      this.emit('cursor-blink');
    }, 500);
  }

  private restartCursorBlink(): void {
    this.cursor.blinkState = true;
    this.stopCursorBlink();
    this.startCursorBlink();
    // Emit immediately to trigger a render with cursor visible
    this.emit('cursor-blink');
  }

  private stopCursorBlink(): void {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
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

    const hasStart = startInfo !== null;
    const hasEnd = endInfo !== null;
    const sectionSpansThisPage = this.sectionSpansPage(section, flowedPage);

    // If section doesn't appear on this page at all, skip
    if (!hasStart && !hasEnd && !sectionSpansThisPage) {
      return;
    }

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
    }

    // Draw vertical connector line
    let verticalStartY: number;
    let verticalEndY: number;

    if (hasStart) {
      verticalStartY = startInfo.y;
    } else {
      // Section started on a previous page, start from top of content
      verticalStartY = contentBounds.y;
    }

    if (hasEnd) {
      verticalEndY = endInfo.y;
    } else if (sectionSpansThisPage) {
      // Section continues to next page, end at bottom of content
      verticalEndY = contentBounds.y + flowedPage.height;
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
    this.stopCursorBlink();
    this.removeAllListeners();
  }
}