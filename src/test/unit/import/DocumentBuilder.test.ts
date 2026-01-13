import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentBuilder } from '../../../lib/import/DocumentBuilder';
import { AnalyzedContent, AnalyzedParagraph, AnalyzedImage, AnalyzedTable } from '../../../lib/import/types';

describe('DocumentBuilder', () => {
  let builder: DocumentBuilder;

  beforeEach(() => {
    builder = new DocumentBuilder();
  });

  describe('build', () => {
    it('should create a document with correct version', () => {
      const content = createEmptyContent();
      const result = builder.build(content, 1);

      expect(result.version).toBe('1.0');
    });

    it('should create correct number of pages', () => {
      const content = createEmptyContent();
      const result = builder.build(content, 3);

      expect(result.pages.length).toBe(3);
      expect(result.pages[0].id).toBe('imported-page-1');
      expect(result.pages[2].id).toBe('imported-page-3');
    });

    it('should detect Letter page size', () => {
      const content = createEmptyContent();
      content.pageInfo.width = 612;
      content.pageInfo.height = 792;

      const result = builder.build(content, 1);

      expect(result.settings?.pageSize).toBe('Letter');
      expect(result.settings?.pageOrientation).toBe('portrait');
    });

    it('should detect A4 page size', () => {
      const content = createEmptyContent();
      content.pageInfo.width = 595;
      content.pageInfo.height = 842;

      const result = builder.build(content, 1);

      expect(result.settings?.pageSize).toBe('A4');
    });

    it('should detect landscape orientation', () => {
      const content = createEmptyContent();
      content.pageInfo.width = 792;
      content.pageInfo.height = 612;

      const result = builder.build(content, 1);

      expect(result.settings?.pageOrientation).toBe('landscape');
    });

    it('should convert margins from points to mm', () => {
      const content = createEmptyContent();
      content.pageInfo.margins = { top: 72, right: 72, bottom: 72, left: 72 };

      const result = builder.build(content, 1);

      // 72 points ≈ 25.4mm (1 inch)
      expect(result.settings?.margins.top).toBeCloseTo(25, 0);
    });
  });

  describe('paragraph handling', () => {
    it('should include paragraph text in body content', () => {
      const content = createEmptyContent();
      content.paragraphs = [
        createParagraph('Hello World', 1, 100)
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.text).toContain('Hello World');
    });

    it('should add newline at paragraph end', () => {
      const content = createEmptyContent();
      content.paragraphs = [
        createParagraph('First paragraph', 1, 100),
        createParagraph('Second paragraph', 1, 200)
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.text).toContain('\n');
    });

    it('should preserve paragraph alignment', () => {
      const content = createEmptyContent();
      content.paragraphs = [
        { ...createParagraph('Centered text', 1, 100), alignment: 'center' }
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.paragraphFormatting?.length).toBeGreaterThan(0);
      expect(result.bodyContent?.paragraphFormatting?.[0].formatting.alignment).toBe('center');
    });

    it('should sort paragraphs by page and Y position', () => {
      const content = createEmptyContent();
      content.paragraphs = [
        createParagraph('Second', 1, 200),
        createParagraph('First', 1, 100)
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.text).toMatch(/First.*Second/s);
    });
  });

  describe('image handling', () => {
    it('should create embedded object for images', () => {
      const content = createEmptyContent();
      content.images = [
        createImage('data:image/png;base64,test', 100, 100, 1, 50, 'block')
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.embeddedObjects?.length).toBe(1);
      expect(result.bodyContent?.embeddedObjects?.[0].object.objectType).toBe('image');
    });

    it('should set correct image position', () => {
      const content = createEmptyContent();
      content.images = [
        createImage('data:image/png;base64,test', 50, 50, 1, 50, 'inline')
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.embeddedObjects?.[0].object.position).toBe('inline');
    });

    it('should include object replacement character in text', () => {
      const content = createEmptyContent();
      content.images = [
        createImage('data:image/png;base64,test', 100, 100, 1, 50, 'block')
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.text).toContain('\ufffc');
    });
  });

  describe('table handling', () => {
    it('should create embedded object for tables', () => {
      const content = createEmptyContent();
      content.tables = [
        createTable(2, 2, 1, 100)
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.embeddedObjects?.length).toBe(1);
      expect(result.bodyContent?.embeddedObjects?.[0].object.objectType).toBe('table');
    });

    it('should set table position as block', () => {
      const content = createEmptyContent();
      content.tables = [
        createTable(2, 2, 1, 100)
      ];

      const result = builder.build(content, 1);

      expect(result.bodyContent?.embeddedObjects?.[0].object.position).toBe('block');
    });
  });

  describe('multi-page handling', () => {
    it('should add page breaks between pages', () => {
      const content = createEmptyContent();
      content.paragraphs = [
        createParagraph('Page 1', 1, 100),
        createParagraph('Page 2', 2, 100)
      ];

      const result = builder.build(content, 2);

      expect(result.bodyContent?.text).toContain('\u000c'); // PAGE_BREAK_CHAR
    });
  });

  describe('empty content', () => {
    it('should create empty header content', () => {
      const content = createEmptyContent();
      const result = builder.build(content, 1);

      expect(result.headerContent?.text).toBe('');
      expect(result.headerContent?.embeddedObjects).toEqual([]);
    });

    it('should create empty footer content', () => {
      const content = createEmptyContent();
      const result = builder.build(content, 1);

      expect(result.footerContent?.text).toBe('');
      expect(result.footerContent?.embeddedObjects).toEqual([]);
    });
  });
});

// Helper functions

function createEmptyContent(): AnalyzedContent {
  return {
    paragraphs: [],
    images: [],
    tables: [],
    pageInfo: {
      width: 612,
      height: 792,
      margins: { top: 72, right: 72, bottom: 72, left: 72 }
    }
  };
}

function createParagraph(text: string, pageNumber: number, y: number): AnalyzedParagraph {
  return {
    text,
    formattingRuns: [{
      startIndex: 0,
      endIndex: text.length,
      formatting: {
        fontFamily: 'Arial',
        fontSize: 12,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#000000'
      }
    }],
    alignment: 'left',
    pageNumber,
    y,
    endsWithNewline: true
  };
}

function createImage(
  dataUrl: string,
  width: number,
  height: number,
  pageNumber: number,
  y: number,
  position: 'inline' | 'block'
): AnalyzedImage {
  return {
    dataUrl,
    width,
    height,
    pageNumber,
    y,
    position
  };
}

function createTable(rows: number, columns: number, pageNumber: number, y: number): AnalyzedTable {
  const tableRows = [];
  for (let i = 0; i < rows; i++) {
    const cells = [];
    for (let j = 0; j < columns; j++) {
      cells.push({
        text: `R${i}C${j}`,
        formattingRuns: []
      });
    }
    tableRows.push({ cells });
  }

  return {
    rows: tableRows,
    columnWidths: Array(columns).fill(100),
    pageNumber,
    y,
    confidence: 0.9
  };
}
