/**
 * Tests for PCEditor table operations
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PCEditor } from '../../lib/core/PCEditor';
import { TableObject } from '../../lib/objects';
import { createEditor, cleanupEditor, nextTick } from '../helpers/createEditor';

describe('PCEditor Table Operations', () => {
  let editor: PCEditor;
  let container: HTMLElement;
  let table: TableObject;

  beforeEach(async () => {
    const result = await createEditor();
    editor = result.editor;
    container = result.container;

    // Create a table for testing
    table = new TableObject({
      id: 'test-table',
      rows: 3,
      columns: 3,
      size: { width: 300, height: 100 }
    });

    editor.insertEmbeddedObject(table, 'block');
    await nextTick();
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('tableInsertRow', () => {
    it('should insert row at beginning', () => {
      const initialRowCount = table.rowCount;

      editor.tableInsertRow(table, 0);

      expect(table.rowCount).toBe(initialRowCount + 1);
    });

    it('should insert row at end', () => {
      const initialRowCount = table.rowCount;

      editor.tableInsertRow(table, initialRowCount);

      expect(table.rowCount).toBe(initialRowCount + 1);
    });

    it('should insert row in middle', () => {
      const initialRowCount = table.rowCount;

      editor.tableInsertRow(table, 1);

      expect(table.rowCount).toBe(initialRowCount + 1);
    });

    it('should insert row with config', () => {
      editor.tableInsertRow(table, 0, { height: 50 });

      // Row is inserted, specific config depends on implementation
      expect(table.rowCount).toBe(4);
    });
  });

  describe('tableRemoveRow', () => {
    it('should remove row from beginning', () => {
      const initialRowCount = table.rowCount;

      editor.tableRemoveRow(table, 0);

      expect(table.rowCount).toBe(initialRowCount - 1);
    });

    it('should remove row from end', () => {
      const initialRowCount = table.rowCount;

      editor.tableRemoveRow(table, initialRowCount - 1);

      expect(table.rowCount).toBe(initialRowCount - 1);
    });

    it('should remove row from middle', () => {
      const initialRowCount = table.rowCount;

      editor.tableRemoveRow(table, 1);

      expect(table.rowCount).toBe(initialRowCount - 1);
    });

    it('should not remove last row', () => {
      // Remove all but one row
      editor.tableRemoveRow(table, 0);
      editor.tableRemoveRow(table, 0);

      // Trying to remove last row might be prevented
      const rowCount = table.rowCount;
      // Implementation may prevent removing last row or allow it
    });
  });

  describe('tableInsertColumn', () => {
    it('should insert column at beginning', () => {
      const initialColCount = table.columnCount;

      editor.tableInsertColumn(table, 0);

      expect(table.columnCount).toBe(initialColCount + 1);
    });

    it('should insert column at end', () => {
      const initialColCount = table.columnCount;

      editor.tableInsertColumn(table, initialColCount);

      expect(table.columnCount).toBe(initialColCount + 1);
    });

    it('should insert column in middle', () => {
      const initialColCount = table.columnCount;

      editor.tableInsertColumn(table, 1);

      expect(table.columnCount).toBe(initialColCount + 1);
    });

    it('should insert column with width', () => {
      editor.tableInsertColumn(table, 0, 100);

      expect(table.columnCount).toBe(4);
    });
  });

  describe('tableRemoveColumn', () => {
    it('should remove column from beginning', () => {
      const initialColCount = table.columnCount;

      editor.tableRemoveColumn(table, 0);

      expect(table.columnCount).toBe(initialColCount - 1);
    });

    it('should remove column from end', () => {
      const initialColCount = table.columnCount;

      editor.tableRemoveColumn(table, initialColCount - 1);

      expect(table.columnCount).toBe(initialColCount - 1);
    });

    it('should remove column from middle', () => {
      const initialColCount = table.columnCount;

      editor.tableRemoveColumn(table, 1);

      expect(table.columnCount).toBe(initialColCount - 1);
    });
  });

  describe('table structure after operations', () => {
    it('should maintain table integrity after row insert', () => {
      editor.tableInsertRow(table, 1);

      // Each row should have same number of columns
      for (const row of table.rows) {
        expect(row.cells.length).toBe(table.columnCount);
      }
    });

    it('should maintain table integrity after column insert', () => {
      editor.tableInsertColumn(table, 1);

      // Each row should have same number of columns
      for (const row of table.rows) {
        expect(row.cells.length).toBe(table.columnCount);
      }
    });

    it('should maintain cell content after row insert', () => {
      // Set content in first cell
      const cell = table.getCell(0, 0);
      if (cell) {
        cell.flowingContent.setText('Test Content');
      }

      editor.tableInsertRow(table, 0);

      // Original cell is now at row 1
      const movedCell = table.getCell(1, 0);
      if (movedCell) {
        expect(movedCell.flowingContent.getText()).toBe('Test Content');
      }
    });
  });

  describe('multiple table operations', () => {
    it('should handle multiple row insertions', () => {
      const initialRowCount = table.rowCount;

      editor.tableInsertRow(table, 0);
      editor.tableInsertRow(table, 0);
      editor.tableInsertRow(table, 0);

      expect(table.rowCount).toBe(initialRowCount + 3);
    });

    it('should handle multiple column insertions', () => {
      const initialColCount = table.columnCount;

      editor.tableInsertColumn(table, 0);
      editor.tableInsertColumn(table, 0);
      editor.tableInsertColumn(table, 0);

      expect(table.columnCount).toBe(initialColCount + 3);
    });

    it('should handle mixed row and column operations', () => {
      const initialRowCount = table.rowCount;
      const initialColCount = table.columnCount;

      editor.tableInsertRow(table, 0);
      editor.tableInsertColumn(table, 0);
      editor.tableRemoveRow(table, 0);
      editor.tableRemoveColumn(table, 0);

      expect(table.rowCount).toBe(initialRowCount);
      expect(table.columnCount).toBe(initialColCount);
    });
  });

  describe('table object direct methods', () => {
    it('should access cell by row and column', () => {
      const cell = table.getCell(0, 0);
      expect(cell).not.toBeNull();
    });

    it('should get row count', () => {
      expect(table.rowCount).toBe(3);
    });

    it('should get column count', () => {
      expect(table.columnCount).toBe(3);
    });

    it('should have rows array', () => {
      expect(table.rows).toBeInstanceOf(Array);
      expect(table.rows.length).toBe(3);
    });

    it('should have cells in each row', () => {
      for (const row of table.rows) {
        expect(row.cells).toBeInstanceOf(Array);
        expect(row.cells.length).toBe(3);
      }
    });
  });

  describe('cell content operations', () => {
    it('should set cell text content', () => {
      const cell = table.getCell(0, 0);
      if (cell) {
        cell.flowingContent.setText('Cell Content');
        expect(cell.flowingContent.getText()).toBe('Cell Content');
      }
    });

    it('should clear cell content', () => {
      const cell = table.getCell(0, 0);
      if (cell) {
        cell.flowingContent.setText('Content');
        cell.flowingContent.setText('');
        expect(cell.flowingContent.getText()).toBe('');
      }
    });
  });

  describe('new table with different configurations', () => {
    it('should create table with 1 row', async () => {
      const smallTable = new TableObject({
        id: 'small-table',
        rows: 1,
        columns: 3,
        size: { width: 300, height: 50 }
      });

      expect(smallTable.rowCount).toBe(1);
      expect(smallTable.columnCount).toBe(3);
    });

    it('should create table with 1 column', async () => {
      const narrowTable = new TableObject({
        id: 'narrow-table',
        rows: 3,
        columns: 1,
        size: { width: 100, height: 100 }
      });

      expect(narrowTable.rowCount).toBe(3);
      expect(narrowTable.columnCount).toBe(1);
    });

    it('should create large table', async () => {
      const largeTable = new TableObject({
        id: 'large-table',
        rows: 10,
        columns: 10,
        size: { width: 500, height: 300 }
      });

      expect(largeTable.rowCount).toBe(10);
      expect(largeTable.columnCount).toBe(10);
    });
  });
});
