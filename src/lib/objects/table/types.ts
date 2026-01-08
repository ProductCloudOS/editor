/**
 * Table-related type definitions for embedded table objects.
 */

import { BorderSide, EmbeddedObjectConfig, EmbeddedObjectData } from '../types';
import { TextFormattingStyle } from '../../text/types';
import type { TableCell } from './TableCell';

/**
 * Vertical alignment within a cell.
 */
export type VerticalAlign = 'top' | 'middle' | 'bottom';

/**
 * Cell border configuration (per-side).
 */
export interface CellBorder {
  top: BorderSide;
  right: BorderSide;
  bottom: BorderSide;
  left: BorderSide;
}

/**
 * Cell padding configuration.
 */
export interface CellPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Configuration for creating a table cell.
 */
export interface TableCellConfig {
  id?: string;
  rowSpan?: number;
  colSpan?: number;
  backgroundColor?: string;
  border?: Partial<CellBorder>;
  padding?: number | Partial<CellPadding>;
  verticalAlign?: VerticalAlign;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
}

/**
 * Serialized cell data for persistence.
 */
export interface TableCellData {
  id: string;
  rowSpan: number;
  colSpan: number;
  backgroundColor: string;
  border: CellBorder;
  padding: CellPadding;
  verticalAlign: VerticalAlign;
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  formattingRuns?: Array<[number, Partial<TextFormattingStyle>]>;
  substitutionFields?: Array<unknown>;
}

/**
 * Row configuration for creating a table row.
 */
export interface TableRowConfig {
  id?: string;
  height?: number | null;  // Explicit height (null = auto)
  minHeight?: number;
  isHeader?: boolean;      // Header row (repeats on page breaks)
  cells?: TableCellConfig[];
}

/**
 * Serialized row data for persistence.
 */
export interface TableRowData {
  id: string;
  height: number | null;
  minHeight: number;
  isHeader: boolean;
  cells: TableCellData[];
}

/**
 * Column configuration.
 */
export interface TableColumnConfig {
  id?: string;
  width: number;
  minWidth?: number;
}

/**
 * Configuration for creating a table object.
 */
export interface TableObjectConfig extends EmbeddedObjectConfig {
  rows?: number;              // Initial row count (default: 2)
  columns?: number;           // Initial column count (default: 2)
  columnWidths?: number[];    // Explicit column widths
  rowData?: TableRowConfig[]; // Full row configuration (overrides rows)
  columnConfig?: TableColumnConfig[];  // Full column configuration (overrides columns/columnWidths)
  defaultCellPadding?: number;
  defaultBorderColor?: string;
  defaultBorderWidth?: number;
  defaultFontFamily?: string;
  defaultFontSize?: number;
  defaultColor?: string;
}

/**
 * Serialized table data for persistence.
 */
export interface TableObjectData extends EmbeddedObjectData {
  objectType: 'table';
  data: {
    columns: TableColumnConfig[];
    rows: TableRowData[];
    defaultCellPadding: number;
    defaultBorderColor: string;
    defaultBorderWidth: number;
    defaultFontFamily: string;
    defaultFontSize: number;
    defaultColor: string;
  };
}

/**
 * Cell address for identifying cells.
 */
export interface CellAddress {
  row: number;
  col: number;
}

/**
 * Cell range for selection/operations.
 */
export interface CellRange {
  start: CellAddress;
  end: CellAddress;
}

/**
 * Result of resolving a cell (handles merged cells).
 */
export interface ResolvedCell {
  cell: TableCell;     // The resolved cell (origin cell for spanned addresses)
  rowIndex: number;    // Actual row containing the cell
  colIndex: number;    // Actual column containing the cell
  isSpanned: boolean;  // True if this address is covered by another cell's span
}

/**
 * Default table styling values.
 */
export const DEFAULT_TABLE_STYLE = {
  cellPadding: 4,
  borderColor: '#000000',
  borderWidth: 1,
  fontFamily: 'Arial',
  fontSize: 12,
  color: '#000000',
  backgroundColor: '#ffffff',
  minColumnWidth: 20,
  minRowHeight: 20,
  defaultColumnWidth: 100,
  defaultRowHeight: null  // Auto
};

/**
 * Default border side for table cells.
 */
export const DEFAULT_CELL_BORDER_SIDE: BorderSide = {
  width: 1,
  color: '#000000',
  style: 'solid'
};

/**
 * Create a full cell border from partial config.
 */
export function createCellBorder(partial?: Partial<CellBorder>, defaultSide?: BorderSide): CellBorder {
  const side = defaultSide || DEFAULT_CELL_BORDER_SIDE;
  return {
    top: partial?.top || { ...side },
    right: partial?.right || { ...side },
    bottom: partial?.bottom || { ...side },
    left: partial?.left || { ...side }
  };
}

/**
 * Create cell padding from number or partial config.
 */
export function createCellPadding(padding?: number | Partial<CellPadding>, defaultPadding?: number): CellPadding {
  const def = defaultPadding ?? DEFAULT_TABLE_STYLE.cellPadding;
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding?.top ?? def,
    right: padding?.right ?? def,
    bottom: padding?.bottom ?? def,
    left: padding?.left ?? def
  };
}

/**
 * Calculate total horizontal padding.
 */
export function getHorizontalPadding(padding: CellPadding): number {
  return padding.left + padding.right;
}

/**
 * Calculate total vertical padding.
 */
export function getVerticalPadding(padding: CellPadding): number {
  return padding.top + padding.bottom;
}

/**
 * Calculate total horizontal border width.
 */
export function getHorizontalBorderWidth(border: CellBorder): number {
  const left = border.left.style !== 'none' ? border.left.width : 0;
  const right = border.right.style !== 'none' ? border.right.width : 0;
  return left + right;
}

/**
 * Calculate total vertical border width.
 */
export function getVerticalBorderWidth(border: CellBorder): number {
  const top = border.top.style !== 'none' ? border.top.width : 0;
  const bottom = border.bottom.style !== 'none' ? border.bottom.width : 0;
  return top + bottom;
}

// ============================================
// Table Page Layout Types (for multi-page tables)
// ============================================

/**
 * Describes which rows of a table appear on a specific page.
 */
export interface TablePageSlice {
  /** Starting row index (inclusive) for data rows on this page */
  startRow: number;
  /** Ending row index (exclusive) for data rows on this page */
  endRow: number;
  /** Whether this is a continuation page (header rows should be repeated) */
  isContinuation: boolean;
  /** Height of this slice (including repeated headers if continuation) */
  height: number;
  /** Y offset within the table where this slice starts */
  yOffset: number;
}

/**
 * Complete layout information for a table spanning multiple pages.
 */
export interface TablePageLayout {
  /** Array of page slices, one per page the table spans */
  slices: TablePageSlice[];
  /** Total height if the table were rendered on a single page */
  totalHeight: number;
  /** Height of header rows (to be repeated on continuation pages) */
  headerHeight: number;
  /** Indices of header rows */
  headerRowIndices: number[];
}
