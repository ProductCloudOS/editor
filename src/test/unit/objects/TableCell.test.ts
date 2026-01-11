/**
 * Unit tests for TableCell
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TableCell } from '../../../lib/objects/table/TableCell';
import { DEFAULT_TABLE_STYLE } from '../../../lib/objects/table/types';

describe('TableCell', () => {
  let cell: TableCell;

  beforeEach(() => {
    cell = new TableCell({});
  });

  describe('constructor', () => {
    it('should create a TableCell with default values', () => {
      expect(cell).toBeInstanceOf(TableCell);
      expect(cell.rowSpan).toBe(1);
      expect(cell.colSpan).toBe(1);
      expect(cell.content).toBe('');
    });

    it('should create a TableCell with custom config', () => {
      const customCell = new TableCell({
        rowSpan: 2,
        colSpan: 3,
        content: 'Hello',
        backgroundColor: '#ff0000',
        verticalAlign: 'middle',
        fontFamily: 'Helvetica',
        fontSize: 16,
        color: '#0000ff'
      });

      expect(customCell.rowSpan).toBe(2);
      expect(customCell.colSpan).toBe(3);
      expect(customCell.content).toBe('Hello');
      expect(customCell.backgroundColor).toBe('#ff0000');
      expect(customCell.verticalAlign).toBe('middle');
      expect(customCell.fontFamily).toBe('Helvetica');
      expect(customCell.fontSize).toBe(16);
      expect(customCell.color).toBe('#0000ff');
    });

    it('should generate unique IDs', () => {
      const cell1 = new TableCell({});
      const cell2 = new TableCell({});
      expect(cell1.id).not.toBe(cell2.id);
    });

    it('should use provided ID', () => {
      const customCell = new TableCell({ id: 'my-cell-id' });
      expect(customCell.id).toBe('my-cell-id');
    });
  });

  describe('identity and structure', () => {
    it('should have type tablecell', () => {
      expect(cell.type).toBe('tablecell');
    });

    it('should get rowSpan', () => {
      expect(cell.rowSpan).toBe(1);
    });

    it('should set rowSpan', () => {
      cell.rowSpan = 3;
      expect(cell.rowSpan).toBe(3);
    });

    it('should emit span-changed when rowSpan changes', () => {
      const handler = vi.fn();
      cell.on('span-changed', handler);

      cell.rowSpan = 2;

      expect(handler).toHaveBeenCalledWith({
        cellId: cell.id,
        rowSpan: 2,
        colSpan: 1
      });
    });

    it('should not emit if rowSpan is unchanged', () => {
      const handler = vi.fn();
      cell.on('span-changed', handler);

      cell.rowSpan = 1;

      expect(handler).not.toHaveBeenCalled();
    });

    it('should ignore invalid rowSpan values', () => {
      cell.rowSpan = 0;
      expect(cell.rowSpan).toBe(1);

      cell.rowSpan = -1;
      expect(cell.rowSpan).toBe(1);
    });

    it('should get colSpan', () => {
      expect(cell.colSpan).toBe(1);
    });

    it('should set colSpan', () => {
      cell.colSpan = 4;
      expect(cell.colSpan).toBe(4);
    });

    it('should emit span-changed when colSpan changes', () => {
      const handler = vi.fn();
      cell.on('span-changed', handler);

      cell.colSpan = 3;

      expect(handler).toHaveBeenCalledWith({
        cellId: cell.id,
        rowSpan: 1,
        colSpan: 3
      });
    });
  });

  describe('styling', () => {
    it('should get default backgroundColor', () => {
      expect(cell.backgroundColor).toBe(DEFAULT_TABLE_STYLE.backgroundColor);
    });

    it('should set backgroundColor', () => {
      cell.backgroundColor = '#00ff00';
      expect(cell.backgroundColor).toBe('#00ff00');
    });

    it('should emit style-changed when backgroundColor changes', () => {
      const handler = vi.fn();
      cell.on('style-changed', handler);

      cell.backgroundColor = '#ff00ff';

      expect(handler).toHaveBeenCalledWith({
        cellId: cell.id,
        backgroundColor: '#ff00ff'
      });
    });

    it('should get border', () => {
      const border = cell.border;
      expect(border).toBeDefined();
      expect(border.top).toBeDefined();
      expect(border.right).toBeDefined();
      expect(border.bottom).toBeDefined();
      expect(border.left).toBeDefined();
    });

    it('should set border', () => {
      const newBorder = {
        top: { width: 2, color: '#000', style: 'solid' as const },
        right: { width: 2, color: '#000', style: 'solid' as const },
        bottom: { width: 2, color: '#000', style: 'solid' as const },
        left: { width: 2, color: '#000', style: 'solid' as const }
      };
      cell.border = newBorder;
      expect(cell.border.top.width).toBe(2);
    });

    it('should get padding', () => {
      const padding = cell.padding;
      expect(padding).toBeDefined();
      expect(typeof padding.top).toBe('number');
      expect(typeof padding.right).toBe('number');
      expect(typeof padding.bottom).toBe('number');
      expect(typeof padding.left).toBe('number');
    });

    it('should set padding', () => {
      const newPadding = { top: 10, right: 10, bottom: 10, left: 10 };
      cell.padding = newPadding;
      expect(cell.padding.top).toBe(10);
    });

    it('should get default verticalAlign', () => {
      expect(cell.verticalAlign).toBe('top');
    });

    it('should set verticalAlign', () => {
      cell.verticalAlign = 'middle';
      expect(cell.verticalAlign).toBe('middle');

      cell.verticalAlign = 'bottom';
      expect(cell.verticalAlign).toBe('bottom');
    });

    it('should emit style-changed when verticalAlign changes', () => {
      const handler = vi.fn();
      cell.on('style-changed', handler);

      cell.verticalAlign = 'middle';

      expect(handler).toHaveBeenCalledWith({
        cellId: cell.id,
        verticalAlign: 'middle'
      });
    });
  });

  describe('text styling', () => {
    it('should get default fontFamily', () => {
      expect(cell.fontFamily).toBe(DEFAULT_TABLE_STYLE.fontFamily);
    });

    it('should set fontFamily', () => {
      cell.fontFamily = 'Georgia';
      expect(cell.fontFamily).toBe('Georgia');
    });

    it('should emit style-changed when fontFamily changes', () => {
      const handler = vi.fn();
      cell.on('style-changed', handler);

      cell.fontFamily = 'Times';

      expect(handler).toHaveBeenCalledWith({
        cellId: cell.id,
        fontFamily: 'Times'
      });
    });

    it('should get default fontSize', () => {
      expect(cell.fontSize).toBe(DEFAULT_TABLE_STYLE.fontSize);
    });

    it('should set fontSize', () => {
      cell.fontSize = 18;
      expect(cell.fontSize).toBe(18);
    });

    it('should get default color', () => {
      expect(cell.color).toBe(DEFAULT_TABLE_STYLE.color);
    });

    it('should set color', () => {
      cell.color = '#ff0000';
      expect(cell.color).toBe('#ff0000');
    });
  });

  describe('content', () => {
    it('should get flowingContent', () => {
      expect(cell.flowingContent).toBeDefined();
    });

    it('should get content', () => {
      expect(cell.content).toBe('');
    });

    it('should set content', () => {
      cell.content = 'Hello World';
      expect(cell.content).toBe('Hello World');
    });

    it('should emit content-changed when content changes', () => {
      const handler = vi.fn();
      cell.on('content-changed', handler);

      cell.content = 'New content';

      expect(handler).toHaveBeenCalledWith({ cellId: cell.id });
    });

    it('should prevent embedded objects', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      cell.flowingContent.insertEmbeddedObject({
        id: 'obj-1',
        type: 'image',
        size: { width: 100, height: 100 }
      } as any);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('layout', () => {
    it('should get null bounds initially', () => {
      expect(cell.getBounds()).toBeNull();
    });

    it('should set and get bounds', () => {
      cell.setBounds({ x: 10, y: 20, width: 100, height: 50 });
      expect(cell.getBounds()).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('should get null renderedPosition initially', () => {
      expect(cell.getRenderedPosition()).toBeNull();
    });

    it('should set and get renderedPosition', () => {
      cell.setRenderedPosition({ x: 100, y: 200 });
      expect(cell.getRenderedPosition()).toEqual({ x: 100, y: 200 });
    });

    it('should get default renderedPageIndex', () => {
      expect(cell.renderedPageIndex).toBe(0);
    });

    it('should set renderedPageIndex', () => {
      cell.renderedPageIndex = 2;
      expect(cell.renderedPageIndex).toBe(2);
    });

    it('should return null contentBounds without bounds', () => {
      expect(cell.getContentBounds()).toBeNull();
    });

    it('should calculate contentBounds with bounds', () => {
      cell.setBounds({ x: 0, y: 0, width: 100, height: 50 });
      const contentBounds = cell.getContentBounds();

      expect(contentBounds).not.toBeNull();
      expect(contentBounds!.width).toBeLessThan(100);
      expect(contentBounds!.height).toBeLessThan(50);
    });

    it('should return 0 availableWidth without bounds', () => {
      expect(cell.getAvailableWidth()).toBe(0);
    });

    it('should calculate availableWidth with bounds', () => {
      cell.setBounds({ x: 0, y: 0, width: 200, height: 100 });
      const width = cell.getAvailableWidth();

      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThan(200);
    });
  });

  describe('EditableTextRegion implementation', () => {
    beforeEach(() => {
      cell.setBounds({ x: 0, y: 0, width: 100, height: 50 });
      cell.setRenderedPosition({ x: 50, y: 100 });
    });

    it('should return null regionBounds without position', () => {
      const emptyCell = new TableCell({});
      expect(emptyCell.getRegionBounds(0)).toBeNull();
    });

    it('should return regionBounds with position', () => {
      const bounds = cell.getRegionBounds(0);
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThan(50);
      expect(bounds!.y).toBeGreaterThan(100);
    });

    it('should convert globalToLocal', () => {
      const bounds = cell.getRegionBounds(0)!;
      const local = cell.globalToLocal(
        { x: bounds.x + 10, y: bounds.y + 10 },
        0
      );

      expect(local).not.toBeNull();
      expect(local!.x).toBe(10);
      expect(local!.y).toBe(10);
    });

    it('should return null for globalToLocal outside bounds', () => {
      const local = cell.globalToLocal({ x: 0, y: 0 }, 0);
      expect(local).toBeNull();
    });

    it('should convert localToGlobal', () => {
      const bounds = cell.getRegionBounds(0)!;
      const global = cell.localToGlobal({ x: 10, y: 10 }, 0);

      expect(global.x).toBe(bounds.x + 10);
      expect(global.y).toBe(bounds.y + 10);
    });

    it('should not span multiple pages', () => {
      expect(cell.spansMultiplePages()).toBe(false);
    });

    it('should have page count of 1', () => {
      expect(cell.getPageCount()).toBe(1);
    });

    it('should check containsPointInRegion', () => {
      const bounds = cell.getRegionBounds(0)!;

      // Inside
      expect(cell.containsPointInRegion(
        { x: bounds.x + 5, y: bounds.y + 5 },
        0
      )).toBe(true);

      // Outside
      expect(cell.containsPointInRegion(
        { x: 0, y: 0 },
        0
      )).toBe(false);
    });
  });

  describe('Focusable implementation', () => {
    it('should get editing state', () => {
      expect(cell.editing).toBe(false);
    });

    it('should set editing state', () => {
      cell.editing = true;
      expect(cell.editing).toBe(true);
    });

    it('should emit editing-changed', () => {
      const handler = vi.fn();
      cell.on('editing-changed', handler);

      cell.editing = true;

      expect(handler).toHaveBeenCalledWith({
        cellId: cell.id,
        editing: true
      });
    });

    it('should focus cell', () => {
      cell.focus();
      expect(cell.editing).toBe(true);
    });

    it('should blur cell', () => {
      cell.editing = true;
      cell.blur();
      expect(cell.editing).toBe(false);
    });

    it('should handle hasFocus', () => {
      expect(cell.hasFocus()).toBe(false);

      cell.focus();
      expect(cell.hasFocus()).toBe(true);
    });

    it('should not handle keyDown when not editing', () => {
      const event = new KeyboardEvent('keydown', { key: 'a' });
      expect(cell.handleKeyDown(event)).toBe(false);
    });

    it('should not handle Tab key', () => {
      cell.editing = true;
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      expect(cell.handleKeyDown(event)).toBe(false);
    });
  });

  describe('reflow', () => {
    it('should mark reflow dirty', () => {
      cell.markReflowDirty();
      // Internal state changed - verify by checking flowed lines after content
      cell.content = 'Test';
      expect(cell.getFlowedLines(0)).toEqual([]);
    });

    it('should return empty flowed lines without bounds', () => {
      cell.content = 'Test content';
      expect(cell.getFlowedLines(0)).toEqual([]);
    });

    it('should return empty flowed pages initially', () => {
      expect(cell.getFlowedPages()).toEqual([]);
    });
  });

  describe('serialization', () => {
    it('should serialize to data', () => {
      cell.content = 'Test content';
      cell.backgroundColor = '#ff0000';
      cell.rowSpan = 2;
      cell.colSpan = 3;

      const data = cell.toData();

      expect(data.id).toBe(cell.id);
      expect(data.content).toBe('Test content');
      expect(data.backgroundColor).toBe('#ff0000');
      expect(data.rowSpan).toBe(2);
      expect(data.colSpan).toBe(3);
    });

    it('should deserialize from data', () => {
      const data = {
        id: 'test-cell',
        content: 'Hello',
        backgroundColor: '#00ff00',
        rowSpan: 2,
        colSpan: 2,
        verticalAlign: 'middle' as const,
        fontFamily: 'Georgia',
        fontSize: 16,
        color: '#0000ff'
      };

      const restored = TableCell.fromData(data);

      expect(restored.id).toBe('test-cell');
      expect(restored.content).toBe('Hello');
      expect(restored.backgroundColor).toBe('#00ff00');
      expect(restored.rowSpan).toBe(2);
      expect(restored.colSpan).toBe(2);
      expect(restored.verticalAlign).toBe('middle');
      expect(restored.fontFamily).toBe('Georgia');
      expect(restored.fontSize).toBe(16);
      expect(restored.color).toBe('#0000ff');
    });

    it('should clone cell', () => {
      cell.content = 'Original';
      cell.backgroundColor = '#123456';

      const cloned = cell.clone();

      expect(cloned.id).toBe(cell.id);
      expect(cloned.content).toBe('Original');
      expect(cloned.backgroundColor).toBe('#123456');

      // Should be independent
      cloned.content = 'Modified';
      expect(cell.content).toBe('Original');
    });

    it('should serialize and restore formatting runs', () => {
      cell.content = 'Hello';
      cell.flowingContent.applyFormatting(0, 2, { bold: true });

      const data = cell.toData();
      expect(data.formattingRuns).toBeDefined();

      const restored = TableCell.fromData(data);
      const formatting = restored.flowingContent.getFormattingManager().getAllFormatting();
      expect(formatting.size).toBeGreaterThan(0);
    });
  });

  describe('cursor events', () => {
    it('should forward cursor-moved event', () => {
      const handler = vi.fn();
      cell.on('cursor-moved', handler);

      cell.flowingContent.emit('cursor-moved', {});

      expect(handler).toHaveBeenCalledWith({ cellId: cell.id });
    });

    it('should register cursor blink handler', () => {
      const handler = vi.fn();
      cell.onCursorBlink(handler);

      // Handler registered - verify it can be unregistered
      expect(() => cell.offCursorBlink(handler)).not.toThrow();
    });
  });
});
