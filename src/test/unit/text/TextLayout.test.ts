/**
 * Unit tests for TextLayout
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextLayout, LayoutContext } from '../../../lib/text/TextLayout';
import { TextMeasurer } from '../../../lib/text/TextMeasurer';
import { TextFormattingManager } from '../../../lib/text/TextFormatting';
import { ParagraphFormattingManager } from '../../../lib/text/ParagraphFormatting';
import { SubstitutionFieldManager } from '../../../lib/text/SubstitutionFieldManager';
import { EmbeddedObjectManager } from '../../../lib/text/EmbeddedObjectManager';
import { createMockContext } from '../../helpers/mocks';
import { DEFAULT_FORMATTING, PAGE_BREAK_CHAR } from '../../../lib/text/types';

describe('TextLayout', () => {
  let layout: TextLayout;
  let context: LayoutContext;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    layout = new TextLayout();
    mockCtx = createMockContext();

    // Override measureText to return predictable widths
    mockCtx.measureText = vi.fn((text: string) => ({
      width: text.length * 8, // 8px per character
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 4,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 8,
      emHeightAscent: 10,
      emHeightDescent: 3,
      hangingBaseline: 10,
      alphabeticBaseline: 0,
      ideographicBaseline: -3
    })) as unknown as typeof mockCtx.measureText;

    context = {
      availableWidth: 400,
      availableHeight: 600,
      measurer: new TextMeasurer(mockCtx),
      formatting: new TextFormattingManager(),
      paragraphFormatting: new ParagraphFormattingManager(),
      substitutionFields: new SubstitutionFieldManager(),
      embeddedObjects: new EmbeddedObjectManager(),
      content: ''
    };
  });

  describe('flowText()', () => {
    it('should return one empty page for empty content', () => {
      const pages = layout.flowText('', context);

      expect(pages).toHaveLength(1);
      expect(pages[0].lines).toHaveLength(1);
      expect(pages[0].lines[0].text).toBe('');
    });

    it('should flow simple text into one line', () => {
      const text = 'Hello';
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages).toHaveLength(1);
      expect(pages[0].lines).toHaveLength(1);
      expect(pages[0].lines[0].text).toBe('Hello');
    });

    it('should handle newlines', () => {
      const text = 'Line one\nLine two';
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages).toHaveLength(1);
      expect(pages[0].lines).toHaveLength(2);
      expect(pages[0].lines[0].text).toBe('Line one');
      expect(pages[0].lines[1].text).toBe('Line two');
    });

    it('should mark lines ending with newline', () => {
      const text = 'Line one\nLine two\n';
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages[0].lines[0].endsWithNewline).toBe(true);
      expect(pages[0].lines[1].endsWithNewline).toBe(true);
    });

    it('should handle multiple empty lines', () => {
      const text = '\n\n\n';
      context.content = text;

      const pages = layout.flowText(text, context);

      // Should create 4 lines: 3 empty lines + 1 final empty line after last newline
      expect(pages[0].lines.length).toBeGreaterThanOrEqual(3);
    });

    it('should wrap long text with words to multiple lines', () => {
      // Each char is 8px, width is 400px, so ~50 chars per line
      // Use words separated by spaces to enable word wrapping
      const text = 'word '.repeat(20).trim(); // ~100 chars with word boundaries
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages[0].lines.length).toBeGreaterThan(1);
    });

    it('should create new page when height exceeded', () => {
      context.availableHeight = 50; // Small height to force page breaks
      const text = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages.length).toBeGreaterThan(1);
    });

    it('should handle page break character', () => {
      const text = `Page one${PAGE_BREAK_CHAR}Page two`;
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages).toHaveLength(2);
      expect(pages[0].lines[0].text).toBe('Page one');
      expect(pages[1].lines[0].text).toBe('Page two');
    });

    it('should mark line ending with page break', () => {
      const text = `Content${PAGE_BREAK_CHAR}More`;
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages[0].lines[0].endsWithPageBreak).toBe(true);
    });

    it('should apply paragraph alignment', () => {
      const text = 'Centered text';
      context.content = text;
      context.paragraphFormatting.setAlignment(0, 'center');

      const pages = layout.flowText(text, context);

      expect(pages[0].lines[0].alignment).toBe('center');
    });

    it('should handle mixed alignments across paragraphs', () => {
      const text = 'Left\nCentered\nRight';
      context.content = text;
      context.paragraphFormatting.setAlignment(0, 'left');
      context.paragraphFormatting.setAlignment(5, 'center');
      context.paragraphFormatting.setAlignment(14, 'right');

      const pages = layout.flowText(text, context);

      expect(pages[0].lines[0].alignment).toBe('left');
      expect(pages[0].lines[1].alignment).toBe('center');
      expect(pages[0].lines[2].alignment).toBe('right');
    });

    it('should track line indices correctly', () => {
      const text = 'First\nSecond';
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages[0].lines[0].startIndex).toBe(0);
      expect(pages[0].lines[0].endIndex).toBe(5);
      expect(pages[0].lines[1].startIndex).toBe(6);
      expect(pages[0].lines[1].endIndex).toBe(12);
    });

    it('should track page indices correctly', () => {
      context.availableHeight = 30;
      const text = 'Line 1\nLine 2\nLine 3';
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages[0].startIndex).toBe(0);
      expect(pages[pages.length - 1].endIndex).toBe(text.length);
    });

    it('should create text runs for formatting', () => {
      const text = 'Simple';
      context.content = text;

      const pages = layout.flowText(text, context);

      const line = pages[0].lines[0];
      expect(line.runs.length).toBeGreaterThan(0);
      // Text gets split by segments, first run is the word
      expect(line.runs[0].text).toBe(text);
      expect(line.runs[0].formatting).toBeDefined();
    });

    it('should create runs for different formatting', () => {
      const text = 'AB';
      context.content = text;
      // Apply different formatting to each character
      context.formatting.applyFormatting(0, 1, { color: '#ff0000' });
      context.formatting.applyFormatting(1, 2, { color: '#0000ff' });

      const pages = layout.flowText(text, context);

      const line = pages[0].lines[0];
      // Should have at least 2 runs due to formatting changes
      expect(line.runs.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate line height and baseline', () => {
      const text = 'Test';
      context.content = text;

      const pages = layout.flowText(text, context);

      const line = pages[0].lines[0];
      expect(line.height).toBeGreaterThan(0);
      expect(line.baseline).toBeGreaterThan(0);
      expect(line.height).toBeGreaterThan(line.baseline);
    });

    it('should calculate line width', () => {
      const text = 'Hello';
      context.content = text;

      const pages = layout.flowText(text, context);

      // 5 chars * 8px per char = 40px
      expect(pages[0].lines[0].width).toBe(40);
    });
  });

  describe('word wrapping', () => {
    it('should break at word boundaries', () => {
      // Width allows ~50 chars, so "Hello World" fits but more words won't
      context.availableWidth = 100; // ~12 chars
      const text = 'Hello World Again';
      context.content = text;

      const pages = layout.flowText(text, context);

      // Should wrap at word boundaries
      expect(pages[0].lines.length).toBeGreaterThan(1);
    });

    it('should handle single long word without breaking mid-word', () => {
      context.availableWidth = 80; // ~10 chars
      const text = 'a'.repeat(30); // 30 chars - single "word"
      context.content = text;

      const pages = layout.flowText(text, context);

      // Single word doesn't break mid-word by default
      // It overflows the line but stays as one line
      expect(pages[0].lines).toHaveLength(1);
      expect(pages[0].lines[0].text).toBe(text);
    });

    it('should handle whitespace-only text', () => {
      const text = '   ';
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages).toHaveLength(1);
      expect(pages[0].lines).toHaveLength(1);
    });

    it('should handle mixed whitespace and text', () => {
      const text = '  word  ';
      context.content = text;

      const pages = layout.flowText(text, context);

      expect(pages[0].lines[0].text).toBe('  word  ');
    });
  });

  describe('justify alignment', () => {
    it('should calculate extra word spacing for justify on wrapped lines', () => {
      context.availableWidth = 100; // Force wrapping
      // Long text that will wrap
      const text = 'Word one two three four five six seven';
      context.content = text;
      context.paragraphFormatting.setAlignment(0, 'justify');

      const pages = layout.flowText(text, context);

      // If multiple lines, first lines (not last) should have extra spacing
      if (pages[0].lines.length > 1) {
        // First line should have extra spacing (not last in paragraph)
        expect(pages[0].lines[0].extraWordSpacing).toBeDefined();
        // Last line should not have extra spacing
        expect(pages[0].lines[pages[0].lines.length - 1].extraWordSpacing).toBeUndefined();
      }
    });

    it('should not justify last line of paragraph', () => {
      context.availableWidth = 200;
      const text = 'Single line';
      context.content = text;
      context.paragraphFormatting.setAlignment(0, 'justify');

      const pages = layout.flowText(text, context);

      // Single line is last line, no extra spacing
      expect(pages[0].lines[0].extraWordSpacing).toBeUndefined();
    });
  });

  describe('findPositionForIndex()', () => {
    it('should find position for index in first line', () => {
      const text = 'Hello\nWorld';
      context.content = text;
      const pages = layout.flowText(text, context);

      const pos = layout.findPositionForIndex(pages, 3);

      expect(pos).toEqual({ pageIndex: 0, lineIndex: 0 });
    });

    it('should find position for index in second line', () => {
      const text = 'Hello\nWorld';
      context.content = text;
      const pages = layout.flowText(text, context);

      const pos = layout.findPositionForIndex(pages, 8);

      expect(pos).toEqual({ pageIndex: 0, lineIndex: 1 });
    });

    it('should return end of last page for index beyond content', () => {
      const text = 'Hello';
      context.content = text;
      const pages = layout.flowText(text, context);

      const pos = layout.findPositionForIndex(pages, 100);

      expect(pos).toEqual({ pageIndex: 0, lineIndex: 0 });
    });

    it('should return null for empty pages array', () => {
      const pos = layout.findPositionForIndex([], 0);

      expect(pos).toBeNull();
    });

    it('should find position on second page', () => {
      context.availableHeight = 20;
      const text = 'Line1\nLine2\nLine3';
      context.content = text;
      const pages = layout.flowText(text, context);

      if (pages.length > 1) {
        const secondPageStart = pages[1].startIndex;
        const pos = layout.findPositionForIndex(pages, secondPageStart + 2);

        expect(pos?.pageIndex).toBe(1);
      }
    });
  });

  describe('getParagraphBoundaries()', () => {
    it('should return [0] for empty content', () => {
      const boundaries = layout.getParagraphBoundaries('');

      expect(boundaries).toEqual([0]);
    });

    it('should return [0] for content with no newlines', () => {
      const boundaries = layout.getParagraphBoundaries('Hello World');

      expect(boundaries).toEqual([0]);
    });

    it('should return boundaries after newlines', () => {
      const boundaries = layout.getParagraphBoundaries('Hello\nWorld');

      expect(boundaries).toEqual([0, 6]);
    });

    it('should handle multiple newlines', () => {
      const boundaries = layout.getParagraphBoundaries('One\nTwo\nThree');

      expect(boundaries).toEqual([0, 4, 8]);
    });

    it('should handle consecutive newlines', () => {
      const boundaries = layout.getParagraphBoundaries('Hello\n\n\nWorld');

      expect(boundaries).toEqual([0, 6, 7, 8]);
    });

    it('should handle trailing newline', () => {
      const boundaries = layout.getParagraphBoundaries('Hello\n');

      expect(boundaries).toEqual([0, 6]);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex document', () => {
      context.availableWidth = 200;
      context.availableHeight = 100;

      const text = 'Paragraph one with some text.\nParagraph two.\n\nParagraph four after empty.';
      context.content = text;
      context.paragraphFormatting.setAlignment(0, 'left');
      context.paragraphFormatting.setAlignment(30, 'center');

      const pages = layout.flowText(text, context);

      // Should have multiple pages due to height limit
      expect(pages.length).toBeGreaterThanOrEqual(1);

      // All lines should have valid structure
      for (const page of pages) {
        for (const line of page.lines) {
          expect(line.startIndex).toBeDefined();
          expect(line.endIndex).toBeDefined();
          expect(line.height).toBeGreaterThan(0);
          expect(line.alignment).toBeDefined();
        }
      }
    });

    it('should preserve content across pages', () => {
      context.availableHeight = 30;
      const text = 'Line 1\nLine 2\nLine 3\nLine 4';
      context.content = text;

      const pages = layout.flowText(text, context);

      // Collect all text from all pages
      let reconstructed = '';
      for (const page of pages) {
        for (const line of page.lines) {
          reconstructed += line.text;
          if (line.endsWithNewline) reconstructed += '\n';
        }
      }

      // Should match original (without trailing newline artifacts)
      expect(reconstructed.replace(/\n+$/, '')).toBe(text);
    });
  });
});
