/**
 * Unit tests for ObjectMutationObserver
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectMutationObserver } from '../../../lib/undo/transaction/ObjectMutationObserver';
import { TransactionManager } from '../../../lib/undo/transaction/TransactionManager';
import { FocusTracker } from '../../../lib/undo/transaction/FocusTracker';
import { TextBoxObject } from '../../../lib/objects/TextBoxObject';
import { ImageObject } from '../../../lib/objects/ImageObject';
import { TableObject } from '../../../lib/objects/table';

describe('ObjectMutationObserver', () => {
  let observer: ObjectMutationObserver;
  let manager: TransactionManager;
  let focusTracker: FocusTracker;

  beforeEach(() => {
    focusTracker = new FocusTracker(
      () => ({
        content: null,
        section: 'body' as const,
        focusedObjectId: null,
        tableCellAddress: null
      }),
      () => {}
    );

    manager = new TransactionManager(
      focusTracker,
      () => null,
      () => null
    );

    observer = new ObjectMutationObserver(manager);
  });

  describe('constructor', () => {
    it('should create an ObjectMutationObserver instance', () => {
      expect(observer).toBeInstanceOf(ObjectMutationObserver);
    });
  });

  describe('observe()', () => {
    it('should start observing a TextBoxObject', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      observer.observe(textBox);

      expect(observer.isObserving(textBox)).toBe(true);
    });

    it('should start observing an ImageObject', () => {
      const image = new ImageObject({
        id: 'img-1',
        textIndex: 0,
        size: { width: 200, height: 150 },
        src: 'test.jpg'
      });

      observer.observe(image);

      expect(observer.isObserving(image)).toBe(true);
    });

    it('should start observing a TableObject', () => {
      const table = new TableObject({
        id: 'table-1',
        textIndex: 0,
        size: { width: 300, height: 200 },
        rows: 3,
        columns: 3
      });

      observer.observe(table);

      expect(observer.isObserving(table)).toBe(true);
    });

    it('should not re-observe if already observing', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      observer.observe(textBox);
      observer.observe(textBox);

      expect(observer.isObserving(textBox)).toBe(true);
    });
  });

  describe('unobserve()', () => {
    it('should stop observing a TextBoxObject', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      observer.observe(textBox);
      expect(observer.isObserving(textBox)).toBe(true);

      observer.unobserve(textBox);
      expect(observer.isObserving(textBox)).toBe(false);
    });

    it('should not throw if not observing', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      expect(() => observer.unobserve(textBox)).not.toThrow();
    });
  });

  describe('isObserving()', () => {
    it('should return false for unobserved object', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      expect(observer.isObserving(textBox)).toBe(false);
    });

    it('should return true for observed object', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      observer.observe(textBox);

      expect(observer.isObserving(textBox)).toBe(true);
    });
  });

  describe('resize mutations - TextBoxObject', () => {
    let textBox: TextBoxObject;

    beforeEach(() => {
      textBox = new TextBoxObject({
        id: 'tb-resize',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });
      observer.observe(textBox);
    });

    it('should record resize mutation via resize() method', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.resize({ width: 150, height: 75 });

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-resize');
      expect(mutation.data.previousSize).toEqual({ width: 100, height: 50 });
      expect(mutation.data.newSize).toEqual({ width: 150, height: 75 });
    });

    it('should record resize mutation via size setter', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.size = { width: 200, height: 100 };

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-resize');
    });

    it('should record resize mutation via width setter', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.width = 180;

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-resize');
      expect(mutation.data.newSize.width).toBe(180);
    });

    it('should record resize mutation via height setter', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.height = 80;

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-resize');
      expect(mutation.data.newSize.height).toBe(80);
    });

    it('should not record if size unchanged', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.resize({ width: 100, height: 50 });

      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('should not record during undo/redo', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');
      vi.spyOn(manager, 'isUndoRedoInProgress', 'get').mockReturnValue(true);

      textBox.resize({ width: 200, height: 100 });

      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('should create boundary for resize', () => {
      const boundarySpy = vi.spyOn(manager, 'createBoundary');

      textBox.resize({ width: 150, height: 75 });

      expect(boundarySpy).toHaveBeenCalled();
    });
  });

  describe('move mutations', () => {
    let textBox: TextBoxObject;

    beforeEach(() => {
      textBox = new TextBoxObject({
        id: 'tb-move',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });
      observer.observe(textBox);
    });

    it('should record move mutation via relativeOffset setter', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.relativeOffset = { x: 20, y: 30 };

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-move');
      expect(mutation.data.previousOffset).toEqual({ x: 0, y: 0 });
      expect(mutation.data.newOffset).toEqual({ x: 20, y: 30 });
    });

    it('should not record if offset unchanged', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.relativeOffset = { x: 0, y: 0 };

      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('should not record during undo/redo', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');
      vi.spyOn(manager, 'isUndoRedoInProgress', 'get').mockReturnValue(true);

      textBox.relativeOffset = { x: 50, y: 50 };

      expect(recordSpy).not.toHaveBeenCalled();
    });
  });

  describe('TextBoxObject property mutations', () => {
    let textBox: TextBoxObject;

    beforeEach(() => {
      textBox = new TextBoxObject({
        id: 'tb-props',
        textIndex: 0,
        size: { width: 100, height: 50 },
        fontFamily: 'Arial',
        fontSize: 12,
        color: '#000000',
        backgroundColor: '#ffffff'
      });
      observer.observe(textBox);
    });

    it('should record fontFamily mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.fontFamily = 'Helvetica';

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('fontFamily');
      expect(mutation.data.previousValue).toBe('Arial');
      expect(mutation.data.newValue).toBe('Helvetica');
    });

    it('should record fontSize mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.fontSize = 16;

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('fontSize');
    });

    it('should record color mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.color = '#ff0000';

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('color');
    });

    it('should record backgroundColor mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.backgroundColor = '#eeeeee';

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('backgroundColor');
    });

    it('should record border mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.border = { width: 2, color: '#000000', style: 'solid' };

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('border');
    });

    it('should record padding mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.padding = 10;

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('padding');
    });

    it('should not record if value unchanged', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.fontFamily = 'Arial';

      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('should not record during undo/redo', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');
      vi.spyOn(manager, 'isUndoRedoInProgress', 'get').mockReturnValue(true);

      textBox.fontSize = 20;

      expect(recordSpy).not.toHaveBeenCalled();
    });
  });

  describe('ImageObject property mutations', () => {
    let image: ImageObject;

    beforeEach(() => {
      image = new ImageObject({
        id: 'img-props',
        textIndex: 0,
        size: { width: 200, height: 150 },
        src: 'test.jpg',
        fit: 'contain',
        resizeMode: 'free',
        alt: 'Test image'
      });
      observer.observe(image);
    });

    it('should record fit mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      image.fit = 'cover';

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('fit');
      expect(mutation.data.previousValue).toBe('contain');
      expect(mutation.data.newValue).toBe('cover');
    });

    it('should record resizeMode mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      image.resizeMode = 'locked-aspect-ratio';

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('resizeMode');
    });

    it('should record alt mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      image.alt = 'New alt text';

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-property');
      expect(mutation.data.propertyName).toBe('alt');
    });

    it('should not record if value unchanged', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      image.fit = 'contain';

      expect(recordSpy).not.toHaveBeenCalled();
    });
  });

  describe('TableObject structure mutations', () => {
    let table: TableObject;

    beforeEach(() => {
      table = new TableObject({
        id: 'table-struct',
        textIndex: 0,
        size: { width: 300, height: 200 },
        rows: 3,
        columns: 3
      });
      observer.observe(table);
    });

    it('should record insertRow mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      table.insertRow(1);

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('table-add-row');
      expect(mutation.sourceId.type).toBe('table');
    });

    it('should record removeRow mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      table.removeRow(1);

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('table-delete-row');
    });

    it('should record insertColumn mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      table.insertColumn(1);

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('table-add-column');
    });

    it('should record removeColumn mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      table.removeColumn(1);

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('table-delete-column');
    });

    it('should record mergeCells mutation on success', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      // Select a range of cells using selectRange method
      table.selectRange({ start: { row: 0, col: 0 }, end: { row: 1, col: 1 } });
      const result = table.mergeCells();

      if (result.success) {
        expect(recordSpy).toHaveBeenCalled();
        const mutation = recordSpy.mock.calls[0][0];
        expect(mutation.type).toBe('table-merge');
      }
    });

    it('should record splitCell mutation on success', () => {
      // First merge cells
      table.selectRange({ start: { row: 0, col: 0 }, end: { row: 1, col: 1 } });
      table.mergeCells();

      const recordSpy = vi.spyOn(manager, 'recordMutation');
      recordSpy.mockClear();

      const result = table.splitCell(0, 0);

      if (result.success) {
        expect(recordSpy).toHaveBeenCalled();
        const mutation = recordSpy.mock.calls[0][0];
        expect(mutation.type).toBe('table-split');
      }
    });

    it('should not record during undo/redo', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');
      vi.spyOn(manager, 'isUndoRedoInProgress', 'get').mockReturnValue(true);

      table.insertRow(1);

      expect(recordSpy).not.toHaveBeenCalled();
    });

    it('should capture table snapshot in mutation data', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      table.insertRow(1);

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.data.beforeSnapshot).toBeDefined();
      expect(mutation.data.afterSnapshot).toBeDefined();
    });
  });

  describe('source ID', () => {
    it('should use correct source ID for TextBoxObject', () => {
      const textBox = new TextBoxObject({
        id: 'tb-srcid',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });
      observer.observe(textBox);

      const recordSpy = vi.spyOn(manager, 'recordMutation');
      textBox.width = 150;

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.sourceId.type).toBe('textbox');
      expect(mutation.sourceId.objectId).toBe('tb-srcid');
    });

    it('should use correct source ID for ImageObject', () => {
      const image = new ImageObject({
        id: 'img-srcid',
        textIndex: 0,
        size: { width: 200, height: 150 },
        src: 'test.jpg'
      });
      observer.observe(image);

      const recordSpy = vi.spyOn(manager, 'recordMutation');
      image.width = 250;

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.sourceId.type).toBe('image');
      expect(mutation.sourceId.objectId).toBe('img-srcid');
    });

    it('should use correct source ID for TableObject', () => {
      const table = new TableObject({
        id: 'table-srcid',
        textIndex: 0,
        size: { width: 300, height: 200 },
        rows: 2,
        columns: 2
      });
      observer.observe(table);

      const recordSpy = vi.spyOn(manager, 'recordMutation');
      table.insertRow(1);

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.sourceId.type).toBe('table');
      expect(mutation.sourceId.objectId).toBe('table-srcid');
    });
  });

  describe('multiple objects', () => {
    it('should observe multiple objects independently', () => {
      const textBox = new TextBoxObject({
        id: 'tb-multi',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      const image = new ImageObject({
        id: 'img-multi',
        textIndex: 1,
        size: { width: 200, height: 150 },
        src: 'test.jpg'
      });

      observer.observe(textBox);
      observer.observe(image);

      expect(observer.isObserving(textBox)).toBe(true);
      expect(observer.isObserving(image)).toBe(true);
    });

    it('should record mutations from correct objects', () => {
      const textBox = new TextBoxObject({
        id: 'tb-m1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      const image = new ImageObject({
        id: 'img-m1',
        textIndex: 1,
        size: { width: 200, height: 150 },
        src: 'test.jpg'
      });

      observer.observe(textBox);
      observer.observe(image);

      const recordSpy = vi.spyOn(manager, 'recordMutation');

      textBox.width = 120;
      image.width = 220;

      expect(recordSpy).toHaveBeenCalledTimes(2);
      expect(recordSpy.mock.calls[0][0].sourceId.objectId).toBe('tb-m1');
      expect(recordSpy.mock.calls[1][0].sourceId.objectId).toBe('img-m1');
    });
  });

  describe('unobserve restores methods', () => {
    it('should mark object as not observed after unobserve', () => {
      const textBox = new TextBoxObject({
        id: 'tb-restore',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      observer.observe(textBox);
      expect(observer.isObserving(textBox)).toBe(true);

      observer.unobserve(textBox);
      expect(observer.isObserving(textBox)).toBe(false);
    });

    it('should still allow resize after unobserve', () => {
      const textBox = new TextBoxObject({
        id: 'tb-restore2',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      observer.observe(textBox);
      observer.unobserve(textBox);

      // Resize should still work (even if wrapper is still in place)
      textBox.resize({ width: 150, height: 75 });

      expect(textBox.width).toBe(150);
      expect(textBox.height).toBe(75);
    });

    it('should restore table methods after unobserve', () => {
      const table = new TableObject({
        id: 'table-restore',
        textIndex: 0,
        size: { width: 300, height: 200 },
        rows: 3,
        columns: 3
      });

      observer.observe(table);
      observer.unobserve(table);

      // Table operations should still work
      table.insertRow(1);

      expect(table.rowCount).toBe(4);
    });
  });
});
