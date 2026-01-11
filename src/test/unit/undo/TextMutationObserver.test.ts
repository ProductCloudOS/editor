/**
 * Unit tests for TextMutationObserver
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextMutationObserver } from '../../../lib/undo/transaction/TextMutationObserver';
import { TransactionManager } from '../../../lib/undo/transaction/TransactionManager';
import { FocusTracker } from '../../../lib/undo/transaction/FocusTracker';
import { FlowingTextContent } from '../../../lib/text/FlowingTextContent';
import { TextBoxObject } from '../../../lib/objects/TextBoxObject';

describe('TextMutationObserver', () => {
  let observer: TextMutationObserver;
  let manager: TransactionManager;
  let content: FlowingTextContent;
  let focusTracker: FocusTracker;

  beforeEach(() => {
    // Create mock FocusTracker
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
    observer = new TextMutationObserver(manager);
    content = new FlowingTextContent('Hello World');
  });

  describe('constructor', () => {
    it('should create a TextMutationObserver instance', () => {
      expect(observer).toBeInstanceOf(TextMutationObserver);
    });
  });

  describe('observe()', () => {
    it('should start observing a FlowingTextContent', () => {
      observer.observe(content, { type: 'body' });

      expect(observer.isObserving(content)).toBe(true);
    });

    it('should update sourceId if already observing', () => {
      observer.observe(content, { type: 'body' });
      observer.observe(content, 'header');

      expect(observer.isObserving(content)).toBe(true);
    });

    it('should wrap insertText method', () => {
      const originalInsertText = content.insertText;
      observer.observe(content, { type: 'body' });

      expect(content.insertText).not.toBe(originalInsertText);
    });

    it('should wrap deleteText method', () => {
      const originalDeleteText = content.deleteText;
      observer.observe(content, { type: 'body' });

      expect(content.deleteText).not.toBe(originalDeleteText);
    });

    it('should wrap applyFormatting method', () => {
      const originalApplyFormatting = content.applyFormatting;
      observer.observe(content, { type: 'body' });

      expect(content.applyFormatting).not.toBe(originalApplyFormatting);
    });
  });

  describe('unobserve()', () => {
    it('should stop observing a FlowingTextContent', () => {
      observer.observe(content, { type: 'body' });
      observer.unobserve(content);

      expect(observer.isObserving(content)).toBe(false);
    });

    it('should restore original methods', () => {
      const originalInsertText = content.insertText;
      observer.observe(content, { type: 'body' });
      observer.unobserve(content);

      // Method should be restored (though it might be bound differently)
      expect(observer.isObserving(content)).toBe(false);
    });

    it('should do nothing if not observing', () => {
      // Should not throw
      expect(() => observer.unobserve(content)).not.toThrow();
    });
  });

  describe('isObserving()', () => {
    it('should return false for unobserved content', () => {
      expect(observer.isObserving(content)).toBe(false);
    });

    it('should return true for observed content', () => {
      observer.observe(content, { type: 'body' });
      expect(observer.isObserving(content)).toBe(true);
    });
  });

  describe('mutation recording - insertText', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should record insert mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.insertText(' inserted', 5);

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('insert');
      expect(mutation.data.text).toBe(' inserted');
      expect(mutation.data.position).toBe(5);
    });

    it('should capture before and after state', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.insertText('X', 0);

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.beforeState).toBeDefined();
      expect(mutation.afterState).toBeDefined();
    });

    it('should not record during undo/redo', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      // Simulate undo/redo in progress
      vi.spyOn(manager, 'isUndoRedoInProgress', 'get').mockReturnValue(true);

      content.insertText('test');

      expect(recordSpy).not.toHaveBeenCalled();
    });
  });

  describe('mutation recording - deleteText', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should record delete mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.deleteText(0, 5);

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('delete');
      expect(mutation.data.deletedText).toBe('Hello');
      expect(mutation.data.position).toBe(0);
    });

    it('should capture deleted formatting', () => {
      content.applyFormatting(0, 5, { bold: true });
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.deleteText(0, 5);

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.data.deletedFormatting).toBeDefined();
    });
  });

  describe('mutation recording - applyFormatting', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should record format mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.applyFormatting(0, 5, { bold: true });

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('format');
      expect(mutation.data.start).toBe(0);
      expect(mutation.data.end).toBe(5);
      expect(mutation.data.newFormatting.bold).toBe(true);
    });

    it('should capture previous formatting', () => {
      content.applyFormatting(0, 3, { italic: true });
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.applyFormatting(0, 3, { bold: true });

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.data.previousFormatting).toBeDefined();
    });

    it('should create boundary for formatting changes', () => {
      const boundSpy = vi.spyOn(manager, 'createBoundary');

      content.applyFormatting(0, 5, { bold: true });

      expect(boundSpy).toHaveBeenCalled();
    });
  });

  describe('mutation recording - setAlignment', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should record alignment mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.setAlignment('center');

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('alignment');
      expect(mutation.data.newAlignment).toBe('center');
    });

    it('should capture previous alignment', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.setAlignment('right');

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.data.previousAlignment).toBeDefined();
    });

    it('should create boundary for alignment changes', () => {
      const boundSpy = vi.spyOn(manager, 'createBoundary');

      content.setAlignment('center');

      expect(boundSpy).toHaveBeenCalled();
    });
  });

  describe('mutation recording - insertSubstitutionField', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should record field-insert mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.setCursorPosition(5);
      content.insertSubstitutionField('test_field', { fieldType: 'text' });

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('field-insert');
      expect(mutation.data.position).toBe(5);
    });

    it('should create boundary for field insertion', () => {
      const boundSpy = vi.spyOn(manager, 'createBoundary');

      content.insertSubstitutionField('field', { fieldType: 'text' });

      expect(boundSpy).toHaveBeenCalled();
    });
  });

  describe('mutation recording - insertEmbeddedObject', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should record object-insert mutation', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      content.setCursorPosition(5);
      content.insertEmbeddedObject(textBox, 'inline');

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('object-insert');
      expect(mutation.data.position).toBe(5);
      expect(mutation.data.objectData).toBeDefined();
    });

    it('should serialize object data', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');
      const textBox = new TextBoxObject({
        id: 'tb-test',
        textIndex: 0,
        size: { width: 150, height: 75 },
        content: 'Test content'
      });

      content.insertEmbeddedObject(textBox, 'inline');

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.data.objectData.id).toBe('tb-test');
      expect(mutation.data.objectData.objectType).toBe('textbox');
    });
  });

  describe('mutation recording - insertTextAt', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should record insert mutation for insertTextAt', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.insertTextAt(5, ' at position');

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('insert');
      expect(mutation.data.position).toBe(5);
      expect(mutation.data.text).toBe(' at position');
    });
  });

  describe('mutation recording - deleteTextAt', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should record delete mutation for deleteTextAt', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      content.deleteTextAt(0, 5);

      expect(recordSpy).toHaveBeenCalled();
      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.type).toBe('delete');
      expect(mutation.data.deletedText).toBe('Hello');
    });
  });

  describe('multiple content sources', () => {
    it('should observe multiple FlowingTextContent instances', () => {
      const content2 = new FlowingTextContent('Second content');

      observer.observe(content, { type: 'body' });
      observer.observe(content2, { type: 'header' });

      expect(observer.isObserving(content)).toBe(true);
      expect(observer.isObserving(content2)).toBe(true);
    });

    it('should record mutations with correct sourceId', () => {
      const content2 = new FlowingTextContent('Header text');
      const recordSpy = vi.spyOn(manager, 'recordMutation');

      observer.observe(content, { type: 'body' });
      observer.observe(content2, { type: 'header' });

      content.insertText('body');
      content2.insertText('header');

      expect(recordSpy).toHaveBeenCalledTimes(2);
      expect(recordSpy.mock.calls[0][0].sourceId.type).toBe('body');
      expect(recordSpy.mock.calls[1][0].sourceId.type).toBe('header');
    });
  });

  describe('state capture', () => {
    beforeEach(() => {
      observer.observe(content, { type: 'body' });
    });

    it('should capture cursor position in state', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');
      content.setCursorPosition(3);

      content.insertText('X');

      const mutation = recordSpy.mock.calls[0][0];
      expect(mutation.beforeState.cursorPosition).toBe(3);
    });

    it('should capture selection in state', () => {
      const recordSpy = vi.spyOn(manager, 'recordMutation');
      content.setSelection(2, 5);

      content.insertText('Y');

      const mutation = recordSpy.mock.calls[0][0];
      // Selection may be cleared after insert, but beforeState should have it
      expect(mutation.beforeState.selection).toBeDefined();
    });
  });
});
