/**
 * Unit tests for TextFormattingManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextFormattingManager } from '../../../lib/text/TextFormatting';
import { DEFAULT_FORMATTING, TextFormattingStyle } from '../../../lib/text/types';

describe('TextFormattingManager', () => {
  let manager: TextFormattingManager;

  beforeEach(() => {
    manager = new TextFormattingManager();
  });

  describe('constructor', () => {
    it('should create with default formatting', () => {
      const formatting = manager.defaultFormatting;
      expect(formatting).toBeDefined();
      expect(formatting.fontFamily).toBe(DEFAULT_FORMATTING.fontFamily);
      expect(formatting.fontSize).toBe(DEFAULT_FORMATTING.fontSize);
    });

    it('should accept custom default formatting', () => {
      const customManager = new TextFormattingManager({
        fontFamily: 'Georgia',
        fontSize: 16
      });

      expect(customManager.defaultFormatting.fontFamily).toBe('Georgia');
      expect(customManager.defaultFormatting.fontSize).toBe(16);
    });

    it('should merge custom with default formatting', () => {
      const customManager = new TextFormattingManager({
        fontWeight: 'bold'
      });

      // Custom property should be set
      expect(customManager.defaultFormatting.fontWeight).toBe('bold');
      // Other defaults should be preserved
      expect(customManager.defaultFormatting.fontFamily).toBe(DEFAULT_FORMATTING.fontFamily);
    });
  });

  describe('defaultFormatting', () => {
    it('should return a copy of default formatting', () => {
      const formatting1 = manager.defaultFormatting;
      const formatting2 = manager.defaultFormatting;

      formatting1.fontFamily = 'Modified';

      expect(formatting2.fontFamily).toBe(DEFAULT_FORMATTING.fontFamily);
    });
  });

  describe('setDefaultFormatting()', () => {
    it('should update default formatting', () => {
      manager.setDefaultFormatting({ fontSize: 18 });

      expect(manager.defaultFormatting.fontSize).toBe(18);
    });

    it('should preserve existing default values', () => {
      manager.setDefaultFormatting({ fontSize: 18 });

      expect(manager.defaultFormatting.fontFamily).toBe(DEFAULT_FORMATTING.fontFamily);
    });

    it('should emit default-formatting-changed event', () => {
      const handler = vi.fn();
      manager.on('default-formatting-changed', handler);

      manager.setDefaultFormatting({ fontWeight: 'bold' });

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].formatting.fontWeight).toBe('bold');
    });
  });

  describe('getFormattingAt()', () => {
    it('should return default formatting for unformatted position', () => {
      const formatting = manager.getFormattingAt(5);

      expect(formatting).toEqual(manager.defaultFormatting);
    });

    it('should return position-specific formatting when set', () => {
      manager.applyFormatting(5, 10, { fontWeight: 'bold' });

      const formatting = manager.getFormattingAt(7);

      expect(formatting.fontWeight).toBe('bold');
    });

    it('should return a copy of formatting', () => {
      manager.applyFormatting(5, 10, { fontWeight: 'bold' });

      const formatting1 = manager.getFormattingAt(7);
      formatting1.fontWeight = 'normal';

      const formatting2 = manager.getFormattingAt(7);
      expect(formatting2.fontWeight).toBe('bold');
    });
  });

  describe('applyFormatting()', () => {
    it('should apply formatting to range', () => {
      manager.applyFormatting(0, 5, { fontWeight: 'bold' });

      expect(manager.getFormattingAt(0).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(4).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(5).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
    });

    it('should merge with existing formatting', () => {
      manager.applyFormatting(0, 5, { fontWeight: 'bold' });
      manager.applyFormatting(0, 5, { fontStyle: 'italic' });

      const formatting = manager.getFormattingAt(2);
      expect(formatting.fontWeight).toBe('bold');
      expect(formatting.fontStyle).toBe('italic');
    });

    it('should emit formatting-changed event', () => {
      const handler = vi.fn();
      manager.on('formatting-changed', handler);

      manager.applyFormatting(0, 5, { fontWeight: 'bold' });

      expect(handler).toHaveBeenCalledWith({
        start: 0,
        end: 5,
        formatting: { fontWeight: 'bold' }
      });
    });

    it('should not emit event when silent is true', () => {
      const handler = vi.fn();
      manager.on('formatting-changed', handler);

      manager.applyFormatting(0, 5, { fontWeight: 'bold' }, true);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle overlapping ranges', () => {
      manager.applyFormatting(0, 10, { fontWeight: 'bold' });
      manager.applyFormatting(5, 15, { fontStyle: 'italic' });

      // 0-4: bold only
      expect(manager.getFormattingAt(2).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(2).fontStyle).toBe(DEFAULT_FORMATTING.fontStyle);

      // 5-9: bold and italic
      expect(manager.getFormattingAt(7).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(7).fontStyle).toBe('italic');

      // 10-14: italic only
      expect(manager.getFormattingAt(12).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
      expect(manager.getFormattingAt(12).fontStyle).toBe('italic');
    });

    it('should handle empty range', () => {
      manager.applyFormatting(5, 5, { fontWeight: 'bold' });

      // No formatting should be applied
      expect(manager.getFormattingAt(5).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
    });
  });

  describe('clearFormatting()', () => {
    it('should remove formatting from range', () => {
      manager.applyFormatting(0, 10, { fontWeight: 'bold' });
      manager.clearFormatting(3, 7);

      expect(manager.getFormattingAt(2).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(5).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
      expect(manager.getFormattingAt(8).fontWeight).toBe('bold');
    });

    it('should emit formatting-cleared event', () => {
      const handler = vi.fn();
      manager.on('formatting-cleared', handler);

      manager.clearFormatting(5, 10);

      expect(handler).toHaveBeenCalledWith({ start: 5, end: 10 });
    });
  });

  describe('shiftFormatting()', () => {
    it('should shift formatting positions on insertion', () => {
      manager.applyFormatting(5, 10, { fontWeight: 'bold' });

      // Insert 3 characters at position 2
      manager.shiftFormatting(2, 3);

      // Formatting should now be at 8-13
      expect(manager.getFormattingAt(5).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
      expect(manager.getFormattingAt(8).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(12).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(13).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
    });

    it('should shift formatting positions on deletion', () => {
      manager.applyFormatting(10, 15, { fontWeight: 'bold' });

      // Delete 3 characters at position 5
      manager.shiftFormatting(5, -3);

      // Formatting should now be at 7-12
      expect(manager.getFormattingAt(6).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
      expect(manager.getFormattingAt(7).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(11).fontWeight).toBe('bold');
    });

    it('should handle delta of 0', () => {
      manager.applyFormatting(5, 10, { fontWeight: 'bold' });

      manager.shiftFormatting(3, 0);

      expect(manager.getFormattingAt(5).fontWeight).toBe('bold');
    });

    it('should not shift formatting before fromIndex', () => {
      manager.applyFormatting(2, 5, { fontWeight: 'bold' });
      manager.applyFormatting(10, 15, { fontStyle: 'italic' });

      manager.shiftFormatting(7, 3);

      // First range should be unchanged
      expect(manager.getFormattingAt(2).fontWeight).toBe('bold');
      // Second range should be shifted
      expect(manager.getFormattingAt(13).fontStyle).toBe('italic');
    });

    it('should remove formatting shifted to negative positions', () => {
      manager.applyFormatting(2, 5, { fontWeight: 'bold' });

      // Shift left by 10 from position 0
      manager.shiftFormatting(0, -10);

      // All formatting should be removed (shifted to negative)
      expect(manager.getFormattingAt(0).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
    });
  });

  describe('handleDeletion()', () => {
    it('should remove formatting in deleted range', () => {
      manager.applyFormatting(0, 15, { fontWeight: 'bold' });

      manager.handleDeletion(5, 5);

      // Positions 0-4 should still be bold
      expect(manager.getFormattingAt(4).fontWeight).toBe('bold');
      // Positions 5-9 were deleted, 10-14 shifted to 5-9
      expect(manager.getFormattingAt(5).fontWeight).toBe('bold');
    });

    it('should shift formatting after deleted range', () => {
      manager.applyFormatting(10, 15, { fontWeight: 'bold' });

      // Delete 3 characters at position 2
      manager.handleDeletion(2, 3);

      // Formatting should now be at 7-12
      expect(manager.getFormattingAt(6).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
      expect(manager.getFormattingAt(7).fontWeight).toBe('bold');
    });
  });

  describe('getAllFormatting() / setAllFormatting()', () => {
    it('should return all formatting entries', () => {
      manager.applyFormatting(0, 5, { fontWeight: 'bold' });
      manager.applyFormatting(10, 15, { fontStyle: 'italic' });

      const all = manager.getAllFormatting();

      expect(all.size).toBe(10);
      expect(all.get(2)?.fontWeight).toBe('bold');
      expect(all.get(12)?.fontStyle).toBe('italic');
    });

    it('should return a copy of formatting map', () => {
      manager.applyFormatting(0, 5, { fontWeight: 'bold' });

      const all = manager.getAllFormatting();
      all.clear();

      expect(manager.getFormattingAt(2).fontWeight).toBe('bold');
    });

    it('should restore formatting from map', () => {
      const map = new Map<number, TextFormattingStyle>();
      map.set(5, { ...DEFAULT_FORMATTING, fontWeight: 'bold' });
      map.set(6, { ...DEFAULT_FORMATTING, fontWeight: 'bold' });

      manager.setAllFormatting(map);

      expect(manager.getFormattingAt(5).fontWeight).toBe('bold');
      expect(manager.getFormattingAt(6).fontWeight).toBe('bold');
    });

    it('should emit formatting-restored event', () => {
      const handler = vi.fn();
      manager.on('formatting-restored', handler);

      manager.setAllFormatting(new Map());

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('should remove all formatting', () => {
      manager.applyFormatting(0, 10, { fontWeight: 'bold' });
      manager.applyFormatting(20, 30, { fontStyle: 'italic' });

      manager.clear();

      expect(manager.getFormattingAt(5).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
      expect(manager.getFormattingAt(25).fontStyle).toBe(DEFAULT_FORMATTING.fontStyle);
    });

    it('should clear pending formatting', () => {
      manager.setPendingFormatting({ fontWeight: 'bold' });

      manager.clear();

      expect(manager.hasPendingFormatting()).toBe(false);
    });

    it('should emit formatting-cleared event', () => {
      const handler = vi.fn();
      manager.on('formatting-cleared', handler);

      manager.clear();

      expect(handler).toHaveBeenCalledWith({ start: 0, end: Infinity });
    });
  });

  describe('pending formatting', () => {
    describe('setPendingFormatting()', () => {
      it('should set pending formatting', () => {
        manager.setPendingFormatting({ fontWeight: 'bold' });

        expect(manager.getPendingFormatting()).toEqual({ fontWeight: 'bold' });
      });

      it('should merge with existing pending formatting', () => {
        manager.setPendingFormatting({ fontWeight: 'bold' });
        manager.setPendingFormatting({ fontStyle: 'italic' });

        expect(manager.getPendingFormatting()).toEqual({
          fontWeight: 'bold',
          fontStyle: 'italic'
        });
      });

      it('should emit pending-formatting-changed event', () => {
        const handler = vi.fn();
        manager.on('pending-formatting-changed', handler);

        manager.setPendingFormatting({ fontWeight: 'bold' });

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('getPendingFormatting()', () => {
      it('should return null when no pending formatting', () => {
        expect(manager.getPendingFormatting()).toBeNull();
      });

      it('should return a copy of pending formatting', () => {
        manager.setPendingFormatting({ fontWeight: 'bold' });

        const pending1 = manager.getPendingFormatting();
        if (pending1) {
          pending1.fontWeight = 'normal';
        }

        expect(manager.getPendingFormatting()?.fontWeight).toBe('bold');
      });
    });

    describe('hasPendingFormatting()', () => {
      it('should return false when no pending formatting', () => {
        expect(manager.hasPendingFormatting()).toBe(false);
      });

      it('should return true when pending formatting exists', () => {
        manager.setPendingFormatting({ fontWeight: 'bold' });

        expect(manager.hasPendingFormatting()).toBe(true);
      });
    });

    describe('clearPendingFormatting()', () => {
      it('should clear pending formatting', () => {
        manager.setPendingFormatting({ fontWeight: 'bold' });
        manager.clearPendingFormatting();

        expect(manager.hasPendingFormatting()).toBe(false);
      });

      it('should emit pending-formatting-cleared event', () => {
        const handler = vi.fn();
        manager.setPendingFormatting({ fontWeight: 'bold' });
        manager.on('pending-formatting-cleared', handler);

        manager.clearPendingFormatting();

        expect(handler).toHaveBeenCalled();
      });

      it('should not emit event if no pending formatting', () => {
        const handler = vi.fn();
        manager.on('pending-formatting-cleared', handler);

        manager.clearPendingFormatting();

        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('applyPendingFormatting()', () => {
      it('should apply pending formatting to range', () => {
        manager.setPendingFormatting({ fontWeight: 'bold' });

        manager.applyPendingFormatting(5, 3);

        expect(manager.getFormattingAt(5).fontWeight).toBe('bold');
        expect(manager.getFormattingAt(6).fontWeight).toBe('bold');
        expect(manager.getFormattingAt(7).fontWeight).toBe('bold');
      });

      it('should not apply if no pending formatting', () => {
        manager.applyPendingFormatting(5, 3);

        expect(manager.getFormattingAt(5).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
      });

      it('should not clear pending formatting after applying', () => {
        manager.setPendingFormatting({ fontWeight: 'bold' });
        manager.applyPendingFormatting(5, 3);

        expect(manager.hasPendingFormatting()).toBe(true);
      });

      it('should not apply for length 0', () => {
        manager.setPendingFormatting({ fontWeight: 'bold' });

        manager.applyPendingFormatting(5, 0);

        expect(manager.getFormattingAt(5).fontWeight).toBe(DEFAULT_FORMATTING.fontWeight);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle formatting at position 0', () => {
      manager.applyFormatting(0, 1, { fontWeight: 'bold' });

      expect(manager.getFormattingAt(0).fontWeight).toBe('bold');
    });

    it('should handle large position numbers', () => {
      manager.applyFormatting(10000, 10005, { fontWeight: 'bold' });

      expect(manager.getFormattingAt(10002).fontWeight).toBe('bold');
    });

    it('should handle multiple formatting properties', () => {
      manager.applyFormatting(0, 5, {
        fontWeight: 'bold',
        fontStyle: 'italic',
        textDecoration: 'underline',
        fontSize: 24,
        color: 'red'
      });

      const formatting = manager.getFormattingAt(2);
      expect(formatting.fontWeight).toBe('bold');
      expect(formatting.fontStyle).toBe('italic');
      expect(formatting.textDecoration).toBe('underline');
      expect(formatting.fontSize).toBe(24);
      expect(formatting.color).toBe('red');
    });
  });
});
