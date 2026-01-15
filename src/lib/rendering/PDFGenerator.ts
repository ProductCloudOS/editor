/**
 * PDFGenerator - Generates PDF documents from editor content.
 *
 * Renders content identically to canvas but excludes UI elements like:
 * - Cursor, selection highlight, control characters
 * - Grid lines, margin indicators, resize handles
 * - Repeating section indicators, loop markers
 */

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { Document } from '../core/Document';
import { PDFExportOptions } from '../types';
import { FlowedPage, FlowedLine, TextFormattingStyle } from '../text/types';
import { createBlobFromUint8Array } from '../utils/blob-utils';
import {
  transformY,
  transformRect,
  getStandardFont,
  parseColor,
  drawFilledRect,
  drawLine
} from './pdf-utils';
import { BaseEmbeddedObject, ImageObject, TextBoxObject } from '../objects';
import { TableObject } from '../objects/table';

/**
 * Hyperlink data for PDF generation.
 */
export interface HyperlinkInfo {
  url: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Snapshot of flowed content for PDF generation.
 */
export interface FlowedContentSnapshot {
  body: FlowedPage[];
  header: FlowedPage | null;
  footer: FlowedPage | null;
  bodyHyperlinks?: HyperlinkInfo[];
  headerHyperlinks?: HyperlinkInfo[];
  footerHyperlinks?: HyperlinkInfo[];
}

/**
 * Font cache for embedded PDF fonts.
 */
type FontCache = Map<string, PDFFont>;

export class PDFGenerator {
  private fontCache: FontCache = new Map();

