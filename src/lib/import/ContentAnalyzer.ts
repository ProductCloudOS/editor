/**
 * ContentAnalyzer - Analyzes extracted PDF content to detect structure.
 */

import { TextFormattingStyle } from '../text/types';
import {
  PDFExtractedContent,
  PDFExtractedPage,
  PDFTextItem,
  PDFImage,
  AnalyzedContent,
  AnalyzedParagraph,
  AnalyzedImage,
  AnalyzedTable,
  AnalyzedTableRow,
  FormattingRun,
  PageInfo,
  PDFImportOptions,
  DEFAULT_IMPORT_OPTIONS
} from './types';

/**
 * Line of text items grouped by Y position.
 */
interface TextLine {
  items: PDFTextItem[];
  y: number;
  minX: number;
  maxX: number;
  height: number;
}

/**
 * Analyzes extracted PDF content to detect paragraphs, tables, and structure.
 */
export class ContentAnalyzer {
  private options: Required<PDFImportOptions>;

  constructor(options?: PDFImportOptions) {
    this.options = { ...DEFAULT_IMPORT_OPTIONS, ...options };
  }

  /**
   * Analyze extracted PDF content and detect structure.
   */
  analyze(content: PDFExtractedContent, options?: Partial<PDFImportOptions>): AnalyzedContent {
    // Merge runtime options with constructor options
    if (options) {
      this.options = { ...this.options, ...options };
    }
    const allParagraphs: AnalyzedParagraph[] = [];
    const allImages: AnalyzedImage[] = [];
    const allTables: AnalyzedTable[] = [];

    // Analyze first page to get page info
    const firstPage = content.pages[0];
    const pageInfo = this.analyzePageLayout(firstPage);

    for (const page of content.pages) {
      // Group text items into lines
      const lines = this.groupIntoLines(page.textItems);

      // Detect tables if enabled
      let tableRegions: { startLine: number; endLine: number; table: AnalyzedTable }[] = [];
      if (this.options.detectTables) {
        tableRegions = this.detectTables(lines, page.pageNumber);
        for (const region of tableRegions) {
          if (region.table.confidence >= this.options.tableConfidenceThreshold) {
            allTables.push(region.table);
          }
        }
      }

      // Group remaining lines into paragraphs (excluding table regions)
      const paragraphs = this.groupIntoParagraphs(lines, page.pageNumber, pageInfo, tableRegions);
      allParagraphs.push(...paragraphs);

      // Analyze images if enabled
      if (this.options.extractImages) {
        const images = this.analyzeImages(page.images, page.pageNumber);
        allImages.push(...images);
      }
    }

    return {
      paragraphs: allParagraphs,
      images: allImages,
      tables: allTables,
      pageInfo
    };
  }

  /**
   * Analyze page layout to estimate margins.
   */
  private analyzePageLayout(page: PDFExtractedPage): PageInfo {
    if (page.textItems.length === 0) {
      return {
        width: page.width,
        height: page.height,
        margins: { top: 72, right: 72, bottom: 72, left: 72 } // Default 1 inch
      };
    }

    const minX = Math.min(...page.textItems.map(item => item.x));
    const maxX = Math.max(...page.textItems.map(item => item.x + item.width));
    const minY = Math.min(...page.textItems.map(item => item.y));
    const maxY = Math.max(...page.textItems.map(item => item.y + item.height));

    return {
      width: page.width,
      height: page.height,
      margins: {
        left: Math.max(0, minX),
        right: Math.max(0, page.width - maxX),
        top: Math.max(0, minY),
        bottom: Math.max(0, page.height - maxY)
      }
    };
  }

  /**
   * Group text items into lines based on Y position.
   */
  private groupIntoLines(items: PDFTextItem[]): TextLine[] {
    if (items.length === 0) return [];

    // Sort by Y position (top to bottom), then X position (left to right)
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

    const lines: TextLine[] = [];
    let currentLine: PDFTextItem[] = [sorted[0]];
    let currentY = sorted[0].y;

    // Tolerance for same-line detection (based on font size)
    const getLineTolerance = (item: PDFTextItem) => item.fontSize * 0.5;

    for (let i = 1; i < sorted.length; i++) {
      const item = sorted[i];
      const tolerance = getLineTolerance(item);

      if (Math.abs(item.y - currentY) <= tolerance) {
        currentLine.push(item);
      } else {
        lines.push(this.createLine(currentLine));
        currentLine = [item];
        currentY = item.y;
      }
    }

    if (currentLine.length > 0) {
      lines.push(this.createLine(currentLine));
    }

    return lines;
  }

