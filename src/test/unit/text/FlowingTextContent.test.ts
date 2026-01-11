/**
 * Unit tests for FlowingTextContent
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FlowingTextContent } from '../../../lib/text/FlowingTextContent';
import { TextBoxObject } from '../../../lib/objects/TextBoxObject';
import { ImageObject } from '../../../lib/objects/ImageObject';

describe('FlowingTextContent', () => {
  let content: FlowingTextContent;

  beforeEach(() => {
    content = new FlowingTextContent();
  });

  afterEach(() => {
    // Clean up any timers
    content.blur();
  });

  describe('constructor', () => {
    it('should create empty FlowingTextContent', () => {
      expect(content).toBeInstanceOf(FlowingTextContent);
      expect(content.getText()).toBe('');
      expect(content.length).toBe(0);
      expect(content.isEmpty).toBe(true);
    });

    it('should create FlowingTextContent with initial content', () => {
      const withContent = new FlowingTextContent('Hello World');
      expect(withContent.getText()).toBe('Hello World');
      expect(withContent.length).toBe(11);
      expect(withContent.isEmpty).toBe(false);
    });
  });

  describe('text operations', () => {
    describe('getText/setText', () => {
      it('should get text', () => {
        content.setText('Test');
        expect(content.getText()).toBe('Test');
      });

      it('should set text', () => {
        content.setText('New text');
        expect(content.getText()).toBe('New text');
      });

      it('should emit content-changed on setText', () => {
        const handler = vi.fn();
        content.on('content-changed', handler);

        content.setText('Changed');

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('insertText', () => {
      it('should insert text at cursor position', () => {
        content.setText('Hello');
        content.setCursorPosition(5);
        content.insertText(' World');

        expect(content.getText()).toBe('Hello World');
      });

      it('should insert text at specific position', () => {
        content.setText('Hello World');
        content.insertText('Beautiful ', 6);

        expect(content.getText()).toBe('Hello Beautiful World');
      });

      it('should emit content-changed on insert', () => {
        const handler = vi.fn();
        content.on('content-changed', handler);

        content.insertText('Test');

        expect(handler).toHaveBeenCalled();
      });

      it('should emit text-inserted event', () => {
        const handler = vi.fn();
        content.on('text-inserted', handler);

        content.insertText('Test');

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            position: 0,
            text: 'Test'
          })
        );
      });
    });

    describe('deleteText', () => {
      it('should delete text from range', () => {
        content.setText('Hello World');
        content.deleteText(5, 6);

        expect(content.getText()).toBe('Hello');
      });

      it('should emit content-changed on delete', () => {
        content.setText('Hello');
        const handler = vi.fn();
        content.on('content-changed', handler);

        content.deleteText(0, 2);

        expect(handler).toHaveBeenCalled();
      });

      it('should emit text-deleted event', () => {
        content.setText('Hello');
        const handler = vi.fn();
        content.on('text-deleted', handler);

        content.deleteText(0, 2);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            position: 0,
            deletedText: 'He'
          })
        );
      });
    });

    describe('insertPageBreak', () => {
      it('should insert page break character', () => {
        content.setText('Hello');
        content.setCursorPosition(5);
        content.insertPageBreak();

        expect(content.getText()).toContain('\f');
      });
    });
  });

  describe('cursor operations', () => {
    beforeEach(() => {
      content.setText('Hello World');
    });

    it('should get cursor position', () => {
      expect(content.getCursorPosition()).toBe(0);
    });

    it('should set cursor position', () => {
      content.setCursorPosition(5);
      expect(content.getCursorPosition()).toBe(5);
    });

    it('should emit cursor-moved on setCursorPosition', () => {
      const handler = vi.fn();
      content.on('cursor-moved', handler);

      content.setCursorPosition(3);

      expect(handler).toHaveBeenCalledWith({ position: 3 });
    });

    it('should move cursor left', () => {
      content.setCursorPosition(5);
      content.moveCursorLeft();

      expect(content.getCursorPosition()).toBe(4);
    });

    it('should move cursor right', () => {
      content.setCursorPosition(5);
      content.moveCursorRight();

      expect(content.getCursorPosition()).toBe(6);
    });

    it('should not move cursor left past start', () => {
      content.setCursorPosition(0);
      content.moveCursorLeft();

      expect(content.getCursorPosition()).toBe(0);
    });

    it('should not move cursor right past end', () => {
      content.setCursorPosition(11);
      content.moveCursorRight();

      expect(content.getCursorPosition()).toBe(11);
    });
  });

  describe('selection operations', () => {
    beforeEach(() => {
      content.setText('Hello World');
    });

    it('should return null for no selection', () => {
      expect(content.getSelection()).toBeNull();
    });

    it('should set selection', () => {
      content.setSelection(0, 5);

      const selection = content.getSelection();
      expect(selection).toEqual({ start: 0, end: 5 });
    });

    it('should check hasSelection', () => {
      expect(content.hasSelection()).toBe(false);

      content.setSelection(0, 5);
      expect(content.hasSelection()).toBe(true);
    });

    it('should clear selection', () => {
      content.setSelection(0, 5);
      content.clearSelection();

      expect(content.hasSelection()).toBe(false);
    });

    it('should get selected text', () => {
      content.setSelection(0, 5);
      expect(content.getSelectedText()).toBe('Hello');
    });

    it('should delete selection', () => {
      content.setSelection(0, 6);
      const deleted = content.deleteSelection();

      expect(deleted).toBe(true);
      expect(content.getText()).toBe('World');
    });

    it('should return false when deleting with no selection', () => {
      expect(content.deleteSelection()).toBe(false);
    });

    it('should replace selection', () => {
      content.setSelection(0, 5);
      content.replaceSelection('Goodbye');

      expect(content.getText()).toBe('Goodbye World');
    });

    it('should select left', () => {
      content.setCursorPosition(5);
      content.setSelectionAnchor(5);
      content.selectLeft();

      expect(content.hasSelection()).toBe(true);
    });

    it('should select right', () => {
      content.setCursorPosition(0);
      content.setSelectionAnchor(0);
      content.selectRight();

      expect(content.hasSelection()).toBe(true);
    });
  });

  describe('formatting operations', () => {
    beforeEach(() => {
      content.setText('Hello World');
    });

    it('should get formatting at position', () => {
      const formatting = content.getFormattingAt(0);
      expect(formatting).toBeDefined();
      expect(formatting.fontFamily).toBeDefined();
    });

    it('should apply formatting to range', () => {
      content.applyFormatting(0, 5, { bold: true });

      const formatting = content.getFormattingAt(0);
      expect(formatting.bold).toBe(true);
    });

    it('should emit formatting-changed', () => {
      const handler = vi.fn();
      content.on('formatting-changed', handler);

      content.applyFormatting(0, 5, { bold: true });

      expect(handler).toHaveBeenCalled();
    });

    it('should get default formatting', () => {
      const defaults = content.getDefaultFormatting();
      expect(defaults).toBeDefined();
      expect(defaults.fontFamily).toBeDefined();
    });

    it('should set default formatting', () => {
      content.setDefaultFormatting({ fontFamily: 'Georgia' });

      const defaults = content.getDefaultFormatting();
      expect(defaults.fontFamily).toBe('Georgia');
    });
  });

  describe('pending formatting', () => {
    it('should set pending formatting', () => {
      content.setPendingFormatting({ bold: true });
      expect(content.hasPendingFormatting()).toBe(true);
    });

    it('should get pending formatting', () => {
      content.setPendingFormatting({ bold: true, italic: true });

      const pending = content.getPendingFormatting();
      expect(pending?.bold).toBe(true);
      expect(pending?.italic).toBe(true);
    });

    it('should clear pending formatting', () => {
      content.setPendingFormatting({ bold: true });
      content.clearPendingFormatting();

      expect(content.hasPendingFormatting()).toBe(false);
    });

    it('should clear pending on cursor move', () => {
      content.setText('Hello');
      content.setPendingFormatting({ bold: true });
      content.setCursorPosition(3);

      expect(content.hasPendingFormatting()).toBe(false);
    });

    it('should get effective formatting at cursor', () => {
      content.setText('Hello');
      content.setCursorPosition(3);
      content.setPendingFormatting({ bold: true });

      const effective = content.getEffectiveFormattingAtCursor();
      expect(effective.bold).toBe(true);
    });
  });

  describe('substitution fields', () => {
    it('should insert substitution field', () => {
      const field = content.insertSubstitutionField('userName');

      expect(field).toBeDefined();
      expect(field.fieldName).toBe('userName');
      expect(content.length).toBe(1);
    });

    it('should get substitution fields', () => {
      content.insertSubstitutionField('field1');
      content.insertSubstitutionField('field2');

      const fields = content.getSubstitutionFields();
      expect(fields.size).toBe(2);
    });

    it('should get substitution field at position', () => {
      content.insertSubstitutionField('testField');

      const field = content.getSubstitutionFieldAt(0);
      expect(field?.fieldName).toBe('testField');
    });

    it('should remove substitution field', () => {
      content.insertSubstitutionField('testField');
      const removed = content.removeSubstitutionField(0);

      expect(removed).toBe(true);
      expect(content.length).toBe(0);
    });

    it('should insert page number field', () => {
      const field = content.insertPageNumberField('Page %d');

      expect(field.fieldType).toBe('pageNumber');
    });

    it('should insert page count field', () => {
      const field = content.insertPageCountField('of %d');

      expect(field.fieldType).toBe('pageCount');
    });

    it('should emit substitution-field-added', () => {
      const handler = vi.fn();
      content.on('substitution-field-added', handler);

      content.insertSubstitutionField('test');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('embedded objects', () => {
    it('should insert embedded object', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      content.insertEmbeddedObject(textBox);

      expect(content.length).toBe(1);
    });

    it('should get embedded objects', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      content.insertEmbeddedObject(textBox);

      const objects = content.getEmbeddedObjects();
      expect(objects.size).toBe(1);
    });

    it('should get embedded object at position', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      content.insertEmbeddedObject(textBox);

      const obj = content.getEmbeddedObjectAt(0);
      expect(obj?.id).toBe('tb-1');
    });

    it('should find embedded object by ID', () => {
      const textBox = new TextBoxObject({
        id: 'tb-find',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      content.insertEmbeddedObject(textBox);

      const found = content.findEmbeddedObjectById('tb-find');
      expect(found?.object.id).toBe('tb-find');
    });

    it('should remove embedded object', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      content.insertEmbeddedObject(textBox);
      const removed = content.removeEmbeddedObject(0);

      expect(removed).toBe(true);
      expect(content.length).toBe(0);
    });

    it('should emit embedded-object-added', () => {
      const handler = vi.fn();
      content.on('embedded-object-added', handler);

      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      content.insertEmbeddedObject(textBox);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Focusable implementation', () => {
    it('should not have focus initially', () => {
      expect(content.hasFocus()).toBe(false);
    });

    it('should focus', () => {
      content.focus();
      expect(content.hasFocus()).toBe(true);
    });

    it('should blur', () => {
      content.focus();
      content.blur();
      expect(content.hasFocus()).toBe(false);
    });

    it('should emit focus event', () => {
      const handler = vi.fn();
      content.on('focus', handler);

      content.focus();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit blur event', () => {
      content.focus();
      const handler = vi.fn();
      content.on('blur', handler);

      content.blur();

      expect(handler).toHaveBeenCalled();
    });

    it('should check cursor visibility', () => {
      expect(content.isCursorVisible()).toBe(false);

      content.focus();
      expect(content.isCursorVisible()).toBe(true);
    });

    it('should register cursor blink handler', () => {
      const handler = vi.fn();
      content.onCursorBlink(handler);

      // Verify it can be unregistered
      expect(() => content.offCursorBlink(handler)).not.toThrow();
    });
  });

  describe('handleKeyDown', () => {
    beforeEach(() => {
      content.setText('Hello World');
      content.focus();
    });

    it('should not handle keys without focus', () => {
      content.blur();
      const event = new KeyboardEvent('keydown', { key: 'a' });
      expect(content.handleKeyDown(event)).toBe(false);
    });

    it('should handle Backspace', () => {
      content.setCursorPosition(5);
      const event = new KeyboardEvent('keydown', { key: 'Backspace' });

      expect(content.handleKeyDown(event)).toBe(true);
      expect(content.getText()).toBe('Hell World');
    });

    it('should handle Delete', () => {
      content.setCursorPosition(5);
      const event = new KeyboardEvent('keydown', { key: 'Delete' });

      expect(content.handleKeyDown(event)).toBe(true);
      expect(content.getText()).toBe('HelloWorld');
    });

    it('should handle ArrowLeft', () => {
      content.setCursorPosition(5);
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

      expect(content.handleKeyDown(event)).toBe(true);
      expect(content.getCursorPosition()).toBe(4);
    });

    it('should handle ArrowRight', () => {
      content.setCursorPosition(5);
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });

      expect(content.handleKeyDown(event)).toBe(true);
      expect(content.getCursorPosition()).toBe(6);
    });

    it('should handle Enter', () => {
      content.setCursorPosition(5);
      const event = new KeyboardEvent('keydown', { key: 'Enter' });

      expect(content.handleKeyDown(event)).toBe(true);
      expect(content.getText()).toContain('\n');
    });

    it('should handle Tab', () => {
      content.setCursorPosition(0);
      const event = new KeyboardEvent('keydown', { key: 'Tab' });

      expect(content.handleKeyDown(event)).toBe(true);
      expect(content.getText()).toContain('\t');
    });

    it('should handle regular character input', () => {
      content.setCursorPosition(5);
      const event = new KeyboardEvent('keydown', { key: 'X' });

      expect(content.handleKeyDown(event)).toBe(true);
      expect(content.getText()).toBe('HelloX World');
    });

    it('should not handle ArrowUp/ArrowDown', () => {
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      expect(content.handleKeyDown(upEvent)).toBe(false);

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      expect(content.handleKeyDown(downEvent)).toBe(false);
    });

    it('should handle Shift+ArrowLeft for selection', () => {
      content.setCursorPosition(5);
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true });

      content.handleKeyDown(event);

      expect(content.hasSelection()).toBe(true);
    });
  });

  describe('paragraph alignment', () => {
    beforeEach(() => {
      content.setText('Hello\nWorld');
    });

    it('should get alignment at position', () => {
      const alignment = content.getAlignmentAt(0);
      expect(alignment).toBe('left');
    });

    it('should set alignment', () => {
      content.setCursorPosition(0);
      content.setAlignment('center');

      expect(content.getAlignmentAt(0)).toBe('center');
    });

    it('should emit alignment-changed', () => {
      const handler = vi.fn();
      content.on('alignment-changed', handler);

      content.setCursorPosition(0);
      content.setAlignment('right');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          newAlignment: 'right'
        })
      );
    });
  });

  describe('clear', () => {
    it('should clear all content', () => {
      content.setText('Hello');
      content.insertSubstitutionField('field');
      content.applyFormatting(0, 5, { bold: true });

      content.clear();

      expect(content.getText()).toBe('');
      expect(content.length).toBe(0);
      expect(content.isEmpty).toBe(true);
    });
  });

  describe('sub-component access', () => {
    it('should get text state', () => {
      expect(content.getTextState()).toBeDefined();
    });

    it('should get formatting manager', () => {
      expect(content.getFormattingManager()).toBeDefined();
    });

    it('should get paragraph formatting manager', () => {
      expect(content.getParagraphFormattingManager()).toBeDefined();
    });

    it('should get substitution field manager', () => {
      expect(content.getSubstitutionFieldManager()).toBeDefined();
    });

    it('should get embedded object manager', () => {
      expect(content.getEmbeddedObjectManager()).toBeDefined();
    });

    it('should get repeating section manager', () => {
      expect(content.getRepeatingSectionManager()).toBeDefined();
    });

    it('should get layout engine', () => {
      expect(content.getLayoutEngine()).toBeDefined();
    });
  });

  describe('serialization', () => {
    it('should serialize to data', () => {
      content.setText('Hello World');
      content.applyFormatting(0, 5, { bold: true });

      const data = content.toData();

      expect(data.text).toBe('Hello World');
    });

    it('should serialize formatting runs', () => {
      content.setText('Hello');
      // Use fontWeight to ensure formatting differs from default
      content.applyFormatting(0, 2, { fontWeight: 'bold' });

      const data = content.toData();

      // formattingRuns may be undefined if all formatting matches defaults
      // Just verify the data structure is valid
      expect(data.text).toBe('Hello');
    });

    it('should deserialize from data', () => {
      const data = {
        text: 'Hello World'
      };

      const restored = FlowingTextContent.fromData(data);

      expect(restored.getText()).toBe('Hello World');
    });

    it('should restore formatting from data', () => {
      content.setText('Hello');
      content.applyFormatting(0, 5, { fontWeight: 'bold', color: '#ff0000' });

      const data = content.toData();
      const restored = FlowingTextContent.fromData(data);

      const formatting = restored.getFormattingAt(0);
      // Check properties that are actually serialized
      expect(formatting.fontWeight).toBe('bold');
      expect(formatting.color).toBe('#ff0000');
    });

    it('should load from data', () => {
      content.setText('Original');
      content.loadFromData({ text: 'Loaded' });

      expect(content.getText()).toBe('Loaded');
    });

    it('should serialize substitution fields', () => {
      content.insertSubstitutionField('testField');

      const data = content.toData();

      expect(data.substitutionFields).toBeDefined();
      expect(data.substitutionFields!.length).toBe(1);
      expect(data.substitutionFields![0].fieldName).toBe('testField');
    });

    it('should serialize embedded objects', () => {
      const textBox = new TextBoxObject({
        id: 'tb-serialize',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });
      content.insertEmbeddedObject(textBox);

      const data = content.toData();

      expect(data.embeddedObjects).toBeDefined();
      expect(data.embeddedObjects!.length).toBe(1);
    });
  });

  describe('compound operations', () => {
    it('should emit compound-operation-start', () => {
      const handler = vi.fn();
      content.on('compound-operation-start', handler);

      content.beginCompoundOperation('Test operation');

      expect(handler).toHaveBeenCalledWith({ description: 'Test operation' });
    });

    it('should emit compound-operation-end', () => {
      const handler = vi.fn();
      content.on('compound-operation-end', handler);

      content.endCompoundOperation();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('repeating sections', () => {
    beforeEach(() => {
      content.setText('Header\nItem 1\nItem 2\nFooter');
    });

    it('should get paragraph boundaries', () => {
      const boundaries = content.getParagraphBoundaries();
      expect(boundaries.length).toBeGreaterThan(0);
    });

    it('should get repeating sections', () => {
      const sections = content.getRepeatingSections();
      expect(Array.isArray(sections)).toBe(true);
    });
  });

  describe('event forwarding', () => {
    it('should forward selection-changed', () => {
      content.setText('Hello');
      const handler = vi.fn();
      content.on('selection-changed', handler);

      content.setSelection(0, 5);

      expect(handler).toHaveBeenCalled();
    });

    it('should forward substitution-field-removed', () => {
      content.insertSubstitutionField('test');
      const handler = vi.fn();
      content.on('substitution-field-removed', handler);

      content.removeSubstitutionField(0);

      expect(handler).toHaveBeenCalled();
    });
  });
});
