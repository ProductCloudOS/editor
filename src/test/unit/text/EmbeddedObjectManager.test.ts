/**
 * Unit tests for EmbeddedObjectManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddedObjectManager } from '../../../lib/text/EmbeddedObjectManager';
import { BaseEmbeddedObject } from '../../../lib/objects/BaseEmbeddedObject';
import { EmbeddedObjectData } from '../../../lib/objects/types';

// Mock embedded object class for testing
class MockEmbeddedObject extends BaseEmbeddedObject {
  private _type: string;

  constructor(id: string, textIndex: number, type: string = 'mock') {
    super({
      id,
      textIndex,
      position: 'inline',
      size: { width: 100, height: 50 }
    });
    this._type = type;
  }

  get objectType(): string {
    return this._type;
  }

  render(_ctx: CanvasRenderingContext2D): void {
    // Mock render
  }

  toData(): EmbeddedObjectData {
    return {
      id: this._id,
      objectType: this._type,
      textIndex: this._textIndex,
      position: this._position,
      size: { ...this._size },
      data: {}
    };
  }

  clone(): BaseEmbeddedObject {
    return new MockEmbeddedObject(this._id + '-clone', this._textIndex, this._type);
  }
}

describe('EmbeddedObjectManager', () => {
  let manager: EmbeddedObjectManager;

  beforeEach(() => {
    manager = new EmbeddedObjectManager();
  });

  describe('constructor', () => {
    it('should create an empty manager', () => {
      expect(manager.count).toBe(0);
      expect(manager.isEmpty).toBe(true);
    });
  });

  describe('insert()', () => {
    it('should insert an object', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      expect(manager.count).toBe(1);
      expect(manager.hasObjectAt(5)).toBe(true);
    });

    it('should update object textIndex', () => {
      const obj = new MockEmbeddedObject('obj1', 0);
      manager.insert(obj, 10);

      expect(obj.textIndex).toBe(10);
    });

    it('should emit object-added event', () => {
      const handler = vi.fn();
      manager.on('object-added', handler);

      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      expect(handler).toHaveBeenCalledWith({ object: obj, textIndex: 5 });
    });

    it('should forward object events', () => {
      const handler = vi.fn();
      manager.on('object-updated', handler);

      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      // Trigger a position change
      obj.position = 'block';

      expect(handler).toHaveBeenCalledWith({ object: obj, textIndex: 5 });
    });

    it('should forward size-changed events', () => {
      const handler = vi.fn();
      manager.on('object-updated', handler);

      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      obj.size = { width: 200, height: 100 };

      expect(handler).toHaveBeenCalled();
    });

    it('should forward offset-changed events', () => {
      const handler = vi.fn();
      manager.on('object-updated', handler);

      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      obj.relativeOffset = { x: 10, y: 20 };

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('should remove an object', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      const removed = manager.remove(5);

      expect(removed).toBe(obj);
      expect(manager.count).toBe(0);
      expect(manager.hasObjectAt(5)).toBe(false);
    });

    it('should return undefined for non-existent object', () => {
      const removed = manager.remove(99);
      expect(removed).toBeUndefined();
    });

    it('should emit object-removed event', () => {
      const handler = vi.fn();
      manager.on('object-removed', handler);

      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);
      manager.remove(5);

      expect(handler).toHaveBeenCalledWith({ object: obj, textIndex: 5 });
    });
  });

  describe('getObjects()', () => {
    it('should return empty map initially', () => {
      const objects = manager.getObjects();
      expect(objects.size).toBe(0);
    });

    it('should return all objects', () => {
      const obj1 = new MockEmbeddedObject('obj1', 5);
      const obj2 = new MockEmbeddedObject('obj2', 10);

      manager.insert(obj1, 5);
      manager.insert(obj2, 10);

      const objects = manager.getObjects();

      expect(objects.size).toBe(2);
      expect(objects.get(5)).toBe(obj1);
      expect(objects.get(10)).toBe(obj2);
    });

    it('should return a copy of the map', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      const objects = manager.getObjects();
      objects.set(99, new MockEmbeddedObject('fake', 99));

      // Original should not be affected
      expect(manager.hasObjectAt(99)).toBe(false);
    });
  });

  describe('getObjectsArray()', () => {
    it('should return empty array initially', () => {
      expect(manager.getObjectsArray()).toEqual([]);
    });

    it('should return sorted array', () => {
      const obj1 = new MockEmbeddedObject('obj1', 10);
      const obj2 = new MockEmbeddedObject('obj2', 5);
      const obj3 = new MockEmbeddedObject('obj3', 15);

      // Insert in random order
      manager.insert(obj1, 10);
      manager.insert(obj2, 5);
      manager.insert(obj3, 15);

      const arr = manager.getObjectsArray();

      expect(arr).toHaveLength(3);
      expect(arr[0].textIndex).toBe(5);
      expect(arr[1].textIndex).toBe(10);
      expect(arr[2].textIndex).toBe(15);
    });
  });

  describe('getObjectAt()', () => {
    it('should return object at index', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      expect(manager.getObjectAt(5)).toBe(obj);
    });

    it('should return undefined for no object', () => {
      expect(manager.getObjectAt(99)).toBeUndefined();
    });
  });

  describe('getObjectsInRange()', () => {
    it('should return empty array for empty range', () => {
      expect(manager.getObjectsInRange(0, 10)).toEqual([]);
    });

    it('should return objects in range', () => {
      const obj1 = new MockEmbeddedObject('obj1', 5);
      const obj2 = new MockEmbeddedObject('obj2', 10);
      const obj3 = new MockEmbeddedObject('obj3', 15);

      manager.insert(obj1, 5);
      manager.insert(obj2, 10);
      manager.insert(obj3, 15);

      const inRange = manager.getObjectsInRange(5, 12);

      expect(inRange).toHaveLength(2);
      expect(inRange[0].object.id).toBe('obj1');
      expect(inRange[1].object.id).toBe('obj2');
    });

    it('should exclude objects at end of range', () => {
      const obj = new MockEmbeddedObject('obj1', 10);
      manager.insert(obj, 10);

      const inRange = manager.getObjectsInRange(0, 10);

      expect(inRange).toHaveLength(0);
    });

    it('should include objects at start of range', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      const inRange = manager.getObjectsInRange(5, 10);

      expect(inRange).toHaveLength(1);
    });

    it('should return sorted results', () => {
      const obj1 = new MockEmbeddedObject('obj1', 8);
      const obj2 = new MockEmbeddedObject('obj2', 3);

      manager.insert(obj1, 8);
      manager.insert(obj2, 3);

      const inRange = manager.getObjectsInRange(0, 20);

      expect(inRange[0].textIndex).toBe(3);
      expect(inRange[1].textIndex).toBe(8);
    });
  });

  describe('hasObjectAt()', () => {
    it('should return false for no object', () => {
      expect(manager.hasObjectAt(5)).toBe(false);
    });

    it('should return true for existing object', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      expect(manager.hasObjectAt(5)).toBe(true);
    });
  });

  describe('shiftObjects()', () => {
    it('should shift objects after insertion point', () => {
      const obj1 = new MockEmbeddedObject('obj1', 5);
      const obj2 = new MockEmbeddedObject('obj2', 10);

      manager.insert(obj1, 5);
      manager.insert(obj2, 10);

      // Insert 3 chars at position 7
      manager.shiftObjects(7, 3);

      expect(manager.hasObjectAt(5)).toBe(true); // Before insertion point
      expect(manager.hasObjectAt(10)).toBe(false); // Moved
      expect(manager.hasObjectAt(13)).toBe(true); // New position
    });

    it('should update object textIndex property', () => {
      const obj = new MockEmbeddedObject('obj1', 10);
      manager.insert(obj, 10);

      manager.shiftObjects(5, 5);

      expect(obj.textIndex).toBe(15);
    });

    it('should shift objects at insertion point', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      manager.shiftObjects(5, 2);

      expect(manager.hasObjectAt(5)).toBe(false);
      expect(manager.hasObjectAt(7)).toBe(true);
    });

    it('should handle zero delta', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      manager.shiftObjects(0, 0);

      expect(manager.hasObjectAt(5)).toBe(true);
    });

    it('should emit objects-shifted event', () => {
      const handler = vi.fn();
      manager.on('objects-shifted', handler);

      const obj = new MockEmbeddedObject('obj1', 10);
      manager.insert(obj, 10);

      manager.shiftObjects(5, 3);

      expect(handler).toHaveBeenCalledWith({ fromIndex: 5, delta: 3 });
    });

    it('should not emit event if no objects shifted', () => {
      const handler = vi.fn();
      manager.on('objects-shifted', handler);

      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      manager.shiftObjects(10, 3); // No objects at or after 10

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle negative result indices', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      // This would result in negative index (though unusual)
      manager.shiftObjects(0, -10);

      // Object would have negative index so is removed
      expect(manager.hasObjectAt(-5)).toBe(false);
      expect(manager.hasObjectAt(5)).toBe(false);
    });
  });

  describe('handleDeletion()', () => {
    it('should remove objects within deleted range', () => {
      const obj1 = new MockEmbeddedObject('obj1', 5);
      const obj2 = new MockEmbeddedObject('obj2', 8);
      const obj3 = new MockEmbeddedObject('obj3', 15);

      manager.insert(obj1, 5);
      manager.insert(obj2, 8);
      manager.insert(obj3, 15);

      const removed = manager.handleDeletion(5, 5); // Delete 5-10

      expect(removed).toHaveLength(2);
      expect(removed).toContain(obj1);
      expect(removed).toContain(obj2);
      expect(manager.hasObjectAt(5)).toBe(false);
      expect(manager.hasObjectAt(8)).toBe(false);
    });

    it('should shift objects after deleted range', () => {
      const obj = new MockEmbeddedObject('obj1', 15);
      manager.insert(obj, 15);

      manager.handleDeletion(5, 5); // Delete 5-10

      expect(manager.hasObjectAt(15)).toBe(false);
      expect(manager.hasObjectAt(10)).toBe(true); // 15 - 5 = 10
      expect(obj.textIndex).toBe(10);
    });

    it('should emit object-removed for deleted objects', () => {
      const handler = vi.fn();
      manager.on('object-removed', handler);

      const obj = new MockEmbeddedObject('obj1', 7);
      manager.insert(obj, 7);

      manager.handleDeletion(5, 5);

      expect(handler).toHaveBeenCalledWith({ object: obj, textIndex: 7 });
    });

    it('should emit objects-changed event', () => {
      const handler = vi.fn();
      manager.on('objects-changed', handler);

      const obj = new MockEmbeddedObject('obj1', 7);
      manager.insert(obj, 7);

      manager.handleDeletion(5, 5);

      expect(handler).toHaveBeenCalled();
    });

    it('should not affect objects before deleted range', () => {
      const obj = new MockEmbeddedObject('obj1', 3);
      manager.insert(obj, 3);

      manager.handleDeletion(5, 5);

      expect(manager.hasObjectAt(3)).toBe(true);
    });

    it('should return empty array if no objects affected', () => {
      const obj = new MockEmbeddedObject('obj1', 20);
      manager.insert(obj, 20);

      const removed = manager.handleDeletion(5, 3);

      expect(removed).toEqual([]);
    });
  });

  describe('count', () => {
    it('should return 0 initially', () => {
      expect(manager.count).toBe(0);
    });

    it('should increase on insert', () => {
      manager.insert(new MockEmbeddedObject('obj1', 5), 5);
      expect(manager.count).toBe(1);

      manager.insert(new MockEmbeddedObject('obj2', 10), 10);
      expect(manager.count).toBe(2);
    });

    it('should decrease on remove', () => {
      manager.insert(new MockEmbeddedObject('obj1', 5), 5);
      manager.insert(new MockEmbeddedObject('obj2', 10), 10);

      manager.remove(5);
      expect(manager.count).toBe(1);
    });
  });

  describe('isEmpty', () => {
    it('should return true initially', () => {
      expect(manager.isEmpty).toBe(true);
    });

    it('should return false after insert', () => {
      manager.insert(new MockEmbeddedObject('obj1', 5), 5);
      expect(manager.isEmpty).toBe(false);
    });

    it('should return true after clearing', () => {
      manager.insert(new MockEmbeddedObject('obj1', 5), 5);
      manager.clear();
      expect(manager.isEmpty).toBe(true);
    });
  });

  describe('clear()', () => {
    it('should remove all objects', () => {
      manager.insert(new MockEmbeddedObject('obj1', 5), 5);
      manager.insert(new MockEmbeddedObject('obj2', 10), 10);

      manager.clear();

      expect(manager.count).toBe(0);
      expect(manager.isEmpty).toBe(true);
    });

    it('should emit objects-cleared event', () => {
      const handler = vi.fn();
      manager.on('objects-cleared', handler);

      manager.insert(new MockEmbeddedObject('obj1', 5), 5);
      manager.clear();

      expect(handler).toHaveBeenCalled();
    });

    it('should not emit event if already empty', () => {
      const handler = vi.fn();
      manager.on('objects-cleared', handler);

      manager.clear();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getObjectIds()', () => {
    it('should return empty array initially', () => {
      expect(manager.getObjectIds()).toEqual([]);
    });

    it('should return all object IDs', () => {
      manager.insert(new MockEmbeddedObject('obj1', 5), 5);
      manager.insert(new MockEmbeddedObject('obj2', 10), 10);

      const ids = manager.getObjectIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('obj1');
      expect(ids).toContain('obj2');
    });
  });

  describe('findById()', () => {
    it('should return undefined for non-existent ID', () => {
      expect(manager.findById('nonexistent')).toBeUndefined();
    });

    it('should find object by ID', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      const result = manager.findById('obj1');

      expect(result).toBeDefined();
      expect(result!.object).toBe(obj);
      expect(result!.textIndex).toBe(5);
    });
  });

  describe('findByType()', () => {
    it('should return empty array for no matches', () => {
      expect(manager.findByType('image')).toEqual([]);
    });

    it('should find objects by type', () => {
      manager.insert(new MockEmbeddedObject('obj1', 5, 'image'), 5);
      manager.insert(new MockEmbeddedObject('obj2', 10, 'textbox'), 10);
      manager.insert(new MockEmbeddedObject('obj3', 15, 'image'), 15);

      const images = manager.findByType('image');

      expect(images).toHaveLength(2);
      expect(images[0].object.id).toBe('obj1');
      expect(images[1].object.id).toBe('obj3');
    });

    it('should return sorted results', () => {
      manager.insert(new MockEmbeddedObject('obj1', 15, 'image'), 15);
      manager.insert(new MockEmbeddedObject('obj2', 5, 'image'), 5);

      const images = manager.findByType('image');

      expect(images[0].textIndex).toBe(5);
      expect(images[1].textIndex).toBe(15);
    });
  });

  describe('updatePosition()', () => {
    it('should update object position', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      const result = manager.updatePosition(5, 'block');

      expect(result).toBe(true);
      expect(obj.position).toBe('block');
    });

    it('should emit object-updated event', () => {
      const handler = vi.fn();
      manager.on('object-updated', handler);

      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      manager.updatePosition(5, 'relative');

      expect(handler).toHaveBeenCalledWith({ object: obj, textIndex: 5 });
    });

    it('should return false for non-existent object', () => {
      const result = manager.updatePosition(99, 'block');
      expect(result).toBe(false);
    });
  });

  describe('deselectAll()', () => {
    it('should deselect all objects', () => {
      const obj1 = new MockEmbeddedObject('obj1', 5);
      const obj2 = new MockEmbeddedObject('obj2', 10);

      obj1.selected = true;
      obj2.selected = true;

      manager.insert(obj1, 5);
      manager.insert(obj2, 10);

      manager.deselectAll();

      expect(obj1.selected).toBe(false);
      expect(obj2.selected).toBe(false);
    });

    it('should handle empty manager', () => {
      expect(() => manager.deselectAll()).not.toThrow();
    });
  });

  describe('getSelectedObject()', () => {
    it('should return undefined if nothing selected', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      manager.insert(obj, 5);

      expect(manager.getSelectedObject()).toBeUndefined();
    });

    it('should return selected object', () => {
      const obj = new MockEmbeddedObject('obj1', 5);
      obj.selected = true;
      manager.insert(obj, 5);

      const result = manager.getSelectedObject();

      expect(result).toBeDefined();
      expect(result!.object).toBe(obj);
      expect(result!.textIndex).toBe(5);
    });

    it('should return first selected if multiple (edge case)', () => {
      const obj1 = new MockEmbeddedObject('obj1', 5);
      const obj2 = new MockEmbeddedObject('obj2', 10);

      obj1.selected = true;
      obj2.selected = true;

      manager.insert(obj1, 5);
      manager.insert(obj2, 10);

      const result = manager.getSelectedObject();

      // Returns first found (order not guaranteed)
      expect(result).toBeDefined();
      expect(result!.object.selected).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex editing workflow', () => {
      // Insert some objects
      manager.insert(new MockEmbeddedObject('img1', 10), 10);
      manager.insert(new MockEmbeddedObject('img2', 20), 20);
      manager.insert(new MockEmbeddedObject('img3', 30), 30);

      expect(manager.count).toBe(3);

      // Insert text before first object (shift all)
      manager.shiftObjects(0, 5);

      expect(manager.hasObjectAt(15)).toBe(true); // 10 + 5
      expect(manager.hasObjectAt(25)).toBe(true); // 20 + 5
      expect(manager.hasObjectAt(35)).toBe(true); // 30 + 5

      // Delete a range that includes an object
      const removed = manager.handleDeletion(20, 10); // Removes object at 25

      expect(removed).toHaveLength(1);
      expect(manager.count).toBe(2);
      expect(manager.hasObjectAt(15)).toBe(true);  // First object unchanged (before range)
      expect(manager.hasObjectAt(25)).toBe(true);  // 35 - 10 = 25 (object shifted down)

      // Clear everything
      manager.clear();
      expect(manager.isEmpty).toBe(true);
    });

    it('should maintain object references after shifting', () => {
      const obj = new MockEmbeddedObject('persistent', 10);
      manager.insert(obj, 10);

      manager.shiftObjects(5, 5);

      const found = manager.findById('persistent');
      expect(found).toBeDefined();
      expect(found!.object).toBe(obj); // Same reference
      expect(found!.textIndex).toBe(15);
    });
  });
});
