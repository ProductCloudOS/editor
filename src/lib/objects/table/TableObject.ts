/**
 * TableObject - An embedded table within text flow.
 * Tables contain rows of cells, each with rich text content.
 */

import { BaseEmbeddedObject } from '../BaseEmbeddedObject';
import {
  EmbeddedObjectData,
  Point
} from '../types';
import { Focusable } from '../../text/types';
import { TableRow } from './TableRow';
import { TableCell } from './TableCell';
import {
  TableObjectConfig,
  TableObjectData,
  TableColumnConfig,
  TableRowConfig,
  TableCellConfig,
  CellAddress,
  CellRange,
  ResolvedCell,
  DEFAULT_TABLE_STYLE,
  TablePageLayout,
  TablePageSlice
} from './types';
import { TableCellMerger } from './TableCellMerger';

/**
 * Generate a unique column ID.
 */
function generateColumnId(): string {
  return `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * TableObject represents an embedded table in the document.
 * It extends BaseEmbeddedObject for integration with the text flow system
 * and implements Focusable for keyboard interaction.
 */
export class TableObject extends BaseEmbeddedObject implements Focusable {
  // Structure
  private _rows: TableRow[] = [];
  private _columns: TableColumnConfig[] = [];

  // Default styling
  private _defaultCellPadding: number;
  private _defaultBorderColor: string;
  private _defaultBorderWidth: number;
  private _defaultFontFamily: string;
  private _defaultFontSize: number;
  private _defaultColor: string;

  // State
  private _focusedCell: CellAddress | null = null;
  private _editing: boolean = false;
  private _selectedRange: CellRange | null = null;  // For multi-cell selection

  // Covered cells map for merged cells: "row,col" -> origin CellAddress
  private _coveredCells: Map<string, CellAddress> = new Map();

  // Layout caching for performance
  private _layoutDirty: boolean = true;
  private _cachedRowHeights: number[] = [];
  private _cachedRowPositions: number[] = [];

  constructor(config: TableObjectConfig) {
    super(config);

    // Initialize defaults
    this._defaultCellPadding = config.defaultCellPadding ?? DEFAULT_TABLE_STYLE.cellPadding;
    this._defaultBorderColor = config.defaultBorderColor ?? DEFAULT_TABLE_STYLE.borderColor;
    this._defaultBorderWidth = config.defaultBorderWidth ?? DEFAULT_TABLE_STYLE.borderWidth;
    this._defaultFontFamily = config.defaultFontFamily ?? DEFAULT_TABLE_STYLE.fontFamily;
    this._defaultFontSize = config.defaultFontSize ?? DEFAULT_TABLE_STYLE.fontSize;
    this._defaultColor = config.defaultColor ?? DEFAULT_TABLE_STYLE.color;

    // Initialize columns
    const columnCount = config.columns ?? 2;
    if (config.columnConfig && config.columnConfig.length > 0) {
      this._columns = config.columnConfig.map(col => ({
        id: col.id || generateColumnId(),
        width: col.width,
        minWidth: col.minWidth ?? DEFAULT_TABLE_STYLE.minColumnWidth
      }));
    } else if (config.columnWidths && config.columnWidths.length > 0) {
      this._columns = config.columnWidths.map(width => ({
        id: generateColumnId(),
        width,
        minWidth: DEFAULT_TABLE_STYLE.minColumnWidth
      }));
    } else {
      for (let i = 0; i < columnCount; i++) {
        this._columns.push({
          id: generateColumnId(),
          width: DEFAULT_TABLE_STYLE.defaultColumnWidth,
          minWidth: DEFAULT_TABLE_STYLE.minColumnWidth
        });
      }
    }

    // Initialize rows
    const rowCount = config.rows ?? 2;
    const defaultCellConfig: Partial<TableCellConfig> = {
      fontFamily: this._defaultFontFamily,
      fontSize: this._defaultFontSize,
      color: this._defaultColor,
      padding: this._defaultCellPadding
    };

    if (config.rowData && config.rowData.length > 0) {
      for (const rowConfig of config.rowData) {
        const row = new TableRow(rowConfig, this._columns.length, defaultCellConfig);
        this.setupRowListeners(row);
        this._rows.push(row);
      }
    } else {
      for (let i = 0; i < rowCount; i++) {
        const row = new TableRow({}, this._columns.length, defaultCellConfig);
        this.setupRowListeners(row);
        this._rows.push(row);
      }
    }

    // Calculate initial size based on columns/rows
    this.updateSizeFromLayout();
  }

  get objectType(): string {
    return 'table';
  }

  // ============================================
  // Structure Accessors
  // ============================================

  get rows(): TableRow[] {
    return this._rows;
  }

  get rowCount(): number {
    return this._rows.length;
  }

  get columns(): TableColumnConfig[] {
    return this._columns;
  }

  get columnCount(): number {
    return this._columns.length;
  }

  // ============================================
  // Header Row Management
  // ============================================

  /**
   * Get all header rows.
   */
  get headerRows(): TableRow[] {
    return this._rows.filter(row => row.isHeader);
  }

  /**
   * Get the number of header rows.
   */
  get headerRowCount(): number {
    return this._rows.filter(row => row.isHeader).length;
  }

  /**
   * Set a row as a header row.
   * @param rowIndex The row index to set as header.
   * @param isHeader Whether the row is a header (default true).
   */
  setHeaderRow(rowIndex: number, isHeader: boolean = true): void {
    const row = this._rows[rowIndex];
    if (!row) return;

    row.isHeader = isHeader;
    this.emit('header-changed', { rowIndex, isHeader });
  }

  /**
   * Set multiple rows as header rows.
   * All rows from 0 to rowCount-1 will be set as headers.
   * @param rowCount Number of header rows (starting from row 0).
   */
  setHeaderRowCount(rowCount: number): void {
    for (let i = 0; i < this._rows.length; i++) {
      this._rows[i].isHeader = i < rowCount;
    }
    this.emit('headers-changed', { count: rowCount });
  }

  /**
   * Calculate the total height of header rows.
   * Used when rendering tables that span multiple pages.
   */
  getHeaderHeight(): number {
    let height = 0;
    for (const row of this._rows) {
      if (row.isHeader) {
        height += row.calculatedHeight;
      }
    }
    return height;
  }

  /**
   * Get header row indices.
   */
  getHeaderRowIndices(): number[] {
    const indices: number[] = [];
    for (let i = 0; i < this._rows.length; i++) {
      if (this._rows[i].isHeader) {
        indices.push(i);
      }
    }
    return indices;
  }

  // ============================================
  // Default Styling Accessors
  // ============================================

  get defaultCellPadding(): number {
    return this._defaultCellPadding;
  }

  set defaultCellPadding(value: number) {
    this._defaultCellPadding = value;
    this.emit('style-changed', { defaultCellPadding: value });
  }

  get defaultBorderColor(): string {
    return this._defaultBorderColor;
  }

  set defaultBorderColor(value: string) {
    this._defaultBorderColor = value;
    this.emit('style-changed', { defaultBorderColor: value });
  }

  get defaultBorderWidth(): number {
    return this._defaultBorderWidth;
  }

  set defaultBorderWidth(value: number) {
    this._defaultBorderWidth = value;
    this.emit('style-changed', { defaultBorderWidth: value });
  }

  get defaultFontFamily(): string {
    return this._defaultFontFamily;
  }

  set defaultFontFamily(value: string) {
    this._defaultFontFamily = value;
    this.emit('style-changed', { defaultFontFamily: value });
  }

  get defaultFontSize(): number {
    return this._defaultFontSize;
  }

  set defaultFontSize(value: number) {
    this._defaultFontSize = value;
    this.emit('style-changed', { defaultFontSize: value });
  }

  get defaultColor(): string {
    return this._defaultColor;
  }

  set defaultColor(value: string) {
    this._defaultColor = value;
    this.emit('style-changed', { defaultColor: value });
  }

  // ============================================
  // Size Override - Redistributes among columns/rows
  // ============================================

  /**
   * Override the size setter to adjust only the last column/row
   * when the table is resized via object handles.
   */
  override set size(value: { width: number; height: number }) {
    const currentWidth = this._columns.reduce((sum, col) => sum + col.width, 0);
    const currentHeight = this._rows.reduce((sum, row) => sum + (row.calculatedHeight || row.minHeight), 0);

    // Only adjust if we have valid current dimensions and columns/rows
    if (currentWidth > 0 && currentHeight > 0 && this._columns.length > 0 && this._rows.length > 0) {
      // Adjust only the last column's width
      const widthDelta = value.width - currentWidth;
      const lastColIndex = this._columns.length - 1;
      const lastCol = this._columns[lastColIndex];
      const newLastColWidth = Math.max(lastCol.minWidth || 20, lastCol.width + widthDelta);
      lastCol.width = newLastColWidth;

      // Adjust only the last row's height
      const heightDelta = value.height - currentHeight;
      const lastRow = this._rows[this._rows.length - 1];
      const currentLastRowHeight = lastRow.calculatedHeight || lastRow.minHeight;
      const newLastRowHeight = Math.max(lastRow.minHeight, currentLastRowHeight + heightDelta);
      lastRow.height = newLastRowHeight;
    }

    // Update internal size
    this._size = { ...value };
    this.markLayoutDirty();
    this.emit('size-changed', { size: { ...value } });
  }

  override get size(): { width: number; height: number } {
    return { ...this._size };
  }

  // ============================================
  // Cell Access
  // ============================================

  /**
   * Get a cell by row and column index.
   */
  getCell(rowIndex: number, colIndex: number): TableCell | null {
    const row = this._rows[rowIndex];
    if (!row) return null;
    return row.getCell(colIndex);
  }

  /**
   * Resolve a cell address, accounting for merged cells.
   * If the address points to a cell covered by a merge, returns the origin cell.
   */
  resolveCell(rowIndex: number, colIndex: number): ResolvedCell | null {
    // Check if this cell is covered by a merge
    const key = `${rowIndex},${colIndex}`;
    const origin = this._coveredCells.get(key);

    if (origin) {
      const cell = this.getCell(origin.row, origin.col);
      if (!cell) return null;
      return {
        cell,
        rowIndex: origin.row,
        colIndex: origin.col,
        isSpanned: true
      };
    }

    const cell = this.getCell(rowIndex, colIndex);
    if (!cell) return null;

    return {
      cell,
      rowIndex,
      colIndex,
      isSpanned: false
    };
  }

  /**
   * Get the cell at a given point (relative to table position).
   * @param point Point in table-local coordinates
   */
  getCellAtPoint(point: Point): CellAddress | null {
    // Calculate column positions
    let x = 0;
    let targetCol = -1;
    for (let i = 0; i < this._columns.length; i++) {
      const width = this._columns[i].width;
      if (point.x >= x && point.x < x + width) {
        targetCol = i;
        break;
      }
      x += width;
    }
    if (targetCol === -1) return null;

    // Calculate row positions
    let y = 0;
    let targetRow = -1;
    for (let i = 0; i < this._rows.length; i++) {
      const height = this._rows[i].calculatedHeight;
      if (point.y >= y && point.y < y + height) {
        targetRow = i;
        break;
      }
      y += height;
    }
    if (targetRow === -1) return null;

    return { row: targetRow, col: targetCol };
  }

  // ============================================
  // Row Listeners
  // ============================================

  private setupRowListeners(row: TableRow): void {
    row.on('cell-content-changed', (data) => {
      // Content changes may affect row height
      this._layoutDirty = true;
      this.emit('cell-content-changed', data);
      this.emit('content-changed', {});
    });

    row.on('cell-style-changed', (data) => {
      this.emit('cell-style-changed', data);
    });

    row.on('cell-span-changed', (data) => {
      this._layoutDirty = true;
      this.updateCoveredCells();
      this.emit('cell-span-changed', data);
    });

    row.on('cell-editing-changed', (data) => {
      this.emit('cell-editing-changed', data);
    });

    row.on('height-changed', () => {
      this._layoutDirty = true;
      this.updateSizeFromLayout();
      this.emit('layout-changed', {});
    });
  }

  // ============================================
  // Column Operations
  // ============================================

  /**
   * Set a column's width.
   */
  setColumnWidth(colIndex: number, width: number): void {
    if (colIndex < 0 || colIndex >= this._columns.length) return;

    const minWidth = this._columns[colIndex].minWidth ?? DEFAULT_TABLE_STYLE.minColumnWidth;
    this._columns[colIndex].width = Math.max(width, minWidth);
    this._layoutDirty = true;
    // Mark all cells in this column as needing reflow (width changed)
    for (const row of this._rows) {
      const cell = row.getCell(colIndex);
      if (cell) cell.markReflowDirty();
    }
    this.updateSizeFromLayout();
    this.emit('column-width-changed', { colIndex, width: this._columns[colIndex].width });
  }

  /**
   * Get column positions (X coordinates for each column).
   */
  getColumnPositions(): number[] {
    const positions: number[] = [];
    let x = 0;
    for (const col of this._columns) {
      positions.push(x);
      x += col.width;
    }
    return positions;
  }

  /**
   * Get column widths.
   */
  getColumnWidths(): number[] {
    return this._columns.map(col => col.width);
  }

  /**
   * Insert a column at the specified index.
   */
  insertColumn(colIndex: number, width?: number): void {
    const actualWidth = width ?? DEFAULT_TABLE_STYLE.defaultColumnWidth;
    const newColumn: TableColumnConfig = {
      id: generateColumnId(),
      width: actualWidth,
      minWidth: DEFAULT_TABLE_STYLE.minColumnWidth
    };

    if (colIndex < 0) colIndex = 0;
    if (colIndex > this._columns.length) colIndex = this._columns.length;

    this._columns.splice(colIndex, 0, newColumn);

    // Add cell to each row
    const defaultCellConfig: TableCellConfig = {
      fontFamily: this._defaultFontFamily,
      fontSize: this._defaultFontSize,
      color: this._defaultColor,
      padding: this._defaultCellPadding
    };

    for (const row of this._rows) {
      row.insertCell(colIndex, defaultCellConfig);
    }

    this._layoutDirty = true;
    this.updateCoveredCells();
    this.updateSizeFromLayout();
    this.emit('column-inserted', { colIndex });
  }

  /**
   * Remove a column at the specified index.
   */
  removeColumn(colIndex: number): void {
    if (colIndex < 0 || colIndex >= this._columns.length) return;
    if (this._columns.length <= 1) return; // Keep at least one column

    this._columns.splice(colIndex, 1);

    for (const row of this._rows) {
      row.removeCell(colIndex);
    }

    this._layoutDirty = true;
    this.updateCoveredCells();
    this.updateSizeFromLayout();
    this.emit('column-removed', { colIndex });
  }

  // ============================================
  // Row Operations
  // ============================================

  /**
   * Insert a row at the specified index.
   */
  insertRow(rowIndex: number, config?: TableRowConfig): TableRow {
    const defaultCellConfig: Partial<TableCellConfig> = {
      fontFamily: this._defaultFontFamily,
      fontSize: this._defaultFontSize,
      color: this._defaultColor,
      padding: this._defaultCellPadding
    };

    const row = new TableRow(config || {}, this._columns.length, defaultCellConfig);
    this.setupRowListeners(row);

    if (rowIndex < 0) rowIndex = 0;
    if (rowIndex > this._rows.length) rowIndex = this._rows.length;

    this._rows.splice(rowIndex, 0, row);
    this._layoutDirty = true;
    this.updateCoveredCells();
    this.updateSizeFromLayout();
    this.emit('row-inserted', { rowIndex, rowId: row.id });
    return row;
  }

  /**
   * Remove a row at the specified index.
   */
  removeRow(rowIndex: number): TableRow | null {
    if (rowIndex < 0 || rowIndex >= this._rows.length) return null;
    if (this._rows.length <= 1) return null; // Keep at least one row

    const [removed] = this._rows.splice(rowIndex, 1);
    this._layoutDirty = true;
    this.updateCoveredCells();
    this.updateSizeFromLayout();
    this.emit('row-removed', { rowIndex, rowId: removed.id });
    return removed;
  }

  // ============================================
  // Layout
  // ============================================

  /**
   * Calculate layout for all cells.
   * Uses caching to avoid recalculation when nothing has changed.
   * @param ctx Canvas context for text measurement
   * @param force Force recalculation even if cache is valid
   */
  calculateLayout(ctx: CanvasRenderingContext2D, force: boolean = false): void {
    // Skip if layout is not dirty and we have valid cache
    if (!force && !this._layoutDirty && this._cachedRowHeights.length === this._rows.length) {
      return;
    }

    const columnWidths = this.getColumnWidths();
    const columnPositions = this.getColumnPositions();

    // First pass: Calculate row heights (considering merged cells)
    const rowHeights: number[] = [];
    let totalHeight = 0;
    for (const row of this._rows) {
      const rowHeight = row.calculateHeight(ctx, columnWidths);
      rowHeights.push(rowHeight);
      totalHeight += rowHeight;
    }

    // Calculate row Y positions
    const rowPositions: number[] = [];
    let y = 0;
    for (const height of rowHeights) {
      rowPositions.push(y);
      y += height;
    }

    // Cache the calculated values
    this._cachedRowHeights = rowHeights;
    this._cachedRowPositions = rowPositions;
    this._layoutDirty = false;

    // Second pass: Set cell bounds, accounting for spans
    for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
      const row = this._rows[rowIdx];
      for (let colIdx = 0; colIdx < row.cellCount; colIdx++) {
        const cell = row.getCell(colIdx);
        if (!cell) continue;

        // Calculate width including colSpan
        let cellWidth = 0;
        const colSpan = cell.colSpan;
        for (let c = colIdx; c < colIdx + colSpan && c < this._columns.length; c++) {
          cellWidth += columnWidths[c];
        }

        // Calculate height including rowSpan
        let cellHeight = 0;
        const rowSpan = cell.rowSpan;
        for (let r = rowIdx; r < rowIdx + rowSpan && r < this._rows.length; r++) {
          cellHeight += rowHeights[r];
        }

        cell.setBounds({
          x: columnPositions[colIdx],
          y: rowPositions[rowIdx],
          width: cellWidth,
          height: cellHeight
        });
      }
    }

    // Update table size
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
    this._size = { width: totalWidth, height: totalHeight };
  }

  /**
   * Mark the layout as needing recalculation.
   */
  markLayoutDirty(): void {
    this._layoutDirty = true;
  }

  /**
   * Check if layout needs recalculation.
   */
  get layoutDirty(): boolean {
    return this._layoutDirty;
  }

  /**
   * Get cached row heights (call calculateLayout first).
   */
  get cachedRowHeights(): number[] {
    return this._cachedRowHeights;
  }

  /**
   * Get cached row Y positions (call calculateLayout first).
   */
  get cachedRowPositions(): number[] {
    return this._cachedRowPositions;
  }

  /**
   * Update table size based on current columns and rows.
   */
  private updateSizeFromLayout(): void {
    const width = this._columns.reduce((sum, col) => sum + col.width, 0);
    let height = 0;
    for (const row of this._rows) {
      height += row.calculatedHeight || row.minHeight;
    }
    this._size = { width, height };
  }

  /**
   * Update the covered cells map based on current cell spans.
   */
  private updateCoveredCells(): void {
    this._coveredCells.clear();

    for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
      const row = this._rows[rowIdx];
      for (let colIdx = 0; colIdx < row.cellCount; colIdx++) {
        const cell = row.getCell(colIdx);
        if (!cell) continue;

        const rowSpan = cell.rowSpan;
        const colSpan = cell.colSpan;

        if (rowSpan > 1 || colSpan > 1) {
          // Mark covered cells
          for (let r = rowIdx; r < rowIdx + rowSpan && r < this._rows.length; r++) {
            for (let c = colIdx; c < colIdx + colSpan && c < this._columns.length; c++) {
              if (r !== rowIdx || c !== colIdx) {
                this._coveredCells.set(`${r},${c}`, { row: rowIdx, col: colIdx });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Set cell rendered positions based on table's rendered position.
   */
  updateCellRenderedPositions(): void {
    if (!this._renderedPosition) return;

    const columnPositions = this.getColumnPositions();
    let y = 0;

    for (const row of this._rows) {
      for (let colIdx = 0; colIdx < row.cellCount; colIdx++) {
        const cell = row.getCell(colIdx);
        if (cell) {
          cell.setRenderedPosition({
            x: this._renderedPosition.x + columnPositions[colIdx],
            y: this._renderedPosition.y + y
          });
        }
      }
      y += row.calculatedHeight;
    }
  }

  // ============================================
  // Multi-Page Layout (Header Row Repetition)
  // ============================================

  /**
   * Calculate how the table should be split across multiple pages.
   * @param availableHeightFirstPage Height available on the first page
   * @param availableHeightOtherPages Height available on subsequent pages
   * @returns TablePageLayout describing row distribution across pages
   */
  calculatePageLayout(
    availableHeightFirstPage: number,
    availableHeightOtherPages: number
  ): TablePageLayout {
    const headerHeight = this.getHeaderHeight();
    const headerRowIndices = this.getHeaderRowIndices();
    const totalHeight = this._size.height;

    // If table fits on first page, return single slice
    if (totalHeight <= availableHeightFirstPage) {
      return {
        slices: [{
          startRow: 0,
          endRow: this._rows.length,
          isContinuation: false,
          height: totalHeight,
          yOffset: 0
        }],
        totalHeight,
        headerHeight,
        headerRowIndices
      };
    }

    const slices: TablePageSlice[] = [];
    let currentRow = 0;
    let yOffset = 0;
    let isFirstPage = true;

    while (currentRow < this._rows.length) {
      const availableHeight = isFirstPage ? availableHeightFirstPage : availableHeightOtherPages;
      const isContinuation = !isFirstPage;

      // On continuation pages, we need space for header rows
      const effectiveAvailable = isContinuation
        ? availableHeight - headerHeight
        : availableHeight;

      // Find how many rows fit in this slice
      let sliceHeight = isContinuation ? headerHeight : 0;
      let sliceEndRow = currentRow;
      const sliceStartY = yOffset;

      // Skip header rows on first page (they're included normally)
      // On continuation pages, we'll render header rows separately
      while (sliceEndRow < this._rows.length) {
        const row = this._rows[sliceEndRow];
        const rowHeight = row.calculatedHeight;

        // Skip header rows when counting - they're handled separately on continuation pages
        if (isContinuation && row.isHeader) {
          sliceEndRow++;
          continue;
        }

        // Check if this row fits
        if (sliceHeight + rowHeight > (isContinuation ? availableHeight : effectiveAvailable)) {
          // Row doesn't fit, end this slice
          break;
        }

        sliceHeight += rowHeight;
        yOffset += rowHeight;
        sliceEndRow++;
      }

      // Ensure we make progress (at least one row per slice)
      if (sliceEndRow === currentRow && currentRow < this._rows.length) {
        // Force include at least one non-header row
        while (sliceEndRow < this._rows.length && this._rows[sliceEndRow].isHeader) {
          sliceEndRow++;
        }
        if (sliceEndRow < this._rows.length) {
          sliceHeight += this._rows[sliceEndRow].calculatedHeight;
          yOffset += this._rows[sliceEndRow].calculatedHeight;
          sliceEndRow++;
        }
      }

      slices.push({
        startRow: currentRow,
        endRow: sliceEndRow,
        isContinuation,
        height: sliceHeight,
        yOffset: sliceStartY
      });

      currentRow = sliceEndRow;
      isFirstPage = false;
    }

    return {
      slices,
      totalHeight,
      headerHeight,
      headerRowIndices
    };
  }

  /**
   * Render a specific page slice of the table.
   * @param ctx Canvas context
   * @param slice The page slice to render
   * @param pageLayout The full page layout info
   */
  renderSlice(
    ctx: CanvasRenderingContext2D,
    slice: TablePageSlice,
    pageLayout: TablePageLayout
  ): void {
    const columnPositions = this.getColumnPositions();
    const columnWidths = this.getColumnWidths();
    let y = 0;

    // On continuation pages, first render header rows
    if (slice.isContinuation && pageLayout.headerRowIndices.length > 0) {
      for (const headerRowIdx of pageLayout.headerRowIndices) {
        const row = this._rows[headerRowIdx];
        if (!row) continue;

        // Render each cell in the header row
        for (let colIdx = 0; colIdx < row.cellCount; colIdx++) {
          const key = `${headerRowIdx},${colIdx}`;
          if (this._coveredCells.has(key)) continue;

          const cell = row.getCell(colIdx);
          if (!cell) continue;

          // Calculate cell bounds for this slice
          let cellWidth = 0;
          for (let c = colIdx; c < colIdx + cell.colSpan && c < this._columns.length; c++) {
            cellWidth += columnWidths[c];
          }

          ctx.save();
          ctx.translate(columnPositions[colIdx], y);

          // Temporarily set cell bounds for rendering
          const originalBounds = cell.getBounds();
          cell.setBounds({
            x: columnPositions[colIdx],
            y: y,
            width: cellWidth,
            height: row.calculatedHeight
          });

          cell.render(ctx);

          // Restore original bounds
          if (originalBounds) {
            cell.setBounds(originalBounds);
          }

          ctx.restore();
        }
        y += row.calculatedHeight;
      }
    }

    // Render data rows for this slice
    for (let rowIdx = slice.startRow; rowIdx < slice.endRow; rowIdx++) {
      const row = this._rows[rowIdx];
      if (!row) continue;

      // Skip header rows (already rendered above on continuation pages)
      if (slice.isContinuation && row.isHeader) continue;

      // Render each cell in the row
      for (let colIdx = 0; colIdx < row.cellCount; colIdx++) {
        const key = `${rowIdx},${colIdx}`;
        if (this._coveredCells.has(key)) continue;

        const cell = row.getCell(colIdx);
        if (!cell) continue;

        // Calculate cell bounds for this slice
        let cellWidth = 0;
        for (let c = colIdx; c < colIdx + cell.colSpan && c < this._columns.length; c++) {
          cellWidth += columnWidths[c];
        }

        let cellHeight = 0;
        for (let r = rowIdx; r < rowIdx + cell.rowSpan && r < this._rows.length; r++) {
          cellHeight += this._rows[r].calculatedHeight;
        }

        ctx.save();
        ctx.translate(columnPositions[colIdx], y);

        // Temporarily set cell bounds for rendering
        const originalBounds = cell.getBounds();
        cell.setBounds({
          x: columnPositions[colIdx],
          y: y,
          width: cellWidth,
          height: cellHeight
        });

        cell.render(ctx);

        // Restore original bounds
        if (originalBounds) {
          cell.setBounds(originalBounds);
        }

        ctx.restore();
      }
      y += row.calculatedHeight;
    }

    // Draw selection border if selected
    if (this._selected) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(0, 0, this._size.width, slice.height);
      ctx.setLineDash([]);
    }
  }

  /**
   * Get rows that should be rendered for a specific page slice.
   * Includes header rows on continuation pages.
   */
  getRowsForSlice(slice: TablePageSlice, pageLayout: TablePageLayout): TableRow[] {
    const rows: TableRow[] = [];

    // Add header rows on continuation pages
    if (slice.isContinuation) {
      for (const idx of pageLayout.headerRowIndices) {
        if (this._rows[idx]) {
          rows.push(this._rows[idx]);
        }
      }
    }

    // Add data rows for this slice (excluding headers which were added above)
    for (let i = slice.startRow; i < slice.endRow; i++) {
      const row = this._rows[i];
      if (row && !(slice.isContinuation && row.isHeader)) {
        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * Check if this table needs to be split across multiple pages.
   */
  needsPageSplit(availableHeight: number): boolean {
    return this._size.height > availableHeight;
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
      if (!value) {
        // Blur any focused cell
        if (this._focusedCell) {
          const cell = this.getCell(this._focusedCell.row, this._focusedCell.col);
          if (cell) {
            cell.blur();
          }
          this._focusedCell = null;
        }
      }
      this.emit('editing-changed', { editing: value });
    }
  }

  get focusedCell(): CellAddress | null {
    return this._focusedCell;
  }

  /**
   * Focus a specific cell.
   */
  focusCell(rowIndex: number, colIndex: number): void {
    // Blur current cell and clear its selection
    if (this._focusedCell) {
      const currentCell = this.getCell(this._focusedCell.row, this._focusedCell.col);
      if (currentCell) {
        currentCell.flowingContent.clearSelection();
        currentCell.blur();
      }
    }

    // Resolve to origin cell if covered
    const resolved = this.resolveCell(rowIndex, colIndex);
    if (!resolved) return;

    this._focusedCell = { row: resolved.rowIndex, col: resolved.colIndex };
    resolved.cell.focus();
    this._editing = true;

    this.emit('cell-focused', {
      rowIndex: resolved.rowIndex,
      colIndex: resolved.colIndex,
      cellId: resolved.cell.id
    });
  }

  /**
   * Move focus to next/previous cell.
   */
  moveFocus(direction: 'next' | 'previous' | 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this._focusedCell) {
      if (this._rows.length > 0 && this._columns.length > 0) {
        this.focusCell(0, 0);
        return true;
      }
      return false;
    }

    let { row, col } = this._focusedCell;

    switch (direction) {
      case 'next':
      case 'right':
        col++;
        if (col >= this._columns.length) {
          col = 0;
          row++;
          if (row >= this._rows.length) {
            return false; // At end
          }
        }
        break;

      case 'previous':
      case 'left':
        col--;
        if (col < 0) {
          col = this._columns.length - 1;
          row--;
          if (row < 0) {
            return false; // At start
          }
        }
        break;

      case 'up':
        row--;
        if (row < 0) return false;
        break;

      case 'down':
        row++;
        if (row >= this._rows.length) return false;
        break;
    }

    this.focusCell(row, col);
    return true;
  }

  focus(): void {
    this._editing = true;
    // Focus first cell if no cell is focused
    if (!this._focusedCell && this._rows.length > 0 && this._columns.length > 0) {
      this.focusCell(0, 0);
    }
    this.emit('focus', {});
  }

  blur(): void {
    this.editing = false;
    this.emit('blur', {});
  }

  hasFocus(): boolean {
    return this._editing;
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    console.log('[TableObject.handleKeyDown] Key:', e.key, '_editing:', this._editing, '_focusedCell:', this._focusedCell);
    if (!this._editing) return false;

    // Handle Tab navigation
    if (e.key === 'Tab') {
      e.preventDefault();
      this.moveFocus(e.shiftKey ? 'previous' : 'next');
      return true;
    }

    // Handle Escape to exit editing
    if (e.key === 'Escape') {
      e.preventDefault();
      this.blur();
      return true;
    }

    // Handle arrow keys at cell boundaries
    if (this._focusedCell) {
      const cell = this.getCell(this._focusedCell.row, this._focusedCell.col);
      if (cell) {
        // Check if we should navigate to adjacent cell
        const flowingContent = cell.flowingContent;
        const cursorPos = flowingContent.getCursorPosition();
        const textLength = flowingContent.getText().length;

        // Arrow left at start of cell
        if (e.key === 'ArrowLeft' && cursorPos === 0 && !e.shiftKey) {
          if (this.moveFocus('left')) {
            e.preventDefault();
            return true;
          }
        }

        // Arrow right at end of cell
        if (e.key === 'ArrowRight' && cursorPos >= textLength && !e.shiftKey) {
          if (this.moveFocus('right')) {
            e.preventDefault();
            return true;
          }
        }

        // Delegate to focused cell
        return cell.handleKeyDown(e);
      }
    }

    return false;
  }

  onCursorBlink(handler: () => void): void {
    // Subscribe to blink events from all cells
    for (const row of this._rows) {
      for (const cell of row.cells) {
        cell.onCursorBlink(handler);
      }
    }
  }

  offCursorBlink(handler: () => void): void {
    for (const row of this._rows) {
      for (const cell of row.cells) {
        cell.offCursorBlink(handler);
      }
    }
  }

  handleDoubleClick(point: Point): void {
    if (this._locked) return;

    // Find cell at click point
    const cellAddr = this.getCellAtPoint(point);
    if (cellAddr) {
      this.focusCell(cellAddr.row, cellAddr.col);
    }
  }

  // ============================================
  // Cell Selection and Merging
  // ============================================

  /**
   * Get the currently selected cell range.
   */
  get selectedRange(): CellRange | null {
    return this._selectedRange;
  }

  /**
   * Select a range of cells.
   */
  selectRange(range: CellRange): void {
    this._selectedRange = TableCellMerger.normalizeRange(range);
    this.emit('selection-changed', { range: this._selectedRange });
  }

  /**
   * Clear the cell selection.
   */
  clearSelection(): void {
    this._selectedRange = null;
    this.emit('selection-changed', { range: null });
  }

  /**
   * Merge cells in the given range (or the current selection if no range provided).
   * @param range Optional range to merge. If not provided, uses current selection.
   * @returns MergeResult indicating success or failure.
   */
  mergeCells(range?: CellRange): { success: boolean; error?: string } {
    const mergeRange = range || this._selectedRange;
    if (!mergeRange) {
      return { success: false, error: 'No range specified for merge' };
    }

    const result = TableCellMerger.mergeCells(this, mergeRange);

    if (result.success) {
      this.updateCoveredCells();
      this.clearSelection();
      this.emit('cells-merged', { range: mergeRange });
      this.emit('content-changed', {});
    }

    return result;
  }

  /**
   * Split a merged cell back into individual cells.
   * @param row Row index of the merged cell.
   * @param col Column index of the merged cell.
   * @returns SplitResult indicating success or failure.
   */
  splitCell(row: number, col: number): { success: boolean; error?: string } {
    const result = TableCellMerger.splitCell(this, row, col);

    if (result.success) {
      this.updateCoveredCells();
      this.emit('cell-split', { row, col });
      this.emit('content-changed', {});
    }

    return result;
  }

  /**
   * Check if the given range can be merged.
   */
  canMergeRange(range?: CellRange): { canMerge: boolean; error?: string } {
    const mergeRange = range || this._selectedRange;
    if (!mergeRange) {
      return { canMerge: false, error: 'No range specified' };
    }

    const error = TableCellMerger.canMerge(this, mergeRange);
    return { canMerge: error === null, error: error || undefined };
  }

  /**
   * Check if the cell at the given position can be split.
   */
  canSplitCell(row: number, col: number): { canSplit: boolean; error?: string } {
    const error = TableCellMerger.canSplit(this, row, col);
    return { canSplit: error === null, error: error || undefined };
  }

  // ============================================
  // Rendering
  // ============================================

  /**
   * Render the table structure (backgrounds, borders).
   * Text content is rendered separately by FlowingTextRenderer.
   * @param ctx Canvas rendering context
   * @param visibleRect Optional visible rectangle for culling (in table-local coordinates)
   */
  render(ctx: CanvasRenderingContext2D, visibleRect?: { y: number; height: number }): void {
    // Determine which rows are visible (for culling optimization)
    let startRowIdx = 0;
    let endRowIdx = this._rows.length;

    if (visibleRect && this._cachedRowPositions.length > 0) {
      // Find first visible row using binary search
      startRowIdx = this.findFirstVisibleRow(visibleRect.y);
      // Find last visible row
      endRowIdx = this.findLastVisibleRow(visibleRect.y + visibleRect.height) + 1;
    }

    // Render each cell's background and border
    // Skip covered cells (only render origin cells of merged regions)
    for (let rowIdx = startRowIdx; rowIdx < endRowIdx && rowIdx < this._rows.length; rowIdx++) {
      const row = this._rows[rowIdx];
      for (let colIdx = 0; colIdx < row.cellCount; colIdx++) {
        // Check if this cell is covered by a merge
        const key = `${rowIdx},${colIdx}`;
        if (this._coveredCells.has(key)) {
          continue; // Skip covered cells
        }

        const cell = row.getCell(colIdx);
        if (!cell) continue;

        const bounds = cell.getBounds();
        if (!bounds) continue;

        ctx.save();
        ctx.translate(bounds.x, bounds.y);
        cell.render(ctx);
        ctx.restore();
      }
    }

    // Render cell range selection highlight
    if (this._selectedRange) {
      this.renderRangeSelection(ctx);
    }

    // Draw selection border if selected
    if (this._selected) {
      this.renderSelectionBorder(ctx);
    }

    // Draw editing indicator
    if (this._editing) {
      this.renderEditingIndicator(ctx);
    }
  }

  /**
   * Find the first row that is visible at or after the given Y position.
   * Uses binary search for efficiency with large tables.
   */
  private findFirstVisibleRow(y: number): number {
    const positions = this._cachedRowPositions;
    const heights = this._cachedRowHeights;
    if (positions.length === 0) return 0;

    let low = 0;
    let high = positions.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const rowBottom = positions[mid] + (heights[mid] || 0);

      if (rowBottom <= y) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /**
   * Find the last row that is visible at or before the given Y position.
   * Uses binary search for efficiency with large tables.
   */
  private findLastVisibleRow(y: number): number {
    const positions = this._cachedRowPositions;
    if (positions.length === 0) return 0;

    let low = 0;
    let high = positions.length - 1;

    while (low < high) {
      const mid = Math.ceil((low + high) / 2);

      if (positions[mid] > y) {
        high = mid - 1;
      } else {
        low = mid;
      }
    }

    return low;
  }

  /**
   * Get the visible row range for a given viewport.
   * Useful for external code that needs to know which rows to process.
   */
  getVisibleRowRange(visibleY: number, visibleHeight: number): { startRow: number; endRow: number } {
    if (this._cachedRowPositions.length === 0) {
      return { startRow: 0, endRow: this._rows.length };
    }

    const startRow = this.findFirstVisibleRow(visibleY);
    const endRow = Math.min(this.findLastVisibleRow(visibleY + visibleHeight) + 1, this._rows.length);

    return { startRow, endRow };
  }

  /**
   * Render the selection highlight for a range of cells.
   */
  private renderRangeSelection(ctx: CanvasRenderingContext2D): void {
    if (!this._selectedRange) return;

    const { start, end } = this._selectedRange;
    const columnPositions = this.getColumnPositions();
    const columnWidths = this.getColumnWidths();

    // Calculate row Y positions
    const rowPositions: number[] = [];
    let y = 0;
    for (const row of this._rows) {
      rowPositions.push(y);
      y += row.calculatedHeight;
    }

    // Calculate bounds of selection
    const x1 = columnPositions[start.col];
    const x2 = columnPositions[end.col] + columnWidths[end.col];
    const y1 = rowPositions[start.row];
    const y2 = rowPositions[end.row] + this._rows[end.row].calculatedHeight;

    // Draw selection highlight
    ctx.fillStyle = 'rgba(0, 120, 215, 0.2)';
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    // Draw selection border
    ctx.strokeStyle = 'rgba(0, 120, 215, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x1 + 1, y1 + 1, x2 - x1 - 2, y2 - y1 - 2);
  }

  private renderEditingIndicator(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this._size;
    ctx.strokeStyle = '#0099ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(1, 1, width - 2, height - 2);
  }

  // ============================================
  // Serialization
  // ============================================

  toData(): EmbeddedObjectData {
    const tableData: TableObjectData = {
      id: this._id,
      objectType: 'table',
      textIndex: this._textIndex,
      position: this._position,
      size: { ...this._size },
      data: {
        columns: this._columns.map(col => ({ ...col })),
        rows: this._rows.map(row => row.toData()),
        defaultCellPadding: this._defaultCellPadding,
        defaultBorderColor: this._defaultBorderColor,
        defaultBorderWidth: this._defaultBorderWidth,
        defaultFontFamily: this._defaultFontFamily,
        defaultFontSize: this._defaultFontSize,
        defaultColor: this._defaultColor
      }
    };

    return tableData;
  }

  static fromData(data: TableObjectData): TableObject {
    const config: TableObjectConfig = {
      id: data.id,
      textIndex: data.textIndex,
      position: data.position,
      size: data.size,
      columnConfig: data.data.columns,
      defaultCellPadding: data.data.defaultCellPadding,
      defaultBorderColor: data.data.defaultBorderColor,
      defaultBorderWidth: data.data.defaultBorderWidth,
      defaultFontFamily: data.data.defaultFontFamily,
      defaultFontSize: data.data.defaultFontSize,
      defaultColor: data.data.defaultColor
    };

    const table = new TableObject(config);

    // Clear auto-generated rows and load from data
    table._rows = [];
    for (const rowData of data.data.rows) {
      const row = TableRow.fromData(rowData);
      table.setupRowListeners(row);
      table._rows.push(row);
    }

    table.updateCoveredCells();
    return table;
  }

  clone(): TableObject {
    return TableObject.fromData(this.toData() as TableObjectData);
  }
}