  /**
   * Create a TextLine from items.
   */
  private createLine(items: PDFTextItem[]): TextLine {
    // Sort items by X position
    items.sort((a, b) => a.x - b.x);

    return {
      items,
      y: items[0].y,
      minX: Math.min(...items.map(i => i.x)),
      maxX: Math.max(...items.map(i => i.x + i.width)),
      height: Math.max(...items.map(i => i.height))
    };
  }

  /**
   * Group lines into paragraphs based on spacing and structure.
   */
  private groupIntoParagraphs(
    lines: TextLine[],
    pageNumber: number,
    pageInfo: PageInfo,
    tableRegions: { startLine: number; endLine: number }[]
  ): AnalyzedParagraph[] {
    if (lines.length === 0) return [];

    const paragraphs: AnalyzedParagraph[] = [];
    let currentParagraphLines: TextLine[] = [];

    // Calculate average line spacing
    const lineSpacings: number[] = [];
    for (let i = 1; i < lines.length; i++) {
      lineSpacings.push(lines[i].y - lines[i - 1].y);
    }
    const avgLineSpacing = lineSpacings.length > 0
      ? lineSpacings.reduce((a, b) => a + b, 0) / lineSpacings.length
      : 20;

    // Check if line is in a table region
    const isInTable = (lineIndex: number) =>
      tableRegions.some(r => lineIndex >= r.startLine && lineIndex <= r.endLine);

    for (let i = 0; i < lines.length; i++) {
      // Skip lines in table regions
      if (isInTable(i)) {
        if (currentParagraphLines.length > 0) {
          paragraphs.push(this.createParagraph(currentParagraphLines, pageNumber, pageInfo));
          currentParagraphLines = [];
        }
        continue;
      }

      const line = lines[i];

      if (currentParagraphLines.length === 0) {
        currentParagraphLines.push(line);
        continue;
      }

      const prevLine = currentParagraphLines[currentParagraphLines.length - 1];
      const lineGap = line.y - prevLine.y;

      // Detect paragraph break based on:
      // 1. Large vertical gap (> 1.5x average line spacing)
      // 2. Significant indentation change
      const isLargeGap = lineGap > avgLineSpacing * 1.5;
      const indentDiff = Math.abs(line.minX - prevLine.minX);
      const isIndentChange = indentDiff > 20; // Significant indent change

      if (isLargeGap || isIndentChange) {
        paragraphs.push(this.createParagraph(currentParagraphLines, pageNumber, pageInfo));
        currentParagraphLines = [line];
      } else {
        currentParagraphLines.push(line);
      }
    }

    if (currentParagraphLines.length > 0) {
      paragraphs.push(this.createParagraph(currentParagraphLines, pageNumber, pageInfo));
    }

    return paragraphs;
  }

  /**
   * Create an AnalyzedParagraph from lines.
   */
  private createParagraph(
    lines: TextLine[],
    pageNumber: number,
    pageInfo: PageInfo
  ): AnalyzedParagraph {
    const textParts: string[] = [];
    const formattingRuns: FormattingRun[] = [];
    let currentIndex = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      for (const item of line.items) {
        // Add space before if needed
        if (currentIndex > 0) {
          const prevChar = textParts[textParts.length - 1];
          if (prevChar && !prevChar.endsWith(' ')) {
            textParts.push(' ');
            currentIndex++;
          }
        }

        const startIndex = currentIndex;
        textParts.push(item.text);
        currentIndex += item.text.length;

        // Create formatting run
        const formatting = this.mapFormatting(item);
        formattingRuns.push({
          startIndex,
          endIndex: currentIndex,
          formatting
        });
      }

      // Add space between lines (will be treated as soft wrap)
      if (lineIdx < lines.length - 1) {
        textParts.push(' ');
        currentIndex++;
      }
    }

    // Merge adjacent runs with same formatting
    const mergedRuns = this.mergeFormattingRuns(formattingRuns);

    // Detect alignment
    const alignment = this.detectAlignment(lines, pageInfo);

