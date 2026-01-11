/**
 * Unit tests for HitTestManager
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HitTestManager } from '../../../lib/hit-test/HitTestManager';
import { HitTarget, HitTargetCategory, HIT_PRIORITY } from '../../../lib/hit-test/types';

describe('HitTestManager', () => {
  let manager: HitTestManager;

  // Helper to create a text region target
  function createTextTarget(
    pageIndex: number,
    bounds: { x: number; y: number; width: number; height: number },
    lineIndex: number = 0
  ): HitTarget {
    return {
      type: 'text-region',
      category: 'content',
      bounds,
      priority: HIT_PRIORITY.TEXT_REGION,
      data: {
        type: 'text-region',
        lineIndex,
        startIndex: 0,
        endIndex: 10
      }
    };
  }

  // Helper to create an embedded object target
  function createObjectTarget(
    pageIndex: number,
    bounds: { x: number; y: number; width: number; height: number },
    objectId: string = 'obj-1'
  ): HitTarget {
    return {
      type: 'embedded-object',
      category: 'content',
      bounds,
      priority: HIT_PRIORITY.EMBEDDED_OBJECT,
      data: {
        type: 'embedded-object',
        object: { id: objectId } as any
      }
    };
  }

  // Helper to create a resize handle target
  function createResizeHandleTarget(
    bounds: { x: number; y: number; width: number; height: number },
    handle: string = 'se'
  ): HitTarget {
    return {
      type: 'resize-handle',
      category: 'resize-handles',
      bounds,
      priority: HIT_PRIORITY.RESIZE_HANDLE,
      data: {
        type: 'resize-handle',
        handle: handle as any,
        element: { id: 'obj-1' } as any
      }
    };
  }

  // Helper to create a table divider target
  function createTableDividerTarget(
    bounds: { x: number; y: number; width: number; height: number },
    dividerType: 'row' | 'column' = 'column'
  ): HitTarget {
    return {
      type: 'table-divider',
      category: 'table-dividers',
      bounds,
      priority: HIT_PRIORITY.TABLE_DIVIDER,
      data: {
        type: 'table-divider',
        table: { id: 'table-1' } as any,
        dividerType,
        index: 0
      }
    };
  }

  beforeEach(() => {
    manager = new HitTestManager();
  });

  describe('constructor', () => {
    it('should create a HitTestManager instance', () => {
      expect(manager).toBeInstanceOf(HitTestManager);
    });

    it('should start with no targets', () => {
      expect(manager.getTotalTargetCount()).toBe(0);
      expect(manager.getPageIndices()).toEqual([]);
    });
  });

  describe('register()', () => {
    it('should register a target for a page', () => {
      const target = createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 });
      manager.register(0, target);

      expect(manager.getTotalTargetCount()).toBe(1);
      expect(manager.getTargetsForPage(0)).toHaveLength(1);
    });

    it('should register multiple targets for same page', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }, 0));
      manager.register(0, createTextTarget(0, { x: 0, y: 20, width: 100, height: 20 }, 1));
      manager.register(0, createTextTarget(0, { x: 0, y: 40, width: 100, height: 20 }, 2));

      expect(manager.getTotalTargetCount()).toBe(3);
      expect(manager.getTargetsForPage(0)).toHaveLength(3);
    });

    it('should register targets for multiple pages', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(1, createTextTarget(1, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(2, createTextTarget(2, { x: 0, y: 0, width: 100, height: 20 }));

      expect(manager.getTotalTargetCount()).toBe(3);
      expect(manager.getPageIndices()).toEqual([0, 1, 2]);
    });

    it('should handle non-sequential page indices', () => {
      manager.register(5, createTextTarget(5, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(2, createTextTarget(2, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(10, createTextTarget(10, { x: 0, y: 0, width: 100, height: 20 }));

      expect(manager.getPageIndices()).toEqual([2, 5, 10]);
    });
  });

  describe('clear()', () => {
    it('should remove all targets', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(1, createTextTarget(1, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(2, createTextTarget(2, { x: 0, y: 0, width: 100, height: 20 }));

      manager.clear();

      expect(manager.getTotalTargetCount()).toBe(0);
      expect(manager.getPageIndices()).toEqual([]);
    });

    it('should handle clearing empty manager', () => {
      expect(() => manager.clear()).not.toThrow();
      expect(manager.getTotalTargetCount()).toBe(0);
    });
  });

  describe('clearCategory()', () => {
    beforeEach(() => {
      // Register targets of different categories
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(0, createObjectTarget(0, { x: 100, y: 0, width: 50, height: 50 }));
      manager.register(0, createResizeHandleTarget({ x: 145, y: 45, width: 10, height: 10 }));
      manager.register(0, createTableDividerTarget({ x: 200, y: 0, width: 5, height: 100 }));
    });

    it('should clear only content category', () => {
      manager.clearCategory('content');

      const targets = manager.getTargetsForPage(0);
      expect(targets).toHaveLength(2); // resize-handles and table-dividers remain
      expect(targets.every(t => t.category !== 'content')).toBe(true);
    });

    it('should clear only resize-handles category', () => {
      manager.clearCategory('resize-handles');

      const targets = manager.getTargetsForPage(0);
      expect(targets).toHaveLength(3); // content and table-dividers remain
      expect(targets.every(t => t.category !== 'resize-handles')).toBe(true);
    });

    it('should clear only table-dividers category', () => {
      manager.clearCategory('table-dividers');

      const targets = manager.getTargetsForPage(0);
      expect(targets).toHaveLength(3); // content and resize-handles remain
      expect(targets.every(t => t.category !== 'table-dividers')).toBe(true);
    });

    it('should remove page entry if all targets cleared', () => {
      // Only have content targets on page 1
      manager.register(1, createTextTarget(1, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(1, createObjectTarget(1, { x: 100, y: 0, width: 50, height: 50 }));

      manager.clearCategory('content');

      expect(manager.getPageIndices()).not.toContain(1);
    });

    it('should work across multiple pages', () => {
      manager.register(1, createResizeHandleTarget({ x: 0, y: 0, width: 10, height: 10 }));
      manager.register(2, createResizeHandleTarget({ x: 0, y: 0, width: 10, height: 10 }));

      manager.clearCategory('resize-handles');

      expect(manager.getTargetsForPage(1)).toHaveLength(0);
      expect(manager.getTargetsForPage(2)).toHaveLength(0);
    });
  });

  describe('queryAtPoint()', () => {
    beforeEach(() => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(0, createObjectTarget(0, { x: 50, y: 5, width: 30, height: 15 }));
    });

    it('should return null for empty page', () => {
      const result = manager.queryAtPoint(5, { x: 50, y: 10 });
      expect(result).toBeNull();
    });

    it('should return null when point is outside all targets', () => {
      const result = manager.queryAtPoint(0, { x: 200, y: 200 });
      expect(result).toBeNull();
    });

    it('should return target when point is inside bounds', () => {
      const result = manager.queryAtPoint(0, { x: 10, y: 10 });
      expect(result).not.toBeNull();
      expect(result?.type).toBe('text-region');
    });

    it('should return higher priority target when overlapping', () => {
      // Point is inside both targets, but object has higher priority
      const result = manager.queryAtPoint(0, { x: 60, y: 10 });
      expect(result).not.toBeNull();
      expect(result?.type).toBe('embedded-object');
    });

    it('should handle point at edge of bounds', () => {
      const result = manager.queryAtPoint(0, { x: 0, y: 0 });
      expect(result).not.toBeNull();

      const resultEdge = manager.queryAtPoint(0, { x: 100, y: 20 });
      expect(resultEdge).not.toBeNull();
    });

    it('should return null for point just outside bounds', () => {
      const result = manager.queryAtPoint(0, { x: 101, y: 10 });
      expect(result).toBeNull();
    });
  });

  describe('queryAllAtPoint()', () => {
    beforeEach(() => {
      // Create overlapping targets with different priorities
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 50 }));
      manager.register(0, createObjectTarget(0, { x: 25, y: 10, width: 50, height: 30 }));
      manager.register(0, createResizeHandleTarget({ x: 40, y: 15, width: 10, height: 10 }));
    });

    it('should return empty array for empty page', () => {
      const result = manager.queryAllAtPoint(5, { x: 50, y: 25 });
      expect(result).toEqual([]);
    });

    it('should return empty array when no targets contain point', () => {
      const result = manager.queryAllAtPoint(0, { x: 200, y: 200 });
      expect(result).toEqual([]);
    });

    it('should return all targets containing point', () => {
      // Point inside all three targets
      const result = manager.queryAllAtPoint(0, { x: 45, y: 20 });
      expect(result).toHaveLength(3);
    });

    it('should sort by priority (highest first)', () => {
      const result = manager.queryAllAtPoint(0, { x: 45, y: 20 });

      expect(result[0].type).toBe('resize-handle'); // priority 100
      expect(result[1].type).toBe('embedded-object'); // priority 80
      expect(result[2].type).toBe('text-region'); // priority 50
    });

    it('should return only overlapping targets', () => {
      // Point inside text and object, but not resize handle
      const result = manager.queryAllAtPoint(0, { x: 30, y: 25 });
      expect(result).toHaveLength(2);
      expect(result.some(t => t.type === 'resize-handle')).toBe(false);
    });
  });

  describe('queryByType()', () => {
    beforeEach(() => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 50 }));
      manager.register(0, createObjectTarget(0, { x: 25, y: 10, width: 50, height: 30 }));
      manager.register(0, createResizeHandleTarget({ x: 40, y: 15, width: 10, height: 10 }));
    });

    it('should return null for empty page', () => {
      const result = manager.queryByType(5, { x: 50, y: 25 }, 'text-region');
      expect(result).toBeNull();
    });

    it('should return null when no target of type at point', () => {
      // Point is inside text region, but not the resize handle
      const result = manager.queryByType(0, { x: 10, y: 10 }, 'resize-handle');
      expect(result).toBeNull();
    });

    it('should return target of specified type', () => {
      const result = manager.queryByType(0, { x: 45, y: 20 }, 'text-region');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('text-region');
    });

    it('should return highest priority target of type when multiple match', () => {
      // Add another text target with higher priority
      const highPriorityText: HitTarget = {
        type: 'text-region',
        category: 'content',
        bounds: { x: 30, y: 15, width: 20, height: 10 },
        priority: HIT_PRIORITY.TEXT_REGION + 10, // Higher priority
        data: {
          type: 'text-region',
          lineIndex: 1,
          startIndex: 10,
          endIndex: 20
        }
      };
      manager.register(0, highPriorityText);

      const result = manager.queryByType(0, { x: 40, y: 20 }, 'text-region');
      expect(result?.priority).toBe(HIT_PRIORITY.TEXT_REGION + 10);
    });

    it('should ignore higher priority targets of different type', () => {
      // Point is inside all targets, but we want text-region
      const result = manager.queryByType(0, { x: 45, y: 20 }, 'text-region');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('text-region');
    });
  });

  describe('getTargetsForPage()', () => {
    it('should return empty array for non-existent page', () => {
      const result = manager.getTargetsForPage(99);
      expect(result).toEqual([]);
    });

    it('should return all targets for page', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(0, createTextTarget(0, { x: 0, y: 20, width: 100, height: 20 }));
      manager.register(1, createTextTarget(1, { x: 0, y: 0, width: 100, height: 20 }));

      expect(manager.getTargetsForPage(0)).toHaveLength(2);
      expect(manager.getTargetsForPage(1)).toHaveLength(1);
    });

    it('should return readonly array', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      const targets = manager.getTargetsForPage(0);

      // TypeScript readonly, but we can still check length
      expect(targets).toHaveLength(1);
    });
  });

  describe('getPageIndices()', () => {
    it('should return empty array when no targets', () => {
      expect(manager.getPageIndices()).toEqual([]);
    });

    it('should return sorted page indices', () => {
      manager.register(3, createTextTarget(3, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(1, createTextTarget(1, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(5, createTextTarget(5, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(2, createTextTarget(2, { x: 0, y: 0, width: 100, height: 20 }));

      expect(manager.getPageIndices()).toEqual([1, 2, 3, 5]);
    });
  });

  describe('getTotalTargetCount()', () => {
    it('should return 0 when empty', () => {
      expect(manager.getTotalTargetCount()).toBe(0);
    });

    it('should count targets across all pages', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(0, createTextTarget(0, { x: 0, y: 20, width: 100, height: 20 }));
      manager.register(1, createTextTarget(1, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(2, createTextTarget(2, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(2, createTextTarget(2, { x: 0, y: 20, width: 100, height: 20 }));

      expect(manager.getTotalTargetCount()).toBe(5);
    });

    it('should update after clear', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(1, createTextTarget(1, { x: 0, y: 0, width: 100, height: 20 }));

      expect(manager.getTotalTargetCount()).toBe(2);

      manager.clear();

      expect(manager.getTotalTargetCount()).toBe(0);
    });

    it('should update after clearCategory', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 20 }));
      manager.register(0, createResizeHandleTarget({ x: 0, y: 0, width: 10, height: 10 }));

      expect(manager.getTotalTargetCount()).toBe(2);

      manager.clearCategory('content');

      expect(manager.getTotalTargetCount()).toBe(1);
    });
  });

  describe('containsPoint (via queries)', () => {
    it('should include point on left edge', () => {
      manager.register(0, createTextTarget(0, { x: 10, y: 10, width: 80, height: 30 }));
      expect(manager.queryAtPoint(0, { x: 10, y: 25 })).not.toBeNull();
    });

    it('should include point on right edge', () => {
      manager.register(0, createTextTarget(0, { x: 10, y: 10, width: 80, height: 30 }));
      expect(manager.queryAtPoint(0, { x: 90, y: 25 })).not.toBeNull();
    });

    it('should include point on top edge', () => {
      manager.register(0, createTextTarget(0, { x: 10, y: 10, width: 80, height: 30 }));
      expect(manager.queryAtPoint(0, { x: 50, y: 10 })).not.toBeNull();
    });

    it('should include point on bottom edge', () => {
      manager.register(0, createTextTarget(0, { x: 10, y: 10, width: 80, height: 30 }));
      expect(manager.queryAtPoint(0, { x: 50, y: 40 })).not.toBeNull();
    });

    it('should include corner points', () => {
      manager.register(0, createTextTarget(0, { x: 10, y: 10, width: 80, height: 30 }));

      // Top-left
      expect(manager.queryAtPoint(0, { x: 10, y: 10 })).not.toBeNull();
      // Top-right
      expect(manager.queryAtPoint(0, { x: 90, y: 10 })).not.toBeNull();
      // Bottom-left
      expect(manager.queryAtPoint(0, { x: 10, y: 40 })).not.toBeNull();
      // Bottom-right
      expect(manager.queryAtPoint(0, { x: 90, y: 40 })).not.toBeNull();
    });

    it('should exclude point just outside', () => {
      manager.register(0, createTextTarget(0, { x: 10, y: 10, width: 80, height: 30 }));

      // Just before left edge
      expect(manager.queryAtPoint(0, { x: 9, y: 25 })).toBeNull();
      // Just after right edge
      expect(manager.queryAtPoint(0, { x: 91, y: 25 })).toBeNull();
      // Just above top edge
      expect(manager.queryAtPoint(0, { x: 50, y: 9 })).toBeNull();
      // Just below bottom edge
      expect(manager.queryAtPoint(0, { x: 50, y: 41 })).toBeNull();
    });
  });

  describe('priority ordering', () => {
    it('should respect HIT_PRIORITY constants', () => {
      // Verify priority ordering
      expect(HIT_PRIORITY.RESIZE_HANDLE).toBeGreaterThan(HIT_PRIORITY.TABLE_DIVIDER);
      expect(HIT_PRIORITY.TABLE_DIVIDER).toBeGreaterThan(HIT_PRIORITY.EMBEDDED_OBJECT);
      expect(HIT_PRIORITY.EMBEDDED_OBJECT).toBeGreaterThan(HIT_PRIORITY.TABLE_CELL);
      expect(HIT_PRIORITY.TABLE_CELL).toBeGreaterThan(HIT_PRIORITY.SUBSTITUTION_FIELD);
      expect(HIT_PRIORITY.SUBSTITUTION_FIELD).toBeGreaterThan(HIT_PRIORITY.TEXT_REGION);
    });

    it('should return resize handle over embedded object', () => {
      const overlapping = { x: 0, y: 0, width: 50, height: 50 };
      manager.register(0, createObjectTarget(0, overlapping));
      manager.register(0, createResizeHandleTarget(overlapping));

      const result = manager.queryAtPoint(0, { x: 25, y: 25 });
      expect(result?.type).toBe('resize-handle');
    });

    it('should return table divider over embedded object', () => {
      const overlapping = { x: 0, y: 0, width: 50, height: 50 };
      manager.register(0, createObjectTarget(0, overlapping));
      manager.register(0, createTableDividerTarget(overlapping));

      const result = manager.queryAtPoint(0, { x: 25, y: 25 });
      expect(result?.type).toBe('table-divider');
    });

    it('should return embedded object over text region', () => {
      const overlapping = { x: 0, y: 0, width: 50, height: 50 };
      manager.register(0, createTextTarget(0, overlapping));
      manager.register(0, createObjectTarget(0, overlapping));

      const result = manager.queryAtPoint(0, { x: 25, y: 25 });
      expect(result?.type).toBe('embedded-object');
    });
  });

  describe('table cell targets', () => {
    function createTableCellTarget(
      bounds: { x: number; y: number; width: number; height: number },
      row: number,
      col: number
    ): HitTarget {
      return {
        type: 'table-cell',
        category: 'content',
        bounds,
        priority: HIT_PRIORITY.TABLE_CELL,
        data: {
          type: 'table-cell',
          table: { id: 'table-1' } as any,
          row,
          col
        }
      };
    }

    it('should register and query table cell targets', () => {
      manager.register(0, createTableCellTarget({ x: 0, y: 0, width: 100, height: 50 }, 0, 0));
      manager.register(0, createTableCellTarget({ x: 100, y: 0, width: 100, height: 50 }, 0, 1));
      manager.register(0, createTableCellTarget({ x: 0, y: 50, width: 100, height: 50 }, 1, 0));
      manager.register(0, createTableCellTarget({ x: 100, y: 50, width: 100, height: 50 }, 1, 1));

      const result = manager.queryAtPoint(0, { x: 150, y: 75 });
      expect(result?.type).toBe('table-cell');
      expect((result?.data as any).row).toBe(1);
      expect((result?.data as any).col).toBe(1);
    });
  });

  describe('substitution field targets', () => {
    function createFieldTarget(
      bounds: { x: number; y: number; width: number; height: number },
      fieldId: string,
      textIndex: number
    ): HitTarget {
      return {
        type: 'substitution-field',
        category: 'content',
        bounds,
        priority: HIT_PRIORITY.SUBSTITUTION_FIELD,
        data: {
          type: 'substitution-field',
          fieldId,
          textIndex
        }
      };
    }

    it('should register and query substitution field targets', () => {
      manager.register(0, createFieldTarget({ x: 50, y: 10, width: 80, height: 20 }, 'field-1', 5));

      const result = manager.queryAtPoint(0, { x: 90, y: 20 });
      expect(result?.type).toBe('substitution-field');
      expect((result?.data as any).fieldId).toBe('field-1');
    });

    it('should have higher priority than text region', () => {
      const bounds = { x: 0, y: 0, width: 100, height: 30 };
      manager.register(0, createTextTarget(0, bounds));
      manager.register(0, createFieldTarget(bounds, 'field-1', 0));

      const result = manager.queryAtPoint(0, { x: 50, y: 15 });
      expect(result?.type).toBe('substitution-field');
    });
  });

  describe('multiple pages interaction', () => {
    it('should query correct page independently', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 50 }));
      manager.register(1, createObjectTarget(1, { x: 0, y: 0, width: 100, height: 50 }));

      const page0Result = manager.queryAtPoint(0, { x: 50, y: 25 });
      const page1Result = manager.queryAtPoint(1, { x: 50, y: 25 });

      expect(page0Result?.type).toBe('text-region');
      expect(page1Result?.type).toBe('embedded-object');
    });

    it('should clear pages independently via clearCategory', () => {
      manager.register(0, createTextTarget(0, { x: 0, y: 0, width: 100, height: 50 }));
      manager.register(0, createResizeHandleTarget({ x: 90, y: 40, width: 10, height: 10 }));
      manager.register(1, createTextTarget(1, { x: 0, y: 0, width: 100, height: 50 }));
      manager.register(1, createResizeHandleTarget({ x: 90, y: 40, width: 10, height: 10 }));

      manager.clearCategory('resize-handles');

      expect(manager.getTargetsForPage(0)).toHaveLength(1);
      expect(manager.getTargetsForPage(1)).toHaveLength(1);
    });
  });
});
