/**
 * TableResizeHandler - Handles column and row resize operations for tables.
 */

import { Point } from '../types';
import { TableObject } from './TableObject';

/**
 * Type of resize handle being dragged.
 */
export type ResizeHandleType = 'column' | 'row' | null;

/**
 * Information about a detected resize handle.
 */
export interface ResizeHandleInfo {
  type: ResizeHandleType;
  index: number;          // Column or row index (the divider between index and index+1)
  position: number;       // X for column, Y for row (in table-local coords)
}

/**
 * State for an active resize operation.
 */
export interface ResizeState {
  table: TableObject;
  handleType: ResizeHandleType;
  index: number;
  startPosition: number;  // Starting position of the handle
  startSize: number;      // Starting size of the column/row being resized
  nextStartSize?: number; // Starting size of the adjacent column/row (for internal dividers)
  tablePosition: Point;   // Table's rendered position
}

/**
 * Hit area for resize handles (pixels on each side of the divider).
 */
const RESIZE_HANDLE_HIT_AREA = 4;

/**
 * TableResizeHandler provides methods for detecting and handling
 * column and row resize operations on tables.
 */
export class TableResizeHandler {
  private _resizeState: ResizeState | null = null;

  /**
   * Get the current resize state.
   */
  get resizeState(): ResizeState | null {
    return this._resizeState;
  }

  /**
   * Check if currently resizing.
   */
  get isResizing(): boolean {
    return this._resizeState !== null;
  }

  /**
   * Detect if a point is over a resize handle.
   * @param table The table object
   * @param point Point in canvas coordinates
   * @param tablePosition The table's rendered position
   * @returns Resize handle info if over a handle, null otherwise
   */
  detectResizeHandle(
    table: TableObject,
    point: Point,
    tablePosition: Point
  ): ResizeHandleInfo | null {
    // Convert to table-local coordinates
    const localX = point.x - tablePosition.x;
    const localY = point.y - tablePosition.y;

    // Check if point is within table bounds
    if (localX < 0 || localY < 0 ||
        localX > table.size.width || localY > table.size.height) {
      return null;
    }

    // Check column dividers (vertical lines between columns)
    const columnPositions = table.getColumnPositions();
    const columnWidths = table.getColumnWidths();

    for (let i = 0; i < columnPositions.length; i++) {
      const dividerX = columnPositions[i] + columnWidths[i];
      if (Math.abs(localX - dividerX) <= RESIZE_HANDLE_HIT_AREA) {
        return {
          type: 'column',
          index: i,
          position: dividerX
        };
      }
    }

    // Check row dividers (horizontal lines between rows)
    let rowY = 0;
    const rows = table.rows;
    for (let i = 0; i < rows.length; i++) {
      rowY += rows[i].calculatedHeight;
      if (Math.abs(localY - rowY) <= RESIZE_HANDLE_HIT_AREA) {
        return {
          type: 'row',
          index: i,
          position: rowY
        };
      }
    }

    return null;
  }

  /**
   * Start a resize operation.
   * @param table The table being resized
   * @param handleInfo The handle being dragged
   * @param tablePosition The table's rendered position
   */
  startResize(
    table: TableObject,
    handleInfo: ResizeHandleInfo,
    tablePosition: Point
  ): void {
    if (!handleInfo.type) return;

    let startSize: number;
    let nextStartSize: number | undefined;

    if (handleInfo.type === 'column') {
      startSize = table.columns[handleInfo.index].width;
      // Store adjacent column's size for internal dividers
      if (handleInfo.index < table.columns.length - 1) {
        nextStartSize = table.columns[handleInfo.index + 1].width;
      }
    } else {
      const row = table.rows[handleInfo.index];
      startSize = row.calculatedHeight;
      // Store adjacent row's size for internal dividers
      if (handleInfo.index < table.rows.length - 1) {
        const nextRow = table.rows[handleInfo.index + 1];
        nextStartSize = nextRow.calculatedHeight || nextRow.minHeight;
      }
    }

    this._resizeState = {
      table,
      handleType: handleInfo.type,
      index: handleInfo.index,
      startPosition: handleInfo.position,
      startSize,
      nextStartSize,
      tablePosition
    };
  }

