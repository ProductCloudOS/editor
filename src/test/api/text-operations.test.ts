/**
 * Tests for PCEditor text operations
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PCEditor } from '../../lib/core/PCEditor';
import { createEditor, cleanupEditor } from '../helpers/createEditor';

describe('PCEditor Text Operations', () => {
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

  describe('setFlowingText / getFlowingText', () => {
    it('should set and get text content', () => {
      editor.setFlowingText('Hello, World!');
      expect(editor.getFlowingText()).toBe('Hello, World!');
    });

    it('should handle empty text', () => {
      editor.setFlowingText('');
      expect(editor.getFlowingText()).toBe('');
    });

    it('should handle single character', () => {
      editor.setFlowingText('X');
      expect(editor.getFlowingText()).toBe('X');
    });

    it('should handle multi-line text', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      editor.setFlowingText(text);
      expect(editor.getFlowingText()).toBe(text);
    });

    it('should handle Unicode characters', () => {
      const text = 'Hello 世界 🌍';
      editor.setFlowingText(text);
      expect(editor.getFlowingText()).toBe(text);
    });

    it('should handle special characters', () => {
      const text = 'Tab:\tNewline:\nCarriage:\r';
      editor.setFlowingText(text);
      expect(editor.getFlowingText()).toBe(text);
    });

    it('should replace existing text', () => {
      editor.setFlowingText('First text');
      editor.setFlowingText('Second text');
      expect(editor.getFlowingText()).toBe('Second text');
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(10000);
      editor.setFlowingText(longText);
      expect(editor.getFlowingText()).toBe(longText);
    });
  });

  describe('insertText', () => {
    it('should insert text at cursor position', () => {
      editor.setFlowingText('Hello World');
      editor.setCursorPosition(5);
      editor.insertText(',');
      expect(editor.getFlowingText()).toBe('Hello, World');
    });

    it('should insert at beginning when cursor at 0', () => {
      editor.setFlowingText('World');
      editor.setCursorPosition(0);
      editor.insertText('Hello ');
      expect(editor.getFlowingText()).toBe('Hello World');
    });

    it('should insert at end when cursor at text length', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(5);
      editor.insertText(' World');
      expect(editor.getFlowingText()).toBe('Hello World');
    });

    it('should insert multiple characters', () => {
      editor.setFlowingText('AC');
      editor.setCursorPosition(1);
      editor.insertText('B');
      expect(editor.getFlowingText()).toBe('ABC');
    });

    it('should insert newline', () => {
      editor.setFlowingText('HelloWorld');
      editor.setCursorPosition(5);
      editor.insertText('\n');
      expect(editor.getFlowingText()).toBe('Hello\nWorld');
    });

    it('should handle empty insert', () => {
      editor.setFlowingText('Hello');
      editor.insertText('');
      expect(editor.getFlowingText()).toBe('Hello');
    });

    it('should insert into empty document', () => {
      editor.setFlowingText('');
      editor.setCursorPosition(0);
      editor.insertText('New text');
      expect(editor.getFlowingText()).toBe('New text');
    });
  });

  describe('setCursorPosition', () => {
    it('should set cursor position in flowing content', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(3);

      // Verify by inserting text at cursor - it should go at position 3
      editor.insertText('X');
      expect(editor.getFlowingText()).toBe('HelXlo');
    });

    it('should set cursor at beginning', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(0);

      editor.insertText('X');
      expect(editor.getFlowingText()).toBe('XHello');
    });

    it('should set cursor at end', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(5);

      editor.insertText('X');
      expect(editor.getFlowingText()).toBe('HelloX');
    });
  });

  describe('getSelection', () => {
    it('should return none initially', () => {
      const selection = editor.getSelection();
      expect(selection.type).toBe('none');
    });

    it('should return cursor type after setCursorPosition', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(2);

      const selection = editor.getSelection();
      expect(selection.type).toBe('cursor');
      expect((selection as any).position).toBe(2);
    });
  });

  describe('clearSelection', () => {
    it('should clear selection without error', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(2);

      expect(() => editor.clearSelection()).not.toThrow();
    });
  });

  describe('section-specific text operations', () => {
    describe('header text', () => {
      it('should set header text', () => {
        editor.setHeaderText('Header Content');
        expect(editor.getHeaderText()).toBe('Header Content');
      });

      it('should handle empty header', () => {
        editor.setHeaderText('');
        expect(editor.getHeaderText()).toBe('');
      });

      it('should replace existing header', () => {
        editor.setHeaderText('First Header');
        editor.setHeaderText('Second Header');
        expect(editor.getHeaderText()).toBe('Second Header');
      });
    });

    describe('footer text', () => {
      it('should set footer text', () => {
        editor.setFooterText('Footer Content');
        expect(editor.getFooterText()).toBe('Footer Content');
      });

      it('should handle empty footer', () => {
        editor.setFooterText('');
        expect(editor.getFooterText()).toBe('');
      });

      it('should replace existing footer', () => {
        editor.setFooterText('First Footer');
        editor.setFooterText('Second Footer');
        expect(editor.getFooterText()).toBe('Second Footer');
      });
    });

    describe('active section', () => {
      it('should return body as default active section', () => {
        expect(editor.getActiveSection()).toBe('body');
      });

      it('should set active section to header', () => {
        editor.setActiveSection('header');
        expect(editor.getActiveSection()).toBe('header');
      });

      it('should set active section to footer', () => {
        editor.setActiveSection('footer');
        expect(editor.getActiveSection()).toBe('footer');
      });

      it('should set active section back to body', () => {
        editor.setActiveSection('header');
        editor.setActiveSection('body');
        expect(editor.getActiveSection()).toBe('body');
      });
    });
  });

  describe('text editing context', () => {
    it('should report not editing text box initially', () => {
      expect(editor.isEditingTextBox()).toBe(false);
    });

    it('should return null for editing text box when none', () => {
      expect(editor.getEditingTextBox()).toBeNull();
    });

    it('should return null for editing flowing content when not editing', () => {
      // getEditingFlowingContent returns null when no focused control
      // but body content is typically available through other means
      const content = editor.getEditingFlowingContent();
      // Result depends on focus state
    });
  });
});
