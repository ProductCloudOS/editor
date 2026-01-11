/**
 * Unit tests for ParagraphFormattingManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParagraphFormattingManager } from '../../../lib/text/ParagraphFormatting';
import { DEFAULT_PARAGRAPH_FORMATTING } from '../../../lib/text/types';

describe('ParagraphFormattingManager', () => {
  let manager: ParagraphFormattingManager;

  beforeEach(() => {
    manager = new ParagraphFormattingManager();
  });

  describe('constructor', () => {
    it('should create with default formatting', () => {
      expect(manager.defaultFormatting).toEqual(DEFAULT_PARAGRAPH_FORMATTING);
    });

    it('should accept custom default formatting', () => {
      const customManager = new ParagraphFormattingManager({ alignment: 'center' });
      expect(customManager.defaultFormatting.alignment).toBe('center');
    });

    it('should merge custom with default formatting', () => {
      const customManager = new ParagraphFormattingManager({ alignment: 'right' });
      // Should have all default properties plus custom ones
      expect(customManager.defaultFormatting.alignment).toBe('right');
    });
  });

  describe('defaultFormatting', () => {
    it('should return a copy of default formatting', () => {
      const formatting1 = manager.defaultFormatting;
      const formatting2 = manager.defaultFormatting;

      // Should be equal but not same object
      expect(formatting1).toEqual(formatting2);
      expect(formatting1).not.toBe(formatting2);
    });
  });

  describe('setDefaultFormatting()', () => {
    it('should update default formatting', () => {
      manager.setDefaultFormatting({ alignment: 'center' });
      expect(manager.defaultFormatting.alignment).toBe('center');
    });

    it('should emit default-formatting-changed event', () => {
      const handler = vi.fn();
      manager.on('default-formatting-changed', handler);

      manager.setDefaultFormatting({ alignment: 'right' });

      expect(handler).toHaveBeenCalledWith({
        formatting: expect.objectContaining({ alignment: 'right' })
      });
    });

    it('should merge with existing default formatting', () => {
      manager.setDefaultFormatting({ alignment: 'center' });
      // After setting again, alignment should update
      manager.setDefaultFormatting({ alignment: 'right' });
      expect(manager.defaultFormatting.alignment).toBe('right');
    });
  });

  describe('getParagraphStart()', () => {
    it('should return 0 for index 0', () => {
      const content = 'Hello\nWorld';
      expect(manager.getParagraphStart(0, content)).toBe(0);
    });

    it('should return 0 for negative index', () => {
      const content = 'Hello\nWorld';
      expect(manager.getParagraphStart(-5, content)).toBe(0);
    });

    it('should return 0 for first paragraph', () => {
      const content = 'Hello\nWorld';
      expect(manager.getParagraphStart(3, content)).toBe(0);
    });

    it('should return position after newline for second paragraph', () => {
      const content = 'Hello\nWorld';
      expect(manager.getParagraphStart(7, content)).toBe(6);
    });

    it('should handle multiple paragraphs', () => {
      const content = 'One\nTwo\nThree';

      expect(manager.getParagraphStart(0, content)).toBe(0);  // In "One"
      expect(manager.getParagraphStart(2, content)).toBe(0);  // In "One"
      expect(manager.getParagraphStart(4, content)).toBe(4);  // Start of "Two"
      expect(manager.getParagraphStart(6, content)).toBe(4);  // In "Two"
      expect(manager.getParagraphStart(8, content)).toBe(8);  // Start of "Three"
      expect(manager.getParagraphStart(12, content)).toBe(8); // In "Three"
    });

    it('should handle position at newline', () => {
      const content = 'Hello\nWorld';
      // Position 5 is the newline itself, paragraph starts at 0
      expect(manager.getParagraphStart(5, content)).toBe(0);
    });

    it('should handle index beyond content length', () => {
      const content = 'Hello\nWorld';
      // Should clamp and search from end
      expect(manager.getParagraphStart(100, content)).toBe(6);
    });

    it('should handle empty content', () => {
      expect(manager.getParagraphStart(0, '')).toBe(0);
    });

    it('should handle content with only newlines', () => {
      const content = '\n\n\n';
      expect(manager.getParagraphStart(0, content)).toBe(0);
      expect(manager.getParagraphStart(1, content)).toBe(1);
      expect(manager.getParagraphStart(2, content)).toBe(2);
      expect(manager.getParagraphStart(3, content)).toBe(3);
    });
  });

  describe('getFormattingAt()', () => {
    it('should return default formatting for unformatted paragraph', () => {
      const content = 'Hello\nWorld';
      expect(manager.getFormattingAt(3, content)).toEqual(DEFAULT_PARAGRAPH_FORMATTING);
    });

    it('should return specific formatting when set', () => {
      const content = 'Hello\nWorld';
      manager.setAlignment(0, 'center');

      expect(manager.getFormattingAt(3, content).alignment).toBe('center');
    });

    it('should return formatting for correct paragraph', () => {
      const content = 'Hello\nWorld';
      manager.setAlignment(0, 'center');
      manager.setAlignment(6, 'right');

      expect(manager.getFormattingAt(3, content).alignment).toBe('center');
      expect(manager.getFormattingAt(8, content).alignment).toBe('right');
    });
  });

  describe('getFormattingForParagraph()', () => {
    it('should return default for unset paragraph', () => {
      expect(manager.getFormattingForParagraph(0)).toEqual(DEFAULT_PARAGRAPH_FORMATTING);
    });

    it('should return a copy of formatting', () => {
      manager.setAlignment(0, 'center');

      const f1 = manager.getFormattingForParagraph(0);
      const f2 = manager.getFormattingForParagraph(0);

      expect(f1).toEqual(f2);
      expect(f1).not.toBe(f2);
    });
  });

  describe('setAlignment()', () => {
    it('should set alignment for a paragraph', () => {
      manager.setAlignment(0, 'center');
      expect(manager.getFormattingForParagraph(0).alignment).toBe('center');
    });

    it('should emit paragraph-formatting-changed event', () => {
      const handler = vi.fn();
      manager.on('paragraph-formatting-changed', handler);

      manager.setAlignment(5, 'right');

      expect(handler).toHaveBeenCalledWith({
        paragraphStart: 5,
        alignment: 'right'
      });
    });

    it('should update existing alignment', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(0, 'right');
      expect(manager.getFormattingForParagraph(0).alignment).toBe('right');
    });

    it('should not affect other paragraphs', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(10, 'right');

      expect(manager.getFormattingForParagraph(0).alignment).toBe('center');
      expect(manager.getFormattingForParagraph(10).alignment).toBe('right');
      expect(manager.getFormattingForParagraph(20).alignment).toBe('left');
    });
  });

  describe('applyToRange()', () => {
    it('should apply formatting to single paragraph', () => {
      const content = 'Hello World';
      manager.applyToRange(0, 5, content, { alignment: 'center' });

      expect(manager.getFormattingForParagraph(0).alignment).toBe('center');
    });

    it('should apply formatting to multiple paragraphs', () => {
      const content = 'One\nTwo\nThree';
      manager.applyToRange(0, 12, content, { alignment: 'center' });

      expect(manager.getFormattingForParagraph(0).alignment).toBe('center');
      expect(manager.getFormattingForParagraph(4).alignment).toBe('center');
      expect(manager.getFormattingForParagraph(8).alignment).toBe('center');
    });

    it('should emit event with range info', () => {
      const handler = vi.fn();
      manager.on('paragraph-formatting-changed', handler);

      const content = 'Hello\nWorld';
      manager.applyToRange(0, 10, content, { alignment: 'right' });

      expect(handler).toHaveBeenCalledWith({
        start: 0,
        end: 10,
        formatting: { alignment: 'right' }
      });
    });

    it('should handle partial paragraph selection', () => {
      const content = 'Hello\nWorld';
      // Selecting from middle of first to middle of second
      manager.applyToRange(2, 8, content, { alignment: 'center' });

      // Both paragraphs should be affected
      expect(manager.getFormattingForParagraph(0).alignment).toBe('center');
      expect(manager.getFormattingForParagraph(6).alignment).toBe('center');
    });

    it('should merge with existing formatting', () => {
      manager.setAlignment(0, 'right');

      const content = 'Hello World';
      manager.applyToRange(0, 5, content, { alignment: 'center' });

      expect(manager.getFormattingForParagraph(0).alignment).toBe('center');
    });
  });

  describe('shiftParagraphs()', () => {
    it('should shift paragraph indices when text inserted', () => {
      const content = 'Hello World';
      manager.setAlignment(5, 'center'); // Paragraph at index 5

      // Insert 3 characters at position 2
      manager.shiftParagraphs(2, 3, 'He123llo World');

      // Paragraph should now be at index 8
      expect(manager.getFormattingForParagraph(8).alignment).toBe('center');
      expect(manager.getFormattingForParagraph(5).alignment).toBe('left');
    });

    it('should not shift paragraphs before insertion point', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(10, 'right');

      // Insert at position 5
      manager.shiftParagraphs(5, 3, 'content after');

      expect(manager.getFormattingForParagraph(0).alignment).toBe('center');
      expect(manager.getFormattingForParagraph(13).alignment).toBe('right');
    });

    it('should handle zero delta', () => {
      manager.setAlignment(5, 'center');

      manager.shiftParagraphs(0, 0, 'content');

      expect(manager.getFormattingForParagraph(5).alignment).toBe('center');
    });

    it('should inherit formatting for new paragraphs from newlines', () => {
      manager.setAlignment(0, 'center');

      // Insert a newline, creating a new paragraph
      const contentAfter = 'Hel\nlo World';
      manager.shiftParagraphs(3, 1, contentAfter);

      // New paragraph at index 4 should inherit formatting
      expect(manager.getFormattingForParagraph(4).alignment).toBe('center');
    });

    it('should handle multiple newlines in inserted text', () => {
      manager.setAlignment(0, 'right');

      // Insert text with multiple newlines
      const contentAfter = 'Hello\n\n\nWorld';
      manager.shiftParagraphs(5, 3, contentAfter);

      // All new paragraphs should inherit
      expect(manager.getFormattingForParagraph(6).alignment).toBe('right');
      expect(manager.getFormattingForParagraph(7).alignment).toBe('right');
      expect(manager.getFormattingForParagraph(8).alignment).toBe('right');
    });

    it('should not set formatting for new paragraphs if original had no formatting', () => {
      // Don't set any formatting (using defaults)
      const contentAfter = 'Hel\nlo';
      manager.shiftParagraphs(3, 1, contentAfter);

      // Should use default, not have explicit entry
      expect(manager.getAllFormatting().size).toBe(0);
    });
  });

  describe('handleDeletion()', () => {
    it('should remove formatting for deleted paragraphs', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(5, 'right');
      manager.setAlignment(10, 'justify');

      // Delete range containing paragraph at 5
      manager.handleDeletion(3, 5);

      // Paragraph 5 should be removed (was within deleted range)
      // Paragraph 10 should shift to 5
      expect(manager.getFormattingForParagraph(5).alignment).toBe('justify');
    });

    it('should shift paragraphs after deletion', () => {
      manager.setAlignment(10, 'center');

      // Delete 5 characters at start
      manager.handleDeletion(0, 5);

      // Paragraph should now be at 5
      expect(manager.getFormattingForParagraph(5).alignment).toBe('center');
      expect(manager.getFormattingForParagraph(10).alignment).toBe('left');
    });

    it('should preserve paragraph at deletion start', () => {
      manager.setAlignment(5, 'center');

      // Delete from exactly at paragraph start
      manager.handleDeletion(5, 3);

      // Paragraph at 5 should be preserved (index == start, not > start)
      expect(manager.getFormattingForParagraph(5).alignment).toBe('center');
    });

    it('should handle deleting entire document', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(10, 'right');
      manager.setAlignment(20, 'justify');

      manager.handleDeletion(0, 100);

      // All explicit formatting should be cleared
      expect(manager.getAllFormatting().size).toBe(1); // Only paragraph 0 preserved
    });
  });

  describe('clear()', () => {
    it('should remove all paragraph formatting', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(10, 'right');
      manager.setAlignment(20, 'justify');

      manager.clear();

      expect(manager.getAllFormatting().size).toBe(0);
    });

    it('should emit paragraph-formatting-cleared event', () => {
      const handler = vi.fn();
      manager.on('paragraph-formatting-cleared', handler);

      manager.clear();

      expect(handler).toHaveBeenCalled();
    });

    it('should not affect default formatting', () => {
      manager.setDefaultFormatting({ alignment: 'center' });
      manager.setAlignment(0, 'right');

      manager.clear();

      expect(manager.defaultFormatting.alignment).toBe('center');
    });
  });

  describe('toJSON()', () => {
    it('should serialize empty formatting', () => {
      expect(manager.toJSON()).toEqual([]);
    });

    it('should serialize all formatting entries', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(10, 'right');

      const json = manager.toJSON();

      expect(json).toHaveLength(2);
      expect(json).toContainEqual({
        paragraphStart: 0,
        formatting: { alignment: 'center' }
      });
      expect(json).toContainEqual({
        paragraphStart: 10,
        formatting: { alignment: 'right' }
      });
    });
  });

  describe('fromJSON()', () => {
    it('should deserialize formatting', () => {
      const data = [
        { paragraphStart: 0, formatting: { alignment: 'center' as const } },
        { paragraphStart: 15, formatting: { alignment: 'right' as const } }
      ];

      manager.fromJSON(data);

      expect(manager.getFormattingForParagraph(0).alignment).toBe('center');
      expect(manager.getFormattingForParagraph(15).alignment).toBe('right');
    });

    it('should clear existing formatting before loading', () => {
      manager.setAlignment(5, 'justify');

      manager.fromJSON([
        { paragraphStart: 0, formatting: { alignment: 'center' as const } }
      ]);

      expect(manager.getFormattingForParagraph(5).alignment).toBe('left');
    });

    it('should emit paragraph-formatting-loaded event', () => {
      const handler = vi.fn();
      manager.on('paragraph-formatting-loaded', handler);

      manager.fromJSON([]);

      expect(handler).toHaveBeenCalled();
    });

    it('should handle empty data', () => {
      manager.setAlignment(0, 'center');
      manager.fromJSON([]);

      expect(manager.getAllFormatting().size).toBe(0);
    });
  });

  describe('getAllFormatting()', () => {
    it('should return empty map initially', () => {
      expect(manager.getAllFormatting().size).toBe(0);
    });

    it('should return all formatting entries', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(10, 'right');

      const all = manager.getAllFormatting();

      expect(all.size).toBe(2);
      expect(all.get(0)?.alignment).toBe('center');
      expect(all.get(10)?.alignment).toBe('right');
    });

    it('should return a copy of the map', () => {
      manager.setAlignment(0, 'center');

      const all = manager.getAllFormatting();
      all.set(100, { alignment: 'right' });

      // Original should not be affected
      expect(manager.getAllFormatting().has(100)).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete document editing workflow', () => {
      // Start with empty document
      let content = '';

      // Type first paragraph
      content = 'First paragraph';

      // Set center alignment
      manager.setAlignment(0, 'center');

      // Add newline and second paragraph
      content = 'First paragraph\nSecond paragraph';
      manager.shiftParagraphs(15, 17, content); // Inserted "\nSecond paragraph"

      // Set right alignment for second paragraph
      manager.setAlignment(16, 'right');

      // Verify
      expect(manager.getFormattingAt(5, content).alignment).toBe('center');
      expect(manager.getFormattingAt(20, content).alignment).toBe('right');
    });

    it('should handle undo-like operations', () => {
      const content = 'Hello\nWorld';

      // Apply formatting
      manager.setAlignment(0, 'center');
      manager.setAlignment(6, 'right');

      // "Undo" by resetting to default
      manager.clear();

      // Verify all reset
      expect(manager.getFormattingAt(3, content).alignment).toBe('left');
      expect(manager.getFormattingAt(8, content).alignment).toBe('left');
    });

    it('should handle serialize/deserialize round trip', () => {
      manager.setAlignment(0, 'center');
      manager.setAlignment(10, 'right');
      manager.setAlignment(20, 'justify');

      const json = manager.toJSON();

      const newManager = new ParagraphFormattingManager();
      newManager.fromJSON(json);

      expect(newManager.getFormattingForParagraph(0).alignment).toBe('center');
      expect(newManager.getFormattingForParagraph(10).alignment).toBe('right');
      expect(newManager.getFormattingForParagraph(20).alignment).toBe('justify');
    });
  });
});
