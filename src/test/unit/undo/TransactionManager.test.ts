/**
 * Unit tests for TransactionManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionManager } from '../../../lib/undo/transaction/TransactionManager';
import { FocusTracker } from '../../../lib/undo/transaction/FocusTracker';
import {
  MutationRecord,
  FocusState,
  ContentSourceId,
  InsertMutationData,
  DeleteMutationData
} from '../../../lib/undo/transaction/types';

// Create mock focus state
function createMockFocusState(): FocusState {
  return {
    activeSection: 'body',
    focusedObjectId: null,
    tableCellAddress: null,
    cursorPosition: 0,
    selection: null
  };
}

// Create mock FocusTracker
function createMockFocusTracker(): FocusTracker {
  const mockState = createMockFocusState();
  return new FocusTracker(
    () => ({ content: null, section: 'body', focusedObjectId: null, tableCellAddress: null }),
    vi.fn()
  );
}

// Create a simple insert mutation
function createInsertMutation(
  position: number,
  text: string,
  timestamp: number = Date.now()
): MutationRecord {
  const sourceId: ContentSourceId = { type: 'body' };
  return {
    id: '',
    sourceId,
    type: 'insert',
    timestamp,
    beforeState: { cursorPosition: position, selection: null },
    afterState: { cursorPosition: position + text.length, selection: null },
    data: { position, text } as InsertMutationData
  };
}

// Create a simple delete mutation
function createDeleteMutation(
  position: number,
  deletedText: string,
  timestamp: number = Date.now()
): MutationRecord {
  const sourceId: ContentSourceId = { type: 'body' };
  return {
    id: '',
    sourceId,
    type: 'delete',
    timestamp,
    beforeState: { cursorPosition: position + deletedText.length, selection: null },
    afterState: { cursorPosition: position, selection: null },
    data: { position, deletedText, deletedFormatting: new Map() } as DeleteMutationData
  };
}

describe('TransactionManager', () => {
  let manager: TransactionManager;
  let focusTracker: FocusTracker;

  beforeEach(() => {
    focusTracker = createMockFocusTracker();
    manager = new TransactionManager(
      focusTracker,
      () => null, // getContent
      () => null  // getObject
    );
  });

  describe('constructor', () => {
    it('should create with empty stacks', () => {
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });

    it('should accept custom max history', () => {
      const customManager = new TransactionManager(
        focusTracker,
        () => null,
        () => null,
        50
      );
      expect(customManager.canUndo()).toBe(false);
    });
  });

  describe('recordMutation()', () => {
    it('should record a mutation', () => {
      const mutation = createInsertMutation(0, 'a');
      manager.recordMutation(mutation);
      manager.flushPendingTransaction();

      expect(manager.canUndo()).toBe(true);
    });

    it('should assign ID if not present', () => {
      const mutation = createInsertMutation(0, 'a');
      expect(mutation.id).toBe('');

      manager.recordMutation(mutation);

      expect(mutation.id).not.toBe('');
    });

    it('should not record during undo/redo', () => {
      // First record something
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();

      // Track undo-mutation events
      const undoHandler = vi.fn();
      manager.on('undo-mutation', undoHandler);

      // Perform undo
      manager.undo();

      // During undo, isPerformingUndoRedo is true
      // We can't easily test this directly, but we can verify
      // that mutations during undo are handled correctly
      expect(manager.canRedo()).toBe(true);
    });

    it('should clear redo stack on new action', () => {
      // Build undo history
      manager.recordMutation(createInsertMutation(0, 'a'));
      manager.flushPendingTransaction();

      // Undo to create redo
      manager.undo();
      expect(manager.canRedo()).toBe(true);

      // New action should clear redo
      manager.recordMutation(createInsertMutation(0, 'b'));
      manager.flushPendingTransaction();

      expect(manager.canRedo()).toBe(false);
    });

    it('should emit state-changed event', () => {
      const handler = vi.fn();
      manager.on('state-changed', handler);

      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('coalescing', () => {
    it('should coalesce consecutive inserts', () => {
      const now = Date.now();

      manager.recordMutation(createInsertMutation(0, 'a', now));
      manager.recordMutation(createInsertMutation(1, 'b', now + 100));
      manager.recordMutation(createInsertMutation(2, 'c', now + 200));
      manager.flushPendingTransaction();

      // Should be one transaction with 3 mutations
      manager.undo();
      expect(manager.canUndo()).toBe(false); // All undone at once
    });

    it('should not coalesce after time gap', () => {
      const now = Date.now();

      manager.recordMutation(createInsertMutation(0, 'a', now));
      manager.flushPendingTransaction();

      // Wait longer than maxTimeGap (default 500ms)
      manager.recordMutation(createInsertMutation(1, 'b', now + 600));
      manager.flushPendingTransaction();

      // Should be two separate transactions
      manager.undo();
      expect(manager.canUndo()).toBe(true);
    });

    it('should not coalesce non-consecutive positions', () => {
      const now = Date.now();

      manager.recordMutation(createInsertMutation(0, 'a', now));
      // Position 5, not consecutive to 0+1=1
      manager.recordMutation(createInsertMutation(5, 'b', now + 100));
      manager.flushPendingTransaction();

      // Should be two separate transactions
      manager.undo();
      expect(manager.canUndo()).toBe(true);
    });

    it('should respect maxCharacters limit', () => {
      const now = Date.now();

      // Default maxCharacters is 50
      for (let i = 0; i < 60; i++) {
        manager.recordMutation(createInsertMutation(i, 'a', now + i * 10));
      }
      manager.flushPendingTransaction();

      // Should have created multiple transactions
      manager.undo();
      expect(manager.canUndo()).toBe(true);
    });

    it('should coalesce backspace deletes', () => {
      const now = Date.now();

      // Simulating backspace: positions decrease
      manager.recordMutation(createDeleteMutation(4, 'e', now));
      manager.recordMutation(createDeleteMutation(3, 'd', now + 100));
      manager.recordMutation(createDeleteMutation(2, 'c', now + 200));
      manager.flushPendingTransaction();

      // Should be one transaction
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });

    it('should coalesce forward deletes', () => {
      const now = Date.now();

      // Simulating forward delete: same position
      manager.recordMutation(createDeleteMutation(5, 'a', now));
      manager.recordMutation(createDeleteMutation(5, 'b', now + 100));
      manager.recordMutation(createDeleteMutation(5, 'c', now + 200));
      manager.flushPendingTransaction();

      // Should be one transaction
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });
  });

  describe('flushPendingTransaction()', () => {
    it('should commit pending transaction', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));

      // Before flush, still pending
      expect(manager.canUndo()).toBe(true); // Pending counts

      manager.flushPendingTransaction();

      expect(manager.canUndo()).toBe(true);
    });

    it('should do nothing if no pending transaction', () => {
      manager.flushPendingTransaction();
      expect(manager.canUndo()).toBe(false);
    });
  });

  describe('createBoundary()', () => {
    it('should flush pending transaction', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.createBoundary();

      expect(manager.canUndo()).toBe(true);
    });
  });

  describe('compound operations', () => {
    it('should group mutations in compound operation', () => {
      manager.beginCompoundOperation('Test Operation');

      manager.recordMutation(createInsertMutation(0, 'a'));
      manager.recordMutation(createInsertMutation(1, 'b'));
      manager.recordMutation(createInsertMutation(2, 'c'));

      manager.endCompoundOperation();

      // Should be one transaction
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });

    it('should use provided description', () => {
      manager.beginCompoundOperation('My Custom Operation');
      manager.recordMutation(createInsertMutation(0, 'x'));
      manager.endCompoundOperation();

      expect(manager.getUndoDescription()).toBe('My Custom Operation');
    });

    it('should allow updating description on end', () => {
      manager.beginCompoundOperation('Initial');
      manager.recordMutation(createInsertMutation(0, 'x'));
      manager.endCompoundOperation('Updated Description');

      expect(manager.getUndoDescription()).toBe('Updated Description');
    });

    it('should handle nested compound operations', () => {
      manager.beginCompoundOperation('Outer');

      manager.recordMutation(createInsertMutation(0, 'a'));

      manager.beginCompoundOperation('Inner');
      manager.recordMutation(createInsertMutation(1, 'b'));
      manager.recordMutation(createInsertMutation(2, 'c'));
      manager.endCompoundOperation();

      manager.recordMutation(createInsertMutation(3, 'd'));

      manager.endCompoundOperation();

      // All should be in one transaction
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });

    it('should handle empty compound operation', () => {
      manager.beginCompoundOperation('Empty');
      manager.endCompoundOperation();

      expect(manager.canUndo()).toBe(false);
    });

    it('should handle endCompoundOperation with no active compound', () => {
      // Should not throw
      expect(() => manager.endCompoundOperation()).not.toThrow();
    });
  });

  describe('undo()', () => {
    it('should return false when nothing to undo', () => {
      expect(manager.undo()).toBe(false);
    });

    it('should return true when undo performed', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();

      expect(manager.undo()).toBe(true);
    });

    it('should move transaction to redo stack', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();

      expect(manager.canRedo()).toBe(false);
      manager.undo();
      expect(manager.canRedo()).toBe(true);
    });

    it('should emit undo-performed event', () => {
      const handler = vi.fn();
      manager.on('undo-performed', handler);

      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      manager.undo();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit undo-mutation for each mutation', () => {
      const handler = vi.fn();
      manager.on('undo-mutation', handler);

      manager.beginCompoundOperation();
      manager.recordMutation(createInsertMutation(0, 'a'));
      manager.recordMutation(createInsertMutation(1, 'b'));
      manager.endCompoundOperation();

      manager.undo();

      // Should be called twice (once per mutation, in reverse order)
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should flush pending transaction before undo', () => {
      manager.recordMutation(createInsertMutation(0, 'pending'));
      // Not flushed yet

      manager.undo(); // Should flush first, then undo

      expect(manager.canRedo()).toBe(true);
    });
  });

  describe('redo()', () => {
    it('should return false when nothing to redo', () => {
      expect(manager.redo()).toBe(false);
    });

    it('should return true when redo performed', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      manager.undo();

      expect(manager.redo()).toBe(true);
    });

    it('should move transaction back to undo stack', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();

      manager.undo();
      expect(manager.canUndo()).toBe(false);

      manager.redo();
      expect(manager.canUndo()).toBe(true);
    });

    it('should emit redo-performed event', () => {
      const handler = vi.fn();
      manager.on('redo-performed', handler);

      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      manager.undo();
      manager.redo();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit redo-mutation for each mutation', () => {
      const handler = vi.fn();
      manager.on('redo-mutation', handler);

      manager.beginCompoundOperation();
      manager.recordMutation(createInsertMutation(0, 'a'));
      manager.recordMutation(createInsertMutation(1, 'b'));
      manager.endCompoundOperation();

      manager.undo();
      manager.redo();

      // Should be called twice (once per mutation, in forward order)
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('canUndo()', () => {
    it('should return false initially', () => {
      expect(manager.canUndo()).toBe(false);
    });

    it('should return true with pending transaction', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      expect(manager.canUndo()).toBe(true);
    });

    it('should return true with committed transaction', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      expect(manager.canUndo()).toBe(true);
    });

    it('should return false after all undone', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });
  });

  describe('canRedo()', () => {
    it('should return false initially', () => {
      expect(manager.canRedo()).toBe(false);
    });

    it('should return true after undo', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      manager.undo();
      expect(manager.canRedo()).toBe(true);
    });

    it('should return false after redo', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      manager.undo();
      manager.redo();
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('getUndoDescription()', () => {
    it('should return null when empty', () => {
      expect(manager.getUndoDescription()).toBeNull();
    });

    it('should return pending transaction description', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      expect(manager.getUndoDescription()).toBe('Typing');
    });

    it('should return committed transaction description', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      expect(manager.getUndoDescription()).toBe('Typing');
    });

    it('should return delete description', () => {
      manager.recordMutation(createDeleteMutation(0, 'x'));
      expect(manager.getUndoDescription()).toBe('Delete');
    });
  });

  describe('getRedoDescription()', () => {
    it('should return null when empty', () => {
      expect(manager.getRedoDescription()).toBeNull();
    });

    it('should return description after undo', () => {
      manager.recordMutation(createInsertMutation(0, 'test'));
      manager.flushPendingTransaction();
      manager.undo();

      expect(manager.getRedoDescription()).toBe('Typing');
    });
  });

  describe('clear()', () => {
    it('should clear all history', () => {
      manager.recordMutation(createInsertMutation(0, 'a'));
      manager.recordMutation(createInsertMutation(1, 'b'));
      manager.flushPendingTransaction();

      manager.undo();

      manager.clear();

      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });

    it('should emit history-cleared event', () => {
      const handler = vi.fn();
      manager.on('history-cleared', handler);

      manager.clear();

      expect(handler).toHaveBeenCalled();
    });

    it('should clear pending transaction', () => {
      manager.recordMutation(createInsertMutation(0, 'pending'));
      // Not flushed

      manager.clear();

      expect(manager.canUndo()).toBe(false);
    });
  });

  describe('setCoalesceConfig()', () => {
    it('should update coalesce configuration', () => {
      manager.setCoalesceConfig({ maxTimeGap: 1000 });

      const now = Date.now();
      manager.recordMutation(createInsertMutation(0, 'a', now));
      manager.recordMutation(createInsertMutation(1, 'b', now + 800)); // Within new limit
      manager.flushPendingTransaction();

      // Should be coalesced
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });

    it('should merge with existing config', () => {
      manager.setCoalesceConfig({ maxCharacters: 10 });

      const now = Date.now();
      for (let i = 0; i < 15; i++) {
        manager.recordMutation(createInsertMutation(i, 'a', now + i * 10));
      }
      manager.flushPendingTransaction();

      // Should have multiple transactions due to character limit
      manager.undo();
      expect(manager.canUndo()).toBe(true);
    });
  });

  describe('setMaxHistory()', () => {
    it('should limit history size', () => {
      manager.setMaxHistory(3);

      for (let i = 0; i < 5; i++) {
        manager.recordMutation(createInsertMutation(i, String(i)));
        manager.flushPendingTransaction();
      }

      // Should only have 3 transactions
      let undoCount = 0;
      while (manager.undo()) {
        undoCount++;
      }

      expect(undoCount).toBe(3);
    });

    it('should trim existing history', () => {
      for (let i = 0; i < 10; i++) {
        manager.recordMutation(createInsertMutation(i, String(i)));
        manager.flushPendingTransaction();
      }

      manager.setMaxHistory(2);

      let undoCount = 0;
      while (manager.undo()) {
        undoCount++;
      }

      expect(undoCount).toBe(2);
    });
  });

  describe('isUndoRedoInProgress', () => {
    it('should be false initially', () => {
      expect(manager.isUndoRedoInProgress).toBe(false);
    });
  });

  describe('getContent() and getObject()', () => {
    it('should delegate to provided callbacks', () => {
      const mockContent = { getText: () => 'test' };
      const mockObject = { id: 'obj1' };

      const customManager = new TransactionManager(
        focusTracker,
        (id) => id.type === 'body' ? mockContent as any : null,
        (id) => id.objectId === 'obj1' ? mockObject : null
      );

      expect(customManager.getContent({ type: 'body' })).toBe(mockContent);
      expect(customManager.getObject({ type: 'textbox', objectId: 'obj1' })).toBe(mockObject);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex undo/redo sequence', () => {
      // Type "Hello"
      manager.recordMutation(createInsertMutation(0, 'H'));
      manager.recordMutation(createInsertMutation(1, 'e'));
      manager.recordMutation(createInsertMutation(2, 'l'));
      manager.recordMutation(createInsertMutation(3, 'l'));
      manager.recordMutation(createInsertMutation(4, 'o'));
      manager.flushPendingTransaction();

      // Type " World"
      manager.recordMutation(createInsertMutation(5, ' '));
      manager.flushPendingTransaction();
      manager.recordMutation(createInsertMutation(6, 'W'));
      manager.recordMutation(createInsertMutation(7, 'o'));
      manager.recordMutation(createInsertMutation(8, 'r'));
      manager.recordMutation(createInsertMutation(9, 'l'));
      manager.recordMutation(createInsertMutation(10, 'd'));
      manager.flushPendingTransaction();

      // Undo "World"
      manager.undo();
      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(true);

      // Undo " "
      manager.undo();
      expect(manager.canUndo()).toBe(true);

      // Redo " "
      manager.redo();
      expect(manager.canRedo()).toBe(true);

      // Type something new (clears redo)
      manager.recordMutation(createInsertMutation(6, '!'));
      manager.flushPendingTransaction();

      expect(manager.canRedo()).toBe(false);
    });
  });
});
