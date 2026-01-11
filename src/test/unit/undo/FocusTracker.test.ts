/**
 * Unit tests for FocusTracker
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FocusTracker, GetActiveContentFn, RestoreFocusFn } from '../../../lib/undo/transaction/FocusTracker';
import { FocusState } from '../../../lib/undo/transaction/types';
import { FlowingTextContent } from '../../../lib/text/FlowingTextContent';

// Mock FlowingTextContent
function createMockContent(cursorPosition: number, selection: { start: number; end: number } | null) {
  return {
    getCursorPosition: vi.fn(() => cursorPosition),
    getSelection: vi.fn(() => selection)
  } as unknown as FlowingTextContent;
}

describe('FocusTracker', () => {
  let tracker: FocusTracker;
  let getActiveContent: ReturnType<typeof vi.fn>;
  let restoreFocus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getActiveContent = vi.fn();
    restoreFocus = vi.fn();
    tracker = new FocusTracker(getActiveContent, restoreFocus);
  });

  describe('constructor', () => {
    it('should create a FocusTracker instance', () => {
      expect(tracker).toBeInstanceOf(FocusTracker);
    });
  });

  describe('capture()', () => {
    it('should return default state when no active content', () => {
      getActiveContent.mockReturnValue({
        content: null,
        section: 'body',
        focusedObjectId: null,
        tableCellAddress: null
      });

      const state = tracker.capture();

      expect(state).toEqual({
        activeSection: 'body',
        focusedObjectId: null,
        tableCellAddress: null,
        cursorPosition: 0,
        selection: null
      });
    });

    it('should capture body section state', () => {
      const mockContent = createMockContent(42, null);
      getActiveContent.mockReturnValue({
        content: mockContent,
        section: 'body',
        focusedObjectId: null,
        tableCellAddress: null
      });

      const state = tracker.capture();

      expect(state.activeSection).toBe('body');
      expect(state.cursorPosition).toBe(42);
      expect(state.focusedObjectId).toBeNull();
      expect(state.tableCellAddress).toBeNull();
      expect(state.selection).toBeNull();
    });

    it('should capture header section state', () => {
      const mockContent = createMockContent(10, null);
      getActiveContent.mockReturnValue({
        content: mockContent,
        section: 'header',
        focusedObjectId: null,
        tableCellAddress: null
      });

      const state = tracker.capture();

      expect(state.activeSection).toBe('header');
      expect(state.cursorPosition).toBe(10);
    });

    it('should capture footer section state', () => {
      const mockContent = createMockContent(5, null);
      getActiveContent.mockReturnValue({
        content: mockContent,
        section: 'footer',
        focusedObjectId: null,
        tableCellAddress: null
      });

      const state = tracker.capture();

      expect(state.activeSection).toBe('footer');
      expect(state.cursorPosition).toBe(5);
    });

    it('should capture selection state', () => {
      const mockContent = createMockContent(15, { start: 10, end: 20 });
      getActiveContent.mockReturnValue({
        content: mockContent,
        section: 'body',
        focusedObjectId: null,
        tableCellAddress: null
      });

      const state = tracker.capture();

      expect(state.selection).toEqual({ start: 10, end: 20 });
      expect(state.cursorPosition).toBe(15);
    });

    it('should capture focused object state', () => {
      const mockContent = createMockContent(0, null);
      getActiveContent.mockReturnValue({
        content: mockContent,
        section: 'body',
        focusedObjectId: 'textbox-1',
        tableCellAddress: null
      });

      const state = tracker.capture();

      expect(state.focusedObjectId).toBe('textbox-1');
    });

    it('should capture table cell state', () => {
      const mockContent = createMockContent(3, null);
      getActiveContent.mockReturnValue({
        content: mockContent,
        section: 'body',
        focusedObjectId: 'table-1',
        tableCellAddress: { row: 2, col: 3 }
      });

      const state = tracker.capture();

      expect(state.focusedObjectId).toBe('table-1');
      expect(state.tableCellAddress).toEqual({ row: 2, col: 3 });
    });

    it('should call getActiveContent callback', () => {
      getActiveContent.mockReturnValue({
        content: null,
        section: 'body',
        focusedObjectId: null,
        tableCellAddress: null
      });

      tracker.capture();

      expect(getActiveContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('restore()', () => {
    it('should call restoreFocus callback with state', () => {
      const state: FocusState = {
        activeSection: 'body',
        focusedObjectId: null,
        tableCellAddress: null,
        cursorPosition: 25,
        selection: null
      };

      tracker.restore(state);

      expect(restoreFocus).toHaveBeenCalledWith(state);
      expect(restoreFocus).toHaveBeenCalledTimes(1);
    });

    it('should restore header section state', () => {
      const state: FocusState = {
        activeSection: 'header',
        focusedObjectId: null,
        tableCellAddress: null,
        cursorPosition: 10,
        selection: null
      };

      tracker.restore(state);

      expect(restoreFocus).toHaveBeenCalledWith(state);
    });

    it('should restore footer section state', () => {
      const state: FocusState = {
        activeSection: 'footer',
        focusedObjectId: null,
        tableCellAddress: null,
        cursorPosition: 5,
        selection: { start: 2, end: 8 }
      };

      tracker.restore(state);

      expect(restoreFocus).toHaveBeenCalledWith(state);
    });

    it('should restore focused object state', () => {
      const state: FocusState = {
        activeSection: 'body',
        focusedObjectId: 'textbox-123',
        tableCellAddress: null,
        cursorPosition: 50,
        selection: null
      };

      tracker.restore(state);

      expect(restoreFocus).toHaveBeenCalledWith(state);
    });

    it('should restore table cell state', () => {
      const state: FocusState = {
        activeSection: 'body',
        focusedObjectId: 'table-456',
        tableCellAddress: { row: 1, col: 2 },
        cursorPosition: 15,
        selection: { start: 10, end: 20 }
      };

      tracker.restore(state);

      expect(restoreFocus).toHaveBeenCalledWith(state);
    });
  });

  describe('captureFromContent()', () => {
    it('should capture state from specific content', () => {
      const mockContent = createMockContent(30, null);

      const state = tracker.captureFromContent(mockContent, 'body');

      expect(state.activeSection).toBe('body');
      expect(state.cursorPosition).toBe(30);
      expect(state.focusedObjectId).toBeNull();
      expect(state.tableCellAddress).toBeNull();
      expect(state.selection).toBeNull();
    });

    it('should capture header section', () => {
      const mockContent = createMockContent(5, null);

      const state = tracker.captureFromContent(mockContent, 'header');

      expect(state.activeSection).toBe('header');
      expect(state.cursorPosition).toBe(5);
    });

    it('should capture footer section', () => {
      const mockContent = createMockContent(8, null);

      const state = tracker.captureFromContent(mockContent, 'footer');

      expect(state.activeSection).toBe('footer');
      expect(state.cursorPosition).toBe(8);
    });

    it('should capture with selection', () => {
      const mockContent = createMockContent(50, { start: 40, end: 60 });

      const state = tracker.captureFromContent(mockContent, 'body');

      expect(state.selection).toEqual({ start: 40, end: 60 });
    });

    it('should capture with focused object id', () => {
      const mockContent = createMockContent(0, null);

      const state = tracker.captureFromContent(mockContent, 'body', 'textbox-abc');

      expect(state.focusedObjectId).toBe('textbox-abc');
    });

    it('should capture with table cell address', () => {
      const mockContent = createMockContent(12, null);

      const state = tracker.captureFromContent(mockContent, 'body', 'table-xyz', { row: 5, col: 3 });

      expect(state.focusedObjectId).toBe('table-xyz');
      expect(state.tableCellAddress).toEqual({ row: 5, col: 3 });
    });

    it('should capture full state with all parameters', () => {
      const mockContent = createMockContent(100, { start: 90, end: 110 });

      const state = tracker.captureFromContent(
        mockContent,
        'footer',
        'table-1',
        { row: 0, col: 0 }
      );

      expect(state).toEqual({
        activeSection: 'footer',
        focusedObjectId: 'table-1',
        tableCellAddress: { row: 0, col: 0 },
        cursorPosition: 100,
        selection: { start: 90, end: 110 }
      });
    });

    it('should call content methods', () => {
      const mockContent = createMockContent(0, null);

      tracker.captureFromContent(mockContent, 'body');

      expect(mockContent.getCursorPosition).toHaveBeenCalled();
      expect(mockContent.getSelection).toHaveBeenCalled();
    });

    it('should not call getActiveContent callback', () => {
      const mockContent = createMockContent(0, null);

      tracker.captureFromContent(mockContent, 'body');

      expect(getActiveContent).not.toHaveBeenCalled();
    });
  });

  describe('round-trip capture and restore', () => {
    it('should be able to restore a captured state', () => {
      const mockContent = createMockContent(42, { start: 40, end: 50 });
      getActiveContent.mockReturnValue({
        content: mockContent,
        section: 'body',
        focusedObjectId: 'obj-1',
        tableCellAddress: null
      });

      // Capture current state
      const capturedState = tracker.capture();

      // Restore the captured state
      tracker.restore(capturedState);

      // Verify restore was called with the captured state
      expect(restoreFocus).toHaveBeenCalledWith({
        activeSection: 'body',
        focusedObjectId: 'obj-1',
        tableCellAddress: null,
        cursorPosition: 42,
        selection: { start: 40, end: 50 }
      });
    });
  });
});
