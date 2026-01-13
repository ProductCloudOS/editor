/**
 * DocumentBuilder - Converts analyzed PDF content to PC Editor DocumentData format.
 */

import {
  DocumentData,
  DocumentSettings,
  PageData,
  FlowingTextContentData,
  TextFormattingRunData,
  ParagraphFormattingData,
  EmbeddedObjectReference
} from '../types';
import { TextFormattingStyle, DEFAULT_FORMATTING, PAGE_BREAK_CHAR, OBJECT_REPLACEMENT_CHAR } from '../text/types';
import { EmbeddedObjectData, ObjectPosition } from '../objects/types';
import {
  AnalyzedContent,
  AnalyzedParagraph,
  AnalyzedImage,
  AnalyzedTable,
  PageInfo
} from './types';

/**
 * Builds PC Editor DocumentData from analyzed PDF content.
 */
export class DocumentBuilder {
  private nextObjectId = 1;

  /**
   * Build DocumentData from analyzed content.
   */
  build(content: AnalyzedContent, pageCount: number): DocumentData {
    // Build body content
    const bodyContent = this.buildFlowingContent(content);

    // Create pages
    const pages = this.createPages(pageCount);

    // Create document settings
    const settings = this.createSettings(content.pageInfo);

    return {
      version: '1.0',
      pages,
      settings,
      bodyContent,
      headerContent: this.createEmptyContent(),
      footerContent: this.createEmptyContent()
    };
  }

