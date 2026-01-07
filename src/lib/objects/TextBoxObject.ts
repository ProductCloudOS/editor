import { BaseEmbeddedObject } from './BaseEmbeddedObject';
import { TextBoxObjectConfig, EmbeddedObjectData, Point, TextBoxBorder, BorderSide, DEFAULT_BORDER_SIDE, Rect } from './types';
import { FlowingTextContent } from '../text/FlowingTextContent';
import { FlowedLine, FlowedPage, Focusable } from '../text/types';
import { TextPositionCalculator } from '../text/TextPositionCalculator';
import { EditableTextRegion, RegionType } from '../text/EditableTextRegion';

/**
 * Default text box styling.
 */
const DEFAULT_TEXTBOX_STYLE = {
  fontFamily: 'Arial',
  fontSize: 14,
  color: '#000000',
  backgroundColor: '#ffffff',
  padding: 4
};

/**
 * Create a full border from partial config.
 */
function createBorder(partial?: Partial<TextBoxBorder>, legacyBorderColor?: string): TextBoxBorder {
  const defaultSide: BorderSide = legacyBorderColor
    ? { ...DEFAULT_BORDER_SIDE, color: legacyBorderColor }
    : { ...DEFAULT_BORDER_SIDE };

  return {
    top: partial?.top ? { ...defaultSide, ...partial.top } : { ...defaultSide },
    right: partial?.right ? { ...defaultSide, ...partial.right } : { ...defaultSide },
    bottom: partial?.bottom ? { ...defaultSide, ...partial.bottom } : { ...defaultSide },
    left: partial?.left ? { ...defaultSide, ...partial.left } : { ...defaultSide }
  };
}

/**
 * Text box object - editable text within a box with flowing text support.
 * Implements Focusable for unified focus management, delegating to internal FlowingTextContent.
 * Implements EditableTextRegion for unified text interaction.
 */
export class TextBoxObject extends BaseEmbeddedObject implements Focusable, EditableTextRegion {
  private _content: string;
  private _fontFamily: string;
  private _fontSize: number;
  private _color: string;
  private _backgroundColor: string;
  private _border: TextBoxBorder;
  private _padding: number;
  private _editing: boolean = false;

  // Internal FlowingTextContent for rich text editing
  private _flowingContent: FlowingTextContent;

  // Cached flowed lines for rendering
  private _flowedLines: FlowedLine[] = [];

  // Cached flowed page for EditableTextRegion interface
  private _flowedPage: FlowedPage | null = null;

  constructor(config: TextBoxObjectConfig) {
    super(config);
    this._content = config.content || '';
    this._fontFamily = config.fontFamily || DEFAULT_TEXTBOX_STYLE.fontFamily;
    this._fontSize = config.fontSize || DEFAULT_TEXTBOX_STYLE.fontSize;
    this._color = config.color || DEFAULT_TEXTBOX_STYLE.color;
    this._backgroundColor = config.backgroundColor || DEFAULT_TEXTBOX_STYLE.backgroundColor;
    this._border = createBorder(config.border, config.borderColor);
    this._padding = config.padding ?? DEFAULT_TEXTBOX_STYLE.padding;

    // Create internal FlowingTextContent
    this._flowingContent = new FlowingTextContent(this._content);
    this._flowingContent.setDefaultFormatting({
      fontFamily: this._fontFamily,
      fontSize: this._fontSize,
      color: this._color
    });

    // Sync content changes back to _content
    this._flowingContent.on('content-changed', () => {
      this._content = this._flowingContent.getText();
      this.emit('content-changed', { content: this._content });
    });
  }

  get objectType(): string {
    return 'textbox';
  }

  // EditableTextRegion type property
  readonly type: RegionType = 'textbox';

  get content(): string {
    return this._content;
  }

  set content(value: string) {
    this._content = value;
    this._flowingContent.setText(value);
    this.emit('content-changed', { content: value });
  }

  get fontFamily(): string {
    return this._fontFamily;
  }

