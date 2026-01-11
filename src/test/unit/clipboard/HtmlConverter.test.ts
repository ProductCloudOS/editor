/**
 * Unit tests for HtmlConverter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlConverter } from '../../../lib/clipboard/HtmlConverter';
import type { ClipboardContent } from '../../../lib/clipboard/types';

describe('HtmlConverter', () => {
  let converter: HtmlConverter;

  beforeEach(() => {
    converter = new HtmlConverter();
  });

  describe('toHtml()', () => {
    it('should convert plain text to HTML', () => {
      const content: ClipboardContent = {
        text: 'Hello world'
      };

      const html = converter.toHtml(content);

      expect(html).toBe('Hello world');
    });

    it('should escape HTML special characters', () => {
      const content: ClipboardContent = {
        text: '<script>alert("xss")</script>'
      };

      const html = converter.toHtml(content);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should convert newlines to <br> tags', () => {
      const content: ClipboardContent = {
        text: 'Line 1\nLine 2\nLine 3'
      };

      const html = converter.toHtml(content);

      expect(html).toContain('<br>');
      expect(html.split('<br>').length).toBe(3);
    });

    it('should return empty string for empty text', () => {
      const content: ClipboardContent = {
        text: ''
      };

      const html = converter.toHtml(content);

      expect(html).toBe('');
    });

    it('should apply formatting runs as styled spans', () => {
      const content: ClipboardContent = {
        text: 'Hello world',
        formattingRuns: [
          {
            index: 0,
            formatting: {
              fontFamily: 'Arial',
              fontSize: 14,
              fontWeight: 'bold',
              color: '#ff0000'
            }
          }
        ]
      };

      const html = converter.toHtml(content);

      expect(html).toContain('font-weight: bold');
      expect(html).toContain('color: #ff0000');
    });

    it('should handle multiple formatting runs', () => {
      const content: ClipboardContent = {
        text: 'Hello world',
        formattingRuns: [
          {
            index: 0,
            formatting: {
              fontFamily: 'Arial',
              fontSize: 14,
              fontWeight: 'bold',
              color: '#000000'
            }
          },
          {
            index: 6,
            formatting: {
              fontFamily: 'Arial',
              fontSize: 14,
              fontStyle: 'italic',
              color: '#0000ff'
            }
          }
        ]
      };

      const html = converter.toHtml(content);

      expect(html).toContain('font-weight: bold');
      expect(html).toContain('font-style: italic');
    });

    it('should handle object replacement characters with formatting', () => {
      const content: ClipboardContent = {
        text: 'Hello \uFFFC world',
        formattingRuns: [
          {
            index: 0,
            formatting: {
              fontFamily: 'Arial',
              fontSize: 14,
              color: '#000000'
            }
          }
        ]
      };

      const html = converter.toHtml(content);

      expect(html).toContain('data-object="true"');
    });

    it('should escape object replacement characters without formatting', () => {
      const content: ClipboardContent = {
        text: 'Hello \uFFFC world'
      };

      const html = converter.toHtml(content);

      // Without formatting, it just escapes the text (replacing newlines only)
      expect(html).toContain('\uFFFC');
    });
  });

  describe('fromHtml()', () => {
    it('should parse plain text from HTML', () => {
      const html = 'Hello world';
      const content = converter.fromHtml(html);

      expect(content.text).toBe('Hello world');
    });

    it('should handle <br> as newlines', () => {
      const html = 'Line 1<br>Line 2<br>Line 3';
      const content = converter.fromHtml(html);

      expect(content.text).toContain('\n');
      expect(content.text.split('\n').length).toBe(3);
    });

    it('should handle <p> tags as paragraphs', () => {
      const html = '<p>Paragraph 1</p><p>Paragraph 2</p>';
      const content = converter.fromHtml(html);

      expect(content.text).toContain('\n');
    });

    it('should extract bold formatting from <b> tags', () => {
      const html = '<b>Bold text</b>';
      const content = converter.fromHtml(html);

      expect(content.text).toBe('Bold text');
      expect(content.formattingRuns).toBeDefined();
      expect(content.formattingRuns?.length).toBeGreaterThan(0);
      expect(content.formattingRuns?.[0].formatting.fontWeight).toBe('bold');
    });

    it('should extract bold formatting from <strong> tags', () => {
      const html = '<strong>Bold text</strong>';
      const content = converter.fromHtml(html);

      expect(content.formattingRuns?.[0].formatting.fontWeight).toBe('bold');
    });

    it('should extract italic formatting from <i> tags', () => {
      const html = '<i>Italic text</i>';
      const content = converter.fromHtml(html);

      expect(content.text).toBe('Italic text');
      expect(content.formattingRuns?.[0].formatting.fontStyle).toBe('italic');
    });

    it('should extract italic formatting from <em> tags', () => {
      const html = '<em>Italic text</em>';
      const content = converter.fromHtml(html);

      expect(content.formattingRuns?.[0].formatting.fontStyle).toBe('italic');
    });

    it('should extract inline styles', () => {
      const html = '<span style="font-size: 20px; color: rgb(255, 0, 0);">Styled text</span>';
      const content = converter.fromHtml(html);

      expect(content.text).toBe('Styled text');
      expect(content.formattingRuns).toBeDefined();
      // Font size should be converted from px to pt (approximately)
      expect(content.formattingRuns?.[0].formatting.fontSize).toBeDefined();
      // Color should be normalized to hex
      expect(content.formattingRuns?.[0].formatting.color).toBe('#ff0000');
    });

    it('should handle nested formatting', () => {
      const html = '<b><i>Bold and italic</i></b>';
      const content = converter.fromHtml(html);

      expect(content.text).toBe('Bold and italic');
      // Should have combined formatting
      const format = content.formattingRuns?.[0].formatting;
      expect(format?.fontWeight).toBe('bold');
      expect(format?.fontStyle).toBe('italic');
    });

    it('should handle heading tags', () => {
      const html = '<h1>Heading</h1><p>Text</p>';
      const content = converter.fromHtml(html);

      expect(content.text).toContain('Heading');
      expect(content.text).toContain('Text');
      expect(content.text).toContain('\n');
    });

    it('should return empty content for empty HTML', () => {
      const content = converter.fromHtml('');

      expect(content.text).toBe('');
    });

    it('should handle list items', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const content = converter.fromHtml(html);

      expect(content.text).toContain('Item 1');
      expect(content.text).toContain('Item 2');
      // List items should be on separate lines
      expect(content.text).toContain('\n');
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve basic text in round-trip', () => {
      const originalContent: ClipboardContent = {
        text: 'Hello world'
      };

      const html = converter.toHtml(originalContent);
      const result = converter.fromHtml(html);

      expect(result.text).toBe(originalContent.text);
    });

    it('should preserve newlines in round-trip', () => {
      const originalContent: ClipboardContent = {
        text: 'Line 1\nLine 2'
      };

      const html = converter.toHtml(originalContent);
      const result = converter.fromHtml(html);

      expect(result.text).toContain('\n');
    });
  });
});