  /**
   * Build FlowingTextContent from analyzed content.
   */
  private buildFlowingContent(content: AnalyzedContent): FlowingTextContentData {
    // Sort all content by page and Y position
    const allContent: Array<{
      type: 'paragraph' | 'image' | 'table';
      pageNumber: number;
      y: number;
      data: AnalyzedParagraph | AnalyzedImage | AnalyzedTable;
    }> = [];

    for (const para of content.paragraphs) {
      allContent.push({ type: 'paragraph', pageNumber: para.pageNumber, y: para.y, data: para });
    }

    for (const img of content.images) {
      allContent.push({ type: 'image', pageNumber: img.pageNumber, y: img.y, data: img });
    }

    for (const table of content.tables) {
      allContent.push({ type: 'table', pageNumber: table.pageNumber, y: table.y, data: table });
    }

    // Sort by page, then Y position
    allContent.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
      return a.y - b.y;
    });

    // Build text and formatting
    let text = '';
    const formattingRuns: Array<{ index: number; formatting: Partial<TextFormattingStyle> }> = [];
    const paragraphFormatting: Array<{ paragraphStart: number; alignment: 'left' | 'center' | 'right' | 'justify' }> = [];
    const embeddedObjects: EmbeddedObjectReference[] = [];

    let currentPage = 1;

    for (const item of allContent) {
      // Add page break if we moved to a new page
      if (item.pageNumber > currentPage) {
        // Add page breaks for skipped pages
        while (currentPage < item.pageNumber) {
          text += PAGE_BREAK_CHAR;
          currentPage++;
        }
      }

      if (item.type === 'paragraph') {
        const para = item.data as AnalyzedParagraph;
        const startIndex = text.length;

        // Record paragraph formatting
        paragraphFormatting.push({
          paragraphStart: startIndex,
          alignment: para.alignment
        });

        // Add formatting runs
        for (const run of para.formattingRuns) {
          formattingRuns.push({
            index: startIndex + run.startIndex,
            formatting: run.formatting
          });
        }

        text += para.text;

        // Add newline at end of paragraph
        if (para.endsWithNewline) {
          text += '\n';
        }
      } else if (item.type === 'image') {
        const img = item.data as AnalyzedImage;
        const insertIndex = text.length;

        // Create image object
        const imageObjData: EmbeddedObjectData = {
          id: `imported-image-${this.nextObjectId++}`,
          objectType: 'image',
          textIndex: insertIndex,
          position: img.position as ObjectPosition,
          size: { width: img.width, height: img.height },
          data: {
            src: img.dataUrl,
            alt: 'Imported image'
          }
        };

        embeddedObjects.push({
          textIndex: insertIndex,
          object: imageObjData
        });
        text += OBJECT_REPLACEMENT_CHAR;

        // Add newline after block images
        if (img.position === 'block') {
          text += '\n';
        }
      } else if (item.type === 'table') {
        const table = item.data as AnalyzedTable;
        const insertIndex = text.length;

        // Create table object
        const tableObjData: EmbeddedObjectData = {
          id: `imported-table-${this.nextObjectId++}`,
          objectType: 'table',
          textIndex: insertIndex,
          position: 'block',
          size: {
            width: table.columnWidths.reduce((a, b) => a + b, 0),
            height: table.rows.length * 30 // Estimate row height
          },
          data: {
            rows: table.rows.length,
            columns: table.columnWidths.length,
            columnWidths: table.columnWidths,
            cells: this.buildTableCells(table)
          }
        };

        embeddedObjects.push({
          textIndex: insertIndex,
          object: tableObjData
        });
        text += OBJECT_REPLACEMENT_CHAR;
        text += '\n';
      }
    }

    // Convert formatting runs to the expected format
    const outputFormattingRuns = this.convertFormattingRuns(formattingRuns);

    // Convert paragraph formatting to the expected format
    const outputParagraphFormatting = this.convertParagraphFormatting(paragraphFormatting);

    return {
      text,
      formattingRuns: outputFormattingRuns,
      paragraphFormatting: outputParagraphFormatting,
      substitutionFields: [],
      embeddedObjects,
      repeatingSections: [],
      hyperlinks: []
    };
  }

  /**
   * Build table cells data.
   */
  private buildTableCells(table: AnalyzedTable): Array<{
    row: number;
    col: number;
    content: FlowingTextContentData;
  }> {
    const cells: Array<{
      row: number;
      col: number;
      content: FlowingTextContentData;
    }> = [];

    for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
      const row = table.rows[rowIdx];
      for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
        const cell = row.cells[colIdx];

        // Build cell formatting runs
        const cellFormattingRuns: TextFormattingRunData[] = [];
        if (cell.formattingRuns.length > 0) {
          cellFormattingRuns.push({
            index: 0,
            formatting: {
              fontFamily: (cell.formattingRuns[0].formatting.fontFamily as string) || DEFAULT_FORMATTING.fontFamily,
              fontSize: (cell.formattingRuns[0].formatting.fontSize as number) || DEFAULT_FORMATTING.fontSize,
              fontWeight: cell.formattingRuns[0].formatting.fontWeight,
              fontStyle: cell.formattingRuns[0].formatting.fontStyle,
              color: (cell.formattingRuns[0].formatting.color as string) || DEFAULT_FORMATTING.color
            }
          });
        }

        cells.push({
          row: rowIdx,
          col: colIdx,
          content: {
            text: cell.text,
            formattingRuns: cellFormattingRuns,
            paragraphFormatting: [],
            substitutionFields: [],
            embeddedObjects: [],
            repeatingSections: [],
            hyperlinks: []
          }
        });
      }
    }

    return cells;
  }

  /**
   * Convert formatting runs to the expected TextFormattingRunData format.
   */
  private convertFormattingRuns(
    runs: Array<{ index: number; formatting: Partial<TextFormattingStyle> }>
  ): TextFormattingRunData[] {
    return runs.map(run => ({
      index: run.index,
      formatting: {
        fontFamily: (run.formatting.fontFamily as string) || DEFAULT_FORMATTING.fontFamily,
        fontSize: (run.formatting.fontSize as number) || DEFAULT_FORMATTING.fontSize,
        fontWeight: run.formatting.fontWeight,
        fontStyle: run.formatting.fontStyle,
        color: (run.formatting.color as string) || DEFAULT_FORMATTING.color,
        backgroundColor: run.formatting.backgroundColor
      }
    }));
  }

  /**
   * Convert paragraph formatting to the expected ParagraphFormattingData format.
   */
  private convertParagraphFormatting(
    formatting: Array<{ paragraphStart: number; alignment: 'left' | 'center' | 'right' | 'justify' }>
  ): ParagraphFormattingData[] {
    return formatting.map(fmt => ({
      paragraphStart: fmt.paragraphStart,
      formatting: {
        alignment: fmt.alignment
      }
    }));
  }

  /**
   * Create page data entries.
   */
  private createPages(count: number): PageData[] {
    const pages: PageData[] = [];
    for (let i = 0; i < count; i++) {
      pages.push({
        id: `imported-page-${i + 1}`
      });
    }
    return pages;
  }

  /**
   * Create document settings from page info.
   */
  private createSettings(pageInfo: PageInfo): DocumentSettings {
    // Determine page size
    let pageSize: 'A4' | 'Letter' | 'Legal' | 'A3' = 'A4';
    const widthPt = pageInfo.width;
    const heightPt = pageInfo.height;

    // Check standard page sizes (with tolerance)
    if (Math.abs(widthPt - 612) < 10 && Math.abs(heightPt - 792) < 10) {
      pageSize = 'Letter';
    } else if (Math.abs(widthPt - 612) < 10 && Math.abs(heightPt - 1008) < 10) {
      pageSize = 'Legal';
    } else if (Math.abs(widthPt - 842) < 10 && Math.abs(heightPt - 1191) < 10) {
      pageSize = 'A3';
    }
    // Default to A4 for other sizes

    // Determine orientation
    const orientation = widthPt > heightPt ? 'landscape' : 'portrait';

    // Convert margins from points to mm (1 pt = 0.352778 mm)
    const ptToMm = 0.352778;

    return {
      pageSize,
      pageOrientation: orientation,
      margins: {
        top: Math.round(pageInfo.margins.top * ptToMm),
        right: Math.round(pageInfo.margins.right * ptToMm),
        bottom: Math.round(pageInfo.margins.bottom * ptToMm),
        left: Math.round(pageInfo.margins.left * ptToMm)
      },
      units: 'mm'
    };
  }

  /**
   * Create empty content data.
   */
  private createEmptyContent(): FlowingTextContentData {
    return {
      text: '',
      formattingRuns: [],
      paragraphFormatting: [],
      substitutionFields: [],
      embeddedObjects: [],
      repeatingSections: [],
      hyperlinks: []
    };
  }
}
