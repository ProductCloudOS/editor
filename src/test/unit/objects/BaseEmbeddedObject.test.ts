/**
 * Unit tests for BaseEmbeddedObject
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseEmbeddedObject } from '../../../lib/objects/BaseEmbeddedObject';
import { EmbeddedObjectData, EmbeddedObjectConfig } from '../../../lib/objects/types';

// Concrete implementation for testing abstract class
class TestEmbeddedObject extends BaseEmbeddedObject {
  constructor(config: EmbeddedObjectConfig) {
    super(config);
  }

  get objectType(): string {
    return 'test';
  }

  render(_ctx: CanvasRenderingContext2D): void {
    // Mock render
  }

  toData(): EmbeddedObjectData {
    return {
      id: this._id,
      objectType: this.objectType,
      textIndex: this._textIndex,
      position: this._position,
      size: { ...this._size },
      data: {}
    };
  }

  clone(): BaseEmbeddedObject {
    return new TestEmbeddedObject({
      id: this._id + '-clone',
      textIndex: this._textIndex,
      position: this._position,
      size: { ...this._size }
    });
  }
}

describe('BaseEmbeddedObject', () => {
  let obj: TestEmbeddedObject;

  beforeEach(() => {
    obj = new TestEmbeddedObject({
      id: 'test-obj',
      textIndex: 5,
      position: 'inline',
      size: { width: 100, height: 50 }
    });
  });

  describe('constructor', () => {
    it('should initialize with required properties', () => {
      expect(obj.id).toBe('test-obj');
      expect(obj.textIndex).toBe(5);
      expect(obj.position).toBe('inline');
      expect(obj.size).toEqual({ width: 100, height: 50 });
    });

    it('should default position to inline', () => {
      const obj2 = new TestEmbeddedObject({
        id: 'obj2',
        textIndex: 0,
        size: { width: 50, height: 25 }
      });
      expect(obj2.position).toBe('inline');
    });

    it('should accept relative offset', () => {
      const obj2 = new TestEmbeddedObject({
        id: 'obj2',
        textIndex: 0,
        size: { width: 50, height: 25 },
        relativeOffset: { x: 10, y: 20 }
      });
      expect(obj2.relativeOffset).toEqual({ x: 10, y: 20 });
    });

    it('should default relative offset to 0,0', () => {
      expect(obj.relativeOffset).toEqual({ x: 0, y: 0 });
    });
  });

  describe('id', () => {
    it('should return the object id', () => {
      expect(obj.id).toBe('test-obj');
    });
  });

  describe('textIndex', () => {
    it('should get text index', () => {
      expect(obj.textIndex).toBe(5);
    });

    it('should set text index', () => {
      obj.textIndex = 10;
      expect(obj.textIndex).toBe(10);
    });

    it('should emit text-index-changed event', () => {
      const handler = vi.fn();
      obj.on('text-index-changed', handler);

      obj.textIndex = 15;

      expect(handler).toHaveBeenCalledWith({ textIndex: 15 });
    });
  });

  describe('position', () => {
    it('should get position', () => {
      expect(obj.position).toBe('inline');
    });

    it('should set position', () => {
      obj.position = 'block';
      expect(obj.position).toBe('block');
    });

    it('should emit position-changed event', () => {
      const handler = vi.fn();
      obj.on('position-changed', handler);

      obj.position = 'relative';

      expect(handler).toHaveBeenCalledWith({ position: 'relative' });
    });
  });

  describe('relativeOffset', () => {
    it('should get relative offset', () => {
      expect(obj.relativeOffset).toEqual({ x: 0, y: 0 });
    });

    it('should return a copy', () => {
      const offset1 = obj.relativeOffset;
      const offset2 = obj.relativeOffset;
      expect(offset1).toEqual(offset2);
      expect(offset1).not.toBe(offset2);
    });

    it('should set relative offset', () => {
      obj.relativeOffset = { x: 25, y: 50 };
      expect(obj.relativeOffset).toEqual({ x: 25, y: 50 });
    });

    it('should emit offset-changed event', () => {
      const handler = vi.fn();
      obj.on('offset-changed', handler);

      obj.relativeOffset = { x: 10, y: 20 };

      expect(handler).toHaveBeenCalledWith({ offset: { x: 10, y: 20 } });
    });
  });

  describe('size', () => {
    it('should get size', () => {
      expect(obj.size).toEqual({ width: 100, height: 50 });
    });

    it('should return a copy', () => {
      const size1 = obj.size;
      const size2 = obj.size;
      expect(size1).toEqual(size2);
      expect(size1).not.toBe(size2);
    });

    it('should set size', () => {
      obj.size = { width: 200, height: 100 };
      expect(obj.size).toEqual({ width: 200, height: 100 });
    });

    it('should emit size-changed event', () => {
      const handler = vi.fn();
      obj.on('size-changed', handler);

      obj.size = { width: 150, height: 75 };

      expect(handler).toHaveBeenCalledWith({ size: { width: 150, height: 75 } });
    });
  });

  describe('width', () => {
    it('should get width', () => {
      expect(obj.width).toBe(100);
    });

    it('should set width', () => {
      obj.width = 200;
      expect(obj.width).toBe(200);
    });

    it('should emit size-changed event', () => {
      const handler = vi.fn();
      obj.on('size-changed', handler);

      obj.width = 150;

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('height', () => {
    it('should get height', () => {
      expect(obj.height).toBe(50);
    });

    it('should set height', () => {
      obj.height = 100;
      expect(obj.height).toBe(100);
    });

    it('should emit size-changed event', () => {
      const handler = vi.fn();
      obj.on('size-changed', handler);

      obj.height = 75;

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('selected', () => {
    it('should default to false', () => {
      expect(obj.selected).toBe(false);
    });

    it('should set selected', () => {
      obj.selected = true;
      expect(obj.selected).toBe(true);
    });

    it('should emit selection-changed event on change', () => {
      const handler = vi.fn();
      obj.on('selection-changed', handler);

      obj.selected = true;

      expect(handler).toHaveBeenCalledWith({ selected: true });
    });

    it('should not emit event if value unchanged', () => {
      obj.selected = false;

      const handler = vi.fn();
      obj.on('selection-changed', handler);

      obj.selected = false;

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('locked', () => {
    it('should default to false', () => {
      expect(obj.locked).toBe(false);
    });

    it('should set locked', () => {
      obj.locked = true;
      expect(obj.locked).toBe(true);
    });

    it('should emit locked-changed event', () => {
      const handler = vi.fn();
      obj.on('locked-changed', handler);

      obj.locked = true;

      expect(handler).toHaveBeenCalledWith({ locked: true });
    });
  });

  describe('renderedPosition', () => {
    it('should default to null', () => {
      expect(obj.renderedPosition).toBeNull();
    });

    it('should set rendered position', () => {
      obj.renderedPosition = { x: 100, y: 200 };
      expect(obj.renderedPosition).toEqual({ x: 100, y: 200 });
    });

    it('should return the same reference', () => {
      obj.renderedPosition = { x: 100, y: 200 };
      const pos1 = obj.renderedPosition;
      const pos2 = obj.renderedPosition;
      expect(pos1).toEqual(pos2);
      expect(pos1).toBe(pos2); // renderedPosition returns the same reference
    });

    it('should handle null', () => {
      obj.renderedPosition = { x: 100, y: 200 };
      obj.renderedPosition = null;
      expect(obj.renderedPosition).toBeNull();
    });
  });

  describe('renderedPageIndex', () => {
    it('should default to -1', () => {
      expect(obj.renderedPageIndex).toBe(-1);
    });

    it('should set rendered page index', () => {
      obj.renderedPageIndex = 2;
      expect(obj.renderedPageIndex).toBe(2);
    });
  });

  describe('getBounds()', () => {
    it('should return bounds relative to object position', () => {
      const bounds = obj.getBounds();

      expect(bounds).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 50
      });
    });
  });

  describe('containsPoint()', () => {
    it('should return true for point inside bounds', () => {
      const objectPos = { x: 100, y: 100 };
      const point = { x: 150, y: 125 };

      expect(obj.containsPoint(point, objectPos)).toBe(true);
    });

    it('should return true for point on edge', () => {
      const objectPos = { x: 100, y: 100 };
      const point = { x: 100, y: 100 }; // Top-left corner

      expect(obj.containsPoint(point, objectPos)).toBe(true);
    });

    it('should return true for point on bottom-right edge', () => {
      const objectPos = { x: 100, y: 100 };
      const point = { x: 200, y: 150 }; // Bottom-right corner

      expect(obj.containsPoint(point, objectPos)).toBe(true);
    });

    it('should return false for point outside bounds', () => {
      const objectPos = { x: 100, y: 100 };
      const point = { x: 50, y: 50 }; // Outside

      expect(obj.containsPoint(point, objectPos)).toBe(false);
    });

    it('should return false for point just outside', () => {
      const objectPos = { x: 100, y: 100 };
      const point = { x: 201, y: 150 }; // Just past right edge

      expect(obj.containsPoint(point, objectPos)).toBe(false);
    });
  });

  describe('resize()', () => {
    it('should resize to new size', () => {
      obj.resize({ width: 200, height: 100 });

      expect(obj.size).toEqual({ width: 200, height: 100 });
    });

    it('should enforce minimum size', () => {
      obj.resize({ width: 5, height: 5 });

      // Default min size is 20x20
      expect(obj.width).toBeGreaterThanOrEqual(20);
      expect(obj.height).toBeGreaterThanOrEqual(20);
    });

    it('should emit size-changed event', () => {
      const handler = vi.fn();
      obj.on('size-changed', handler);

      obj.resize({ width: 150, height: 75 });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('handleClick()', () => {
    it('should select the object', () => {
      obj.handleClick({ x: 0, y: 0 });

      expect(obj.selected).toBe(true);
    });

    it('should not select when locked', () => {
      obj.locked = true;
      obj.handleClick({ x: 0, y: 0 });

      expect(obj.selected).toBe(false);
    });
  });

  describe('handleDoubleClick()', () => {
    it('should not throw', () => {
      expect(() => obj.handleDoubleClick({ x: 0, y: 0 })).not.toThrow();
    });
  });

  describe('getMinSize()', () => {
    it('should return default minimum size', () => {
      expect(obj.getMinSize()).toEqual({ width: 20, height: 20 });
    });
  });

  describe('getMaxSize()', () => {
    it('should return null by default', () => {
      expect(obj.getMaxSize()).toBeNull();
    });
  });

  describe('resizable', () => {
    it('should be true when not locked', () => {
      expect(obj.resizable).toBe(true);
    });

    it('should be false when locked', () => {
      obj.locked = true;
      expect(obj.resizable).toBe(false);
    });
  });

  describe('getResizeHandles()', () => {
    it('should return all 8 handles when not locked', () => {
      const handles = obj.getResizeHandles();

      expect(handles).toHaveLength(8);
      expect(handles).toContain('nw');
      expect(handles).toContain('n');
      expect(handles).toContain('ne');
      expect(handles).toContain('e');
      expect(handles).toContain('se');
      expect(handles).toContain('s');
      expect(handles).toContain('sw');
      expect(handles).toContain('w');
    });

    it('should return empty array when locked', () => {
      obj.locked = true;
      const handles = obj.getResizeHandles();

      expect(handles).toHaveLength(0);
    });
  });

  describe('getResizeHandleAtPoint()', () => {
    it('should return null when not resizable', () => {
      obj.locked = true;

      const handle = obj.getResizeHandleAtPoint({ x: 0, y: 0 });

      expect(handle).toBeNull();
    });

    it('should detect nw handle', () => {
      const handle = obj.getResizeHandleAtPoint({ x: 0, y: 0 });

      expect(handle).toBe('nw');
    });

    it('should detect se handle', () => {
      const handle = obj.getResizeHandleAtPoint({ x: 100, y: 50 });

      expect(handle).toBe('se');
    });

    it('should detect n handle', () => {
      const handle = obj.getResizeHandleAtPoint({ x: 50, y: 0 });

      expect(handle).toBe('n');
    });

    it('should detect e handle', () => {
      const handle = obj.getResizeHandleAtPoint({ x: 100, y: 25 });

      expect(handle).toBe('e');
    });

    it('should return null for point not on handle', () => {
      const handle = obj.getResizeHandleAtPoint({ x: 50, y: 25 }); // Center

      expect(handle).toBeNull();
    });
  });

  describe('objectType', () => {
    it('should return the object type', () => {
      expect(obj.objectType).toBe('test');
    });
  });

  describe('toData()', () => {
    it('should serialize object data', () => {
      const data = obj.toData();

      expect(data.id).toBe('test-obj');
      expect(data.objectType).toBe('test');
      expect(data.textIndex).toBe(5);
      expect(data.position).toBe('inline');
      expect(data.size).toEqual({ width: 100, height: 50 });
    });
  });

  describe('clone()', () => {
    it('should create a copy of the object', () => {
      const cloned = obj.clone() as TestEmbeddedObject;

      expect(cloned.id).toBe('test-obj-clone');
      expect(cloned.textIndex).toBe(5);
      expect(cloned.position).toBe('inline');
      expect(cloned.size).toEqual({ width: 100, height: 50 });
    });

    it('should return a different instance', () => {
      const cloned = obj.clone();

      expect(cloned).not.toBe(obj);
    });
  });

  describe('event emission', () => {
    it('should support multiple event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      obj.on('size-changed', handler1);
      obj.on('size-changed', handler2);

      obj.size = { width: 200, height: 100 };

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should support removing event handlers', () => {
      const handler = vi.fn();

      obj.on('size-changed', handler);
      obj.off('size-changed', handler);

      obj.size = { width: 200, height: 100 };

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