    return {
      text: textParts.join(''),
      formattingRuns: mergedRuns,
      alignment,
      pageNumber,
      y: lines[0].y,
      endsWithNewline: true
    };
  }

  /**
   * Map PDF text item to TextFormattingStyle.
   */
  private mapFormatting(item: PDFTextItem): Partial<TextFormattingStyle> {
    return {
      fontFamily: this.mapFontFamily(item.fontName),
      fontSize: Math.round(item.fontSize),
      fontWeight: item.fontWeight || 'normal',
      fontStyle: item.fontStyle || 'normal',
      color: item.color
        ? `#${item.color.r.toString(16).padStart(2, '0')}${item.color.g.toString(16).padStart(2, '0')}${item.color.b.toString(16).padStart(2, '0')}`
        : '#000000'
    };
  }

  /**
   * Map PDF font name to standard font family.
   */
  private mapFontFamily(pdfFontName: string): string {
    const fontMap: Record<string, string> = {
      'helvetica': 'Arial',
      'arial': 'Arial',
      'times': 'Times New Roman',
      'timesnewroman': 'Times New Roman',
      'courier': 'Courier New',
      'couriernew': 'Courier New',
      'georgia': 'Georgia',
      'verdana': 'Verdana',
      'tahoma': 'Tahoma',
      'trebuchet': 'Trebuchet MS',
      'impact': 'Impact',
      'comic': 'Comic Sans MS'
    };

    // Normalize font name
    const normalized = pdfFontName
      .toLowerCase()
      .replace(/[-_,.\s]/g, '')
      .replace(/(bold|italic|oblique|regular|medium|light|black|heavy)/gi, '');

    // Find matching font
    for (const [key, value] of Object.entries(fontMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    // Default to Arial
    return 'Arial';
  }

  /**
   * Merge adjacent formatting runs with identical formatting.
   */
  private mergeFormattingRuns(runs: FormattingRun[]): FormattingRun[] {
    if (runs.length === 0) return [];

    const merged: FormattingRun[] = [runs[0]];

    for (let i = 1; i < runs.length; i++) {
      const current = runs[i];
      const last = merged[merged.length - 1];

      // Check if formatting is the same
      if (this.isFormattingEqual(last.formatting, current.formatting)) {
        // Extend the last run
        last.endIndex = current.endIndex;
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Check if two formatting objects are equal.
   */
  private isFormattingEqual(
    a: Partial<TextFormattingStyle>,
    b: Partial<TextFormattingStyle>
  ): boolean {
    return (
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.fontStyle === b.fontStyle &&
      a.color === b.color
    );
  }

  /**
   * Detect text alignment from lines.
   */
  private detectAlignment(
    lines: TextLine[],
    pageInfo: PageInfo
  ): 'left' | 'center' | 'right' | 'justify' {
    if (lines.length === 0) return 'left';

    const contentWidth = pageInfo.width - pageInfo.margins.left - pageInfo.margins.right;
    const tolerance = 10; // pixels

    let leftAligned = 0;
    let rightAligned = 0;
    let centerAligned = 0;
    let justified = 0;

    for (const line of lines) {
      const lineWidth = line.maxX - line.minX;
      const leftDist = Math.abs(line.minX - pageInfo.margins.left);
      const rightDist = Math.abs((pageInfo.width - pageInfo.margins.right) - line.maxX);
      const centerOffset = Math.abs(
        (line.minX + lineWidth / 2) - (pageInfo.width / 2)
      );

      // Check if line spans most of the content width (justified)
      if (lineWidth > contentWidth * 0.9 && leftDist < tolerance && rightDist < tolerance) {
        justified++;
      } else if (centerOffset < tolerance * 2) {
        centerAligned++;
      } else if (rightDist < tolerance && leftDist > tolerance * 3) {
        rightAligned++;
      } else {
        leftAligned++;
      }
    }

    // Determine dominant alignment
    const max = Math.max(leftAligned, rightAligned, centerAligned, justified);
    if (justified === max && justified > 0) return 'justify';
    if (centerAligned === max) return 'center';
    if (rightAligned === max) return 'right';
    return 'left';
  }

  /**
   * Detect tables from lines.
   */
  private detectTables(
    lines: TextLine[],
    pageNumber: number
  ): { startLine: number; endLine: number; table: AnalyzedTable }[] {
    const tables: { startLine: number; endLine: number; table: AnalyzedTable }[] = [];

    // Find potential column boundaries
    const columnBoundaries = this.detectColumnBoundaries(lines);
    if (columnBoundaries.length < 2) return tables;

    // Find regions with consistent column structure
    let regionStart = -1;
    let regionLines: TextLine[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const columnsUsed = this.countColumnsUsed(line, columnBoundaries);

      if (columnsUsed >= 2) {
        if (regionStart === -1) {
          regionStart = i;
        }
        regionLines.push(line);
      } else {
        if (regionLines.length >= 2) {
          // We have a potential table
          const table = this.createTable(regionLines, columnBoundaries, pageNumber);
          if (table.confidence >= this.options.tableConfidenceThreshold) {
            tables.push({
              startLine: regionStart,
              endLine: i - 1,
              table
            });
          }
        }
        regionStart = -1;
        regionLines = [];
      }
    }

    // Check final region
    if (regionLines.length >= 2) {
      const table = this.createTable(regionLines, columnBoundaries, pageNumber);
      if (table.confidence >= this.options.tableConfidenceThreshold) {
        tables.push({
          startLine: regionStart,
          endLine: lines.length - 1,
          table
        });
      }
    }

    return tables;
  }

  /**
   * Detect column boundaries from text positions.
   */
  private detectColumnBoundaries(lines: TextLine[]): number[] {
    // Build histogram of X positions
    const xPositions = new Map<number, number>();
    const bucketSize = 5;

    for (const line of lines) {
      for (const item of line.items) {
        const bucket = Math.round(item.x / bucketSize) * bucketSize;
        xPositions.set(bucket, (xPositions.get(bucket) || 0) + 1);
      }
    }

    // Find positions that appear frequently (potential column starts)
    const threshold = Math.max(2, lines.length * 0.3);
    const boundaries = Array.from(xPositions.entries())
      .filter(([, count]) => count >= threshold)
      .map(([x]) => x)
      .sort((a, b) => a - b);

    // Filter out boundaries that are too close together
    const minGap = 30;
    const filtered: number[] = [];
    for (const boundary of boundaries) {
      if (filtered.length === 0 || boundary - filtered[filtered.length - 1] >= minGap) {
        filtered.push(boundary);
      }
    }

    return filtered;
  }

  /**
   * Count how many columns a line uses.
   */
  private countColumnsUsed(line: TextLine, columnBoundaries: number[]): number {
    const usedColumns = new Set<number>();
    const tolerance = 15;

    for (const item of line.items) {
      for (let i = 0; i < columnBoundaries.length; i++) {
        const boundary = columnBoundaries[i];
        const nextBoundary = columnBoundaries[i + 1] ?? Infinity;

        if (item.x >= boundary - tolerance && item.x < nextBoundary) {
          usedColumns.add(i);
          break;
        }
      }
    }

    return usedColumns.size;
  }

  /**
   * Create a table from lines.
   */
  private createTable(
    lines: TextLine[],
    columnBoundaries: number[],
    pageNumber: number
  ): AnalyzedTable {
    const rows: AnalyzedTableRow[] = [];
    const tolerance = 15;

    for (const line of lines) {
      const cells: { text: string; items: PDFTextItem[] }[] = columnBoundaries.map(() => ({
        text: '',
        items: []
      }));

      for (const item of line.items) {
        // Find which column this item belongs to
        for (let i = 0; i < columnBoundaries.length; i++) {
          const boundary = columnBoundaries[i];
          const nextBoundary = columnBoundaries[i + 1] ?? Infinity;

          if (item.x >= boundary - tolerance && item.x < nextBoundary) {
            if (cells[i].text) cells[i].text += ' ';
            cells[i].text += item.text;
            cells[i].items.push(item);
            break;
          }
        }
      }

      rows.push({
        cells: cells.map(cell => ({
          text: cell.text.trim(),
          formattingRuns: cell.items.length > 0
            ? [{ startIndex: 0, endIndex: cell.text.length, formatting: this.mapFormatting(cell.items[0]) }]
            : []
        }))
      });
    }

    // Calculate column widths
    const columnWidths = columnBoundaries.map((boundary, i) => {
      const nextBoundary = columnBoundaries[i + 1];
      return nextBoundary ? nextBoundary - boundary : 100; // Default width for last column
    });

    // Calculate confidence based on how consistently columns are used
    let filledCells = 0;
    let totalCells = 0;
    for (const row of rows) {
      for (const cell of row.cells) {
        totalCells++;
        if (cell.text.length > 0) filledCells++;
      }
    }
    const confidence = totalCells > 0 ? filledCells / totalCells : 0;

    return {
      rows,
      columnWidths,
      pageNumber,
      y: lines[0].y,
      confidence
    };
  }

  /**
   * Analyze images from a page.
   */
  private analyzeImages(images: PDFImage[], pageNumber: number): AnalyzedImage[] {
    return images.map(img => ({
      dataUrl: img.dataUrl,
      width: img.width,
      height: img.height,
      pageNumber,
      y: img.y,
      position: img.width > 200 ? 'block' : 'inline' as const
    }));
  }
}
