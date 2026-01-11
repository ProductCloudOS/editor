/**
 * Unit tests for ParagraphFormattingManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParagraphFormattingManager } from '../../../lib/text/ParagraphFormatting';
import { DEFAULT_PARAGRAPH_FORMATTING, DEFAULT_LIST_FORMATTING, ListFormatting } from '../../../lib/text/types';

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

  // ============================================================
  // FEATURE-0013: List Formatting Tests
  // ============================================================

  describe('setListFormatting()', () => {
    it('should set bullet list formatting for a paragraph', () => {
      const listFormatting: ListFormatting = {
        listType: 'bullet',
        bulletStyle: 'disc',
        nestingLevel: 0
      };

      manager.setListFormatting(0, listFormatting);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting).toBeDefined();
      expect(formatting.listFormatting?.listType).toBe('bullet');
      expect(formatting.listFormatting?.bulletStyle).toBe('disc');
      expect(formatting.listFormatting?.nestingLevel).toBe(0);
    });

    it('should set numbered list formatting for a paragraph', () => {
      const listFormatting: ListFormatting = {
        listType: 'number',
        numberStyle: 'decimal',
        nestingLevel: 0,
        startNumber: 1
      };

      manager.setListFormatting(0, listFormatting);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.listType).toBe('number');
      expect(formatting.listFormatting?.numberStyle).toBe('decimal');
      expect(formatting.listFormatting?.startNumber).toBe(1);
    });

    it('should emit paragraph-formatting-changed event', () => {
      const handler = vi.fn();
      manager.on('paragraph-formatting-changed', handler);

      const listFormatting: ListFormatting = {
        listType: 'bullet',
        bulletStyle: 'disc',
        nestingLevel: 0
      };

      manager.setListFormatting(5, listFormatting);

      expect(handler).toHaveBeenCalledWith({
        paragraphStart: 5,
        listFormatting
      });
    });

    it('should update existing list formatting', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.setListFormatting(0, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.listType).toBe('number');
    });

    it('should preserve alignment when setting list formatting', () => {
      manager.setAlignment(0, 'center');
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.alignment).toBe('center');
      expect(formatting.listFormatting?.listType).toBe('bullet');
    });

    it('should set undefined to remove list formatting', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.setListFormatting(0, undefined);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting).toBeUndefined();
    });
  });

  describe('clearListFormatting()', () => {
    it('should remove list formatting from a paragraph', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.clearListFormatting(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting).toBeUndefined();
    });

    it('should preserve alignment when clearing list formatting', () => {
      manager.setAlignment(0, 'right');
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.clearListFormatting(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.alignment).toBe('right');
      expect(formatting.listFormatting).toBeUndefined();
    });

    it('should emit paragraph-formatting-changed event', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });

      const handler = vi.fn();
      manager.on('paragraph-formatting-changed', handler);

      manager.clearListFormatting(0);

      expect(handler).toHaveBeenCalledWith({
        paragraphStart: 0,
        listFormatting: undefined
      });
    });
  });

  describe('toggleList()', () => {
    it('should toggle bullet list on for unformatted paragraph', () => {
      manager.toggleList(0, 'bullet');

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.listType).toBe('bullet');
      expect(formatting.listFormatting?.bulletStyle).toBe('disc');
    });

    it('should toggle numbered list on for unformatted paragraph', () => {
      manager.toggleList(0, 'number');

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.listType).toBe('number');
      expect(formatting.listFormatting?.numberStyle).toBe('decimal');
    });

    it('should toggle off when same list type already applied', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.toggleList(0, 'bullet');

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting).toBeUndefined();
    });

    it('should switch list type when different type applied', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.toggleList(0, 'number');

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.listType).toBe('number');
    });

    it('should preserve nesting level when switching list type', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 2 });
      manager.toggleList(0, 'number');

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.listType).toBe('number');
      expect(formatting.listFormatting?.nestingLevel).toBe(2);
    });

    it('should emit paragraph-formatting-changed event', () => {
      const handler = vi.fn();
      manager.on('paragraph-formatting-changed', handler);

      manager.toggleList(0, 'bullet');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('indentParagraph()', () => {
    it('should increase nesting level for list paragraph', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.indentParagraph(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.nestingLevel).toBe(1);
    });

    it('should cycle bullet style when indenting', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.indentParagraph(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.bulletStyle).toBe('circle');
    });

    it('should cycle bullet styles: disc -> circle -> square -> disc', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });

      manager.indentParagraph(0);
      expect(manager.getFormattingForParagraph(0).listFormatting?.bulletStyle).toBe('circle');

      manager.indentParagraph(0);
      expect(manager.getFormattingForParagraph(0).listFormatting?.bulletStyle).toBe('square');

      manager.indentParagraph(0);
      expect(manager.getFormattingForParagraph(0).listFormatting?.bulletStyle).toBe('disc');
    });

    it('should cycle number styles: decimal -> lower-alpha -> lower-roman -> decimal', () => {
      manager.setListFormatting(0, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });

      manager.indentParagraph(0);
      expect(manager.getFormattingForParagraph(0).listFormatting?.numberStyle).toBe('lower-alpha');

      manager.indentParagraph(0);
      expect(manager.getFormattingForParagraph(0).listFormatting?.numberStyle).toBe('lower-roman');

      manager.indentParagraph(0);
      expect(manager.getFormattingForParagraph(0).listFormatting?.numberStyle).toBe('decimal');
    });

    it('should respect maximum nesting level of 8', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 8 });
      manager.indentParagraph(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.nestingLevel).toBe(8);
    });

    it('should convert non-list paragraph to bullet list when indenting', () => {
      // No list formatting set
      manager.indentParagraph(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.listType).toBe('bullet');
      expect(formatting.listFormatting?.nestingLevel).toBe(0);
    });

    it('should emit paragraph-formatting-changed event', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });

      const handler = vi.fn();
      manager.on('paragraph-formatting-changed', handler);

      manager.indentParagraph(0);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('outdentParagraph()', () => {
    it('should decrease nesting level for list paragraph', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'circle', nestingLevel: 2 });
      manager.outdentParagraph(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.nestingLevel).toBe(1);
    });

    it('should cycle bullet style when outdenting', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'circle', nestingLevel: 1 });
      manager.outdentParagraph(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting?.bulletStyle).toBe('disc');
    });

    it('should remove list formatting when outdenting at level 0', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.outdentParagraph(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting).toBeUndefined();
    });

    it('should do nothing for non-list paragraph', () => {
      manager.setAlignment(0, 'center');
      manager.outdentParagraph(0);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.listFormatting).toBeUndefined();
      expect(formatting.alignment).toBe('center');
    });

    it('should emit paragraph-formatting-changed event', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 1 });

      const handler = vi.fn();
      manager.on('paragraph-formatting-changed', handler);

      manager.outdentParagraph(0);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('list formatting with shiftParagraphs()', () => {
    it('should shift list formatting when text inserted', () => {
      manager.setListFormatting(5, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });

      // Insert 3 characters at position 2
      manager.shiftParagraphs(2, 3, 'He123llo World');

      // List formatting should now be at index 8
      const formatting = manager.getFormattingForParagraph(8);
      expect(formatting.listFormatting?.listType).toBe('bullet');

      // Old index should not have list formatting
      expect(manager.getFormattingForParagraph(5).listFormatting).toBeUndefined();
    });

    it('should inherit list formatting for new paragraphs from newlines', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 1 });

      // Insert a newline, creating a new paragraph
      const contentAfter = 'Hel\nlo World';
      manager.shiftParagraphs(3, 1, contentAfter);

      // New paragraph at index 4 should inherit list formatting
      const formatting = manager.getFormattingForParagraph(4);
      expect(formatting.listFormatting?.listType).toBe('bullet');
      expect(formatting.listFormatting?.nestingLevel).toBe(1);
    });
  });

  describe('list formatting with handleDeletion()', () => {
    it('should remove list formatting for deleted paragraphs', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });
      manager.setListFormatting(5, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });
      manager.setListFormatting(10, { listType: 'bullet', bulletStyle: 'circle', nestingLevel: 1 });

      // Delete range containing paragraph at 5
      manager.handleDeletion(3, 5);

      // Paragraph 10 should shift to 5
      const formatting = manager.getFormattingForParagraph(5);
      expect(formatting.listFormatting?.listType).toBe('bullet');
      expect(formatting.listFormatting?.bulletStyle).toBe('circle');
    });
  });

  describe('list formatting serialization', () => {
    it('should serialize list formatting in toJSON()', () => {
      manager.setAlignment(0, 'center');
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 1 });

      const json = manager.toJSON();

      expect(json).toHaveLength(1);
      expect(json[0].formatting.listFormatting).toEqual({
        listType: 'bullet',
        bulletStyle: 'disc',
        nestingLevel: 1
      });
    });

    it('should deserialize list formatting in fromJSON()', () => {
      const data = [
        {
          paragraphStart: 0,
          formatting: {
            alignment: 'center' as const,
            listFormatting: {
              listType: 'number' as const,
              numberStyle: 'lower-alpha' as const,
              nestingLevel: 2,
              startNumber: 5
            }
          }
        }
      ];

      manager.fromJSON(data);

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.alignment).toBe('center');
      expect(formatting.listFormatting?.listType).toBe('number');
      expect(formatting.listFormatting?.numberStyle).toBe('lower-alpha');
      expect(formatting.listFormatting?.nestingLevel).toBe(2);
      expect(formatting.listFormatting?.startNumber).toBe(5);
    });

    it('should handle round-trip serialization with list formatting', () => {
      manager.setAlignment(0, 'right');
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'square', nestingLevel: 3 });
      manager.setListFormatting(10, { listType: 'number', numberStyle: 'upper-roman', nestingLevel: 0 });

      const json = manager.toJSON();

      const newManager = new ParagraphFormattingManager();
      newManager.fromJSON(json);

      const f0 = newManager.getFormattingForParagraph(0);
      expect(f0.alignment).toBe('right');
      expect(f0.listFormatting?.listType).toBe('bullet');
      expect(f0.listFormatting?.bulletStyle).toBe('square');
      expect(f0.listFormatting?.nestingLevel).toBe(3);

      const f10 = newManager.getFormattingForParagraph(10);
      expect(f10.listFormatting?.listType).toBe('number');
      expect(f10.listFormatting?.numberStyle).toBe('upper-roman');
    });
  });

  describe('applyToRange() with list formatting', () => {
    it('should apply list formatting to range of paragraphs', () => {
      const content = 'One\nTwo\nThree';
      const listFormatting: ListFormatting = {
        listType: 'bullet',
        bulletStyle: 'disc',
        nestingLevel: 0
      };

      manager.applyToRange(0, 12, content, { listFormatting });

      expect(manager.getFormattingForParagraph(0).listFormatting?.listType).toBe('bullet');
      expect(manager.getFormattingForParagraph(4).listFormatting?.listType).toBe('bullet');
      expect(manager.getFormattingForParagraph(8).listFormatting?.listType).toBe('bullet');
    });

    it('should preserve list formatting when applying alignment to range', () => {
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });

      const content = 'Hello World';
      manager.applyToRange(0, 10, content, { alignment: 'center' });

      const formatting = manager.getFormattingForParagraph(0);
      expect(formatting.alignment).toBe('center');
      expect(formatting.listFormatting?.listType).toBe('bullet');
    });
  });

  describe('getListNumber()', () => {
    it('should return 1 for first numbered paragraph', () => {
      const content = 'First item';
      manager.setListFormatting(0, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });

      expect(manager.getListNumber(0, content)).toBe(1);
    });

    it('should count consecutive numbered paragraphs at same level', () => {
      const content = 'First\nSecond\nThird';
      manager.setListFormatting(0, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });
      manager.setListFormatting(6, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });
      manager.setListFormatting(13, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });

      expect(manager.getListNumber(0, content)).toBe(1);
      expect(manager.getListNumber(6, content)).toBe(2);
      expect(manager.getListNumber(13, content)).toBe(3);
    });

    it('should restart numbering after non-list paragraph', () => {
      const content = 'First\nNormal\nSecond';
      manager.setListFormatting(0, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });
      // No list formatting for paragraph at 6 (Normal)
      manager.setListFormatting(13, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });

      expect(manager.getListNumber(0, content)).toBe(1);
      expect(manager.getListNumber(13, content)).toBe(1); // Restarts after non-list
    });

    it('should track nested lists independently', () => {
      const content = 'One\nNested1\nNested2\nTwo';
      manager.setListFormatting(0, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });
      manager.setListFormatting(4, { listType: 'number', numberStyle: 'lower-alpha', nestingLevel: 1 });
      manager.setListFormatting(12, { listType: 'number', numberStyle: 'lower-alpha', nestingLevel: 1 });
      manager.setListFormatting(20, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });

      expect(manager.getListNumber(0, content)).toBe(1);  // Level 0
      expect(manager.getListNumber(4, content)).toBe(1);  // Level 1 starts at 1
      expect(manager.getListNumber(12, content)).toBe(2); // Level 1 continues
      expect(manager.getListNumber(20, content)).toBe(2); // Level 0 continues
    });

    it('should return undefined for bullet lists', () => {
      const content = 'Bullet item';
      manager.setListFormatting(0, { listType: 'bullet', bulletStyle: 'disc', nestingLevel: 0 });

      expect(manager.getListNumber(0, content)).toBeUndefined();
    });

    it('should return undefined for non-list paragraphs', () => {
      const content = 'Normal paragraph';
      expect(manager.getListNumber(0, content)).toBeUndefined();
    });

    it('should respect startNumber when set', () => {
      const content = 'First\nSecond';
      manager.setListFormatting(0, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0, startNumber: 5 });
      manager.setListFormatting(6, { listType: 'number', numberStyle: 'decimal', nestingLevel: 0 });

      expect(manager.getListNumber(0, content)).toBe(5);
      expect(manager.getListNumber(6, content)).toBe(6);
    });
  });
});
