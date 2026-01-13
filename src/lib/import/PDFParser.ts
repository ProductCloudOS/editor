/**
 * PDFParser - Extracts raw content from PDF files using pdfjs-dist.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import {
  PDFExtractedContent,
  PDFExtractedPage,
  PDFTextItem,
  PDFImage,
  PDFMetadata,
  PDFImportError,
  PDFImportErrorCode
} from './types';

// Configure PDF.js worker
// In a real application, this would be configured based on the build environment
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Parser for extracting content from PDF files.
 */
export class PDFParser {
  /**
   * Parse a PDF document and extract its content.
   */
  async parse(source: ArrayBuffer, password?: string): Promise<PDFExtractedContent> {
    let pdfDocument: PDFDocumentProxy;

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: source,
        password: password || undefined
      });

      pdfDocument = await loadingTask.promise;
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'PasswordException') {
        if (err.message?.includes('need a password')) {
          throw new PDFImportError(
            'This PDF is encrypted and requires a password',
            PDFImportErrorCode.PASSWORD_REQUIRED
          );
        } else {
          throw new PDFImportError(
            'Incorrect password for encrypted PDF',
            PDFImportErrorCode.INCORRECT_PASSWORD
          );
        }
      }
      throw new PDFImportError(
        'Failed to load PDF document',
        PDFImportErrorCode.INVALID_PDF,
        error
      );
    }

    try {
      const pages: PDFExtractedPage[] = [];

      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const extractedPage = await this.extractPage(page, i);
        pages.push(extractedPage);
      }

      const metadata = await this.extractMetadata(pdfDocument);

      return {
        pageCount: pdfDocument.numPages,
        pages,
        metadata
      };
    } catch (error) {
      throw new PDFImportError(
        'Failed to extract content from PDF',
        PDFImportErrorCode.EXTRACTION_FAILED,
        error
      );
    } finally {
      await pdfDocument.destroy();
    }
  }

  /**
   * Extract content from a single PDF page.
   */
  private async extractPage(page: PDFPageProxy, pageNumber: number): Promise<PDFExtractedPage> {
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const textItems: PDFTextItem[] = [];

    for (const item of textContent.items) {
      // Filter to TextItem (not TextMarkedContent)
      if ('str' in item && item.str) {
        const textItem = this.convertTextItem(item, viewport.height);
        if (textItem.text.trim()) {
          textItems.push(textItem);
        }
      }
    }

    // Extract images
    const images = await this.extractImages(page, viewport.height);

    return {
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      textItems,
      images
    };
  }

  /**
   * Convert a PDF.js TextItem to our PDFTextItem format.
   */
  private convertTextItem(item: TextItem, pageHeight: number): PDFTextItem {
    // PDF coordinates are bottom-left origin, convert to top-left
    const transform = item.transform;
    const [a, b, , , tx, ty] = transform;

    // Extract font size from transform matrix
    const fontSize = Math.sqrt(a * a + b * b);

    // Parse font name to extract weight and style
    const fontInfo = this.parseFontName(item.fontName);

    return {
      text: item.str,
      x: tx,
      y: pageHeight - ty, // Flip Y coordinate
      width: item.width,
      height: item.height,
      fontName: item.fontName,
      fontSize: Math.round(fontSize * 10) / 10, // Round to 1 decimal
      fontWeight: fontInfo.fontWeight,
      fontStyle: fontInfo.fontStyle,
      transform
    };
  }

  /**
   * Parse font name to extract weight and style information.
   */
  private parseFontName(fontName: string): {
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
  } {
    const lower = fontName.toLowerCase();
    return {
      fontWeight: /bold|black|heavy|semibold|demibold/i.test(lower) ? 'bold' : 'normal',
      fontStyle: /italic|oblique/i.test(lower) ? 'italic' : 'normal'
    };
  }

  /**
   * Extract images from a PDF page.
   */
  private async extractImages(page: PDFPageProxy, pageHeight: number): Promise<PDFImage[]> {
    const images: PDFImage[] = [];

    try {
      const operatorList = await page.getOperatorList();
      const commonObjs = page.commonObjs;
      const objs = page.objs;

      // Track current transform for image positioning
      const transformStack: number[][] = [[1, 0, 0, 1, 0, 0]];

      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i];
        const args = operatorList.argsArray[i];

        // Handle transform operations
        if (fn === pdfjsLib.OPS.save) {
          transformStack.push([...transformStack[transformStack.length - 1]]);
        } else if (fn === pdfjsLib.OPS.restore) {
          if (transformStack.length > 1) {
            transformStack.pop();
          }
        } else if (fn === pdfjsLib.OPS.transform) {
          const currentTransform = transformStack[transformStack.length - 1];
          const newTransform = this.multiplyTransforms(currentTransform, args as number[]);
          transformStack[transformStack.length - 1] = newTransform;
        } else if (fn === pdfjsLib.OPS.paintImageXObject) {
          const imageName = args[0] as string;

          try {
            // Get image object
            let imgData: { width: number; height: number; data?: Uint8ClampedArray } | null = null;

            if (objs.has(imageName)) {
              imgData = objs.get(imageName) as { width: number; height: number; data?: Uint8ClampedArray };
            } else if (commonObjs.has(imageName)) {
              imgData = commonObjs.get(imageName) as { width: number; height: number; data?: Uint8ClampedArray };
            }

            if (imgData && imgData.width && imgData.height) {
              const currentTransform = transformStack[transformStack.length - 1];

              // Calculate image position and size from transform
              const width = Math.abs(currentTransform[0]) || imgData.width;
              const height = Math.abs(currentTransform[3]) || imgData.height;
              const x = currentTransform[4];
              const y = pageHeight - currentTransform[5] - height;

              // Convert image data to data URL if available
              if (imgData.data) {
                const dataUrl = this.imageDataToDataUrl(imgData.data, imgData.width, imgData.height);
                if (dataUrl) {
                  images.push({
                    x,
                    y,
                    width,
                    height,
                    dataUrl,
                    mimeType: 'image/png'
                  });
                }
              }
            }
          } catch {
            // Skip images that fail to extract
            console.warn(`Failed to extract image: ${imageName}`);
          }
        }
      }
    } catch (error) {
      console.warn('Image extraction failed:', error);
    }

    return images;
  }

  /**
   * Multiply two transform matrices.
   */
  private multiplyTransforms(t1: number[], t2: number[]): number[] {
    return [
      t1[0] * t2[0] + t1[2] * t2[1],
      t1[1] * t2[0] + t1[3] * t2[1],
      t1[0] * t2[2] + t1[2] * t2[3],
      t1[1] * t2[2] + t1[3] * t2[3],
      t1[0] * t2[4] + t1[2] * t2[5] + t1[4],
      t1[1] * t2[4] + t1[3] * t2[5] + t1[5]
    ];
  }

  /**
   * Convert raw image data to a data URL.
   */
  private imageDataToDataUrl(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): string | null {
    try {
      // Create a canvas to draw the image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Create ImageData and draw it
      // Copy the data to ensure it's a proper ArrayBuffer (not SharedArrayBuffer)
      const dataArray = new Uint8ClampedArray(data.length);
      dataArray.set(data);
      const imageData = new ImageData(dataArray, width, height);
      ctx.putImageData(imageData, 0, 0);

      // Convert to data URL
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  /**
   * Extract metadata from the PDF document.
   */
  private async extractMetadata(pdfDocument: PDFDocumentProxy): Promise<PDFMetadata | undefined> {
    try {
      const metadata = await pdfDocument.getMetadata();
      const info = metadata.info as Record<string, unknown>;

      if (!info) return undefined;

      return {
        title: info.Title as string | undefined,
        author: info.Author as string | undefined,
        subject: info.Subject as string | undefined,
        keywords: info.Keywords as string | undefined,
        creationDate: info.CreationDate ? this.parseDate(info.CreationDate as string) : undefined,
        modificationDate: info.ModDate ? this.parseDate(info.ModDate as string) : undefined
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Parse a PDF date string (D:YYYYMMDDHHmmSS format).
   */
  private parseDate(pdfDate: string): Date | undefined {
    try {
      // PDF date format: D:YYYYMMDDHHmmSS+HH'mm' or similar
      const match = pdfDate.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
      if (!match) return undefined;

      const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
    } catch {
      return undefined;
    }
  }
}