  /**
   * Update the resize during drag.
   * For internal dividers, adjusts both adjacent columns/rows to keep total size constant.
   * For edge dividers (last column/row), only adjusts that column/row.
   * @param point Current mouse position in canvas coordinates
   * @returns true if resize was updated, false otherwise
   */
  updateResize(point: Point): boolean {
    if (!this._resizeState) return false;

    const { table, handleType, index, startPosition, startSize, nextStartSize, tablePosition } = this._resizeState;

    if (handleType === 'column') {
      const isLastColumn = index === table.columns.length - 1;
      const localX = point.x - tablePosition.x;
      const delta = localX - startPosition;

      if (isLastColumn) {
        // Edge resize: only change the last column
        const newWidth = Math.max(
          startSize + delta,
          table.columns[index].minWidth || 20
        );
        table.setColumnWidth(index, newWidth);
      } else if (nextStartSize !== undefined) {
        // Internal divider: adjust both adjacent columns inversely
        const nextCol = table.columns[index + 1];

        // Calculate new widths ensuring minimum constraints
        const minWidth = table.columns[index].minWidth || 20;
        const nextMinWidth = nextCol.minWidth || 20;

        // Clamp delta to respect both minimum widths (use original nextStartSize)
        const maxPositiveDelta = nextStartSize - nextMinWidth;  // Can't shrink next col below min
        const maxNegativeDelta = -(startSize - minWidth);       // Can't shrink current col below min
        const clampedDelta = Math.max(maxNegativeDelta, Math.min(maxPositiveDelta, delta));

        const newWidth = startSize + clampedDelta;
        const newNextWidth = nextStartSize - clampedDelta;

        table.setColumnWidth(index, newWidth);
        table.setColumnWidth(index + 1, newNextWidth);
      }
      return true;
    } else if (handleType === 'row') {
      const isLastRow = index === table.rows.length - 1;
      const localY = point.y - tablePosition.y;
      const delta = localY - startPosition;
      const row = table.rows[index];

      if (isLastRow) {
        // Edge resize: only change the last row
        const newHeight = Math.max(startSize + delta, row.minHeight);
        row.height = newHeight;
      } else if (nextStartSize !== undefined) {
        // Internal divider: adjust both adjacent rows inversely
        const nextRow = table.rows[index + 1];

        // Clamp delta to respect both minimum heights (use original nextStartSize)
        const maxPositiveDelta = nextStartSize - nextRow.minHeight;  // Can't shrink next row below min
        const maxNegativeDelta = -(startSize - row.minHeight);       // Can't shrink current row below min
        const clampedDelta = Math.max(maxNegativeDelta, Math.min(maxPositiveDelta, delta));

        const newHeight = startSize + clampedDelta;
        const newNextHeight = nextStartSize - clampedDelta;

        row.height = newHeight;
        nextRow.height = newNextHeight;
      }
      return true;
    }

    return false;
  }

  /**
   * End the resize operation.
   */
  endResize(): void {
    this._resizeState = null;
  }

  /**
   * Cancel the resize operation and restore original size.
   */
  cancelResize(): void {
    if (!this._resizeState) return;

    const { table, handleType, index, startSize, nextStartSize } = this._resizeState;

    if (handleType === 'column') {
      table.setColumnWidth(index, startSize);
      // Restore adjacent column if it was an internal divider
      if (nextStartSize !== undefined && index < table.columns.length - 1) {
        table.setColumnWidth(index + 1, nextStartSize);
      }
    } else if (handleType === 'row') {
      table.rows[index].height = startSize;
      // Restore adjacent row if it was an internal divider
      if (nextStartSize !== undefined && index < table.rows.length - 1) {
        table.rows[index + 1].height = nextStartSize;
      }
    }

    this._resizeState = null;
  }

  /**
   * Get the cursor style for a resize handle type.
   */
  static getCursorForHandle(handleType: ResizeHandleType): string {
    switch (handleType) {
      case 'column':
        return 'col-resize';
      case 'row':
        return 'row-resize';
      default:
        return 'default';
    }
  }
}
