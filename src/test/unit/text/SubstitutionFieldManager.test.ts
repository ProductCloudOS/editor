/**
 * Unit tests for SubstitutionFieldManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubstitutionFieldManager } from '../../../lib/text/SubstitutionFieldManager';
import { SubstitutionField, DEFAULT_FORMATTING } from '../../../lib/text/types';

describe('SubstitutionFieldManager', () => {
  let manager: SubstitutionFieldManager;

  beforeEach(() => {
    manager = new SubstitutionFieldManager();
  });

  describe('constructor', () => {
    it('should create an empty manager', () => {
      expect(manager.count).toBe(0);
      expect(manager.isEmpty).toBe(true);
    });
  });

  describe('insert()', () => {
    it('should insert a field', () => {
      const field = manager.insert('username', 5);

      expect(field.fieldName).toBe('username');
      expect(field.textIndex).toBe(5);
      expect(field.id).toMatch(/^field-\d+$/);
      expect(manager.count).toBe(1);
    });

    it('should generate unique IDs', () => {
      const field1 = manager.insert('field1', 5);
      const field2 = manager.insert('field2', 10);

      expect(field1.id).not.toBe(field2.id);
    });

    it('should accept optional config', () => {
      const field = manager.insert('amount', 5, {
        displayFormat: '$%d',
        defaultValue: '0.00',
        fieldType: 'data'
      });

      expect(field.displayFormat).toBe('$%d');
      expect(field.defaultValue).toBe('0.00');
      expect(field.fieldType).toBe('data');
    });

    it('should emit field-added event', () => {
      const handler = vi.fn();
      manager.on('field-added', handler);

      const field = manager.insert('test', 5);

      expect(handler).toHaveBeenCalledWith({ field });
    });

    it('should create page number field', () => {
      const field = manager.insert('page', 5, { fieldType: 'pageNumber' });

      expect(field.fieldType).toBe('pageNumber');
      expect(manager.isPageNumberField(field)).toBe(true);
    });

    it('should create page count field', () => {
      const field = manager.insert('pages', 5, { fieldType: 'pageCount' });

      expect(field.fieldType).toBe('pageCount');
      expect(manager.isPageCountField(field)).toBe(true);
    });
  });

  describe('remove()', () => {
    it('should remove a field', () => {
      manager.insert('test', 5);

      const removed = manager.remove(5);

      expect(removed).toBeDefined();
      expect(removed!.fieldName).toBe('test');
      expect(manager.count).toBe(0);
    });

    it('should return undefined for non-existent field', () => {
      const removed = manager.remove(99);
      expect(removed).toBeUndefined();
    });

    it('should emit field-removed event', () => {
      const handler = vi.fn();
      manager.on('field-removed', handler);

      const field = manager.insert('test', 5);
      manager.remove(5);

      expect(handler).toHaveBeenCalledWith({ field });
    });
  });

  describe('getFieldAt()', () => {
    it('should return field at index', () => {
      const field = manager.insert('test', 5);
      expect(manager.getFieldAt(5)).toBe(field);
    });

    it('should return undefined for no field', () => {
      expect(manager.getFieldAt(99)).toBeUndefined();
    });
  });

  describe('hasFieldAt()', () => {
    it('should return true for existing field', () => {
      manager.insert('test', 5);
      expect(manager.hasFieldAt(5)).toBe(true);
    });

    it('should return false for no field', () => {
      expect(manager.hasFieldAt(99)).toBe(false);
    });
  });

  describe('getFieldsInRange()', () => {
    it('should return empty array for empty range', () => {
      expect(manager.getFieldsInRange(0, 10)).toEqual([]);
    });

    it('should return fields in range', () => {
      manager.insert('f1', 5);
      manager.insert('f2', 10);
      manager.insert('f3', 15);

      const inRange = manager.getFieldsInRange(5, 12);

      expect(inRange).toHaveLength(2);
      expect(inRange[0].field.fieldName).toBe('f1');
      expect(inRange[1].field.fieldName).toBe('f2');
    });

    it('should exclude fields at end of range', () => {
      manager.insert('test', 10);

      const inRange = manager.getFieldsInRange(0, 10);

      expect(inRange).toHaveLength(0);
    });

    it('should return sorted results', () => {
      manager.insert('f2', 10);
      manager.insert('f1', 5);

      const inRange = manager.getFieldsInRange(0, 20);

      expect(inRange[0].textIndex).toBe(5);
      expect(inRange[1].textIndex).toBe(10);
    });
  });

  describe('insertAt()', () => {
    it('should insert field at position preserving ID', () => {
      const field: SubstitutionField = {
        id: 'preserved-id',
        fieldName: 'test',
        textIndex: 0
      };

      manager.insertAt(10, field);

      expect(manager.getFieldAt(10)?.id).toBe('preserved-id');
      expect(field.textIndex).toBe(10);
    });

    it('should emit field-added event', () => {
      const handler = vi.fn();
      manager.on('field-added', handler);

      const field: SubstitutionField = {
        id: 'test-id',
        fieldName: 'test',
        textIndex: 0
      };

      manager.insertAt(5, field);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getFields()', () => {
    it('should return empty map initially', () => {
      expect(manager.getFields().size).toBe(0);
    });

    it('should return all fields', () => {
      manager.insert('f1', 5);
      manager.insert('f2', 10);

      const fields = manager.getFields();

      expect(fields.size).toBe(2);
      expect(fields.get(5)?.fieldName).toBe('f1');
      expect(fields.get(10)?.fieldName).toBe('f2');
    });

    it('should return a copy', () => {
      manager.insert('test', 5);

      const fields = manager.getFields();
      fields.set(99, { id: 'fake', fieldName: 'fake', textIndex: 99 });

      expect(manager.hasFieldAt(99)).toBe(false);
    });
  });

  describe('getFieldsArray()', () => {
    it('should return empty array initially', () => {
      expect(manager.getFieldsArray()).toEqual([]);
    });

    it('should return sorted array', () => {
      manager.insert('f2', 10);
      manager.insert('f1', 5);
      manager.insert('f3', 15);

      const arr = manager.getFieldsArray();

      expect(arr).toHaveLength(3);
      expect(arr[0].textIndex).toBe(5);
      expect(arr[1].textIndex).toBe(10);
      expect(arr[2].textIndex).toBe(15);
    });
  });

  describe('findById()', () => {
    it('should return undefined for non-existent ID', () => {
      expect(manager.findById('nonexistent')).toBeUndefined();
    });

    it('should find field by ID', () => {
      const field = manager.insert('test', 5);

      const found = manager.findById(field.id);

      expect(found).toBe(field);
    });
  });

  describe('findByFieldName()', () => {
    it('should return undefined for non-existent name', () => {
      expect(manager.findByFieldName('nonexistent')).toBeUndefined();
    });

    it('should find field by name', () => {
      manager.insert('username', 5);

      const found = manager.findByFieldName('username');

      expect(found?.fieldName).toBe('username');
    });

    it('should return first match for duplicates', () => {
      manager.insert('duplicate', 5);
      manager.insert('duplicate', 10);

      const found = manager.findByFieldName('duplicate');

      expect(found).toBeDefined();
    });
  });

  describe('findAllByFieldName()', () => {
    it('should return empty array for no matches', () => {
      expect(manager.findAllByFieldName('nonexistent')).toEqual([]);
    });

    it('should find all fields with name', () => {
      manager.insert('name', 5);
      manager.insert('other', 10);
      manager.insert('name', 15);

      const found = manager.findAllByFieldName('name');

      expect(found).toHaveLength(2);
    });
  });

  describe('isPageNumberField()', () => {
    it('should return true for page number field', () => {
      const field = manager.insert('page', 5, { fieldType: 'pageNumber' });
      expect(manager.isPageNumberField(field)).toBe(true);
    });

    it('should return false for regular field', () => {
      const field = manager.insert('name', 5);
      expect(manager.isPageNumberField(field)).toBe(false);
    });
  });

  describe('isPageCountField()', () => {
    it('should return true for page count field', () => {
      const field = manager.insert('pages', 5, { fieldType: 'pageCount' });
      expect(manager.isPageCountField(field)).toBe(true);
    });

    it('should return false for regular field', () => {
      const field = manager.insert('name', 5);
      expect(manager.isPageCountField(field)).toBe(false);
    });
  });

  describe('isSpecialField()', () => {
    it('should return true for page number field', () => {
      const field = manager.insert('page', 5, { fieldType: 'pageNumber' });
      expect(manager.isSpecialField(field)).toBe(true);
    });

    it('should return true for page count field', () => {
      const field = manager.insert('pages', 5, { fieldType: 'pageCount' });
      expect(manager.isSpecialField(field)).toBe(true);
    });

    it('should return false for regular field', () => {
      const field = manager.insert('name', 5);
      expect(manager.isSpecialField(field)).toBe(false);
    });
  });

  describe('getPageNumberFields()', () => {
    it('should return only page number fields', () => {
      manager.insert('page', 5, { fieldType: 'pageNumber' });
      manager.insert('name', 10);
      manager.insert('page2', 15, { fieldType: 'pageNumber' });

      const pageFields = manager.getPageNumberFields();

      expect(pageFields).toHaveLength(2);
      expect(pageFields.every(f => f.fieldType === 'pageNumber')).toBe(true);
    });
  });

  describe('getPageCountFields()', () => {
    it('should return only page count fields', () => {
      manager.insert('pages', 5, { fieldType: 'pageCount' });
      manager.insert('name', 10);
      manager.insert('pages2', 15, { fieldType: 'pageCount' });

      const pageFields = manager.getPageCountFields();

      expect(pageFields).toHaveLength(2);
      expect(pageFields.every(f => f.fieldType === 'pageCount')).toBe(true);
    });
  });

  describe('getDataFields()', () => {
    it('should return only data fields', () => {
      manager.insert('name', 5);
      manager.insert('page', 10, { fieldType: 'pageNumber' });
      manager.insert('email', 15, { fieldType: 'data' });

      const dataFields = manager.getDataFields();

      expect(dataFields).toHaveLength(2);
    });
  });

  describe('shiftFields()', () => {
    it('should shift fields after insertion point', () => {
      manager.insert('f1', 5);
      manager.insert('f2', 10);

      manager.shiftFields(7, 3);

      expect(manager.hasFieldAt(5)).toBe(true); // Before insertion
      expect(manager.hasFieldAt(10)).toBe(false); // Moved
      expect(manager.hasFieldAt(13)).toBe(true); // New position
    });

    it('should update field textIndex property', () => {
      const field = manager.insert('test', 10);

      manager.shiftFields(5, 5);

      expect(field.textIndex).toBe(15);
    });

    it('should shift fields at insertion point', () => {
      manager.insert('test', 5);

      manager.shiftFields(5, 3);

      expect(manager.hasFieldAt(5)).toBe(false);
      expect(manager.hasFieldAt(8)).toBe(true);
    });

    it('should emit fields-shifted event', () => {
      const handler = vi.fn();
      manager.on('fields-shifted', handler);

      manager.insert('test', 10);
      manager.shiftFields(5, 3);

      expect(handler).toHaveBeenCalledWith({ fromIndex: 5, delta: 3 });
    });

    it('should not emit event if no fields shifted', () => {
      const handler = vi.fn();
      manager.on('fields-shifted', handler);

      manager.insert('test', 5);
      manager.shiftFields(10, 3);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('handleDeletion()', () => {
    it('should remove fields within deleted range', () => {
      manager.insert('f1', 5);
      manager.insert('f2', 8);
      manager.insert('f3', 15);

      const removed = manager.handleDeletion(5, 5);

      expect(removed).toHaveLength(2);
      expect(manager.hasFieldAt(5)).toBe(false);
      expect(manager.hasFieldAt(8)).toBe(false);
    });

    it('should shift fields after deleted range', () => {
      manager.insert('test', 15);

      manager.handleDeletion(5, 5);

      expect(manager.hasFieldAt(15)).toBe(false);
      expect(manager.hasFieldAt(10)).toBe(true);
    });

    it('should emit field-removed for deleted fields', () => {
      const handler = vi.fn();
      manager.on('field-removed', handler);

      manager.insert('test', 7);
      manager.handleDeletion(5, 5);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit fields-changed event', () => {
      const handler = vi.fn();
      manager.on('fields-changed', handler);

      manager.insert('test', 7);
      manager.handleDeletion(5, 5);

      expect(handler).toHaveBeenCalled();
    });

    it('should not affect fields before range', () => {
      manager.insert('test', 3);

      manager.handleDeletion(5, 5);

      expect(manager.hasFieldAt(3)).toBe(true);
    });

    it('should return empty array if no fields affected', () => {
      manager.insert('test', 20);

      const removed = manager.handleDeletion(5, 3);

      expect(removed).toEqual([]);
    });
  });

  describe('updateFieldConfig()', () => {
    it('should update field name', () => {
      manager.insert('old', 5);

      const result = manager.updateFieldConfig(5, { fieldName: 'new' });

      expect(result).toBe(true);
      expect(manager.getFieldAt(5)?.fieldName).toBe('new');
    });

    it('should update display format', () => {
      manager.insert('test', 5);

      manager.updateFieldConfig(5, { displayFormat: '$%d' });

      expect(manager.getFieldAt(5)?.displayFormat).toBe('$%d');
    });

    it('should update default value', () => {
      manager.insert('test', 5);

      manager.updateFieldConfig(5, { defaultValue: 'N/A' });

      expect(manager.getFieldAt(5)?.defaultValue).toBe('N/A');
    });

    it('should emit field-updated event', () => {
      const handler = vi.fn();
      manager.on('field-updated', handler);

      manager.insert('test', 5);
      manager.updateFieldConfig(5, { fieldName: 'updated' });

      expect(handler).toHaveBeenCalled();
    });

    it('should return false for non-existent field', () => {
      const result = manager.updateFieldConfig(99, { fieldName: 'test' });
      expect(result).toBe(false);
    });
  });

  describe('setFieldFormatting()', () => {
    it('should set field formatting', () => {
      manager.insert('test', 5);

      const formatting = { ...DEFAULT_FORMATTING, color: '#ff0000' };
      const result = manager.setFieldFormatting(5, formatting);

      expect(result).toBe(true);
      expect(manager.getFieldAt(5)?.formatting?.color).toBe('#ff0000');
    });

    it('should emit field-formatting-changed event', () => {
      const handler = vi.fn();
      manager.on('field-formatting-changed', handler);

      manager.insert('test', 5);
      manager.setFieldFormatting(5, DEFAULT_FORMATTING);

      expect(handler).toHaveBeenCalled();
    });

    it('should return false for non-existent field', () => {
      const result = manager.setFieldFormatting(99, DEFAULT_FORMATTING);
      expect(result).toBe(false);
    });
  });

  describe('getFieldFormatting()', () => {
    it('should return custom formatting', () => {
      manager.insert('test', 5, {
        formatting: { ...DEFAULT_FORMATTING, fontSize: 20 }
      });

      const formatting = manager.getFieldFormatting(5);

      expect(formatting.fontSize).toBe(20);
    });

    it('should return default formatting for no custom', () => {
      manager.insert('test', 5);

      const formatting = manager.getFieldFormatting(5);

      expect(formatting).toEqual(DEFAULT_FORMATTING);
    });

    it('should return default formatting for non-existent field', () => {
      const formatting = manager.getFieldFormatting(99);

      expect(formatting).toEqual(DEFAULT_FORMATTING);
    });
  });

  describe('getDisplayText()', () => {
    it('should return {{fieldName}} for data fields', () => {
      const field = manager.insert('username', 5);

      expect(manager.getDisplayText(field)).toBe('{{username}}');
    });

    it('should return page number when provided', () => {
      const field = manager.insert('page', 5, { fieldType: 'pageNumber' });

      expect(manager.getDisplayText(field, 5)).toBe('5');
    });

    it('should return {{page}} without page number', () => {
      const field = manager.insert('page', 5, { fieldType: 'pageNumber' });

      expect(manager.getDisplayText(field)).toBe('{{page}}');
    });

    it('should apply display format to page number', () => {
      const field = manager.insert('page', 5, {
        fieldType: 'pageNumber',
        displayFormat: 'Page %d'
      });

      expect(manager.getDisplayText(field, 3)).toBe('Page 3');
    });

    it('should return page count when provided', () => {
      const field = manager.insert('pages', 5, { fieldType: 'pageCount' });

      expect(manager.getDisplayText(field, undefined, 10)).toBe('10');
    });

    it('should return {{pages}} without page count', () => {
      const field = manager.insert('pages', 5, { fieldType: 'pageCount' });

      expect(manager.getDisplayText(field)).toBe('{{pages}}');
    });

    it('should apply display format to page count', () => {
      const field = manager.insert('pages', 5, {
        fieldType: 'pageCount',
        displayFormat: 'of %d'
      });

      expect(manager.getDisplayText(field, undefined, 10)).toBe('of 10');
    });
  });

  describe('getDisplayTextAt()', () => {
    it('should return display text for field', () => {
      manager.insert('test', 5);

      expect(manager.getDisplayTextAt(5)).toBe('{{test}}');
    });

    it('should return undefined for no field', () => {
      expect(manager.getDisplayTextAt(99)).toBeUndefined();
    });
  });

  describe('count', () => {
    it('should return 0 initially', () => {
      expect(manager.count).toBe(0);
    });

    it('should increase on insert', () => {
      manager.insert('test', 5);
      expect(manager.count).toBe(1);
    });

    it('should decrease on remove', () => {
      manager.insert('test', 5);
      manager.remove(5);
      expect(manager.count).toBe(0);
    });
  });

  describe('isEmpty', () => {
    it('should return true initially', () => {
      expect(manager.isEmpty).toBe(true);
    });

    it('should return false after insert', () => {
      manager.insert('test', 5);
      expect(manager.isEmpty).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all fields', () => {
      manager.insert('f1', 5);
      manager.insert('f2', 10);

      manager.clear();

      expect(manager.count).toBe(0);
    });

    it('should emit fields-cleared event', () => {
      const handler = vi.fn();
      manager.on('fields-cleared', handler);

      manager.insert('test', 5);
      manager.clear();

      expect(handler).toHaveBeenCalled();
    });

    it('should not emit event if already empty', () => {
      const handler = vi.fn();
      manager.on('fields-cleared', handler);

      manager.clear();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('toJSON()', () => {
    it('should serialize all fields', () => {
      manager.insert('f1', 5);
      manager.insert('f2', 10, { displayFormat: '$%d' });

      const json = manager.toJSON();

      expect(json).toHaveLength(2);
      expect(json[0].fieldName).toBe('f1');
      expect(json[1].displayFormat).toBe('$%d');
    });

    it('should return sorted array', () => {
      manager.insert('f2', 10);
      manager.insert('f1', 5);

      const json = manager.toJSON();

      expect(json[0].textIndex).toBe(5);
      expect(json[1].textIndex).toBe(10);
    });
  });

  describe('fromJSON()', () => {
    it('should load fields from data', () => {
      const data: SubstitutionField[] = [
        { id: 'field-100', fieldName: 'name', textIndex: 5 },
        { id: 'field-101', fieldName: 'email', textIndex: 10 }
      ];

      manager.fromJSON(data);

      expect(manager.count).toBe(2);
      expect(manager.getFieldAt(5)?.fieldName).toBe('name');
    });

    it('should clear existing fields', () => {
      manager.insert('old', 5);

      manager.fromJSON([{ id: 'new', fieldName: 'new', textIndex: 10 }]);

      expect(manager.hasFieldAt(5)).toBe(false);
    });

    it('should emit fields-loaded event', () => {
      const handler = vi.fn();
      manager.on('fields-loaded', handler);

      manager.fromJSON([]);

      expect(handler).toHaveBeenCalledWith({ count: 0 });
    });

    it('should update nextId to avoid collisions', () => {
      manager.fromJSON([{ id: 'field-50', fieldName: 'test', textIndex: 5 }]);

      const newField = manager.insert('new', 10);

      expect(parseInt(newField.id.replace('field-', ''))).toBeGreaterThan(50);
    });

    it('should preserve all field properties', () => {
      const data: SubstitutionField[] = [{
        id: 'field-1',
        fieldName: 'amount',
        textIndex: 5,
        fieldType: 'data',
        displayFormat: '$%d',
        defaultValue: '0',
        formatting: { ...DEFAULT_FORMATTING, fontSize: 16 }
      }];

      manager.fromJSON(data);

      const field = manager.getFieldAt(5);
      expect(field?.displayFormat).toBe('$%d');
      expect(field?.defaultValue).toBe('0');
      expect(field?.formatting?.fontSize).toBe(16);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete document workflow', () => {
      // Insert fields
      manager.insert('name', 10);
      manager.insert('page', 20, { fieldType: 'pageNumber' });
      manager.insert('email', 30);

      // Insert text before all fields
      manager.shiftFields(0, 5);

      expect(manager.getFieldAt(15)?.fieldName).toBe('name');
      expect(manager.getFieldAt(25)?.fieldType).toBe('pageNumber');
      expect(manager.getFieldAt(35)?.fieldName).toBe('email');

      // Delete a range with a field
      const removed = manager.handleDeletion(20, 10);

      expect(removed).toHaveLength(1);
      expect(manager.count).toBe(2);

      // Verify remaining
      expect(manager.hasFieldAt(15)).toBe(true);
      expect(manager.hasFieldAt(25)).toBe(true);  // 35 - 10
    });

    it('should handle serialize/deserialize round trip', () => {
      manager.insert('name', 5);
      manager.insert('page', 10, { fieldType: 'pageNumber' });
      manager.setFieldFormatting(5, { ...DEFAULT_FORMATTING, color: '#ff0000' });

      const json = manager.toJSON();

      const newManager = new SubstitutionFieldManager();
      newManager.fromJSON(json);

      expect(newManager.count).toBe(2);
      expect(newManager.getFieldAt(5)?.formatting?.color).toBe('#ff0000');
      expect(newManager.getFieldAt(10)?.fieldType).toBe('pageNumber');
    });
  });
});
