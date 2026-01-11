/**
 * Unit tests for MutationUndo
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MutationUndo } from '../../../lib/undo/transaction/MutationUndo';
import { FlowingTextContent } from '../../../lib/text/FlowingTextContent';
import { TextBoxObject } from '../../../lib/objects/TextBoxObject';
import { MutationRecord, ContentSourceId, ObjectSourceId } from '../../../lib/undo/transaction/types';

describe('MutationUndo', () => {
  let mutationUndo: MutationUndo;
  let mockContent: FlowingTextContent;
  let mockObject: TextBoxObject;
  let getContent: ReturnType<typeof vi.fn>;
  let getObject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockContent = new FlowingTextContent('Hello World');
    mockObject = new TextBoxObject({
      id: 'tb-1',
      textIndex: 0,
      size: { width: 100, height: 50 }
    });

    getContent = vi.fn((sourceId: ContentSourceId) => {
      if (sourceId === 'body') return mockContent;
      return null;
    });

    getObject = vi.fn((sourceId: ObjectSourceId) => {
      if (sourceId.objectId === 'tb-1') return mockObject;
      return null;
    });

    mutationUndo = new MutationUndo(getContent, getObject);
  });

  describe('constructor', () => {
    it('should create a MutationUndo instance', () => {
      expect(mutationUndo).toBeInstanceOf(MutationUndo);
    });
  });

  describe('undoMutation() - insert', () => {
    it('should delete inserted text', () => {
      // Setup: pretend we inserted "test" at position 5
      mockContent.insertTextAt(5, 'test');
      expect(mockContent.getText()).toBe('Hellotest World');

      const mutation: MutationRecord = {
        type: 'insert',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          position: 5,
          text: 'test'
        }
      };

      mutationUndo.undoMutation(mutation);

      expect(mockContent.getText()).toBe('Hello World');
    });

    it('should handle missing content source', () => {
      const mutation: MutationRecord = {
        type: 'insert',
        sourceId: 'nonexistent',
        timestamp: Date.now(),
        data: { position: 0, text: 'test' }
      };

      // Should not throw
      expect(() => mutationUndo.undoMutation(mutation)).not.toThrow();
    });
  });

  describe('redoMutation() - insert', () => {
    it('should re-insert text', () => {
      const mutation: MutationRecord = {
        type: 'insert',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          position: 5,
          text: ' inserted'
        }
      };

      mutationUndo.redoMutation(mutation);

      expect(mockContent.getText()).toBe('Hello inserted World');
    });

    it('should restore formatting with inserted text', () => {
      const mutation: MutationRecord = {
        type: 'insert',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          position: 0,
          text: 'Bold',
          formatting: { bold: true }
        }
      };

      mutationUndo.redoMutation(mutation);

      const fm = mockContent.getFormattingManager();
      expect(fm.getFormattingAt(0)?.bold).toBe(true);
    });
  });

  describe('undoMutation() - delete', () => {
    it('should restore deleted text', () => {
      // Start with "Hello World", delete "World"
      mockContent.deleteTextAt(6, 5);
      expect(mockContent.getText()).toBe('Hello ');

      const mutation: MutationRecord = {
        type: 'delete',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          position: 6,
          deletedText: 'World'
        }
      };

      mutationUndo.undoMutation(mutation);

      expect(mockContent.getText()).toBe('Hello World');
    });

    it('should restore deleted formatting', () => {
      // Apply formatting to "World" before deleting
      mockContent.applyFormatting(6, 11, { italic: true });
      mockContent.deleteTextAt(6, 5);

      const mutation: MutationRecord = {
        type: 'delete',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          position: 6,
          deletedText: 'World',
          deletedFormatting: new Map([
            [0, { italic: true }],
            [1, { italic: true }],
            [2, { italic: true }],
            [3, { italic: true }],
            [4, { italic: true }]
          ])
        }
      };

      mutationUndo.undoMutation(mutation);

      const fm = mockContent.getFormattingManager();
      expect(fm.getFormattingAt(6)?.italic).toBe(true);
    });
  });

  describe('redoMutation() - delete', () => {
    it('should re-delete text', () => {
      const mutation: MutationRecord = {
        type: 'delete',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          position: 6,
          deletedText: 'World'
        }
      };

      mutationUndo.redoMutation(mutation);

      expect(mockContent.getText()).toBe('Hello ');
    });
  });

  describe('undoMutation() - format', () => {
    it('should restore previous formatting', () => {
      // Apply bold formatting
      mockContent.applyFormatting(0, 5, { bold: true });

      const mutation: MutationRecord = {
        type: 'format',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          start: 0,
          end: 5,
          newFormatting: { bold: true },
          previousFormatting: new Map([
            [0, { italic: true }],  // Restore to italic instead of bold
            [1, { italic: true }],
            [2, { italic: true }],
            [3, { italic: true }],
            [4, { italic: true }]
          ])
        }
      };

      mutationUndo.undoMutation(mutation);

      const fm = mockContent.getFormattingManager();
      // Should now have italic instead of bold
      expect(fm.getFormattingAt(0)?.italic).toBe(true);
    });
  });

  describe('redoMutation() - format', () => {
    it('should re-apply formatting', () => {
      const mutation: MutationRecord = {
        type: 'format',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          start: 0,
          end: 5,
          newFormatting: { bold: true },
          previousFormatting: new Map()
        }
      };

      mutationUndo.redoMutation(mutation);

      const fm = mockContent.getFormattingManager();
      expect(fm.getFormattingAt(0)?.bold).toBe(true);
    });
  });

  describe('undoMutation() - object-resize', () => {
    it('should restore previous size', () => {
      mockObject.width = 200;
      mockObject.height = 100;

      const mutation: MutationRecord = {
        type: 'object-resize',
        sourceId: { objectId: 'tb-1' },
        timestamp: Date.now(),
        data: {
          previousSize: { width: 100, height: 50 },
          newSize: { width: 200, height: 100 }
        }
      };

      mutationUndo.undoMutation(mutation);

      expect(mockObject.width).toBe(100);
      expect(mockObject.height).toBe(50);
    });

    it('should handle missing object', () => {
      const mutation: MutationRecord = {
        type: 'object-resize',
        sourceId: { objectId: 'nonexistent' },
        timestamp: Date.now(),
        data: {
          previousSize: { width: 100, height: 50 },
          newSize: { width: 200, height: 100 }
        }
      };

      expect(() => mutationUndo.undoMutation(mutation)).not.toThrow();
    });
  });

  describe('redoMutation() - object-resize', () => {
    it('should re-apply new size', () => {
      const mutation: MutationRecord = {
        type: 'object-resize',
        sourceId: { objectId: 'tb-1' },
        timestamp: Date.now(),
        data: {
          previousSize: { width: 100, height: 50 },
          newSize: { width: 200, height: 100 }
        }
      };

      mutationUndo.redoMutation(mutation);

      expect(mockObject.width).toBe(200);
      expect(mockObject.height).toBe(100);
    });
  });

  describe('undoMutation() - object-move', () => {
    it('should restore previous offset', () => {
      mockObject.relativeOffset = { x: 50, y: 30 };

      const mutation: MutationRecord = {
        type: 'object-move',
        sourceId: { objectId: 'tb-1' },
        timestamp: Date.now(),
        data: {
          previousOffset: { x: 0, y: 0 },
          newOffset: { x: 50, y: 30 }
        }
      };

      mutationUndo.undoMutation(mutation);

      expect(mockObject.relativeOffset).toEqual({ x: 0, y: 0 });
    });
  });

  describe('redoMutation() - object-move', () => {
    it('should re-apply new offset', () => {
      const mutation: MutationRecord = {
        type: 'object-move',
        sourceId: { objectId: 'tb-1' },
        timestamp: Date.now(),
        data: {
          previousOffset: { x: 0, y: 0 },
          newOffset: { x: 50, y: 30 }
        }
      };

      mutationUndo.redoMutation(mutation);

      expect(mockObject.relativeOffset).toEqual({ x: 50, y: 30 });
    });
  });

  describe('undoMutation() - object-property', () => {
    it('should restore previous property value', () => {
      mockObject.content = 'New content';

      const mutation: MutationRecord = {
        type: 'object-property',
        sourceId: { objectId: 'tb-1' },
        timestamp: Date.now(),
        data: {
          propertyName: 'content',
          previousValue: 'Old content',
          newValue: 'New content'
        }
      };

      mutationUndo.undoMutation(mutation);

      expect(mockObject.content).toBe('Old content');
    });
  });

  describe('redoMutation() - object-property', () => {
    it('should re-apply new property value', () => {
      mockObject.content = 'Old content';

      const mutation: MutationRecord = {
        type: 'object-property',
        sourceId: { objectId: 'tb-1' },
        timestamp: Date.now(),
        data: {
          propertyName: 'content',
          previousValue: 'Old content',
          newValue: 'New content'
        }
      };

      mutationUndo.redoMutation(mutation);

      expect(mockObject.content).toBe('New content');
    });
  });

  describe('unknown mutation types', () => {
    it('should log warning for unknown undo mutation type', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mutation: MutationRecord = {
        type: 'unknown-type' as any,
        sourceId: 'body',
        timestamp: Date.now(),
        data: {}
      };

      mutationUndo.undoMutation(mutation);

      expect(warnSpy).toHaveBeenCalledWith('Unknown mutation type for undo:', 'unknown-type');
      warnSpy.mockRestore();
    });

    it('should log warning for unknown redo mutation type', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mutation: MutationRecord = {
        type: 'unknown-type' as any,
        sourceId: 'body',
        timestamp: Date.now(),
        data: {}
      };

      mutationUndo.redoMutation(mutation);

      expect(warnSpy).toHaveBeenCalledWith('Unknown mutation type for redo:', 'unknown-type');
      warnSpy.mockRestore();
    });
  });

  describe('alignment mutations', () => {
    beforeEach(() => {
      mockContent.setText('First paragraph\nSecond paragraph');
    });

    it('should undo alignment change', () => {
      const pm = mockContent.getParagraphFormattingManager();
      pm.setAlignment(0, 'center');

      const mutation: MutationRecord = {
        type: 'alignment',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          paragraphIndex: 0,
          previousAlignment: 'left',
          newAlignment: 'center'
        }
      };

      mutationUndo.undoMutation(mutation);

      // Check via getFormattingForParagraph
      expect(pm.getFormattingForParagraph(0).alignment).toBe('left');
    });

    it('should redo alignment change', () => {
      const mutation: MutationRecord = {
        type: 'alignment',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          paragraphIndex: 0,
          previousAlignment: 'left',
          newAlignment: 'right'
        }
      };

      mutationUndo.redoMutation(mutation);

      const pm = mockContent.getParagraphFormattingManager();
      expect(pm.getFormattingForParagraph(0).alignment).toBe('right');
    });
  });

  describe('field mutations', () => {
    it('should undo field insert', () => {
      // Insert a field first
      mockContent.setCursorPosition(5);
      mockContent.insertSubstitutionField('test_field', { fieldType: 'text' });

      const mutation: MutationRecord = {
        type: 'field-insert',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          position: 5,
          field: {
            textIndex: 5,
            fieldName: 'test_field',
            fieldType: 'text'
          }
        }
      };

      mutationUndo.undoMutation(mutation);

      expect(mockContent.getSubstitutionFieldManager().hasFieldAt(5)).toBe(false);
    });

    it('should redo field insert', () => {
      const mutation: MutationRecord = {
        type: 'field-insert',
        sourceId: 'body',
        timestamp: Date.now(),
        data: {
          position: 5,
          field: {
            textIndex: 5,
            fieldName: 'new_field',
            fieldType: 'text'
          }
        }
      };

      mutationUndo.redoMutation(mutation);

      expect(mockContent.getSubstitutionFieldManager().hasFieldAt(5)).toBe(true);
    });
  });
});
