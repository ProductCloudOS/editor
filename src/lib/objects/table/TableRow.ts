/**
 * TableRow - A row within a table containing cells.
 */

import { EventEmitter } from '../../events/EventEmitter';
import { TableCell } from './TableCell';
import {
  TableRowConfig,
  TableRowData,
  TableCellConfig,
  DEFAULT_TABLE_STYLE
} from './types';

/**
 * Generate a unique row ID.
 */
function generateRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * TableRow represents a row in a table.
 * It contains TableCell instances and manages row-level properties.
 */
export class TableRow extends EventEmitter {
  private _id: string;
  private _cells: TableCell[];
  private _height: number | null;        // Explicit height (null = auto)
  private _minHeight: number;
  private _isHeader: boolean;
  private _calculatedHeight: number = 0; // Computed during layout

  constructor(config: TableRowConfig, columnCount: number, defaultCellConfig?: Partial<TableCellConfig>) {
    super();

    this._id = config.id || generateRowId();
    this._height = config.height ?? null;
    this._minHeight = config.minHeight ?? DEFAULT_TABLE_STYLE.minRowHeight;
    this._isHeader = config.isHeader ?? false;

    // Create cells
    this._cells = [];
    if (config.cells && config.cells.length > 0) {
      // Use provided cell configs
      for (let i = 0; i < columnCount; i++) {
        const cellConfig = config.cells[i] || {};
        const mergedConfig = { ...defaultCellConfig, ...cellConfig };
        const cell = new TableCell(mergedConfig);
        this.setupCellListeners(cell);
        this._cells.push(cell);
      }
    } else {
      // Create empty cells
      for (let i = 0; i < columnCount; i++) {
        const cell = new TableCell(defaultCellConfig || {});
        this.setupCellListeners(cell);
        this._cells.push(cell);
      }
    }
  }

  private setupCellListeners(cell: TableCell): void {
    cell.on('content-changed', (data) => {
      this.emit('cell-content-changed', { rowId: this._id, ...data });
    });

    cell.on('style-changed', (data) => {
      this.emit('cell-style-changed', { rowId: this._id, ...data });
    });

    cell.on('span-changed', (data) => {
      this.emit('cell-span-changed', { rowId: this._id, ...data });
    });

    cell.on('editing-changed', (data) => {
      this.emit('cell-editing-changed', { rowId: this._id, ...data });
    });
  }

  // ============================================
  // Accessors
  // ============================================

  get id(): string {
    return this._id;
  }

  get cells(): TableCell[] {
    return this._cells;
  }

  get cellCount(): number {
    return this._cells.length;
  }

  get height(): number | null {
    return this._height;
  }

  set height(value: number | null) {
    if (this._height !== value) {
      this._height = value;
      this.emit('height-changed', { rowId: this._id, height: value });
    }
  }

  get minHeight(): number {
    return this._minHeight;
  }

  set minHeight(value: number) {
    if (this._minHeight !== value) {
      this._minHeight = value;
      this.emit('min-height-changed', { rowId: this._id, minHeight: value });
    }
  }

  get isHeader(): boolean {
    return this._isHeader;
  }

  set isHeader(value: boolean) {
    if (this._isHeader !== value) {
      this._isHeader = value;
      this.emit('header-changed', { rowId: this._id, isHeader: value });
    }
  }

  get calculatedHeight(): number {
    return this._calculatedHeight;
  }

  // ============================================
  // Cell Operations
  // ============================================

  /**
   * Get a cell by column index.
   */
  getCell(colIndex: number): TableCell | null {
    if (colIndex < 0 || colIndex >= this._cells.length) {
      return null;
    }
    return this._cells[colIndex];
  }

  /**
   * Add a cell to the row.
   */
  addCell(cell: TableCell, index?: number): void {
    this.setupCellListeners(cell);
    if (index !== undefined && index >= 0 && index <= this._cells.length) {
      this._cells.splice(index, 0, cell);
    } else {
      this._cells.push(cell);
    }
    this.emit('cell-added', { rowId: this._id, cellId: cell.id, index: index ?? this._cells.length - 1 });
  }