  /**
   * Generate a PDF from the document.
   *
   * @param document The document to export
   * @param flowedContent Snapshot of flowed text content
   * @param options Export options
   */
  async generate(
    document: Document,
    flowedContent?: FlowedContentSnapshot,
    _options?: PDFExportOptions
  ): Promise<Blob> {
    const pdfDoc = await PDFDocument.create();
    this.fontCache.clear();

    // Embed standard fonts we'll need
    await this.embedStandardFonts(pdfDoc);

    // Render each page
    for (let pageIndex = 0; pageIndex < document.pages.length; pageIndex++) {
      try {
        const page = document.pages[pageIndex];
        const dimensions = page.getPageDimensions();
        const pdfPage = pdfDoc.addPage([dimensions.width, dimensions.height]);

        // Draw white background
        pdfPage.drawRectangle({
          x: 0,
          y: 0,
          width: dimensions.width,
          height: dimensions.height,
          color: rgb(1, 1, 1)
        });

        // Get content bounds using Page API
        const pageBounds = page.getContentBounds();
        const contentBounds = {
          x: pageBounds.position.x,
          y: pageBounds.position.y,
          width: pageBounds.size.width,
          height: pageBounds.size.height
        };

        // Render header if present
        if (flowedContent?.header && document.headerFlowingContent) {
          const headerRegion = page.getHeaderBounds();
          const headerBounds = {
            x: headerRegion.position.x,
            y: headerRegion.position.y,
            width: headerRegion.size.width,
            height: headerRegion.size.height
          };
          await this.renderFlowedPage(
            pdfPage,
            flowedContent.header,
            headerBounds,
            dimensions.height,
            pageIndex,
            document.pages.length,
            flowedContent.headerHyperlinks
          );
        }

        // Render body content
        if (flowedContent?.body && flowedContent.body[pageIndex]) {
          await this.renderFlowedPage(
            pdfPage,
            flowedContent.body[pageIndex],
            contentBounds,
            dimensions.height,
            pageIndex,
            document.pages.length,
            flowedContent.bodyHyperlinks
          );
        }

        // Render footer if present
        if (flowedContent?.footer && document.footerFlowingContent) {
          const footerRegion = page.getFooterBounds();
          const footerBounds = {
            x: footerRegion.position.x,
            y: footerRegion.position.y,
            width: footerRegion.size.width,
            height: footerRegion.size.height
          };
          await this.renderFlowedPage(
            pdfPage,
            flowedContent.footer,
            footerBounds,
            dimensions.height,
            pageIndex,
            document.pages.length,
            flowedContent.footerHyperlinks
          );
        }
      } catch (pageError) {
        console.error(`[PDFGenerator] Error rendering page ${pageIndex + 1}:`, pageError);
        throw pageError;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return createBlobFromUint8Array(pdfBytes, 'application/pdf');
  }

  /**
   * Embed standard PDF fonts for all variants we might need.
   */
  private async embedStandardFonts(pdfDoc: PDFDocument): Promise<void> {
    // Embed all Helvetica variants
    const fonts = [
      StandardFonts.Helvetica,
      StandardFonts.HelveticaBold,
      StandardFonts.HelveticaOblique,
      StandardFonts.HelveticaBoldOblique,
      StandardFonts.TimesRoman,
      StandardFonts.TimesRomanBold,
      StandardFonts.TimesRomanItalic,
      StandardFonts.TimesRomanBoldItalic,
      StandardFonts.Courier,
      StandardFonts.CourierBold,
      StandardFonts.CourierOblique,
      StandardFonts.CourierBoldOblique
    ];

    for (const fontName of fonts) {
      const font = await pdfDoc.embedFont(fontName);
      this.fontCache.set(fontName, font);
    }
  }

  /**
   * Filter text to only include WinAnsi-compatible characters.
   * Standard PDF fonts (Helvetica, Times, Courier) only support WinAnsi encoding.
   * This replaces unsupported characters with a placeholder or removes them.
   */
  private filterToWinAnsi(text: string): string {
    // WinAnsi encoding supports characters 32-255 (with some gaps)
    // Replace unsupported characters with '?' or remove them
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // Basic ASCII printable characters (32-126) are always safe
      // Extended characters (128-255) in WinAnsi are mostly supported
      // Skip control characters and characters outside WinAnsi range
      if (code >= 32 && code <= 126) {
        result += text[i];
      } else if (code >= 160 && code <= 255) {
        // Extended Latin characters (most are supported)
        result += text[i];
      } else if (code === 9) {
        // Tab -> spaces
        result += '    ';
      } else if (code === 10 || code === 13) {
        // Newlines should be handled by line breaking, skip here
        continue;
      } else if (code === 12) {
        // Form Feed (page break) - pagination handles this, skip here
        continue;
      } else {
        // Unsupported character - replace with space to maintain spacing
        result += ' ';
      }
    }
    return result;
  }

  /**
   * Get a font from cache by formatting style.
   */
  private getFont(formatting: Partial<TextFormattingStyle>): PDFFont {
    const standardFont = getStandardFont(
      formatting.fontFamily || 'Arial',
      formatting.fontWeight,
      formatting.fontStyle
    );
    return this.fontCache.get(standardFont) || this.fontCache.get(StandardFonts.Helvetica)!;
  }

  /**
   * Render a flowed page to PDF.
   */
  private async renderFlowedPage(
    pdfPage: PDFPage,
    flowedPage: FlowedPage,
    bounds: { x: number; y: number; width: number; height: number },
    pageHeight: number,
    pageIndex: number,
    totalPages: number,
    hyperlinks?: HyperlinkInfo[]
  ): Promise<void> {
    let y = bounds.y;

    // Track relative objects to render after all lines (so they appear on top)
    const relativeObjects: Array<{
      object: BaseEmbeddedObject;
      anchorX: number;
      anchorY: number;
    }> = [];

    // Track rendered text positions for hyperlink annotations
    const renderedRuns: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      startIndex: number;
      endIndex: number;
    }> = [];

    for (const line of flowedPage.lines) {
      // Collect relative objects from this line
      if (line.embeddedObjects) {
        for (const objRef of line.embeddedObjects) {
          if (objRef.isAnchor && objRef.object.position === 'relative') {
            relativeObjects.push({
              object: objRef.object,
              anchorX: bounds.x,
              anchorY: y
            });
          }
        }
      }
      // Calculate line position with alignment
      const alignmentOffset = this.getAlignmentOffset(line, bounds.width);
      const lineX = bounds.x + alignmentOffset;

      // Render each text run in the line
      let runX = lineX;

      for (const run of line.runs) {
        if (!run.text) continue;

        // Filter text to WinAnsi-compatible characters (standard PDF fonts limitation)
        const safeText = this.filterToWinAnsi(run.text);
        if (!safeText) continue;

        // Ensure formatting has required properties with defaults
        const formatting = run.formatting || {};
        const font = this.getFont(formatting);
        const fontSize = formatting.fontSize || 14;
        const color = parseColor(formatting.color || '#000000');

        const textWidth = font.widthOfTextAtSize(safeText, fontSize);

        // Draw background if present
        if (formatting.backgroundColor) {
          const bgColor = parseColor(formatting.backgroundColor);
          drawFilledRect(
            pdfPage,
            runX,
            y,
            textWidth,
            line.height,
            bgColor,
            pageHeight
          );
        }

        // Draw text - position at baseline
        const textY = y + line.baseline;
        pdfPage.drawText(safeText, {
          x: runX,
          y: transformY(textY, pageHeight),
          font,
          size: fontSize,
          color
        });

        // Track this run's position for hyperlink annotations
        if (hyperlinks && hyperlinks.length > 0) {
          renderedRuns.push({
            x: runX,
            y: y,
            width: textWidth,
            height: line.height,
            startIndex: run.startIndex,
            endIndex: run.endIndex
          });
        }

        // Advance X position
        runX += textWidth;

        // Add extra word spacing for justified text
        if (line.extraWordSpacing && safeText.includes(' ')) {
          const spaceCount = (safeText.match(/ /g) || []).length;
          runX += spaceCount * line.extraWordSpacing;
        }
      }

      // Render substitution fields (page numbers, data fields)
      for (const fieldRef of line.substitutionFields) {
        this.renderSubstitutionField(
          pdfPage,
          fieldRef,
          lineX,
          y,
          line,
          pageHeight,
          pageIndex,
          totalPages
        );
      }

      // Render embedded objects (images, text boxes, tables)
      for (const objRef of line.embeddedObjects) {
        // Skip anchor-only entries for relative objects - they're rendered in a separate pass
        if (objRef.isAnchor) {
          continue;
        }

        // For block objects, center them (or align based on line alignment)
        let objectX = lineX + objRef.x;
        if (objRef.isBlock) {
          // Block objects should be centered or aligned within the bounds
          switch (line.alignment) {
            case 'center':
              objectX = bounds.x + (bounds.width - objRef.object.width) / 2;
              break;
            case 'right':
              objectX = bounds.x + bounds.width - objRef.object.width;
              break;
            default:
              objectX = bounds.x;
          }
        }

        await this.renderEmbeddedObject(
          pdfPage,
          objRef.object,
          objectX,
          y,
          pageHeight,
          pageIndex,
          totalPages
        );
      }

      y += line.height;
    }

    // Render relative objects last (so they appear on top of text)
    await this.renderRelativeObjects(pdfPage, relativeObjects, pageHeight, pageIndex, totalPages);

    // Create hyperlink annotations
    if (hyperlinks && hyperlinks.length > 0 && renderedRuns.length > 0) {
      this.createHyperlinkAnnotations(pdfPage, renderedRuns, hyperlinks, pageHeight);
    }
  }

