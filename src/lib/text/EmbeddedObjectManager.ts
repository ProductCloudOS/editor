import { EventEmitter } from '../events/EventEmitter';
import { BaseEmbeddedObject, ObjectPosition } from '../objects';

/**
 * Entry for an embedded object in the manager.
 */
export interface EmbeddedObjectEntry {
  object: BaseEmbeddedObject;
  textIndex: number;
}

/**
 * Manages embedded objects within text content.
 * Handles insertion, removal, and position shifting when text changes.
 */
export class EmbeddedObjectManager extends EventEmitter {
  private objects: Map<number, BaseEmbeddedObject> = new Map();

  constructor() {
    super();
  }

  /**
   * Get all embedded objects.
   */
  getObjects(): Map<number, BaseEmbeddedObject> {
    return new Map(this.objects);
  }

  /**
   * Get all embedded objects as an array, sorted by text index.
   */
  getObjectsArray(): EmbeddedObjectEntry[] {
    return Array.from(this.objects.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([textIndex, object]) => ({ object, textIndex }));
  }

  /**
   * Get the embedded object at a specific text index.
   */
  getObjectAt(textIndex: number): BaseEmbeddedObject | undefined {
    return this.objects.get(textIndex);
  }

  /**
   * Get all embedded objects within a range.
   */
  getObjectsInRange(start: number, end: number): EmbeddedObjectEntry[] {
    const result: EmbeddedObjectEntry[] = [];
    for (const [textIndex, object] of this.objects.entries()) {
      if (textIndex >= start && textIndex < end) {
        result.push({ object, textIndex });
      }
    }
    return result.sort((a, b) => a.textIndex - b.textIndex);
  }

  /**
   * Check if there's an embedded object at the given text index.
   */
  hasObjectAt(textIndex: number): boolean {
    return this.objects.has(textIndex);
  }

  /**
   * Insert an embedded object at a specific text index.
   * Note: The caller is responsible for inserting the placeholder character.
   */
  insert(object: BaseEmbeddedObject, textIndex: number): void {
    object.textIndex = textIndex;
    this.objects.set(textIndex, object);

    // Listen to object property changes and forward them
    object.on('position-changed', () => {
      this.emit('object-updated', { object, textIndex: object.textIndex });
    });
    object.on('offset-changed', () => {
      this.emit('object-updated', { object, textIndex: object.textIndex });
    });
    object.on('size-changed', () => {
      this.emit('object-updated', { object, textIndex: object.textIndex });
    });

    this.emit('object-added', { object, textIndex });
  }

  /**
   * Remove an embedded object at a specific text index.
   * Note: The caller is responsible for removing the placeholder character.
   */
  remove(textIndex: number): BaseEmbeddedObject | undefined {
    const object = this.objects.get(textIndex);
    if (object) {
      this.objects.delete(textIndex);
      this.emit('object-removed', { object, textIndex });
      return object;
    }
    return undefined;
  }

  /**
   * Shift all object positions when text is inserted.
   * @param fromIndex The position where text was inserted
   * @param delta The number of characters inserted (positive)
   */
  shiftObjects(fromIndex: number, delta: number): void {
    if (delta === 0) return;

    const toShift: Array<{ oldIndex: number; object: BaseEmbeddedObject }> = [];

    // Collect objects that need to be shifted
    for (const [index, object] of this.objects.entries()) {
      if (index >= fromIndex) {
        toShift.push({ oldIndex: index, object });
      }
    }

    // Remove old entries
    for (const { oldIndex } of toShift) {
      this.objects.delete(oldIndex);
    }

    // Add with new indices
    for (const { oldIndex, object } of toShift) {
      const newIndex = oldIndex + delta;
      if (newIndex >= 0) {
        object.textIndex = newIndex;
        this.objects.set(newIndex, object);
      }
    }

    if (toShift.length > 0) {
      this.emit('objects-shifted', { fromIndex, delta });
    }
  }

  /**
   * Handle deletion of text range.
   * Objects within the deleted range are removed.
   * Objects after the range are shifted.
   * @returns Array of removed objects
   */
  handleDeletion(start: number, length: number): BaseEmbeddedObject[] {
    const end = start + length;
    const removedObjects: BaseEmbeddedObject[] = [];
    const toShift: Array<{ oldIndex: number; object: BaseEmbeddedObject }> = [];

    for (const [textIndex, object] of this.objects) {
      if (textIndex >= start && textIndex < end) {
        // Object is within deleted range
        removedObjects.push(object);
      } else if (textIndex >= end) {
        // Object is after deleted range, needs to shift
        toShift.push({ oldIndex: textIndex, object });
      }
    }

    // Remove deleted objects
    for (const object of removedObjects) {
      this.objects.delete(object.textIndex);
      this.emit('object-removed', { object, textIndex: object.textIndex });
    }

    // Remove objects that will be shifted
    for (const { oldIndex } of toShift) {
      this.objects.delete(oldIndex);
    }

    // Add back with new indices
    for (const { oldIndex, object } of toShift) {
      const newIndex = oldIndex - length;
      object.textIndex = newIndex;
      this.objects.set(newIndex, object);
    }

    if (removedObjects.length > 0 || toShift.length > 0) {
      this.emit('objects-changed');
    }

    return removedObjects;
  }

  /**
   * Get the count of embedded objects.
   */
  get count(): number {
    return this.objects.size;
  }

  /**
   * Check if there are any embedded objects.
   */
  get isEmpty(): boolean {
    return this.objects.size === 0;
  }

  /**
   * Clear all embedded objects.
   */
  clear(): void {
    const hadObjects = this.objects.size > 0;
    this.objects.clear();
    if (hadObjects) {
      this.emit('objects-cleared');
    }
  }

  /**
   * Get all object IDs.
   */
  getObjectIds(): string[] {
    return Array.from(this.objects.values()).map(obj => obj.id);
  }

  /**
   * Find an embedded object by its ID.
   */
  findById(objectId: string): EmbeddedObjectEntry | undefined {
    for (const [textIndex, object] of this.objects.entries()) {
      if (object.id === objectId) {
        return { object, textIndex };
      }
    }
    return undefined;
  }

  /**
   * Find all embedded objects of a specific type.
   */
  findByType(objectType: string): EmbeddedObjectEntry[] {
    const result: EmbeddedObjectEntry[] = [];
    for (const [textIndex, object] of this.objects.entries()) {
      if (object.objectType === objectType) {
        result.push({ object, textIndex });
      }
    }
    return result.sort((a, b) => a.textIndex - b.textIndex);
  }

  /**
   * Update an object's position mode.
   */
  updatePosition(textIndex: number, position: ObjectPosition): boolean {
    const object = this.objects.get(textIndex);
    if (object) {
      object.position = position;
      this.emit('object-updated', { object, textIndex });
      return true;
    }
    return false;
  }

  /**
   * Deselect all objects.
   */
  deselectAll(): void {
    for (const object of this.objects.values()) {
      if (object.selected) {
        object.selected = false;
      }
    }
  }

  /**
   * Get the currently selected object (if any).
   */
  getSelectedObject(): EmbeddedObjectEntry | undefined {
    for (const [textIndex, object] of this.objects.entries()) {
      if (object.selected) {
        return { object, textIndex };
      }
    }
    return undefined;
  }
}
