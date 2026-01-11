/**
 * Unit tests for TextState
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextState } from '../../../lib/text/TextState';
import { OBJECT_REPLACEMENT_CHAR } from '../../../lib/text/types';

describe('TextState', () => {
  let state: TextState;

  beforeEach(() => {
    state = new TextState();
  });

  describe('constructor', () => {
    it('should create with empty content by default', () => {
      expect(state.getText()).toBe('');
      expect(state.getCursorPosition()).toBe(0);
    });

    it('should accept initial content', () => {
      const stateWithContent = new TextState('Hello World');
      expect(stateWithContent.getText()).toBe('Hello World');
    });

    it('should set cursor to 0 with initial content', () => {
      const stateWithContent = new TextState('Hello');
      expect(stateWithContent.getCursorPosition()).toBe(0);
    });
  });

  describe('getText() / setText()', () => {
    it('should set and get text', () => {
      state.setText('Hello');
      expect(state.getText()).toBe('Hello');
    });

    it('should emit text-changed event', () => {
      const handler = vi.fn();
      state.on('text-changed', handler);

      state.setText('New text');

      expect(handler).toHaveBeenCalledWith({
        text: 'New text',
        previousContent: '',
        cursorPosition: 0
      });
    });

    it('should clamp cursor position when text is shorter', () => {
      state.setText('Hello World');
      state.setCursorPosition(11);

      state.setText('Hi');

      expect(state.getCursorPosition()).toBe(2);
    });

    it('should handle empty string', () => {
      state.setText('Hello');
      state.setText('');
      expect(state.getText()).toBe('');
      expect(state.getCursorPosition()).toBe(0);
    });

    it('should handle special characters', () => {
      state.setText('Hello\nWorld\t!');
      expect(state.getText()).toBe('Hello\nWorld\t!');
    });

    it('should handle unicode characters', () => {
      state.setText('Hello 世界 🌍');
      expect(state.getText()).toBe('Hello 世界 🌍');
    });
  });

  describe('insertText()', () => {
    it('should insert at cursor position by default', () => {
      state.setText('Hello');
      state.setCursorPosition(5);
      state.insertText(' World');

      expect(state.getText()).toBe('Hello World');
    });

    it('should insert at specified position', () => {
      state.setText('HelloWorld');
      state.insertText(' ', 5);

      expect(state.getText()).toBe('Hello World');
    });

    it('should insert at beginning', () => {
      state.setText('World');
      state.insertText('Hello ', 0);

      expect(state.getText()).toBe('Hello World');
    });

    it('should update cursor position after insert', () => {
      state.setText('Hello');
      state.setCursorPosition(5);
      state.insertText(' World');

      expect(state.getCursorPosition()).toBe(11);
    });

    it('should return new cursor position', () => {
      state.setText('Hello');
      const newPos = state.insertText(' World', 5);

      expect(newPos).toBe(11);
    });

    it('should emit text-inserted event', () => {
      const handler = vi.fn();
      state.on('text-inserted', handler);
      state.setText('Hello');

      state.insertText(' World', 5);

      expect(handler).toHaveBeenCalledWith({
        text: ' World',
        position: 5,
        newCursorPosition: 11,
        previousContent: 'Hello'
      });
    });

    it('should handle empty string insertion', () => {
      state.setText('Hello');
      state.insertText('', 2);

      expect(state.getText()).toBe('Hello');
    });

    it('should handle insertion into empty text', () => {
      state.insertText('Hello');
      expect(state.getText()).toBe('Hello');
    });
  });

  describe('deleteText()', () => {
    it('should delete text range', () => {
      state.setText('Hello World');
      state.deleteText(5, 6);

      expect(state.getText()).toBe('Hello');
    });

    it('should return deleted text', () => {
      state.setText('Hello World');
      const deleted = state.deleteText(5, 6);

      expect(deleted).toBe(' World');
    });

    it('should emit text-deleted event', () => {
      const handler = vi.fn();
      state.on('text-deleted', handler);
      state.setText('Hello World');
      state.setCursorPosition(8); // Set cursor in the range being deleted

      state.deleteText(5, 6);

      expect(handler).toHaveBeenCalledWith({
        start: 5,
        length: 6,
        deletedText: ' World',
        newCursorPosition: 5, // Clamped to start of deleted range
        previousContent: 'Hello World'
      });
    });

    it('should clamp cursor position', () => {
      state.setText('Hello World');
      state.setCursorPosition(8);
      state.deleteText(5, 6);

      expect(state.getCursorPosition()).toBe(5);
    });

    it('should handle delete from beginning', () => {
      state.setText('Hello');
      state.deleteText(0, 2);

      expect(state.getText()).toBe('llo');
    });

    it('should handle delete to end', () => {
      state.setText('Hello');
      state.deleteText(3, 2);

      expect(state.getText()).toBe('Hel');
    });

    it('should handle delete all', () => {
      state.setText('Hello');
      state.deleteText(0, 5);

      expect(state.getText()).toBe('');
    });
  });

  describe('backspace()', () => {
    it('should delete character before cursor', () => {
      state.setText('Hello');
      state.setCursorPosition(5);
      state.backspace();

      expect(state.getText()).toBe('Hell');
      expect(state.getCursorPosition()).toBe(4);
    });

    it('should return true when character deleted', () => {
      state.setText('Hello');
      state.setCursorPosition(5);

      expect(state.backspace()).toBe(true);
    });

    it('should return false at beginning of text', () => {
      state.setText('Hello');
      state.setCursorPosition(0);

      expect(state.backspace()).toBe(false);
      expect(state.getText()).toBe('Hello');
    });

    it('should delete substitution field when cursor is after it', () => {
      state.setText(`Hello${OBJECT_REPLACEMENT_CHAR}World`);
      state.setFieldCheckCallback((pos) => pos === 5);
      state.setCursorPosition(6);

      const result = state.backspace();

      expect(result).toBe(true);
      expect(state.getText()).toBe('HelloWorld');
    });
  });

  describe('deleteForward()', () => {
    it('should delete character at cursor', () => {
      state.setText('Hello');
      state.setCursorPosition(0);
      state.deleteForward();

      expect(state.getText()).toBe('ello');
    });

    it('should return true when character deleted', () => {
      state.setText('Hello');
      state.setCursorPosition(0);

      expect(state.deleteForward()).toBe(true);
    });

    it('should return false at end of text', () => {
      state.setText('Hello');
      state.setCursorPosition(5);

      expect(state.deleteForward()).toBe(false);
      expect(state.getText()).toBe('Hello');
    });

    it('should delete substitution field at cursor', () => {
      state.setText(`Hello${OBJECT_REPLACEMENT_CHAR}World`);
      state.setFieldCheckCallback((pos) => pos === 5);
      state.setCursorPosition(5);

      const result = state.deleteForward();

      expect(result).toBe(true);
      expect(state.getText()).toBe('HelloWorld');
    });
  });

  describe('cursor operations', () => {
    describe('getCursorPosition() / setCursorPosition()', () => {
      it('should set and get cursor position', () => {
        state.setText('Hello');
        state.setCursorPosition(3);

        expect(state.getCursorPosition()).toBe(3);
      });

      it('should clamp to minimum 0', () => {
        state.setText('Hello');
        state.setCursorPosition(-5);

        expect(state.getCursorPosition()).toBe(0);
      });

      it('should clamp to maximum text length', () => {
        state.setText('Hello');
        state.setCursorPosition(100);

        expect(state.getCursorPosition()).toBe(5);
      });

      it('should emit cursor-moved event', () => {
        const handler = vi.fn();
        state.setText('Hello');
        state.on('cursor-moved', handler);

        state.setCursorPosition(3);

        expect(handler).toHaveBeenCalledWith({
          position: 3,
          previousPosition: 0
        });
      });

      it('should not emit event if position unchanged', () => {
        const handler = vi.fn();
        state.setText('Hello');
        state.setCursorPosition(3);
        state.on('cursor-moved', handler);

        state.setCursorPosition(3);

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('moveCursor()', () => {
      it('should move cursor by positive delta', () => {
        state.setText('Hello');
        state.setCursorPosition(0);
        state.moveCursor(3);

        expect(state.getCursorPosition()).toBe(3);
      });

      it('should move cursor by negative delta', () => {
        state.setText('Hello');
        state.setCursorPosition(5);
        state.moveCursor(-2);

        expect(state.getCursorPosition()).toBe(3);
      });

      it('should handle delta of 0', () => {
        state.setText('Hello');
        state.setCursorPosition(2);
        state.moveCursor(0);

        expect(state.getCursorPosition()).toBe(2);
      });
    });

    describe('moveCursorLeft()', () => {
      it('should move cursor left by one', () => {
        state.setText('Hello');
        state.setCursorPosition(3);
        state.moveCursorLeft();

        expect(state.getCursorPosition()).toBe(2);
      });

      it('should not move past beginning', () => {
        state.setText('Hello');
        state.setCursorPosition(0);
        state.moveCursorLeft();

        expect(state.getCursorPosition()).toBe(0);
      });
    });

    describe('moveCursorRight()', () => {
      it('should move cursor right by one', () => {
        state.setText('Hello');
        state.setCursorPosition(2);
        state.moveCursorRight();

        expect(state.getCursorPosition()).toBe(3);
      });

      it('should not move past end', () => {
        state.setText('Hello');
        state.setCursorPosition(5);
        state.moveCursorRight();

        expect(state.getCursorPosition()).toBe(5);
      });
    });
  });

  describe('content properties', () => {
    describe('length', () => {
      it('should return content length', () => {
        state.setText('Hello');
        expect(state.length).toBe(5);
      });

      it('should return 0 for empty content', () => {
        expect(state.length).toBe(0);
      });
    });

    describe('isEmpty', () => {
      it('should return true for empty content', () => {
        expect(state.isEmpty).toBe(true);
      });

      it('should return false for non-empty content', () => {
        state.setText('Hello');
        expect(state.isEmpty).toBe(false);
      });
    });
  });

  describe('string operations', () => {
    describe('charAt()', () => {
      it('should return character at position', () => {
        state.setText('Hello');
        expect(state.charAt(0)).toBe('H');
        expect(state.charAt(4)).toBe('o');
      });

      it('should return empty string for out of bounds', () => {
        state.setText('Hello');
        expect(state.charAt(10)).toBe('');
      });
    });

    describe('substring()', () => {
      it('should return substring', () => {
        state.setText('Hello World');
        expect(state.substring(0, 5)).toBe('Hello');
        expect(state.substring(6)).toBe('World');
      });
    });

    describe('indexOf()', () => {
      it('should find substring index', () => {
        state.setText('Hello World');
        expect(state.indexOf('World')).toBe(6);
        expect(state.indexOf('xyz')).toBe(-1);
      });

      it('should support start position', () => {
        state.setText('Hello Hello');
        expect(state.indexOf('Hello', 1)).toBe(6);
      });
    });

    describe('clear()', () => {
      it('should clear all content', () => {
        state.setText('Hello');
        state.clear();

        expect(state.getText()).toBe('');
        expect(state.getCursorPosition()).toBe(0);
      });
    });
  });

  describe('selection operations', () => {
    describe('setSelectionAnchor()', () => {
      it('should set anchor at current cursor by default', () => {
        state.setText('Hello');
        state.setCursorPosition(3);
        state.setSelectionAnchor();

        expect(state.hasSelectionAnchor()).toBe(true);
      });

      it('should set anchor at specified position', () => {
        state.setText('Hello');
        state.setSelectionAnchor(2);

        expect(state.hasSelectionAnchor()).toBe(true);
      });
    });

    describe('getSelection()', () => {
      it('should return null when no anchor', () => {
        state.setText('Hello');
        expect(state.getSelection()).toBeNull();
      });

      it('should return null when anchor equals cursor', () => {
        state.setText('Hello');
        state.setCursorPosition(3);
        state.setSelectionAnchor(3);

        expect(state.getSelection()).toBeNull();
      });

      it('should return selection range with start < end', () => {
        state.setText('Hello');
        state.setSelectionAnchor(1);
        state.setCursorPosition(4);

        expect(state.getSelection()).toEqual({ start: 1, end: 4 });
      });

      it('should normalize selection when cursor before anchor', () => {
        state.setText('Hello');
        state.setSelectionAnchor(4);
        state.setCursorPosition(1);

        expect(state.getSelection()).toEqual({ start: 1, end: 4 });
      });
    });

    describe('hasSelection()', () => {
      it('should return false when no selection', () => {
        state.setText('Hello');
        expect(state.hasSelection()).toBe(false);
      });

      it('should return true when selection exists', () => {
        state.setText('Hello');
        state.setSelectionAnchor(1);
        state.setCursorPosition(4);

        expect(state.hasSelection()).toBe(true);
      });
    });

    describe('clearSelection()', () => {
      it('should clear selection anchor', () => {
        state.setText('Hello');
        state.setSelectionAnchor(1);
        state.setCursorPosition(4);

        state.clearSelection();

        expect(state.hasSelectionAnchor()).toBe(false);
        expect(state.getSelection()).toBeNull();
      });

      it('should emit selection-changed event', () => {
        const handler = vi.fn();
        state.setText('Hello');
        state.setSelectionAnchor(1);
        state.on('selection-changed', handler);

        state.clearSelection();

        expect(handler).toHaveBeenCalledWith({ selection: null });
      });

      it('should not emit if no anchor set', () => {
        const handler = vi.fn();
        state.setText('Hello');
        state.on('selection-changed', handler);

        state.clearSelection();

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('getSelectedText()', () => {
      it('should return empty string when no selection', () => {
        state.setText('Hello');
        expect(state.getSelectedText()).toBe('');
      });

      it('should return selected text', () => {
        state.setText('Hello World');
        state.setSelectionAnchor(0);
        state.setCursorPosition(5);

        expect(state.getSelectedText()).toBe('Hello');
      });
    });

    describe('deleteSelection()', () => {
      it('should return false when no selection', () => {
        state.setText('Hello');
        expect(state.deleteSelection()).toBe(false);
      });

      it('should delete selected text', () => {
        state.setText('Hello World');
        state.setSelectionAnchor(5);
        state.setCursorPosition(11);

        const result = state.deleteSelection();

        expect(result).toBe(true);
        expect(state.getText()).toBe('Hello');
      });

      it('should clear selection after delete', () => {
        state.setText('Hello World');
        state.setSelectionAnchor(0);
        state.setCursorPosition(5);

        state.deleteSelection();

        expect(state.hasSelectionAnchor()).toBe(false);
      });
    });

    describe('selectLeft()', () => {
      it('should set anchor if not set', () => {
        state.setText('Hello');
        state.setCursorPosition(3);

        state.selectLeft();

        expect(state.hasSelectionAnchor()).toBe(true);
        expect(state.getCursorPosition()).toBe(2);
      });

      it('should extend selection left', () => {
        state.setText('Hello');
        state.setCursorPosition(5);
        state.setSelectionAnchor(5);

        state.selectLeft();
        state.selectLeft();

        expect(state.getSelection()).toEqual({ start: 3, end: 5 });
      });

      it('should emit selection-changed event', () => {
        const handler = vi.fn();
        state.setText('Hello');
        state.setCursorPosition(3);
        state.on('selection-changed', handler);

        state.selectLeft();

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('selectRight()', () => {
      it('should set anchor if not set', () => {
        state.setText('Hello');
        state.setCursorPosition(2);

        state.selectRight();

        expect(state.hasSelectionAnchor()).toBe(true);
        expect(state.getCursorPosition()).toBe(3);
      });

      it('should extend selection right', () => {
        state.setText('Hello');
        state.setCursorPosition(0);
        state.setSelectionAnchor(0);

        state.selectRight();
        state.selectRight();

        expect(state.getSelection()).toEqual({ start: 0, end: 2 });
      });
    });
  });

  describe('field check callback', () => {
    it('should use callback to identify fields', () => {
      const callback = vi.fn((pos) => pos === 5);
      state.setFieldCheckCallback(callback);
      state.setText(`Hello${OBJECT_REPLACEMENT_CHAR}World`);
      state.setCursorPosition(6);

      state.backspace();

      expect(callback).toHaveBeenCalledWith(5);
    });

    it('should handle null callback', () => {
      state.setFieldCheckCallback(null);
      state.setText(`Hello${OBJECT_REPLACEMENT_CHAR}World`);
      state.setCursorPosition(6);

      // Should delete normally without field check
      state.backspace();
      expect(state.getText()).toBe('HelloWorld');
    });
  });

  describe('edge cases', () => {
    it('should handle very long text', () => {
      const longText = 'a'.repeat(10000);
      state.setText(longText);

      expect(state.length).toBe(10000);
      expect(state.getText()).toBe(longText);
    });

    it('should handle rapid insertions', () => {
      for (let i = 0; i < 100; i++) {
        state.insertText('x');
      }

      expect(state.length).toBe(100);
      expect(state.getCursorPosition()).toBe(100);
    });

    it('should handle mixed operations', () => {
      state.setText('Hello');
      state.insertText(' Beautiful', 5);
      state.deleteText(6, 9);
      state.insertText('World', 6);

      expect(state.getText()).toBe('Hello World');
    });
  });
});
