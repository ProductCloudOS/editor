/**
 * Unit tests for TableRow
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TableRow } from '../../../lib/objects/table/TableRow';
import { TableCell } from '../../../lib/objects/table/TableCell';
import { DEFAULT_TABLE_STYLE } from '../../../lib/objects/table/types';

describe('TableRow', () => {
  let row: TableRow;

  beforeEach(() => {
    row = new TableRow({}, 3);
  });

  describe('constructor', () => {
    it('should create a TableRow with default values', () => {
      expect(row).toBeInstanceOf(TableRow);
      expect(row.cellCount).toBe(3);
      expect(row.height).toBeNull();
      expect(row.isHeader).toBe(false);
    });

    it('should create cells for each column', () => {
      const row5 = new TableRow({}, 5);
      expect(row5.cellCount).toBe(5);
      expect(row5.cells).toHaveLength(5);
    });

    it('should create a TableRow with custom config', () => {
      const customRow = new TableRow({
        height: 50,
        minHeight: 30,
        isHeader: true
      }, 2);

      expect(customRow.height).toBe(50);
      expect(customRow.minHeight).toBe(30);
      expect(customRow.isHeader).toBe(true);
    });

    it('should generate unique IDs', () => {
      const row1 = new TableRow({}, 2);
      const row2 = new TableRow({}, 2);
      expect(row1.id).not.toBe(row2.id);
    });

    it('should use provided ID', () => {
      const customRow = new TableRow({ id: 'my-row-id' }, 2);
      expect(customRow.id).toBe('my-row-id');
    });

    it('should use provided cell configs', () => {
      const rowWithCells = new TableRow({
        cells: [
          { content: 'Cell 1', backgroundColor: '#ff0000' },
          { content: 'Cell 2', backgroundColor: '#00ff00' }
        ]
      }, 2);

      expect(rowWithCells.getCell(0)?.content).toBe('Cell 1');
      expect(rowWithCells.getCell(0)?.backgroundColor).toBe('#ff0000');
      expect(rowWithCells.getCell(1)?.content).toBe('Cell 2');
    });

    it('should apply default cell config', () => {
      const rowWithDefaults = new TableRow({}, 2, {
        fontFamily: 'Georgia',
        fontSize: 16
      });

      expect(rowWithDefaults.getCell(0)?.fontFamily).toBe('Georgia');
      expect(rowWithDefaults.getCell(0)?.fontSize).toBe(16);
    });

    it('should merge default cell config with provided cells', () => {
      const rowWithMerged = new TableRow({
        cells: [{ content: 'Test' }]
      }, 2, {
        fontFamily: 'Georgia'
      });

      expect(rowWithMerged.getCell(0)?.fontFamily).toBe('Georgia');
      expect(rowWithMerged.getCell(0)?.content).toBe('Test');
    });
  });

  describe('accessors', () => {
    it('should get id', () => {
      expect(typeof row.id).toBe('string');
      expect(row.id.length).toBeGreaterThan(0);
    });

    it('should get cells array', () => {
      expect(Array.isArray(row.cells)).toBe(true);
      expect(row.cells).toHaveLength(3);
      expect(row.cells[0]).toBeInstanceOf(TableCell);
    });

    it('should get cellCount', () => {
      expect(row.cellCount).toBe(3);
    });

    it('should get default height as null', () => {
      expect(row.height).toBeNull();
    });

    it('should set and get height', () => {
      row.height = 60;
      expect(row.height).toBe(60);
    });

    it('should emit height-changed when height changes', () => {
      const handler = vi.fn();
      row.on('height-changed', handler);

      row.height = 80;

      expect(handler).toHaveBeenCalledWith({
        rowId: row.id,
        height: 80
      });
    });

    it('should not emit if height unchanged', () => {
      row.height = 50;
      const handler = vi.fn();
      row.on('height-changed', handler);

      row.height = 50;

      expect(handler).not.toHaveBeenCalled();
    });

    it('should get default minHeight', () => {
      expect(row.minHeight).toBe(DEFAULT_TABLE_STYLE.minRowHeight);
    });

    it('should set and get minHeight', () => {
      row.minHeight = 40;
      expect(row.minHeight).toBe(40);
    });

    it('should emit min-height-changed when minHeight changes', () => {
      const handler = vi.fn();
      row.on('min-height-changed', handler);

      row.minHeight = 35;

      expect(handler).toHaveBeenCalledWith({
        rowId: row.id,
        minHeight: 35
      });
    });

    it('should get default isHeader', () => {
      expect(row.isHeader).toBe(false);
    });

    it('should set and get isHeader', () => {
      row.isHeader = true;
      expect(row.isHeader).toBe(true);
    });

    it('should emit header-changed when isHeader changes', () => {
      const handler = vi.fn();
      row.on('header-changed', handler);

      row.isHeader = true;

      expect(handler).toHaveBeenCalledWith({
        rowId: row.id,
        isHeader: true
      });
    });

    it('should get calculatedHeight', () => {
      expect(row.calculatedHeight).toBe(0);
    });
  });

  describe('cell operations', () => {
    describe('getCell()', () => {
      it('should get cell by index', () => {
        const cell = row.getCell(0);
        expect(cell).toBeInstanceOf(TableCell);
      });

      it('should return null for negative index', () => {
        expect(row.getCell(-1)).toBeNull();
      });

      it('should return null for out of bounds index', () => {
        expect(row.getCell(10)).toBeNull();
      });

      it('should get last cell', () => {
        const cell = row.getCell(2);
        expect(cell).toBeInstanceOf(TableCell);
      });
    });

    describe('addCell()', () => {
      it('should add cell at end', () => {
        const cell = new TableCell({ content: 'New' });
        row.addCell(cell);

        expect(row.cellCount).toBe(4);
        expect(row.getCell(3)?.content).toBe('New');
      });

      it('should add cell at specific index', () => {
        const cell = new TableCell({ content: 'Inserted' });
        row.addCell(cell, 1);

        expect(row.cellCount).toBe(4);
        expect(row.getCell(1)?.content).toBe('Inserted');
      });

      it('should emit cell-added event', () => {
        const handler = vi.fn();
        row.on('cell-added', handler);

        const cell = new TableCell({});
        row.addCell(cell, 1);

        expect(handler).toHaveBeenCalledWith({
          rowId: row.id,
          cellId: cell.id,
          index: 1
        });
      });

      it('should setup cell listeners', () => {
        const cell = new TableCell({});
        row.addCell(cell);

        const handler = vi.fn();
        row.on('cell-content-changed', handler);

        cell.content = 'Changed';

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('removeCell()', () => {
      it('should remove cell at index', () => {
        const removed = row.removeCell(1);

        expect(removed).toBeInstanceOf(TableCell);
        expect(row.cellCount).toBe(2);
      });

      it('should return null for invalid index', () => {
        expect(row.removeCell(-1)).toBeNull();
        expect(row.removeCell(10)).toBeNull();
        expect(row.cellCount).toBe(3);
      });

      it('should emit cell-removed event', () => {
        const handler = vi.fn();
        row.on('cell-removed', handler);

        const cellId = row.getCell(1)!.id;
        row.removeCell(1);

        expect(handler).toHaveBeenCalledWith({
          rowId: row.id,
          cellId,
          index: 1
        });
      });
    });

    describe('insertCell()', () => {
      it('should insert cell at index', () => {
        const cell = row.insertCell(1, { content: 'New' });

        expect(row.cellCount).toBe(4);
        expect(row.getCell(1)).toBe(cell);
        expect(cell.content).toBe('New');
      });

      it('should clamp negative index to 0', () => {
        const cell = row.insertCell(-5, { content: 'First' });

        expect(row.getCell(0)).toBe(cell);
      });

      it('should clamp out of bounds index to end', () => {
        const cell = row.insertCell(100, { content: 'Last' });

        expect(row.getCell(row.cellCount - 1)).toBe(cell);
      });

      it('should emit cell-added event', () => {
        const handler = vi.fn();
        row.on('cell-added', handler);

        const cell = row.insertCell(1);

        expect(handler).toHaveBeenCalledWith({
          rowId: row.id,
          cellId: cell.id,
          index: 1
        });
      });

      it('should create empty cell if no config provided', () => {
        const cell = row.insertCell(0);
        expect(cell.content).toBe('');
      });
    });
  });

  describe('cell event forwarding', () => {
    it('should forward cell-content-changed', () => {
      const handler = vi.fn();
      row.on('cell-content-changed', handler);

      row.getCell(0)!.content = 'New content';

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          rowId: row.id,
          cellId: row.getCell(0)!.id
        })
      );
    });

    it('should forward cell-style-changed', () => {
      const handler = vi.fn();
      row.on('cell-style-changed', handler);

      row.getCell(0)!.backgroundColor = '#ff0000';

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          rowId: row.id,
          cellId: row.getCell(0)!.id
        })
      );
    });

    it('should forward cell-span-changed', () => {
      const handler = vi.fn();
      row.on('cell-span-changed', handler);

      row.getCell(0)!.colSpan = 2;

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          rowId: row.id,
          cellId: row.getCell(0)!.id
        })
      );
    });

    it('should forward cell-editing-changed', () => {
      const handler = vi.fn();
      row.on('cell-editing-changed', handler);

      row.getCell(0)!.editing = true;

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          rowId: row.id,
          cellId: row.getCell(0)!.id,
          editing: true
        })
      );
    });
  });

  describe('layout', () => {
    describe('setCellBounds()', () => {
      it('should set bounds for all cells', () => {
        const rowY = 100;
        const columnPositions = [0, 100, 200];
        const columnWidths = [100, 100, 100];
        const height = 50;

        row.setCellBounds(rowY, columnPositions, columnWidths, height);

        expect(row.getCell(0)?.getBounds()).toEqual({
          x: 0,
          y: 100,
          width: 100,
          height: 50
        });

        expect(row.getCell(1)?.getBounds()).toEqual({
          x: 100,
          y: 100,
          width: 100,
          height: 50
        });

        expect(row.getCell(2)?.getBounds()).toEqual({
          x: 200,
          y: 100,
          width: 100,
          height: 50
        });
      });

      it('should use default width for missing columns', () => {
        row.setCellBounds(0, [0], [100], 50);

        // First cell gets explicit values
        expect(row.getCell(0)?.getBounds()?.width).toBe(100);

        // Other cells get defaults
        expect(row.getCell(1)?.getBounds()?.width).toBe(DEFAULT_TABLE_STYLE.defaultColumnWidth);
      });
    });
  });

  describe('serialization', () => {
    it('should serialize to data', () => {
      row.height = 60;
      row.minHeight = 40;
      row.isHeader = true;
      row.getCell(0)!.content = 'Cell content';

      const data = row.toData();

      expect(data.id).toBe(row.id);
      expect(data.height).toBe(60);
      expect(data.minHeight).toBe(40);
      expect(data.isHeader).toBe(true);
      expect(data.cells).toHaveLength(3);
      expect(data.cells[0].content).toBe('Cell content');
    });

    it('should deserialize from data', () => {
      const data = {
        id: 'test-row',
        height: 70,
        minHeight: 35,
        isHeader: true,
        cells: [
          { id: 'cell-1', content: 'A' },
          { id: 'cell-2', content: 'B' }
        ]
      };

      const restored = TableRow.fromData(data as any);

      expect(restored.id).toBe('test-row');
      expect(restored.height).toBe(70);
      expect(restored.minHeight).toBe(35);
      expect(restored.isHeader).toBe(true);
      expect(restored.cellCount).toBe(2);
      expect(restored.getCell(0)?.content).toBe('A');
      expect(restored.getCell(1)?.content).toBe('B');
    });

    it('should setup cell listeners after fromData', () => {
      const data = row.toData();
      const restored = TableRow.fromData(data);

      const handler = vi.fn();
      restored.on('cell-content-changed', handler);

      restored.getCell(0)!.content = 'Modified';

      expect(handler).toHaveBeenCalled();
    });

    it('should clone row', () => {
      row.height = 55;
      row.getCell(0)!.content = 'Original';

      const cloned = row.clone();

      expect(cloned.id).toBe(row.id);
      expect(cloned.height).toBe(55);
      expect(cloned.getCell(0)?.content).toBe('Original');

      // Should be independent
      cloned.getCell(0)!.content = 'Modified';
      expect(row.getCell(0)?.content).toBe('Original');
    });
  });

  describe('header rows', () => {
    it('should create header row', () => {
      const headerRow = new TableRow({ isHeader: true }, 3);
      expect(headerRow.isHeader).toBe(true);
    });

    it('should toggle header status', () => {
      expect(row.isHeader).toBe(false);

      row.isHeader = true;
      expect(row.isHeader).toBe(true);

      row.isHeader = false;
      expect(row.isHeader).toBe(false);
    });
  });

  describe('explicit height', () => {
    it('should use null for auto height', () => {
      expect(row.height).toBeNull();
    });

    it('should set explicit height', () => {
      row.height = 100;
      expect(row.height).toBe(100);
    });

    it('should reset to auto height', () => {
      row.height = 100;
      row.height = null;
      expect(row.height).toBeNull();
    });
  });
});
