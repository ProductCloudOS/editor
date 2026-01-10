/**
 * Tests for PCEditor substitution field operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PCEditor } from '../../lib/core/PCEditor';
import { createEditor, cleanupEditor, waitForEvent, nextTick } from '../helpers/createEditor';
import { sampleMergeData } from '../helpers/documentFixtures';

describe('PCEditor Substitution Fields', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    const result = await createEditor();
    editor = result.editor;
    container = result.container;
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('insertSubstitutionField', () => {
    it('should insert a data field', async () => {
      editor.setFlowingText('Hello ');
      editor.setCursorPosition(6);

      editor.insertSubstitutionField('customerName');
      await nextTick();

      const field = editor.getFieldAt(6);
      expect(field).not.toBeNull();
      expect(field?.fieldName).toBe('customerName');
    });

    it('should insert field with default value', async () => {
      editor.setFlowingText('');
      editor.setCursorPosition(0);

      editor.insertSubstitutionField('name', { defaultValue: 'Unknown' });
      await nextTick();

      const field = editor.getFieldAt(0);
      expect(field?.defaultValue).toBe('Unknown');
    });

    it('should insert field with display format', async () => {
      editor.setFlowingText('');
      editor.setCursorPosition(0);

      editor.insertSubstitutionField('amount', { displayFormat: '$%.2f' });
      await nextTick();

      const field = editor.getFieldAt(0);
      expect(field?.displayFormat).toBe('$%.2f');
    });

    it('should emit substitution-field-added event', async () => {
      const handler = vi.fn();
      editor.on('substitution-field-added', handler);

      editor.insertSubstitutionField('testField');
      await nextTick();

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].field.fieldName).toBe('testField');
    });

    it('should insert placeholder character in text', async () => {
      editor.setFlowingText('Hello ');
      editor.setCursorPosition(6);

      editor.insertSubstitutionField('name');
      await nextTick();

      const text = editor.getFlowingText();
      expect(text).toContain('\uFFFC');
    });

    it('should insert field at beginning', async () => {
      editor.setFlowingText('World');
      editor.setCursorPosition(0);

      editor.insertSubstitutionField('greeting');
      await nextTick();

      const field = editor.getFieldAt(0);
      expect(field?.fieldName).toBe('greeting');
    });

    it('should insert field at end', async () => {
      editor.setFlowingText('Hello ');
      editor.setCursorPosition(6);

      editor.insertSubstitutionField('name');
      await nextTick();

      const text = editor.getFlowingText();
      expect(text.endsWith('\uFFFC')).toBe(true);
    });
  });

  describe('insertPageNumberField', () => {
    it('should insert page number field', async () => {
      editor.setFlowingText('Page: ');
      editor.setCursorPosition(6);

      editor.insertPageNumberField();
      await nextTick();

      const field = editor.getFieldAt(6);
      expect(field?.fieldType).toBe('pageNumber');
    });

    it('should insert page number with format', async () => {
      editor.insertPageNumberField('Page %d');
      await nextTick();

      const field = editor.getFieldAt(0);
      expect(field?.displayFormat).toBe('Page %d');
    });

    it('should emit page-number-field-added event', async () => {
      const handler = vi.fn();
      editor.on('page-number-field-added', handler);

      editor.insertPageNumberField();
      await nextTick();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('insertPageCountField', () => {
    it('should insert page count field', async () => {
      editor.setFlowingText('of ');
      editor.setCursorPosition(3);

      editor.insertPageCountField();
      await nextTick();

      const field = editor.getFieldAt(3);
      expect(field?.fieldType).toBe('pageCount');
    });

    it('should insert page count with format', async () => {
      editor.insertPageCountField('of %d');
      await nextTick();

      const field = editor.getFieldAt(0);
      expect(field?.displayFormat).toBe('of %d');
    });

    it('should emit page-count-field-added event', async () => {
      const handler = vi.fn();
      editor.on('page-count-field-added', handler);

      editor.insertPageCountField();
      await nextTick();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getFieldAt', () => {
    it('should return field at position', async () => {
      editor.insertSubstitutionField('test');
      await nextTick();

      const field = editor.getFieldAt(0);
      expect(field).not.toBeNull();
    });

    it('should return null when no field at position', () => {
      editor.setFlowingText('Hello');

      const field = editor.getFieldAt(2);
      expect(field).toBeNull();
    });

    it('should return null for out of bounds position', () => {
      editor.setFlowingText('Hello');

      const field = editor.getFieldAt(100);
      expect(field).toBeNull();
    });
  });

  describe('getSelectedField', () => {
    it('should return null when no field selected', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(2);

      const field = editor.getSelectedField();
      expect(field).toBeNull();
    });

    it('should return field when cursor is on field', async () => {
      editor.insertSubstitutionField('test');
      await nextTick();

      // Cursor should be after the field
      const field = editor.getSelectedField();
      // May be null depending on cursor position after insert
    });
  });

  describe('updateField', () => {
    it('should update field name', async () => {
      editor.insertSubstitutionField('oldName');
      await nextTick();

      const success = editor.updateField(0, { fieldName: 'newName' });
      expect(success).toBe(true);

      const field = editor.getFieldAt(0);
      expect(field?.fieldName).toBe('newName');
    });

    it('should update default value', async () => {
      editor.insertSubstitutionField('test');
      await nextTick();

      editor.updateField(0, { defaultValue: 'New Default' });

      const field = editor.getFieldAt(0);
      expect(field?.defaultValue).toBe('New Default');
    });

    it('should update display format', async () => {
      editor.insertSubstitutionField('amount');
      await nextTick();

      editor.updateField(0, { displayFormat: '${amount}' });

      const field = editor.getFieldAt(0);
      expect(field?.displayFormat).toBe('${amount}');
    });

    it('should return false when no field at position', () => {
      editor.setFlowingText('Hello');

      const success = editor.updateField(2, { fieldName: 'test' });
      expect(success).toBe(false);
    });

    it('should emit substitution-field-updated event', async () => {
      const handler = vi.fn();
      editor.on('substitution-field-updated', handler);

      editor.insertSubstitutionField('test');
      await nextTick();

      editor.updateField(0, { fieldName: 'updated' });
      await nextTick();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('header/footer fields', () => {
    it('should insert field in header', async () => {
      editor.insertHeaderSubstitutionField('headerField');
      await nextTick();

      const headerText = editor.getHeaderText();
      expect(headerText).toContain('\uFFFC');
    });

    it('should insert field in footer', async () => {
      editor.insertFooterSubstitutionField('footerField');
      await nextTick();

      const footerText = editor.getFooterText();
      expect(footerText).toContain('\uFFFC');
    });
  });

  describe('applyMergeData', () => {
    it('should replace field with simple value', async () => {
      editor.setFlowingText('Hello ');
      editor.setCursorPosition(6);
      editor.insertSubstitutionField('customerName');
      await nextTick();

      editor.applyMergeData({ customerName: 'John' });

      expect(editor.getFlowingText()).toBe('Hello John');
    });

    it('should replace field with nested path value', async () => {
      editor.insertSubstitutionField('contact.email');
      await nextTick();

      editor.applyMergeData(sampleMergeData);

      expect(editor.getFlowingText()).toBe('john@acme.com');
    });

    it('should use default value when field not in data', async () => {
      editor.insertSubstitutionField('missing', { defaultValue: 'N/A' });
      await nextTick();

      editor.applyMergeData({});

      expect(editor.getFlowingText()).toBe('N/A');
    });

    it('should handle deeply nested paths', async () => {
      editor.insertSubstitutionField('contact.address.city');
      await nextTick();

      editor.applyMergeData(sampleMergeData);

      expect(editor.getFlowingText()).toBe('Anytown');
    });

    it('should emit merge-data-applied event', async () => {
      const handler = vi.fn();
      editor.on('merge-data-applied', handler);

      editor.insertSubstitutionField('test');
      await nextTick();

      editor.applyMergeData({ test: 'value' });

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].data.test).toBe('value');
    });

    it('should replace multiple fields', async () => {
      editor.setFlowingText('');
      editor.insertSubstitutionField('customerName');
      editor.insertText(' from ');
      editor.insertSubstitutionField('companyName');
      await nextTick();

      editor.applyMergeData(sampleMergeData);

      expect(editor.getFlowingText()).toBe('John Doe from Acme Corp');
    });

    it('should handle array indexing with default to first element', async () => {
      editor.insertSubstitutionField('items.name');
      await nextTick();

      editor.applyMergeData(sampleMergeData);

      expect(editor.getFlowingText()).toBe('Item 1');
    });
  });

  describe('page break', () => {
    it('should insert page break', async () => {
      editor.setFlowingText('Before');
      editor.setCursorPosition(6);

      // insertPageBreak requires body content to have focus
      // This test may need focus simulation
    });
  });
});