  /**
   * Create PDF link annotations for hyperlinks.
   * Matches hyperlink ranges with rendered text positions and creates clickable links.
   */
  private createHyperlinkAnnotations(
    pdfPage: PDFPage,
    renderedRuns: Array<{ x: number; y: number; width: number; height: number; startIndex: number; endIndex: number }>,
    hyperlinks: HyperlinkInfo[],
    pageHeight: number
  ): void {
    for (const hyperlink of hyperlinks) {
      // Find all runs that overlap with this hyperlink
      const overlappingRuns = renderedRuns.filter(run =>
        run.startIndex < hyperlink.endIndex && run.endIndex > hyperlink.startIndex
      );

      if (overlappingRuns.length === 0) continue;

      // Calculate bounding box for the hyperlink
      // For multi-line hyperlinks, we create separate annotations for each line segment
      // Group runs by their Y position (same line)
      const runsByLine = new Map<number, typeof overlappingRuns>();
      for (const run of overlappingRuns) {
        const key = run.y;
        if (!runsByLine.has(key)) {
          runsByLine.set(key, []);
        }
        runsByLine.get(key)!.push(run);
      }

      // Create an annotation for each line segment
      for (const [lineY, lineRuns] of runsByLine) {
        // Calculate bounds for this line's portion of the hyperlink
        const minX = Math.min(...lineRuns.map(r => r.x));
        const maxX = Math.max(...lineRuns.map(r => r.x + r.width));
        const height = lineRuns[0].height;

        // Transform to PDF coordinates (Y is inverted)
        const pdfY = pageHeight - lineY - height;

        // Create link annotation using pdf-lib
        const linkAnnotation = pdfPage.doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [minX, pdfY, maxX, pdfY + height],
          Border: [0, 0, 0], // No visible border
          A: {
            Type: 'Action',
            S: 'URI',
            URI: hyperlink.url
          }
        });

        // Add annotation to page
        const annotations = pdfPage.node.get(pdfPage.doc.context.obj('Annots'));
        if (annotations) {
          (annotations as any).push(linkAnnotation);
        } else {
          pdfPage.node.set(pdfPage.doc.context.obj('Annots'), pdfPage.doc.context.obj([linkAnnotation]));
        }
      }
    }
  }

  /**
   * Calculate alignment offset for a line.
   */
  private getAlignmentOffset(line: FlowedLine, containerWidth: number): number {
    switch (line.alignment) {
      case 'center':
        return (containerWidth - line.width) / 2;
      case 'right':
        return containerWidth - line.width;
      case 'justify':
      case 'left':
      default:
        return 0;
    }
  }

  /**
   * Render a substitution field (page number, data field value).
   */
  private renderSubstitutionField(
    pdfPage: PDFPage,
    fieldRef: { field: any; x: number; width: number },
    lineX: number,
    lineY: number,
    line: FlowedLine,
    pageHeight: number,
    pageIndex: number,
    totalPages: number
  ): void {
    const field = fieldRef.field;
    let displayText = '';

    // Determine display text based on field type
    if (field.fieldType === 'pageNumber') {
      displayText = String(pageIndex + 1);
    } else if (field.fieldType === 'pageCount') {
      displayText = String(totalPages);
    } else {
      // Data field - should already be substituted, but fallback to default
      displayText = field.defaultValue || '';
    }

    if (!displayText) return;

    // Filter to WinAnsi-compatible characters
    const safeText = this.filterToWinAnsi(displayText);
    if (!safeText) return;

    const formatting = field.formatting || {
      fontFamily: 'Arial',
      fontSize: 14,
      color: '#000000'
    };

    const font = this.getFont(formatting);
    const fontSize = formatting.fontSize;
    const color = parseColor(formatting.color);

    const fieldX = lineX + fieldRef.x;
    const textY = lineY + line.baseline;

    pdfPage.drawText(safeText, {
      x: fieldX,
      y: transformY(textY, pageHeight),
      font,
      size: fontSize,
      color
    });
  }

  /**
   * Render an embedded object (image, text box, or table).
   */
  private async renderEmbeddedObject(
    pdfPage: PDFPage,
    object: BaseEmbeddedObject,
    x: number,
    y: number,
    pageHeight: number,
    pageIndex: number,
    totalPages: number
  ): Promise<void> {
    if (object instanceof ImageObject) {
      await this.renderImage(pdfPage, object, x, y, pageHeight);
    } else if (object instanceof TextBoxObject) {
      await this.renderTextBox(pdfPage, object, x, y, pageHeight, pageIndex, totalPages);
    } else if (object instanceof TableObject) {
      await this.renderTable(pdfPage, object, x, y, pageHeight, pageIndex, totalPages);
    }
  }

  /**
   * Render relative-positioned objects at their calculated positions.
   * Called after all lines are rendered so objects appear on top.
   */
  private async renderRelativeObjects(
    pdfPage: PDFPage,
    relativeObjects: Array<{ object: BaseEmbeddedObject; anchorX: number; anchorY: number }>,
    pageHeight: number,
    pageIndex: number,
    totalPages: number
  ): Promise<void> {
    for (const { object, anchorX, anchorY } of relativeObjects) {
      const offset = object.relativeOffset;
      const elementX = anchorX + offset.x;
      const elementY = anchorY + offset.y;

      await this.renderEmbeddedObject(
        pdfPage,
        object,
        elementX,
        elementY,
        pageHeight,
        pageIndex,
        totalPages
      );
    }
  }

  /**
   * Render an image to PDF.
   */
  private async renderImage(
    pdfPage: PDFPage,
    image: ImageObject,
    x: number,
    y: number,
    pageHeight: number
  ): Promise<void> {
    const pdfDoc = pdfPage.doc;
    const src = image.src;

    // Check if it's a data URL we can embed
    if (src.startsWith('data:')) {
      try {
        const embeddedImage = await this.embedImageFromDataUrl(pdfDoc, src);
        if (embeddedImage) {
          // Calculate draw position/size based on fit mode
          const drawParams = this.calculateImageDrawParams(
            embeddedImage.width,
            embeddedImage.height,
            image.width,
            image.height,
            image.fit
          );

          // Transform coordinates for PDF (Y-axis is inverted)
          const pdfX = x + drawParams.dx;
          const pdfY = pageHeight - (y + drawParams.dy + drawParams.dh);

          // For tiled mode, we need to draw multiple times
          if (image.fit === 'tile') {
            this.drawTiledImage(pdfPage, embeddedImage, x, y, image.width, image.height, pageHeight);
          } else {
            pdfPage.drawImage(embeddedImage, {
              x: pdfX,
              y: pdfY,
              width: drawParams.dw,
              height: drawParams.dh
            });
          }
          return;
        }
      } catch (e) {
        console.warn('Failed to embed image:', e);
      }
    }

    // Fallback: draw placeholder rectangle for images we can't embed
    const rect = transformRect(x, y, image.width, image.height, pageHeight);
    pdfPage.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1
    });
  }

  /**
   * Embed an image from a data URL into the PDF document.
   */
  private async embedImageFromDataUrl(pdfDoc: PDFDocument, dataUrl: string) {
    // Parse data URL format: data:[<mediatype>][;base64],<data>
    const match = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
    if (!match) return null;

    const mimeType = match[1] || '';
    const base64Data = match[2];

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Embed based on type
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      return await pdfDoc.embedJpg(bytes);
    } else if (mimeType.includes('png')) {
      return await pdfDoc.embedPng(bytes);
    }

    // Unsupported format
    return null;
  }

  /**
   * Calculate image drawing parameters based on fit mode.
   */
  private calculateImageDrawParams(
    imgWidth: number,
    imgHeight: number,
    boxWidth: number,
    boxHeight: number,
    fit: string
  ): { dx: number; dy: number; dw: number; dh: number } {
    let dx = 0, dy = 0, dw = boxWidth, dh = boxHeight;

    switch (fit) {
      case 'fill':
        // Stretch to fill - default values work
        break;

      case 'contain': {
        // Fit within bounds, maintaining aspect ratio
        const scale = Math.min(boxWidth / imgWidth, boxHeight / imgHeight);
        dw = imgWidth * scale;
        dh = imgHeight * scale;
        dx = (boxWidth - dw) / 2;
        dy = (boxHeight - dh) / 2;
        break;
      }

      case 'cover': {
        // Cover bounds, maintaining aspect ratio (may crop)
        const scale = Math.max(boxWidth / imgWidth, boxHeight / imgHeight);
        dw = imgWidth * scale;
        dh = imgHeight * scale;
        dx = (boxWidth - dw) / 2;
        dy = (boxHeight - dh) / 2;
        break;
      }

      case 'none':
        // Original size, centered
        dw = imgWidth;
        dh = imgHeight;
        dx = (boxWidth - imgWidth) / 2;
        dy = (boxHeight - imgHeight) / 2;
        break;

      case 'tile':
        // Tiling is handled separately
        dw = imgWidth;
        dh = imgHeight;
        break;
    }

    return { dx, dy, dw, dh };
  }

  /**
   * Draw a tiled image pattern to fill the box.
   */
  private drawTiledImage(
    pdfPage: PDFPage,
    embeddedImage: Awaited<ReturnType<PDFDocument['embedPng']>>,
    x: number,
    y: number,
    boxWidth: number,
    boxHeight: number,
    pageHeight: number
  ): void {
    const imgWidth = embeddedImage.width;
    const imgHeight = embeddedImage.height;

    // Draw tiles to fill the box
    for (let tileY = 0; tileY < boxHeight; tileY += imgHeight) {
      for (let tileX = 0; tileX < boxWidth; tileX += imgWidth) {
        // Calculate the portion to draw (may be clipped at edges)
        const drawWidth = Math.min(imgWidth, boxWidth - tileX);
        const drawHeight = Math.min(imgHeight, boxHeight - tileY);

        // Transform for PDF coordinates
        const pdfX = x + tileX;
        const pdfY = pageHeight - (y + tileY + drawHeight);

        // pdf-lib doesn't support clipping easily, so we draw full tiles
        // and rely on page boundaries for clipping
        pdfPage.drawImage(embeddedImage, {
          x: pdfX,
          y: pdfY,
          width: drawWidth,
          height: drawHeight
        });
      }
    }
  }

  /**
   * Render a text box to PDF.
   */
  private async renderTextBox(
    pdfPage: PDFPage,
    textBox: TextBoxObject,
    x: number,
    y: number,
    pageHeight: number,
    pageIndex: number,
    totalPages: number
  ): Promise<void> {
    // Draw background
    if (textBox.backgroundColor) {
      const bgColor = parseColor(textBox.backgroundColor);
      drawFilledRect(pdfPage, x, y, textBox.width, textBox.height, bgColor, pageHeight);
    }

    // Draw borders (each side individually)
    const border = textBox.border;
    if (border) {
      // Top border
      if (border.top.style !== 'none' && border.top.width > 0) {
        drawLine(pdfPage, x, y, x + textBox.width, y, parseColor(border.top.color), border.top.width, pageHeight);
      }
      // Right border
      if (border.right.style !== 'none' && border.right.width > 0) {
        drawLine(pdfPage, x + textBox.width, y, x + textBox.width, y + textBox.height, parseColor(border.right.color), border.right.width, pageHeight);
      }
      // Bottom border
      if (border.bottom.style !== 'none' && border.bottom.width > 0) {
        drawLine(pdfPage, x, y + textBox.height, x + textBox.width, y + textBox.height, parseColor(border.bottom.color), border.bottom.width, pageHeight);
      }
      // Left border
      if (border.left.style !== 'none' && border.left.width > 0) {
        drawLine(pdfPage, x, y, x, y + textBox.height, parseColor(border.left.color), border.left.width, pageHeight);
      }
    }

    // Render text content
    const flowingContent = textBox.flowingContent;
    if (flowingContent) {
      // Create a temporary canvas for text measurement
      const tempCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      const ctx = tempCanvas?.getContext('2d');

      if (ctx) {
        const padding = textBox.padding || 4;
        const flowedPages = flowingContent.flowText(
          textBox.width - padding * 2,
          textBox.height - padding * 2,
          ctx
        );

        if (flowedPages.length > 0) {
          const contentBounds = {
            x: x + padding,
            y: y + padding,
            width: textBox.width - padding * 2,
            height: textBox.height - padding * 2
          };
          await this.renderFlowedPage(
            pdfPage,
            flowedPages[0],
            contentBounds,
            pageHeight,
            pageIndex,
            totalPages
          );
        }
      }
    }
  }

  /**
   * Render a table to PDF.
   * Handles multi-page tables by checking rendered slice info.
   */
  private async renderTable(
    pdfPage: PDFPage,
    table: TableObject,
    x: number,
    y: number,
    pageHeight: number,
    pageIndex: number,
    totalPages: number
  ): Promise<void> {
    // Get column positions and widths
    const columnPositions = table.getColumnPositions();
    const columnWidths = table.getColumnWidths();

    // Check if this table has slice info for this page (multi-page tables)
    const sliceInfo = table.getRenderedSlice(pageIndex);

    // Determine which rows to render
    let rowsToRender: { row: typeof table.rows[0]; originalIndex: number }[];

    if (sliceInfo && sliceInfo.slicePosition !== 'only') {
      // Multi-page table - render only the rows for this page's slice
      rowsToRender = this.getTableRowsForSlice(table, {
        slicePosition: sliceInfo.slicePosition,
        sliceIndex: sliceInfo.sliceIndex,
        yOffset: sliceInfo.yOffset,
        headerHeight: sliceInfo.headerHeight
      });
    } else {
      // Single-page table or no slice info - render all rows
      rowsToRender = table.rows.map((row, idx) => ({ row, originalIndex: idx }));
    }

    let rowY = y;

    // Track covered cells (from merged cells) - need to track across all rows
    const coveredCells = new Set<string>();

    // Pre-calculate covered cells from merged cells
    for (const { row, originalIndex: rowIdx } of rowsToRender) {
      for (let colIndex = 0; colIndex < row.cells.length; colIndex++) {
        const cell = row.cells[colIndex];
        if (!cell) continue;

        if (cell.rowSpan > 1 || cell.colSpan > 1) {
          for (let r = rowIdx; r < rowIdx + cell.rowSpan; r++) {
            for (let c = colIndex; c < colIndex + cell.colSpan; c++) {
              if (r !== rowIdx || c !== colIndex) {
                coveredCells.add(`${r},${c}`);
              }
            }
          }
        }
      }
    }

    // Render each row
    for (const { row, originalIndex: rowIdx } of rowsToRender) {
      for (let colIndex = 0; colIndex < row.cells.length; colIndex++) {
        const cell = row.cells[colIndex];
        const cellKey = `${rowIdx},${colIndex}`;

        // Skip cells that are covered by a merged cell
        if (coveredCells.has(cellKey)) continue;
        if (!cell) continue;

        // Calculate cell dimensions (accounting for merged cells)
        let cellWidth = 0;
        for (let c = colIndex; c < colIndex + cell.colSpan; c++) {
          cellWidth += columnWidths[c] || 0;
        }

        // For cell height, only count rows that are in our render set
        let cellHeight = row.calculatedHeight;
        if (cell.rowSpan > 1) {
          cellHeight = 0;
          for (let r = rowIdx; r < rowIdx + cell.rowSpan && r < table.rows.length; r++) {
            // Check if this row is in our render set
            const inRenderSet = rowsToRender.some(item => item.originalIndex === r);
            if (inRenderSet) {
              cellHeight += table.rows[r].calculatedHeight;
            }
          }
        }

        const cellX = x + columnPositions[colIndex];

        // Draw cell background
        if (cell.backgroundColor) {
          const bgColor = parseColor(cell.backgroundColor);
          drawFilledRect(pdfPage, cellX, rowY, cellWidth, cellHeight, bgColor, pageHeight);
        }

        // Draw cell borders
        this.renderCellBorders(pdfPage, cell, cellX, rowY, cellWidth, cellHeight, pageHeight);

        // Render cell text content
        const flowingContent = cell.flowingContent;
        if (flowingContent) {
          const tempCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
          const ctx = tempCanvas?.getContext('2d');

          if (ctx) {
            const padding = cell.padding;
            const paddingH = padding.left + padding.right;
            const paddingV = padding.top + padding.bottom;
            const flowedPages = flowingContent.flowText(
              cellWidth - paddingH,
              cellHeight - paddingV,
              ctx
            );

            if (flowedPages.length > 0) {
              const contentBounds = {
                x: cellX + padding.left,
                y: rowY + padding.top,
                width: cellWidth - paddingH,
                height: cellHeight - paddingV
              };
              await this.renderFlowedPage(
                pdfPage,
                flowedPages[0],
                contentBounds,
                pageHeight,
                pageIndex,
                totalPages
              );
            }
          }
        }
      }

      rowY += row.calculatedHeight;
    }
  }

  /**
   * Get the rows to render for a specific table slice.
   * Handles header row repetition on continuation pages.
   *
   * Uses sliceIndex to look at all rendered pages and determine
   * which data rows belong to this slice.
   */
  private getTableRowsForSlice(
    table: TableObject,
    sliceInfo: {
      slicePosition: 'only' | 'first' | 'middle' | 'last';
      sliceIndex: number;
      yOffset: number;
      headerHeight: number;
    }
  ): { row: typeof table.rows[0]; originalIndex: number }[] {
    const result: { row: typeof table.rows[0]; originalIndex: number }[] = [];
    const isContinuation = sliceInfo.slicePosition !== 'first' && sliceInfo.slicePosition !== 'only';

    // On continuation pages, add header rows first
    if (isContinuation) {
      for (let i = 0; i < table.rows.length; i++) {
        if (table.rows[i].isHeader) {
          result.push({ row: table.rows[i], originalIndex: i });
        }
      }
    }

    // Calculate header height
    let headerHeight = 0;
    for (const row of table.rows) {
      if (row.isHeader) {
        headerHeight += row.calculatedHeight;
      }
    }

    // Find the yOffset range for this slice
    // yOffset tells us the cumulative Y position of data rows where this slice starts
    const sliceStartY = sliceInfo.yOffset;

    // Find the end Y by looking at the next slice's yOffset, or use table height
    let sliceEndY = table.height - headerHeight; // Default to end of table data rows

    // Get all rendered page indices to find next slice
    const pageIndices = table.getRenderedPageIndices().sort((a, b) => a - b);
    const currentPageArrayIndex = pageIndices.findIndex(
      pageIdx => table.getRenderedSlice(pageIdx)?.sliceIndex === sliceInfo.sliceIndex
    );

    if (currentPageArrayIndex >= 0 && currentPageArrayIndex < pageIndices.length - 1) {
      // There's a next slice - use its yOffset as our end
      const nextPageIdx = pageIndices[currentPageArrayIndex + 1];
      const nextSlice = table.getRenderedSlice(nextPageIdx);
      if (nextSlice) {
        sliceEndY = nextSlice.yOffset;
      }
    }

    // Find data rows that fall within [sliceStartY, sliceEndY)
    let currentY = 0;
    for (let i = 0; i < table.rows.length; i++) {
      const row = table.rows[i];

      // Skip header rows - they're handled separately
      if (row.isHeader) continue;

      const rowStartY = currentY;
      const rowEndY = currentY + row.calculatedHeight;

      // Check if this row overlaps with the slice range
      if (rowStartY < sliceEndY && rowEndY > sliceStartY) {
        result.push({ row, originalIndex: i });
      }

      currentY = rowEndY;
    }

    return result;
  }

  /**
   * Render cell borders.
   */
  private renderCellBorders(
    pdfPage: PDFPage,
    cell: { border: { top: { width: number; color: string; style: string }; right: { width: number; color: string; style: string }; bottom: { width: number; color: string; style: string }; left: { width: number; color: string; style: string } } },
    x: number,
    y: number,
    width: number,
    height: number,
    pageHeight: number
  ): void {
    const border = cell.border;

    // Top border
    if (border.top.style !== 'none' && border.top.width > 0) {
      drawLine(pdfPage, x, y, x + width, y, parseColor(border.top.color), border.top.width, pageHeight);
    }

    // Right border
    if (border.right.style !== 'none' && border.right.width > 0) {
      drawLine(pdfPage, x + width, y, x + width, y + height, parseColor(border.right.color), border.right.width, pageHeight);
    }

    // Bottom border
    if (border.bottom.style !== 'none' && border.bottom.width > 0) {
      drawLine(pdfPage, x, y + height, x + width, y + height, parseColor(border.bottom.color), border.bottom.width, pageHeight);
    }

    // Left border
    if (border.left.style !== 'none' && border.left.width > 0) {
      drawLine(pdfPage, x, y, x, y + height, parseColor(border.left.color), border.left.width, pageHeight);
    }
  }
}