  /**
   * Remove a cell from the row.
   */
  removeCell(colIndex: number): TableCell | null {
    if (colIndex < 0 || colIndex >= this._cells.length) {
      return null;
    }
    const [removed] = this._cells.splice(colIndex, 1);
    this.emit('cell-removed', { rowId: this._id, cellId: removed.id, index: colIndex });
    return removed;
  }

  /**
   * Insert a new cell at the specified index.
   */
  insertCell(colIndex: number, config?: TableCellConfig): TableCell {
    const cell = new TableCell(config || {});
    this.setupCellListeners(cell);

    if (colIndex < 0) {
      colIndex = 0;
    } else if (colIndex > this._cells.length) {
      colIndex = this._cells.length;
    }

    this._cells.splice(colIndex, 0, cell);
    this.emit('cell-added', { rowId: this._id, cellId: cell.id, index: colIndex });
    return cell;
  }

  // ============================================
  // Layout
  // ============================================

  /**
   * Calculate the height needed for this row based on cell content.
   * @param ctx Canvas context for text measurement
   * @param columnWidths Array of column widths
   * @returns The calculated height
   */
  calculateHeight(ctx: CanvasRenderingContext2D, columnWidths: number[]): number {
    // If explicit height is set, use it
    if (this._height !== null) {
      this._calculatedHeight = Math.max(this._height, this._minHeight);
      return this._calculatedHeight;
    }

    // Calculate based on cell content heights
    let maxHeight = this._minHeight;

    for (let i = 0; i < this._cells.length; i++) {
      const cell = this._cells[i];

      // Calculate cell width including colSpan
      let cellWidth = 0;
      for (let c = i; c < i + cell.colSpan && c < columnWidths.length; c++) {
        cellWidth += columnWidths[c] || DEFAULT_TABLE_STYLE.defaultColumnWidth;
      }

      // Set cell bounds temporarily for width calculation
      cell.setBounds({ x: 0, y: 0, width: cellWidth, height: 1000 });

      // Calculate content height
      const contentHeight = cell.getContentHeight(ctx);
      if (contentHeight > maxHeight) {
        maxHeight = contentHeight;
      }
    }

    this._calculatedHeight = maxHeight;
    return this._calculatedHeight;
  }

  /**
   * Set the bounds for all cells in this row.
   * @param rowY The Y position of this row
   * @param columnPositions Array of X positions for each column
   * @param columnWidths Array of column widths
   * @param height The height of this row
   */
  setCellBounds(
    rowY: number,
    columnPositions: number[],
    columnWidths: number[],
    height: number
  ): void {
    for (let i = 0; i < this._cells.length; i++) {
      const cell = this._cells[i];
      const x = columnPositions[i] || 0;
      const width = columnWidths[i] || DEFAULT_TABLE_STYLE.defaultColumnWidth;

      cell.setBounds({
        x,
        y: rowY,
        width,
        height
      });
    }
  }

  // ============================================
  // Serialization
  // ============================================

  toData(): TableRowData {
    return {
      id: this._id,
      height: this._height,
      minHeight: this._minHeight,
      isHeader: this._isHeader,
      cells: this._cells.map(cell => cell.toData())
    };
  }

  static fromData(data: TableRowData): TableRow {
    const row = new TableRow({
      id: data.id,
      height: data.height,
      minHeight: data.minHeight,
      isHeader: data.isHeader
    }, data.cells.length);

    // Replace cells with deserialized ones
    row._cells = data.cells.map(cellData => {
      const cell = TableCell.fromData(cellData);
      row.setupCellListeners(cell);
      return cell;
    });

    return row;
  }

  clone(): TableRow {
    return TableRow.fromData(this.toData());
  }
}
