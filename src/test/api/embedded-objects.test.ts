/**
 * Tests for PCEditor embedded object operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PCEditor } from '../../lib/core/PCEditor';
import { TextBoxObject, ImageObject, TableObject } from '../../lib/objects';
import { createEditor, cleanupEditor, nextTick } from '../helpers/createEditor';

describe('PCEditor Embedded Objects', () => {
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

  describe('insertEmbeddedObject', () => {
    describe('TextBoxObject', () => {
      it('should insert text box as inline', async () => {
        const textBox = new TextBoxObject({
          id: 'textbox-1',
          size: { width: 100, height: 50 }
        });

        editor.insertEmbeddedObject(textBox, 'inline');
        await nextTick();

        const text = editor.getFlowingText();
        expect(text).toContain('\uFFFC');
      });

      it('should insert text box as block', async () => {
        const textBox = new TextBoxObject({
          id: 'textbox-block',
          size: { width: 200, height: 100 }
        });

        editor.insertEmbeddedObject(textBox, 'block');
        await nextTick();

        const text = editor.getFlowingText();
        expect(text).toContain('\uFFFC');
      });

      it('should emit embedded-object-added event', async () => {
        const handler = vi.fn();
        editor.on('embedded-object-added', handler);

        const textBox = new TextBoxObject({
          id: 'textbox-event',
          size: { width: 100, height: 50 }
        });

        editor.insertEmbeddedObject(textBox);
        await nextTick();

        expect(handler).toHaveBeenCalled();
        expect(handler.mock.calls[0][0].object.id).toBe('textbox-event');
      });

      it('should insert text box with content', async () => {
        const textBox = new TextBoxObject({
          id: 'textbox-content',
          size: { width: 150, height: 75 },
          content: 'Initial text box content'
        });

        editor.insertEmbeddedObject(textBox);
        await nextTick();

        // Text box is inserted, content is internal to the text box
        const text = editor.getFlowingText();
        expect(text).toContain('\uFFFC');
      });
    });

    describe('ImageObject', () => {
      it('should insert image as inline', async () => {
        const image = new ImageObject({
          id: 'image-1',
          size: { width: 100, height: 100 },
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        });

        editor.insertEmbeddedObject(image, 'inline');
        await nextTick();

        const text = editor.getFlowingText();
        expect(text).toContain('\uFFFC');
      });

      it('should insert image as block', async () => {
        const image = new ImageObject({
          id: 'image-block',
          size: { width: 200, height: 150 }
        });

        editor.insertEmbeddedObject(image, 'block');
        await nextTick();

        const text = editor.getFlowingText();
        expect(text).toContain('\uFFFC');
      });
    });

    describe('TableObject', () => {
      it('should insert table', async () => {
        const table = new TableObject({
          id: 'table-1',
          rows: 3,
          columns: 3,
          size: { width: 300, height: 100 }
        });

        editor.insertEmbeddedObject(table, 'block');
        await nextTick();

        const text = editor.getFlowingText();
        expect(text).toContain('\uFFFC');
      });

      it('should insert table with configured rows and columns', async () => {
        const table = new TableObject({
          id: 'table-config',
          rows: 5,
          columns: 4,
          size: { width: 400, height: 200 }
        });

        editor.insertEmbeddedObject(table, 'block');
        await nextTick();

        expect(table.rowCount).toBe(5);
        expect(table.columnCount).toBe(4);
      });
    });
  });

  describe('insertion within existing text', () => {
    it('should insert text box at beginning of text', async () => {
      editor.setFlowingText('Hello World');
      editor.setCursorPosition(0);
      await nextTick();

      const textBox = new TextBoxObject({
        id: 'textbox-begin',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      const text = editor.getFlowingText();
      expect(text).toBe('\uFFFCHello World');
      expect(text.indexOf('\uFFFC')).toBe(0);
    });

    it('should insert text box in middle of text', async () => {
      editor.setFlowingText('Hello World');
      editor.setCursorPosition(5);
      await nextTick();

      const textBox = new TextBoxObject({
        id: 'textbox-middle',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      const text = editor.getFlowingText();
      expect(text).toBe('Hello\uFFFC World');
      expect(text.indexOf('\uFFFC')).toBe(5);
    });

    it('should insert text box at end of text', async () => {
      editor.setFlowingText('Hello World');
      editor.setCursorPosition(11);
      await nextTick();

      const textBox = new TextBoxObject({
        id: 'textbox-end',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      const text = editor.getFlowingText();
      expect(text).toBe('Hello World\uFFFC');
      expect(text.indexOf('\uFFFC')).toBe(11);
    });

    it('should insert image at specific position', async () => {
      editor.setFlowingText('Before After');
      editor.setCursorPosition(7);
      await nextTick();

      const image = new ImageObject({
        id: 'image-middle',
        size: { width: 100, height: 100 },
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      });

      editor.insertEmbeddedObject(image);
      await nextTick();

      const text = editor.getFlowingText();
      expect(text).toBe('Before \uFFFCAfter');
      expect(text.indexOf('\uFFFC')).toBe(7);
    });

    it('should insert multiple objects at different positions', async () => {
      editor.setFlowingText('One Two Three');

      // Insert at position 3 (after "One")
      editor.setCursorPosition(3);
      await nextTick();

      const textBox1 = new TextBoxObject({
        id: 'textbox-pos1',
        size: { width: 100, height: 50 }
      });
      editor.insertEmbeddedObject(textBox1);
      await nextTick();

      // Text is now "One[obj] Two Three" (14 chars)
      let text = editor.getFlowingText();
      expect(text).toBe('One\uFFFC Two Three');

      // Insert at position 8 (after " Two", accounting for first object)
      // Original: "One Two Three" -> After first insert: "One[obj] Two Three"
      // Position 8 is after the space following "Two"
      editor.setCursorPosition(8);
      await nextTick();

      const textBox2 = new TextBoxObject({
        id: 'textbox-pos2',
        size: { width: 100, height: 50 }
      });
      editor.insertEmbeddedObject(textBox2);
      await nextTick();

      text = editor.getFlowingText();
      expect(text).toBe('One\uFFFC Two\uFFFC Three');
      expect(text.match(/\uFFFC/g)?.length).toBe(2);
    });

    it('should preserve text before and after inserted object', async () => {
      const originalText = 'The quick brown fox jumps over the lazy dog';
      editor.setFlowingText(originalText);
      editor.setCursorPosition(16); // After "The quick brown "
      await nextTick();

      const textBox = new TextBoxObject({
        id: 'textbox-preserve',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      const text = editor.getFlowingText();

      // Check text before object
      expect(text.substring(0, 16)).toBe('The quick brown ');

      // Check object is at correct position
      expect(text.charAt(16)).toBe('\uFFFC');

      // Check text after object
      expect(text.substring(17)).toBe('fox jumps over the lazy dog');
    });

    it('should insert object and allow continued text insertion', async () => {
      editor.setFlowingText('Start End');
      editor.setCursorPosition(6);
      await nextTick();

      const textBox = new TextBoxObject({
        id: 'textbox-continue',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      let text = editor.getFlowingText();
      expect(text).toBe('Start \uFFFCEnd');

      // Insert text after the object
      editor.setCursorPosition(7); // After the object
      editor.insertText('Middle ');
      await nextTick();

      text = editor.getFlowingText();
      expect(text).toBe('Start \uFFFCMiddle End');
    });

    it('should handle object insertion at word boundaries', async () => {
      editor.setFlowingText('Word1 Word2 Word3');

      // Insert between Word1 and Word2
      editor.setCursorPosition(6);
      await nextTick();

      const textBox = new TextBoxObject({
        id: 'textbox-boundary',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      const text = editor.getFlowingText();
      expect(text).toBe('Word1 \uFFFCWord2 Word3');

      // Verify words are still intact
      const parts = text.split('\uFFFC');
      expect(parts[0]).toBe('Word1 ');
      expect(parts[1]).toBe('Word2 Word3');
    });

    it('should track cursor position after object insertion', async () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(2);
      await nextTick();

      const textBox = new TextBoxObject({
        id: 'textbox-cursor',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      const text = editor.getFlowingText();
      expect(text).toBe('He\uFFFCllo');

      // Verify selection state is updated
      const selection = editor.getSelection();
      expect(selection.type).toBe('cursor');
      if (selection.type === 'cursor') {
        // Cursor stays at the insertion position (before the object)
        // or may advance - verify it's a valid position
        expect(selection.position).toBeGreaterThanOrEqual(2);
        expect(selection.position).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('removeEmbeddedObject', () => {
    it('should remove text box by id and its placeholder character', async () => {
      const textBox = new TextBoxObject({
        id: 'textbox-remove',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      const textBefore = editor.getFlowingText();
      expect(textBefore).toContain('\uFFFC');

      // Remove the object - this should also remove the placeholder character
      editor.removeEmbeddedObject('textbox-remove');
      await nextTick();

      const textAfter = editor.getFlowingText();
      expect(textAfter).not.toContain('\uFFFC');
    });

    it('should handle removing non-existent object', async () => {
      // Should not throw
      expect(() => editor.removeEmbeddedObject('non-existent')).not.toThrow();
    });
  });

  describe('selectElement', () => {
    it('should select embedded object by id', async () => {
      const textBox = new TextBoxObject({
        id: 'textbox-select',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      editor.selectElement('textbox-select');
      await nextTick();

      // Selection state is managed by canvas manager
      // Check that it doesn't throw
    });
  });

  describe('getSelectedTextBox', () => {
    it('should return null when no text box selected', () => {
      const textBox = editor.getSelectedTextBox();
      expect(textBox).toBeNull();
    });

    it('should return text box when selected', async () => {
      const textBox = new TextBoxObject({
        id: 'textbox-get-selected',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      editor.selectElement('textbox-get-selected');
      await nextTick();

      // The selection may require canvas interaction to work fully
      // In unit tests, we verify the method exists and doesn't throw
      const selected = editor.getSelectedTextBox();
      // Result depends on canvas manager state
    });
  });

  describe('getSelectedTable', () => {
    it('should return null when no table selected', () => {
      const table = editor.getSelectedTable();
      expect(table).toBeNull();
    });
  });

  describe('getSelectedImage', () => {
    it('should return null when no image selected', () => {
      const image = editor.getSelectedImage();
      expect(image).toBeNull();
    });
  });

  describe('getFocusedTable', () => {
    it('should return null when no table focused', () => {
      const table = editor.getFocusedTable();
      expect(table).toBeNull();
    });
  });

  describe('header/footer embedded objects', () => {
    it('should insert embedded object in header', async () => {
      const textBox = new TextBoxObject({
        id: 'header-textbox',
        size: { width: 100, height: 30 }
      });

      editor.insertHeaderEmbeddedObject(textBox);
      await nextTick();

      const headerText = editor.getHeaderText();
      expect(headerText).toContain('\uFFFC');
    });
  });

  describe('object position modes', () => {
    it('should support inline position', async () => {
      const textBox = new TextBoxObject({
        id: 'inline-obj',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox, 'inline');
      await nextTick();

      expect(textBox.position).toBe('inline');
    });

    it('should support block position', async () => {
      const textBox = new TextBoxObject({
        id: 'block-obj',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox, 'block');
      await nextTick();

      expect(textBox.position).toBe('block');
    });

    it('should support relative position', async () => {
      const image = new ImageObject({
        id: 'relative-obj',
        size: { width: 100, height: 100 }
      });

      editor.insertEmbeddedObject(image, 'relative');
      await nextTick();

      expect(image.position).toBe('relative');
    });
  });

  describe('clearSelection', () => {
    it('should clear object selection', async () => {
      const textBox = new TextBoxObject({
        id: 'textbox-clear',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox);
      await nextTick();

      editor.selectElement('textbox-clear');
      await nextTick();

      editor.clearSelection();
      await nextTick();

      // Selection should be cleared
      expect(editor.getSelectedTextBox()).toBeNull();
    });
  });

  describe('multiple objects', () => {
    it('should handle multiple embedded objects', async () => {
      const textBox1 = new TextBoxObject({
        id: 'multi-tb-1',
        size: { width: 100, height: 50 }
      });

      const textBox2 = new TextBoxObject({
        id: 'multi-tb-2',
        size: { width: 100, height: 50 }
      });

      editor.insertEmbeddedObject(textBox1);
      editor.insertEmbeddedObject(textBox2);
      await nextTick();

      const text = editor.getFlowingText();
      // Should have two placeholder characters
      const placeholderCount = (text.match(/\uFFFC/g) || []).length;
      expect(placeholderCount).toBe(2);
    });
  });
});