  set fontFamily(value: string) {
    this._fontFamily = value;
    this._flowingContent.setDefaultFormatting({ fontFamily: value });
    this.emit('style-changed', { fontFamily: value });
  }

  get fontSize(): number {
    return this._fontSize;
  }

  set fontSize(value: number) {
    this._fontSize = value;
    this._flowingContent.setDefaultFormatting({ fontSize: value });
    this.emit('style-changed', { fontSize: value });
  }

  get color(): string {
    return this._color;
  }

  set color(value: string) {
    this._color = value;
    this._flowingContent.setDefaultFormatting({ color: value });
    this.emit('style-changed', { color: value });
  }

  get backgroundColor(): string {
    return this._backgroundColor;
  }

  set backgroundColor(value: string) {
    this._backgroundColor = value;
    this.emit('style-changed', { backgroundColor: value });
  }

  get border(): TextBoxBorder {
    return this._border;
  }

  set border(value: TextBoxBorder) {
    this._border = value;
    this.emit('style-changed', { border: value });
  }

  /** @deprecated Use border instead */
  get borderColor(): string {
    return this._border.top.color;
  }

  /** @deprecated Use border instead */
  set borderColor(value: string) {
    this._border = {
      top: { ...this._border.top, color: value },
      right: { ...this._border.right, color: value },
      bottom: { ...this._border.bottom, color: value },
      left: { ...this._border.left, color: value }
    };
    this.emit('style-changed', { borderColor: value });
  }

  get padding(): number {
    return this._padding;
  }

  set padding(value: number) {
    this._padding = value;
    this.emit('style-changed', { padding: value });
  }

  get editing(): boolean {
    return this._editing;
  }

  set editing(value: boolean) {
    if (this._editing !== value) {
      this._editing = value;
      if (value) {
        this._flowingContent.focus();
      } else {
        this._flowingContent.blur();
      }
      this.emit('editing-changed', { editing: value });
    }
  }

  /**
   * Get the internal FlowingTextContent for direct manipulation.
   */
  get flowingContent(): FlowingTextContent {
    return this._flowingContent;
  }

  /**
   * Get available text bounds (size minus padding and borders).
   */
  getTextBounds(): { width: number; height: number } {
    const borderLeft = this._border.left.style !== 'none' ? this._border.left.width : 0;
    const borderRight = this._border.right.style !== 'none' ? this._border.right.width : 0;
    const borderTop = this._border.top.style !== 'none' ? this._border.top.width : 0;
    const borderBottom = this._border.bottom.style !== 'none' ? this._border.bottom.width : 0;

    return {
      width: this._size.width - this._padding * 2 - borderLeft - borderRight,
      height: this._size.height - this._padding * 2 - borderTop - borderBottom
    };
  }

  /**
   * Get the text area offset (padding + border) from the top-left of the text box.
   */
  getTextOffset(): { x: number; y: number } {
    const borderLeft = this._border.left.style !== 'none' ? this._border.left.width : 0;
    const borderTop = this._border.top.style !== 'none' ? this._border.top.width : 0;

    return {
      x: this._padding + borderLeft,
      y: this._padding + borderTop
    };
  }

