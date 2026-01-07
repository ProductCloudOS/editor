import { PDFDocument, rgb } from 'pdf-lib';
import { Document } from '../core/Document';
import { PDFExportOptions } from '../types';
import { createBlobFromUint8Array } from '../utils/blob-utils';

export class PDFGenerator {
  async generate(document: Document, _options?: PDFExportOptions): Promise<Blob> {
    const pdfDoc = await PDFDocument.create();

    for (const page of document.pages) {
      const dimensions = page.getPageDimensions();
      const pdfPage = pdfDoc.addPage([dimensions.width, dimensions.height]);
      
      pdfPage.drawRectangle({
        x: 0,
        y: 0,
        width: dimensions.width,
        height: dimensions.height,
        color: rgb(1, 1, 1)
      });
    }

    const pdfBytes = await pdfDoc.save();
    return createBlobFromUint8Array(pdfBytes, 'application/pdf');
  }
}