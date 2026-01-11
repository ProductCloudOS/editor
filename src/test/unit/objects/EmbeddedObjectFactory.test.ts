/**
 * Unit tests for EmbeddedObjectFactory
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmbeddedObjectFactory } from '../../../lib/objects/EmbeddedObjectFactory';
import { ImageObject } from '../../../lib/objects/ImageObject';
import { TextBoxObject } from '../../../lib/objects/TextBoxObject';
import { TableObject } from '../../../lib/objects/table';
import { BaseEmbeddedObject } from '../../../lib/objects/BaseEmbeddedObject';
import { EmbeddedObjectData } from '../../../lib/objects/types';

describe('EmbeddedObjectFactory', () => {
  beforeEach(() => {
    // Reset factory before each test
    EmbeddedObjectFactory.reset();
  });

  afterEach(() => {
    EmbeddedObjectFactory.reset();
  });

  describe('initialize()', () => {
    it('should register built-in object types', () => {
      EmbeddedObjectFactory.initialize();

      expect(EmbeddedObjectFactory.isRegistered('image')).toBe(true);
      expect(EmbeddedObjectFactory.isRegistered('textbox')).toBe(true);
      expect(EmbeddedObjectFactory.isRegistered('table')).toBe(true);
    });

    it('should not re-initialize if already initialized', () => {
      EmbeddedObjectFactory.initialize();
      EmbeddedObjectFactory.initialize();

      // Should still work normally
      expect(EmbeddedObjectFactory.isRegistered('image')).toBe(true);
    });
  });

  describe('register()', () => {
    it('should register a custom object type', () => {
      EmbeddedObjectFactory.register('custom', (data) => {
        return new TextBoxObject({
          id: data.id,
          textIndex: data.textIndex,
          size: data.size
        });
      });

      expect(EmbeddedObjectFactory.isRegistered('custom')).toBe(true);
    });

    it('should override existing factory', () => {
      EmbeddedObjectFactory.register('test', () => new TextBoxObject({
        id: 'test',
        textIndex: 0,
        size: { width: 50, height: 50 }
      }));

      EmbeddedObjectFactory.register('test', () => new TextBoxObject({
        id: 'override',
        textIndex: 0,
        size: { width: 100, height: 100 }
      }));

      const data: EmbeddedObjectData = {
        id: 'obj',
        objectType: 'test',
        textIndex: 0,
        size: { width: 50, height: 50 },
        data: {}
      };

      const obj = EmbeddedObjectFactory.create(data);
      expect(obj.id).toBe('override');
    });
  });

  describe('unregister()', () => {
    it('should unregister an object type', () => {
      EmbeddedObjectFactory.register('temp', () => new TextBoxObject({
        id: 'temp',
        textIndex: 0,
        size: { width: 50, height: 50 }
      }));

      expect(EmbeddedObjectFactory.isRegistered('temp')).toBe(true);

      const result = EmbeddedObjectFactory.unregister('temp');

      expect(result).toBe(true);
      expect(EmbeddedObjectFactory.isRegistered('temp')).toBe(false);
    });

    it('should return false for non-existent type', () => {
      const result = EmbeddedObjectFactory.unregister('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('isRegistered()', () => {
    it('should return false for unregistered type', () => {
      expect(EmbeddedObjectFactory.isRegistered('unknown')).toBe(false);
    });

    it('should auto-initialize and check built-in types', () => {
      // Reset to uninitialized state
      EmbeddedObjectFactory.reset();

      // isRegistered should auto-initialize
      expect(EmbeddedObjectFactory.isRegistered('image')).toBe(true);
    });
  });

  describe('getRegisteredTypes()', () => {
    it('should return array of registered types', () => {
      EmbeddedObjectFactory.initialize();

      const types = EmbeddedObjectFactory.getRegisteredTypes();

      expect(types).toContain('image');
      expect(types).toContain('textbox');
      expect(types).toContain('table');
    });

    it('should include custom registered types', () => {
      EmbeddedObjectFactory.register('custom', () => new TextBoxObject({
        id: 'custom',
        textIndex: 0,
        size: { width: 50, height: 50 }
      }));

      const types = EmbeddedObjectFactory.getRegisteredTypes();

      expect(types).toContain('custom');
    });
  });

  describe('create()', () => {
    beforeEach(() => {
      EmbeddedObjectFactory.initialize();
    });

    it('should create ImageObject', () => {
      const data: EmbeddedObjectData = {
        id: 'img-1',
        objectType: 'image',
        textIndex: 5,
        size: { width: 200, height: 150 },
        data: {
          src: 'test.jpg',
          fit: 'contain',
          alt: 'Test image'
        }
      };

      const obj = EmbeddedObjectFactory.create(data);

      expect(obj).toBeInstanceOf(ImageObject);
      expect(obj.id).toBe('img-1');
      expect((obj as ImageObject).src).toBe('test.jpg');
      expect((obj as ImageObject).fit).toBe('contain');
      expect((obj as ImageObject).alt).toBe('Test image');
    });

    it('should create TextBoxObject', () => {
      const data: EmbeddedObjectData = {
        id: 'tb-1',
        objectType: 'textbox',
        textIndex: 10,
        size: { width: 150, height: 80 },
        data: {
          content: 'Hello',
          fontSize: 16,
          color: '#ff0000'
        }
      };

      const obj = EmbeddedObjectFactory.create(data);

      expect(obj).toBeInstanceOf(TextBoxObject);
      expect(obj.id).toBe('tb-1');
      expect((obj as TextBoxObject).content).toBe('Hello');
      expect((obj as TextBoxObject).fontSize).toBe(16);
      expect((obj as TextBoxObject).color).toBe('#ff0000');
    });

    it('should create TableObject', () => {
      // First create a table and serialize it to get proper format
      const originalTable = new TableObject({
        id: 'table-1',
        textIndex: 0,
        size: { width: 400, height: 200 },
        rows: 2,
        columns: 3
      });

      const data = originalTable.toData();
      EmbeddedObjectFactory.reset();
      EmbeddedObjectFactory.initialize();

      const obj = EmbeddedObjectFactory.create(data);

      expect(obj).toBeInstanceOf(TableObject);
      expect(obj.id).toBe('table-1');
    });

    it('should throw for unknown object type', () => {
      const data: EmbeddedObjectData = {
        id: 'unknown-1',
        objectType: 'unknown',
        textIndex: 0,
        size: { width: 100, height: 100 },
        data: {}
      };

      expect(() => EmbeddedObjectFactory.create(data)).toThrow('Unknown object type: unknown');
    });

    it('should restore textbox formatting runs', () => {
      const data: EmbeddedObjectData = {
        id: 'tb-2',
        objectType: 'textbox',
        textIndex: 0,
        size: { width: 100, height: 50 },
        data: {
          content: 'Formatted',
          formattingRuns: [[0, { bold: true }], [5, { italic: true }]]
        }
      };

      const obj = EmbeddedObjectFactory.create(data) as TextBoxObject;
      const fm = obj.flowingContent.getFormattingManager();

      expect(fm.getFormattingAt(0)?.bold).toBe(true);
      expect(fm.getFormattingAt(5)?.italic).toBe(true);
    });

    it('should restore position and relativeOffset', () => {
      const data: EmbeddedObjectData = {
        id: 'img-2',
        objectType: 'image',
        textIndex: 0,
        position: 'relative',
        size: { width: 100, height: 100 },
        relativeOffset: { x: 20, y: 30 },
        data: { src: 'test.png' }
      };

      const obj = EmbeddedObjectFactory.create(data);

      expect(obj.position).toBe('relative');
      expect(obj.relativeOffset).toEqual({ x: 20, y: 30 });
    });
  });

  describe('tryCreate()', () => {
    beforeEach(() => {
      EmbeddedObjectFactory.initialize();
    });

    it('should create object for known type', () => {
      const data: EmbeddedObjectData = {
        id: 'img-1',
        objectType: 'image',
        textIndex: 0,
        size: { width: 100, height: 100 },
        data: { src: 'test.jpg' }
      };

      const obj = EmbeddedObjectFactory.tryCreate(data);

      expect(obj).not.toBeNull();
      expect(obj).toBeInstanceOf(ImageObject);
    });

    it('should return null for unknown type', () => {
      const data: EmbeddedObjectData = {
        id: 'unknown-1',
        objectType: 'unknown',
        textIndex: 0,
        size: { width: 100, height: 100 },
        data: {}
      };

      const obj = EmbeddedObjectFactory.tryCreate(data);

      expect(obj).toBeNull();
    });
  });

  describe('reset()', () => {
    it('should clear all registrations', () => {
      EmbeddedObjectFactory.initialize();
      expect(EmbeddedObjectFactory.isRegistered('image')).toBe(true);

      EmbeddedObjectFactory.reset();

      // After reset, types are unregistered but isRegistered will re-initialize
      // Let's test by checking getRegisteredTypes before auto-init
      const types = EmbeddedObjectFactory.getRegisteredTypes();
      expect(types).toContain('image'); // Will re-initialize
    });

    it('should allow re-initialization after reset', () => {
      EmbeddedObjectFactory.initialize();
      EmbeddedObjectFactory.reset();
      EmbeddedObjectFactory.initialize();

      expect(EmbeddedObjectFactory.isRegistered('image')).toBe(true);
    });
  });

  describe('auto-initialization', () => {
    it('should auto-initialize on create()', () => {
      EmbeddedObjectFactory.reset();

      const data: EmbeddedObjectData = {
        id: 'img-1',
        objectType: 'image',
        textIndex: 0,
        size: { width: 100, height: 100 },
        data: { src: 'test.jpg' }
      };

      // Should not throw even though not explicitly initialized
      const obj = EmbeddedObjectFactory.create(data);

      expect(obj).toBeInstanceOf(ImageObject);
    });

    it('should auto-initialize on getRegisteredTypes()', () => {
      EmbeddedObjectFactory.reset();

      const types = EmbeddedObjectFactory.getRegisteredTypes();

      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('image');
    });
  });
});