  /**
   * Get the text area bounds in global coordinates.
   * This is the area where text is rendered, inside padding and borders.
   * Returns null if the text box hasn't been positioned yet.
   */
  getTextAreaBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this._renderedPosition) {
      return null;
    }
    const offset = this.getTextOffset();
    const textBounds = this.getTextBounds();
    return {
      x: this._renderedPosition.x + offset.x,
      y: this._renderedPosition.y + offset.y,
      width: textBounds.width,
      height: textBounds.height
    };
  }

  /**
   * Render the text box container (background, border, indicators).
   * Text content is rendered separately by FlowingTextRenderer.renderRegion().
   * @param ctx Canvas rendering context (should be translated to text box position)
   */
  render(ctx: CanvasRenderingContext2D): void {
    // Draw background
    this.renderBackground(ctx);

    // Draw border
    this.renderBorder(ctx);

    // Text content is rendered by FlowingTextRenderer.renderRegion()

    // Draw selection border if selected
    if (this._selected) {
      this.renderSelectionBorder(ctx);
    }

    // Draw editing border if editing
    if (this._editing) {
      this.renderEditingBorder(ctx);
    }
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this._size;
    ctx.fillStyle = this._backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  private renderBorder(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this._size;

    // Draw each side separately
    this.drawBorderSide(ctx, 'top', 0, 0, width, 0);
    this.drawBorderSide(ctx, 'right', width, 0, width, height);
    this.drawBorderSide(ctx, 'bottom', width, height, 0, height);
    this.drawBorderSide(ctx, 'left', 0, height, 0, 0);
  }

  private drawBorderSide(
    ctx: CanvasRenderingContext2D,
    side: 'top' | 'right' | 'bottom' | 'left',
    x1: number, y1: number, x2: number, y2: number
  ): void {
    const border = this._border[side];
    if (border.style === 'none' || border.width <= 0) return;

    ctx.strokeStyle = border.color;
    ctx.lineWidth = border.width;

    // Set dash pattern based on style
    switch (border.style) {
      case 'dashed':
        ctx.setLineDash([border.width * 3, border.width * 2]);
        break;
      case 'dotted':
        ctx.setLineDash([border.width, border.width]);
        break;
      default:
        ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Reset dash pattern
    ctx.setLineDash([]);
  }

  /**
   * Get X position for a text index within a line.
   * Used for vertical cursor navigation.
   */
  private getXPositionInLine(ctx: CanvasRenderingContext2D, line: FlowedLine, textIndex: number): number {
    const textBounds = this.getTextBounds();
    // Use TextPositionCalculator for alignment offset and X position
    const alignmentOffset = TextPositionCalculator.getAlignmentOffset(line, textBounds.width);
    const xInLine = TextPositionCalculator.getXPositionForTextIndex(line, textIndex, ctx);
    return alignmentOffset + xInLine;
  }

  private renderEditingBorder(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this._size;
    ctx.strokeStyle = '#0099ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(1, 1, width - 2, height - 2);
  }

  /**
   * Move cursor vertically by one line.
   * @param direction -1 for up, 1 for down
   * @param ctx Canvas context for text measurement
   * @returns true if cursor was moved, false if at boundary
   */
  moveCursorVertical(direction: -1 | 1, ctx: CanvasRenderingContext2D): boolean {
    if (this._flowedLines.length === 0) return false;

    const cursorPos = this._flowingContent.getCursorPosition();

    // Find current line index
    let currentLineIndex = -1;
    for (let i = 0; i < this._flowedLines.length; i++) {
      const line = this._flowedLines[i];
      if (cursorPos >= line.startIndex && cursorPos <= line.endIndex) {
        currentLineIndex = i;
        break;
      }
    }

    // If cursor not found in any line, put it at the end
    if (currentLineIndex === -1) {
      currentLineIndex = this._flowedLines.length - 1;
    }

    // Calculate target line
    const targetLineIndex = currentLineIndex + direction;
    if (targetLineIndex < 0 || targetLineIndex >= this._flowedLines.length) {
      return false; // At boundary
    }

    const currentLine = this._flowedLines[currentLineIndex];
    const targetLine = this._flowedLines[targetLineIndex];

    // Get current X position in the line
    const currentX = this.getXPositionInLine(ctx, currentLine, cursorPos);

    // Find text index at same X position in target line
    const newTextIndex = this.getTextIndexAtX(ctx, targetLine, currentX);

    this._flowingContent.setCursorPosition(newTextIndex);
    this._flowingContent.resetCursorBlink();
    return true;
  }

  /**
   * Find the text index at a given X position within a line.
   */
  private getTextIndexAtX(ctx: CanvasRenderingContext2D, line: FlowedLine, targetX: number): number {
    const textBounds = this.getTextBounds();
    const alignmentOffset = TextPositionCalculator.getAlignmentOffset(line, textBounds.width);
    const x = targetX - alignmentOffset;
    return TextPositionCalculator.getTextIndexAtX(line, x, ctx);
  }

  // ============================================
  // Focusable Interface Implementation
  // ============================================

  /**
   * Called when this control receives focus.
   * Delegates to internal FlowingTextContent.
   */
  focus(): void {
    this.editing = true;
  }

  /**
   * Called when this control loses focus.
   * Delegates to internal FlowingTextContent.
   */
  blur(): void {
    this.editing = false;
  }

  /**
   * Returns whether this control currently has focus.
   */
  hasFocus(): boolean {
    return this._editing && this._flowingContent.hasFocus();
  }

  /**
   * Handle a keyboard event.
   * @returns true if the event was handled, false otherwise
   */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (!this._editing) return false;

    // Handle Escape to exit editing
    if (e.key === 'Escape') {
      e.preventDefault();
      this.finishEditing();
      return true;
    }

    // Note: ArrowUp/ArrowDown are handled by PCEditor (needs canvas context)

    // Delegate to internal FlowingTextContent for text editing
    return this._flowingContent.handleKeyDown(e);
  }

  /**
   * Subscribe to cursor blink events (for re-rendering).
   * Delegates to internal FlowingTextContent.
   */
  onCursorBlink(handler: () => void): void {
    this._flowingContent.onCursorBlink(handler);
  }

  /**
   * Unsubscribe from cursor blink events.
   * Delegates to internal FlowingTextContent.
   */
  offCursorBlink(handler: () => void): void {
    this._flowingContent.offCursorBlink(handler);
  }

  handleDoubleClick(_point: Point): void {
    if (!this._locked) {
      this.editing = true;
      this.emit('edit-requested', { object: this });
    }
  }

  /**
   * Exit editing mode.
   */
  finishEditing(): void {
    this.editing = false;
  }

  toData(): EmbeddedObjectData {
    // Serialize formatting map to array of [index, style] pairs
    const formattingMap = this._flowingContent.getFormattingManager().getAllFormatting();
    const formattingEntries: Array<[number, Record<string, unknown>]> = [];
    formattingMap.forEach((value, key) => {
      formattingEntries.push([key, { ...value }]);
    });

    // Get substitution fields as array
    const fields = this._flowingContent.getSubstitutionFieldManager().getFieldsArray();

    return {
      id: this._id,
      objectType: 'textbox',
      textIndex: this._textIndex,
      position: this._position,
      size: { ...this._size },
      data: {
        content: this._content,
        fontFamily: this._fontFamily,
        fontSize: this._fontSize,
        color: this._color,
        backgroundColor: this._backgroundColor,
        border: this._border,
        padding: this._padding,
        // Include formatting data from FlowingTextContent
        formattingRuns: formattingEntries,
        substitutionFields: fields
      }
    };
  }

  clone(): TextBoxObject {
    return new TextBoxObject({
      id: `${this._id}-clone-${Date.now()}`,
      textIndex: this._textIndex,
      position: this._position,
      size: { ...this._size },
      content: this._content,
      fontFamily: this._fontFamily,
      fontSize: this._fontSize,
      color: this._color,
      backgroundColor: this._backgroundColor,
      border: this._border,
      padding: this._padding
    });
  }

  /**
   * Get the minimum size needed to fit the current content.
   */
  getContentSize(ctx: CanvasRenderingContext2D): { width: number; height: number } {
    if (!this._content) {
      return { width: 50, height: this._fontSize * 1.2 + this._padding * 2 };
    }

    ctx.font = `${this._fontSize}px ${this._fontFamily}`;

    const lines = this._content.split('\n');
    let maxWidth = 0;

    for (const line of lines) {
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    }

    const height = lines.length * this._fontSize * 1.2;
    const borderH = (this._border.top.style !== 'none' ? this._border.top.width : 0) +
                    (this._border.bottom.style !== 'none' ? this._border.bottom.width : 0);
    const borderW = (this._border.left.style !== 'none' ? this._border.left.width : 0) +
                    (this._border.right.style !== 'none' ? this._border.right.width : 0);

    return {
      width: maxWidth + this._padding * 2 + borderW,
      height: height + this._padding * 2 + borderH
    };
  }

  /**
   * Resize to fit the current content.
   */
  resizeToContent(ctx: CanvasRenderingContext2D): void {
    const contentSize = this.getContentSize(ctx);
    const minSize = this.getMinSize();

    this.size = {
      width: Math.max(contentSize.width, minSize.width),
      height: Math.max(contentSize.height, minSize.height)
    };
  }

  // ============================================
  // EditableTextRegion Interface Implementation
  // ============================================

  /**
   * Get the bounds of the text area within this text box on a specific page.
   * Text boxes are single-page objects, so pageIndex is ignored.
   * Returns the text area bounds (accounting for padding/borders) in canvas coordinates.
   * This is the area where text is rendered, used by FlowingTextRenderer.renderRegion().
   */
  getRegionBounds(_pageIndex: number): Rect | null {
    return this.getTextAreaBounds();
  }

  /**
   * Convert a point from global (canvas) coordinates to local (text box) coordinates.
   * @param point Point in canvas coordinates
   * @param pageIndex The page index (ignored for text boxes)
   * @returns Point in local coordinates, or null if point is outside this text box
   */
  globalToLocal(point: Point, pageIndex: number): Point | null {
    const bounds = this.getRegionBounds(pageIndex);
    if (!bounds) return null;

    // Check if point is within bounds
    if (point.x < bounds.x || point.x > bounds.x + bounds.width ||
        point.y < bounds.y || point.y > bounds.y + bounds.height) {
      return null;
    }

    return {
      x: point.x - bounds.x,
      y: point.y - bounds.y
    };
  }

  /**
   * Convert a point from local (text box) coordinates to global (canvas) coordinates.
   * @param point Point in local coordinates
   * @param pageIndex The page index (ignored for text boxes)
   * @returns Point in canvas coordinates
   */
  localToGlobal(point: Point, pageIndex: number): Point {
    const bounds = this.getRegionBounds(pageIndex);
    if (!bounds) {
      return point;
    }

    return {
      x: point.x + bounds.x,
      y: point.y + bounds.y
    };
  }

  /**
   * Get the flowed lines for this text box.
   * Text boxes don't span pages, so pageIndex is ignored.
   */
  getFlowedLines(_pageIndex: number): FlowedLine[] {
    return this._flowedLines;
  }

  /**
   * Get all flowed pages for this text box.
   * Text boxes have a single "page" of content.
   */
  getFlowedPages(): FlowedPage[] {
    return this._flowedPage ? [this._flowedPage] : [];
  }

  /**
   * Get the available width for text in this text box.
   */
  getAvailableWidth(): number {
    return this.getTextBounds().width;
  }

  /**
   * Text boxes do not span multiple pages.
   */
  spansMultiplePages(): boolean {
    return false;
  }

  /**
   * Text boxes are always on a single page.
   */
  getPageCount(): number {
    return 1;
  }

  /**
   * Check if a point is within this text box region.
   * @param point Point in canvas coordinates
   * @param pageIndex The page index (ignored for text boxes)
   */
  containsPointInRegion(point: Point, pageIndex: number): boolean {
    const bounds = this.getRegionBounds(pageIndex);
    if (!bounds) return false;

    return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }

  /**
   * Trigger a reflow of text in this text box.
   * @param ctx Canvas context for text measurement
   */
  reflow(ctx: CanvasRenderingContext2D): void {
    const textBounds = this.getTextBounds();
    if (textBounds.width <= 0 || textBounds.height <= 0) {
      this._flowedLines = [];
      this._flowedPage = null;
      return;
    }

    // Flow the text - use a large height to get all lines
    const pages = this._flowingContent.flowText(textBounds.width, 10000, ctx);
    this._flowedLines = pages.length > 0 ? pages[0].lines : [];
    this._flowedPage = pages.length > 0 ? pages[0] : null;
  }
}
