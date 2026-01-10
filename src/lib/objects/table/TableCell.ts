/**
 * TableCell - A cell within a table that contains editable text.
 * Implements EditableTextRegion for unified text interaction.
 */

import { EventEmitter } from '../../events/EventEmitter';
import { FlowingTextContent } from '../../text/FlowingTextContent';
import { FlowedLine, FlowedPage, Focusable, TextFormattingStyle, SubstitutionFieldConfig } from '../../text/types';
import { EditableTextRegion, RegionType } from '../../text/EditableTextRegion';
import { Point, Rect } from '../../types';
import {
  TableCellConfig,
  TableCellData,
  CellBorder,
  CellPadding,
  VerticalAlign,
  DEFAULT_TABLE_STYLE,
  createCellBorder,
  createCellPadding,
  getHorizontalPadding,
  getVerticalPadding
} from './types';
import { BorderSide } from '../types';

/**
 * Generate a unique cell ID.
 */
function generateCellId(): string {
  return `cell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * TableCell represents a single cell in a table.
 * It contains FlowingTextContent for rich text editing and implements
 * EditableTextRegion for unified text interaction.
 */
export class TableCell extends EventEmitter implements EditableTextRegion, Focusable {
  // Identity
  private _id: string;
  readonly type: RegionType = 'tablecell' as RegionType;

  // Structure (spans)
  private _rowSpan: number;
  private _colSpan: number;

  // Styling
  private _backgroundColor: string;
  private _border: CellBorder;
  private _padding: CellPadding;
  private _verticalAlign: VerticalAlign;

  // Text styling defaults
  private _fontFamily: string;
  private _fontSize: number;
  private _color: string;

  // Content
  private _flowingContent: FlowingTextContent;
  private _flowedLines: FlowedLine[] = [];
  private _flowedPage: FlowedPage | null = null;

  // Layout state (set by parent table during layout calculation)
  private _bounds: Rect | null = null;           // Position within table (local)
  private _renderedPosition: Point | null = null; // Global position on canvas
  private _renderedPageIndex: number = 0;        // Page index where cell was rendered

  // Editing state
  private _editing: boolean = false;

  // Caching for performance
  private _reflowDirty: boolean = true;
  private _lastReflowWidth: number = 0;
  private _cachedContentHeight: number | null = null;

  constructor(config: TableCellConfig) {
    super();

    this._id = config.id || generateCellId();
    this._rowSpan = config.rowSpan ?? 1;
    this._colSpan = config.colSpan ?? 1;
    this._backgroundColor = config.backgroundColor ?? DEFAULT_TABLE_STYLE.backgroundColor;
    this._border = createCellBorder(config.border);
    this._padding = createCellPadding(config.padding, DEFAULT_TABLE_STYLE.cellPadding);
    this._verticalAlign = config.verticalAlign ?? 'top';
    this._fontFamily = config.fontFamily ?? DEFAULT_TABLE_STYLE.fontFamily;
    this._fontSize = config.fontSize ?? DEFAULT_TABLE_STYLE.fontSize;
    this._color = config.color ?? DEFAULT_TABLE_STYLE.color;

    // Create FlowingTextContent for this cell
    this._flowingContent = new FlowingTextContent();
    this._flowingContent.setDefaultFormatting({
      fontFamily: this._fontFamily,
      fontSize: this._fontSize,
      color: this._color
    });

    // Prevent embedded objects in table cells (only substitution fields allowed)
    this._flowingContent.insertEmbeddedObject = () => {
      console.warn('Embedded objects are not allowed in table cells. Use insertSubstitutionField instead.');
    };

    // Set initial content
    if (config.content) {
      this._flowingContent.setText(config.content);
    }

    // Forward content changes and mark reflow dirty
    this._flowingContent.on('content-changed', () => {
      this._reflowDirty = true;
      this._cachedContentHeight = null;
      this.emit('content-changed', { cellId: this._id });
    });

    this._flowingContent.on('cursor-moved', () => {
      this.emit('cursor-moved', { cellId: this._id });
    });
  }

  // ============================================
  // Identity and Structure
  // ============================================

  get id(): string {
    return this._id;
  }

  get rowSpan(): number {
    return this._rowSpan;
  }

  set rowSpan(value: number) {
    if (value >= 1 && value !== this._rowSpan) {
      this._rowSpan = value;
      this.emit('span-changed', { cellId: this._id, rowSpan: value, colSpan: this._colSpan });
    }
  }

  get colSpan(): number {
    return this._colSpan;
  }

  set colSpan(value: number) {
    if (value >= 1 && value !== this._colSpan) {
      this._colSpan = value;
      this.emit('span-changed', { cellId: this._id, rowSpan: this._rowSpan, colSpan: value });
    }
  }

  // ============================================
  // Styling
  // ============================================

  get backgroundColor(): string {
    return this._backgroundColor;
  }

  set backgroundColor(value: string) {
    if (this._backgroundColor !== value) {
      this._backgroundColor = value;
      this.emit('style-changed', { cellId: this._id, backgroundColor: value });
    }
  }

  get border(): CellBorder {
    return this._border;
  }

  set border(value: CellBorder) {
    this._border = value;
    this.emit('style-changed', { cellId: this._id, border: value });
  }

  get padding(): CellPadding {
    return this._padding;
  }

  set padding(value: CellPadding) {
    this._padding = value;
    this.emit('style-changed', { cellId: this._id, padding: value });
  }

  get verticalAlign(): VerticalAlign {
    return this._verticalAlign;
  }

  set verticalAlign(value: VerticalAlign) {
    if (this._verticalAlign !== value) {
      this._verticalAlign = value;
      this.emit('style-changed', { cellId: this._id, verticalAlign: value });
    }
  }

  get fontFamily(): string {
    return this._fontFamily;
  }

  set fontFamily(value: string) {
    this._fontFamily = value;
    this._flowingContent.setDefaultFormatting({ fontFamily: value });
    this.emit('style-changed', { cellId: this._id, fontFamily: value });
  }

  get fontSize(): number {
    return this._fontSize;
  }

  set fontSize(value: number) {
    this._fontSize = value;
    this._flowingContent.setDefaultFormatting({ fontSize: value });
    this.emit('style-changed', { cellId: this._id, fontSize: value });
  }

  get color(): string {
    return this._color;
  }

  set color(value: string) {
    this._color = value;
    this._flowingContent.setDefaultFormatting({ color: value });
    this.emit('style-changed', { cellId: this._id, color: value });
  }

  // ============================================
  // Content
  // ============================================

  get flowingContent(): FlowingTextContent {
    return this._flowingContent;
  }

  get content(): string {
    return this._flowingContent.getText();
  }

  set content(value: string) {
    this._flowingContent.setText(value);
  }

  /**
   * Insert a substitution field at the current cursor position.
   * This is the only type of embedded content allowed in table cells.
   */
  insertSubstitutionField(
    fieldName: string,
    config?: SubstitutionFieldConfig
  ): void {
    this._flowingContent.insertSubstitutionField(fieldName, config);
  }

  // ============================================
  // Layout
  // ============================================

  /**
   * Set the bounds of this cell within the table (table-local coordinates).
   */
  setBounds(bounds: Rect): void {
    this._bounds = bounds;
  }

  /**
   * Get the bounds of this cell within the table.
   */
  getBounds(): Rect | null {
    return this._bounds;
  }

  /**
   * Set the rendered position (global canvas coordinates).
   */
  setRenderedPosition(pos: Point): void {
    this._renderedPosition = pos;
  }

  /**
   * Get the rendered position.
   */
  getRenderedPosition(): Point | null {
    return this._renderedPosition;
  }

  /**
   * Set the page index where this cell was rendered.
   */
  set renderedPageIndex(index: number) {
    this._renderedPageIndex = index;
  }

  /**
   * Get the page index where this cell was rendered.
   */
  get renderedPageIndex(): number {
    return this._renderedPageIndex;
  }

  /**
   * Get the content area bounds (inside padding and borders).
   */
  getContentBounds(): Rect | null {
    if (!this._bounds) return null;

    const borderLeft = this._border.left.style !== 'none' ? this._border.left.width : 0;
    const borderTop = this._border.top.style !== 'none' ? this._border.top.width : 0;

    return {
      x: this._bounds.x + borderLeft + this._padding.left,
      y: this._bounds.y + borderTop + this._padding.top,
      width: this._bounds.width - getHorizontalPadding(this._padding) -
             (this._border.left.style !== 'none' ? this._border.left.width : 0) -
             (this._border.right.style !== 'none' ? this._border.right.width : 0),
      height: this._bounds.height - getVerticalPadding(this._padding) -
              (this._border.top.style !== 'none' ? this._border.top.width : 0) -
              (this._border.bottom.style !== 'none' ? this._border.bottom.width : 0)
    };
  }

  /**
   * Calculate the content height based on flowed text.
   * Uses caching to avoid recalculation when nothing has changed.
   */
  getContentHeight(ctx: CanvasRenderingContext2D): number {
    // Return cached height if available and valid
    if (this._cachedContentHeight !== null && !this._reflowDirty) {
      return this._cachedContentHeight;
    }

    // Reflow if needed to get accurate height
    if (this._reflowDirty || (this._flowedLines.length === 0 && this._flowingContent.getText().length > 0)) {
      this.reflow(ctx);
    }

    let height = 0;
    for (const line of this._flowedLines) {
      height += line.height;
    }

    // Add padding and border
    height += getVerticalPadding(this._padding);
    height += (this._border.top.style !== 'none' ? this._border.top.width : 0);
    height += (this._border.bottom.style !== 'none' ? this._border.bottom.width : 0);

    this._cachedContentHeight = Math.max(height, DEFAULT_TABLE_STYLE.minRowHeight);
    return this._cachedContentHeight;
  }

  // ============================================
  // EditableTextRegion Implementation
  // ============================================

  /**
   * Get the bounds of this cell's text area in canvas coordinates.
   */
  getRegionBounds(_pageIndex: number): Rect | null {
    if (!this._renderedPosition || !this._bounds) return null;

    const borderLeft = this._border.left.style !== 'none' ? this._border.left.width : 0;
    const borderTop = this._border.top.style !== 'none' ? this._border.top.width : 0;
    const borderRight = this._border.right.style !== 'none' ? this._border.right.width : 0;
    const borderBottom = this._border.bottom.style !== 'none' ? this._border.bottom.width : 0;

    // Return the text content area (inside padding and borders)
    return {
      x: this._renderedPosition.x + borderLeft + this._padding.left,
      y: this._renderedPosition.y + borderTop + this._padding.top,
      width: this._bounds.width - this._padding.left - this._padding.right - borderLeft - borderRight,
      height: this._bounds.height - this._padding.top - this._padding.bottom - borderTop - borderBottom
    };
  }

  /**
   * Convert global (canvas) point to local (cell content) coordinates.
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
   * Convert local (cell content) point to global (canvas) coordinates.
   */
  localToGlobal(point: Point, pageIndex: number): Point {
    const bounds = this.getRegionBounds(pageIndex);
    if (!bounds) return point;

    return {
      x: point.x + bounds.x,
      y: point.y + bounds.y
    };
  }

  /**
   * Get flowed lines for this cell.
   */
  getFlowedLines(_pageIndex: number): FlowedLine[] {
    return this._flowedLines;
  }

  /**
   * Get flowed pages (cells have one "page").
   */
  getFlowedPages(): FlowedPage[] {
    return this._flowedPage ? [this._flowedPage] : [];
  }

  /**
   * Get available width for text.
   */
  getAvailableWidth(): number {
    if (!this._bounds) return 0;

    const borderLeft = this._border.left.style !== 'none' ? this._border.left.width : 0;
    const borderRight = this._border.right.style !== 'none' ? this._border.right.width : 0;

    return this._bounds.width - this._padding.left - this._padding.right - borderLeft - borderRight;
  }

  /**
   * Cells don't span multiple pages.
   */
  spansMultiplePages(): boolean {
    return false;
  }

  /**
   * Cells have one page.
   */
  getPageCount(): number {
    return 1;
  }

  /**
   * Check if a point is within this cell.
   */
  containsPointInRegion(point: Point, pageIndex: number): boolean {
    const bounds = this.getRegionBounds(pageIndex);
    if (!bounds) return false;

    return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }

  /**
   * Reflow text within this cell.
   * Uses caching to avoid unnecessary reflow operations.
   */
  reflow(ctx: CanvasRenderingContext2D): void {
    const width = this.getAvailableWidth();
    if (width <= 0) {
      this._flowedLines = [];
      this._flowedPage = null;
      this._reflowDirty = false;
      return;
    }

    // Skip reflow if not dirty and width hasn't changed
    if (!this._reflowDirty && this._lastReflowWidth === width && this._flowedLines.length > 0) {
      return;
    }

    // Flow text with large height to get all lines
    const pages = this._flowingContent.flowText(width, 10000, ctx);
    this._flowedLines = pages.length > 0 ? pages[0].lines : [];
    this._flowedPage = pages.length > 0 ? pages[0] : null;
    this._reflowDirty = false;
    this._lastReflowWidth = width;
    this._cachedContentHeight = null; // Clear cached height since lines changed
    console.log('[TableCell.reflow] cellId:', this._id, 'text:', JSON.stringify(this._flowingContent.getText()), 'lines:', this._flowedLines.length);
  }

  /**
   * Mark this cell as needing reflow.
   * Call this when cell bounds change.
   */
  markReflowDirty(): void {
    this._reflowDirty = true;
    this._cachedContentHeight = null;
  }

  // ============================================
  // Focusable Implementation
  // ============================================

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
      this.emit('editing-changed', { cellId: this._id, editing: value });
    }
  }

  focus(): void {
    this.editing = true;
  }

  blur(): void {
    this.editing = false;
  }

  hasFocus(): boolean {
    return this._editing && this._flowingContent.hasFocus();
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    console.log('[TableCell.handleKeyDown] Key:', e.key, '_editing:', this._editing, 'flowingContent.hasFocus:', this._flowingContent.hasFocus());
    if (!this._editing) return false;

    // Let parent table handle Tab navigation
    if (e.key === 'Tab') {
      return false; // Not handled - parent will handle
    }

    // Delegate to FlowingTextContent
    console.log('[TableCell.handleKeyDown] Delegating to FlowingTextContent.handleKeyDown');
    const handled = this._flowingContent.handleKeyDown(e);
    console.log('[TableCell.handleKeyDown] FlowingTextContent handled:', handled);
    return handled;
  }

  onCursorBlink(handler: () => void): void {
    this._flowingContent.onCursorBlink(handler);
  }

  offCursorBlink(handler: () => void): void {
    this._flowingContent.offCursorBlink(handler);
  }

  // ============================================
  // Rendering
  // ============================================

  /**
   * Render the cell background and border.
   * Text content is rendered separately by FlowingTextRenderer.
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this._bounds) return;

    this.renderBackground(ctx);
    this.renderBorder(ctx);
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    if (!this._bounds) return;

    ctx.fillStyle = this._backgroundColor;
    ctx.fillRect(0, 0, this._bounds.width, this._bounds.height);
  }

  private renderBorder(ctx: CanvasRenderingContext2D): void {
    if (!this._bounds) return;

    const { width, height } = this._bounds;

    // Top border
    if (this._border.top.style !== 'none') {
      this.renderBorderSide(ctx, this._border.top, 0, 0, width, 0);
    }

    // Right border
    if (this._border.right.style !== 'none') {
      this.renderBorderSide(ctx, this._border.right, width, 0, width, height);
    }

    // Bottom border
    if (this._border.bottom.style !== 'none') {
      this.renderBorderSide(ctx, this._border.bottom, 0, height, width, height);
    }

    // Left border
    if (this._border.left.style !== 'none') {
      this.renderBorderSide(ctx, this._border.left, 0, 0, 0, height);
    }
  }

  private renderBorderSide(
    ctx: CanvasRenderingContext2D,
    side: BorderSide,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    ctx.strokeStyle = side.color;
    ctx.lineWidth = side.width;

    switch (side.style) {
      case 'dashed':
        ctx.setLineDash([4, 4]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 2]);
        break;
      default:
        ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  // ============================================
  // Serialization
  // ============================================

  toData(): TableCellData {
    const formattingMap = this._flowingContent.getFormattingManager().getAllFormatting();
    const formattingRuns: Array<[number, Partial<TextFormattingStyle>]> = [];
    formattingMap.forEach((style, index) => {
      formattingRuns.push([index, { ...style }]);
    });

    // Get substitution fields for serialization
    const fields = this._flowingContent.getSubstitutionFieldManager().getFieldsArray();

    return {
      id: this._id,
      rowSpan: this._rowSpan,
      colSpan: this._colSpan,
      backgroundColor: this._backgroundColor,
      border: this._border,
      padding: this._padding,
      verticalAlign: this._verticalAlign,
      content: this._flowingContent.getText(),
      fontFamily: this._fontFamily,
      fontSize: this._fontSize,
      color: this._color,
      formattingRuns: formattingRuns.length > 0 ? formattingRuns : undefined,
      substitutionFields: fields.length > 0 ? fields : undefined
    };
  }

  static fromData(data: TableCellData): TableCell {
    const cell = new TableCell({
      id: data.id,
      rowSpan: data.rowSpan,
      colSpan: data.colSpan,
      backgroundColor: data.backgroundColor,
      border: data.border,
      padding: data.padding,
      verticalAlign: data.verticalAlign,
      content: data.content,
      fontFamily: data.fontFamily,
      fontSize: data.fontSize,
      color: data.color
    });

    // Restore formatting runs
    if (data.formattingRuns) {
      const formattingManager = cell._flowingContent.getFormattingManager();
      const formattingMap = new Map<number, TextFormattingStyle>();
      for (const [index, style] of data.formattingRuns) {
        formattingMap.set(index, style as TextFormattingStyle);
      }
      formattingManager.setAllFormatting(formattingMap);
    }

    // Restore substitution fields
    if (data.substitutionFields && Array.isArray(data.substitutionFields)) {
      const fieldManager = cell._flowingContent.getSubstitutionFieldManager();
      for (const field of data.substitutionFields as any[]) {
        if (field.textIndex !== undefined && field.fieldName) {
          fieldManager.insert(field.fieldName, field.textIndex, {
            defaultValue: field.defaultValue,
            displayFormat: field.displayFormat
          });
          // Restore field formatting if present
          if (field.formatting) {
            fieldManager.setFieldFormatting(field.textIndex, field.formatting);
          }
        }
      }
    }

    return cell;
  }

  clone(): TableCell {
    return TableCell.fromData(this.toData());
  }
}
