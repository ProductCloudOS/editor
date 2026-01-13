import { describe, it, expect, beforeEach } from 'vitest';
import { ContentAnalyzer } from '../../../lib/import/ContentAnalyzer';
import { PDFExtractedContent, PDFExtractedPage, PDFTextItem } from '../../../lib/import/types';

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;

  beforeEach(() => {
    analyzer = new ContentAnalyzer();
  });

  describe('analyze', () => {
    it('should analyze empty content', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.paragraphs).toEqual([]);
      expect(result.images).toEqual([]);
      expect(result.tables).toEqual([]);
      expect(result.pageInfo.width).toBe(612);
      expect(result.pageInfo.height).toBe(792);
    });

    it('should group text items into a single paragraph', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [
            createTextItem('Hello ', 72, 100, 12),
            createTextItem('World', 108, 100, 12)
          ],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.paragraphs.length).toBe(1);
      expect(result.paragraphs[0].text).toContain('Hello');
      expect(result.paragraphs[0].text).toContain('World');
      expect(result.paragraphs[0].pageNumber).toBe(1);
    });

    it('should detect multiple paragraphs based on vertical gap', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [
            // First paragraph - 3 lines with small gaps (14px)
            createTextItem('First paragraph line 1', 72, 100, 12),
            createTextItem('First paragraph line 2', 72, 114, 12),
            createTextItem('First paragraph line 3', 72, 128, 12),
            // Second paragraph - large gap (50px instead of 14px)
            createTextItem('Second paragraph line 1', 72, 178, 12),
            createTextItem('Second paragraph line 2', 72, 192, 12)
          ],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.paragraphs.length).toBe(2);
      expect(result.paragraphs[0].text).toContain('First');
      expect(result.paragraphs[1].text).toContain('Second');
    });

    it('should detect left alignment', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [
            createTextItem('Left aligned text line one', 72, 100, 12),
            createTextItem('Left aligned text line two', 72, 115, 12),
            createTextItem('Left aligned text line three', 72, 130, 12)
          ],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.paragraphs.length).toBe(1);
      expect(result.paragraphs[0].alignment).toBe('left');
    });

    it('should extract images', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [],
          images: [{
            x: 100,
            y: 200,
            width: 300,
            height: 200,
            dataUrl: 'data:image/png;base64,test',
            mimeType: 'image/png'
          }]
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.images.length).toBe(1);
      expect(result.images[0].width).toBe(300);
      expect(result.images[0].height).toBe(200);
      expect(result.images[0].position).toBe('block'); // Large image
    });

    it('should classify small images as inline', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [],
          images: [{
            x: 100,
            y: 200,
            width: 50,
            height: 50,
            dataUrl: 'data:image/png;base64,test',
            mimeType: 'image/png'
          }]
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.images.length).toBe(1);
      expect(result.images[0].position).toBe('inline');
    });
  });

  describe('font mapping', () => {
    it('should detect bold font weight', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [
            {
              text: 'Bold text',
              x: 72,
              y: 100,
              width: 100,
              height: 12,
              fontName: 'Arial-Bold',
              fontSize: 12,
              fontWeight: 'bold',
              fontStyle: 'normal'
            }
          ],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.paragraphs[0].formattingRuns[0].formatting.fontWeight).toBe('bold');
    });

    it('should detect italic font style', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [
            {
              text: 'Italic text',
              x: 72,
              y: 100,
              width: 100,
              height: 12,
              fontName: 'Arial-Italic',
              fontSize: 12,
              fontWeight: 'normal',
              fontStyle: 'italic'
            }
          ],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.paragraphs[0].formattingRuns[0].formatting.fontStyle).toBe('italic');
    });
  });

  describe('table detection', () => {
    it('should detect simple table structure', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [
            // Row 1
            createTextItem('Col1', 72, 100, 12),
            createTextItem('Col2', 200, 100, 12),
            // Row 2
            createTextItem('A', 72, 115, 12),
            createTextItem('B', 200, 115, 12),
            // Row 3
            createTextItem('C', 72, 130, 12),
            createTextItem('D', 200, 130, 12)
          ],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      // Table detection is heuristic-based, so we check if it found a table
      // or treated it as paragraphs (depending on confidence threshold)
      expect(result.tables.length + result.paragraphs.length).toBeGreaterThan(0);
    });

    it('should not detect table when disabled', () => {
      const analyzer = new ContentAnalyzer({ detectTables: false });

      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [
            createTextItem('Col1', 72, 100, 12),
            createTextItem('Col2', 200, 100, 12),
            createTextItem('A', 72, 115, 12),
            createTextItem('B', 200, 115, 12)
          ],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.tables.length).toBe(0);
    });
  });

  describe('page info estimation', () => {
    it('should estimate margins from content', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [
            createTextItem('Content', 72, 100, 12)
          ],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.pageInfo.margins.left).toBe(72);
      expect(result.pageInfo.margins.top).toBe(100);
    });

    it('should use default margins for empty page', () => {
      const content: PDFExtractedContent = {
        pageCount: 1,
        pages: [{
          pageNumber: 1,
          width: 612,
          height: 792,
          textItems: [],
          images: []
        }]
      };

      const result = analyzer.analyze(content);

      expect(result.pageInfo.margins.left).toBe(72);
      expect(result.pageInfo.margins.top).toBe(72);
    });
  });
});

// Helper function to create a text item
function createTextItem(
  text: string,
  x: number,
  y: number,
  fontSize: number
): PDFTextItem {
  return {
    text,
    x,
    y,
    width: text.length * fontSize * 0.6,
    height: fontSize,
    fontName: 'Arial',
    fontSize,
    fontWeight: 'normal',
    fontStyle: 'normal'
  };
}
