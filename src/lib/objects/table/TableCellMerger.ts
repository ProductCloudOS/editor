/**
 * TableCellMerger - Handles cell merge and split operations for tables.
 */

import { TableObject } from './TableObject';
import { TableCell } from './TableCell';
import { CellRange } from './types';

/**
 * Result of a merge operation.
 */
export interface MergeResult {
  success: boolean;
  error?: string;
  mergedCell?: TableCell;
}

/**
 * Result of a split operation.
 */
export interface SplitResult {
  success: boolean;
  error?: string;
  newCells?: TableCell[];
}

/**
 * TableCellMerger provides utilities for merging and splitting table cells.
 */
export class TableCellMerger {
  /**
   * Normalize a cell range so start is always top-left and end is bottom-right.
   */
  static normalizeRange(range: CellRange): CellRange {
    return {
      start: {
        row: Math.min(range.start.row, range.end.row),
        col: Math.min(range.start.col, range.end.col)
      },
      end: {
        row: Math.max(range.start.row, range.end.row),
        col: Math.max(range.start.col, range.end.col)
      }
    };
  }

  /**
   * Check if a range is valid for the given table.
   */
  static isValidRange(table: TableObject, range: CellRange): boolean {
    const normalized = this.normalizeRange(range);
    return (
      normalized.start.row >= 0 &&
      normalized.start.col >= 0 &&
      normalized.end.row < table.rowCount &&
      normalized.end.col < table.columnCount
    );
  }

  /**
   * Check if a cell range can be merged.
   * Returns an error message if it cannot be merged, or null if it can.
   */
  static canMerge(table: TableObject, range: CellRange): string | null {
    const normalized = this.normalizeRange(range);

    // Validate range bounds
    if (!this.isValidRange(table, normalized)) {
      return 'Range is out of table bounds';
    }

    // Check if range is at least 2 cells
    const rowSpan = normalized.end.row - normalized.start.row + 1;
    const colSpan = normalized.end.col - normalized.start.col + 1;
    if (rowSpan === 1 && colSpan === 1) {
      return 'Selection must include at least 2 cells to merge';
    }

    // Check if any cells in the range are already part of a merge
    for (let row = normalized.start.row; row <= normalized.end.row; row++) {
      for (let col = normalized.start.col; col <= normalized.end.col; col++) {
        const resolved = table.resolveCell(row, col);
        if (!resolved) continue;

        // If this cell is spanned by another cell outside our range
        if (resolved.isSpanned) {
          const originRow = resolved.rowIndex;
          const originCol = resolved.colIndex;

          // Check if the origin cell is within our merge range
          if (originRow < normalized.start.row || originRow > normalized.end.row ||
              originCol < normalized.start.col || originCol > normalized.end.col) {
            return 'Cannot merge: selection overlaps with existing merged cells';
          }
        }

        // If this cell spans beyond our range
        const cell = table.getCell(row, col);
        if (cell) {
          const cellEndRow = row + cell.rowSpan - 1;
          const cellEndCol = col + cell.colSpan - 1;

          if (cellEndRow > normalized.end.row || cellEndCol > normalized.end.col) {
            return 'Cannot merge: selection overlaps with existing merged cells';
          }
        }
      }
    }

    return null; // Can merge
  }

  /**
   * Merge cells in the given range.
   * The top-left cell becomes the merged cell, other cells are cleared.
   */
  static mergeCells(table: TableObject, range: CellRange): MergeResult {
    const normalized = this.normalizeRange(range);

    // Validate
    const error = this.canMerge(table, normalized);
    if (error) {
      return { success: false, error };
    }

    const rowSpan = normalized.end.row - normalized.start.row + 1;
    const colSpan = normalized.end.col - normalized.start.col + 1;

    // Get the origin cell (top-left)
    const originCell = table.getCell(normalized.start.row, normalized.start.col);
    if (!originCell) {
      return { success: false, error: 'Could not find origin cell' };
    }

    // Clear content from covered cells (origin cell keeps its content)
    for (let row = normalized.start.row; row <= normalized.end.row; row++) {
      for (let col = normalized.start.col; col <= normalized.end.col; col++) {
        if (row === normalized.start.row && col === normalized.start.col) continue;

        const cell = table.getCell(row, col);
        if (cell) {
          // Clear the cell's content since it will be covered
          cell.content = '';
          cell.rowSpan = 1;
          cell.colSpan = 1;
        }
      }
    }

    // Set the span on the origin cell
    originCell.rowSpan = rowSpan;
    originCell.colSpan = colSpan;

    return { success: true, mergedCell: originCell };
  }

  /**
   * Check if a cell can be split.
   */
  static canSplit(table: TableObject, row: number, col: number): string | null {
    const cell = table.getCell(row, col);
    if (!cell) {
      return 'Cell not found';
    }

    if (cell.rowSpan === 1 && cell.colSpan === 1) {
      return 'Cell is not merged';
    }

    return null; // Can split
  }

  /**
   * Split a merged cell back into individual cells.
   */
  static splitCell(table: TableObject, row: number, col: number): SplitResult {
    const error = this.canSplit(table, row, col);
    if (error) {
      return { success: false, error };
    }

    const cell = table.getCell(row, col);
    if (!cell) {
      return { success: false, error: 'Cell not found' };
    }

    const rowSpan = cell.rowSpan;
    const colSpan = cell.colSpan;

    // Reset the origin cell's span
    cell.rowSpan = 1;
    cell.colSpan = 1;

    // The covered cells should already exist in the table structure
    // We just need to reset them (they were "hidden" by the span)
    const newCells: TableCell[] = [cell];

    for (let r = row; r < row + rowSpan && r < table.rowCount; r++) {
      for (let c = col; c < col + colSpan && c < table.columnCount; c++) {
        if (r === row && c === col) continue;

        const coveredCell = table.getCell(r, c);
        if (coveredCell) {
          // Ensure the cell is reset
          coveredCell.rowSpan = 1;
          coveredCell.colSpan = 1;
          newCells.push(coveredCell);
        }
      }
    }

    return { success: true, newCells };
  }

  /**
   * Get all cells in a range (accounting for merged cells).
   */
  static getCellsInRange(table: TableObject, range: CellRange): TableCell[] {
    const normalized = this.normalizeRange(range);
    const cells: TableCell[] = [];
    const seen = new Set<string>();

    for (let row = normalized.start.row; row <= normalized.end.row; row++) {
      for (let col = normalized.start.col; col <= normalized.end.col; col++) {
        const resolved = table.resolveCell(row, col);
        if (!resolved) continue;

        const key = `${resolved.rowIndex},${resolved.colIndex}`;
        if (!seen.has(key)) {
          seen.add(key);
          cells.push(resolved.cell);
        }
      }
    }

    return cells;
  }

  /**
   * Check if two ranges overlap.
   */
  static rangesOverlap(range1: CellRange, range2: CellRange): boolean {
    const r1 = this.normalizeRange(range1);
    const r2 = this.normalizeRange(range2);

    return !(
      r1.end.row < r2.start.row ||
      r1.start.row > r2.end.row ||
      r1.end.col < r2.start.col ||
      r1.start.col > r2.end.col
    );
  }

  /**
   * Get the bounding range of a merged cell.
   */
  static getMergedCellRange(cell: TableCell, row: number, col: number): CellRange {
    return {
      start: { row, col },
      end: {
        row: row + cell.rowSpan - 1,
        col: col + cell.colSpan - 1
      }
    };
  }
}
