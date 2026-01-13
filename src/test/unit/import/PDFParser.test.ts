import { describe, it, expect } from 'vitest';
import { PDFImportError, PDFImportErrorCode } from '../../../lib/import/types';

describe('PDFImportError', () => {
  it('should create error with message and code', () => {
    const error = new PDFImportError('Test error', PDFImportErrorCode.INVALID_PDF);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe(PDFImportErrorCode.INVALID_PDF);
    expect(error.name).toBe('PDFImportError');
  });

  it('should include details when provided', () => {
    const details = { reason: 'corrupted file' };
    const error = new PDFImportError(
      'Test error',
      PDFImportErrorCode.PARSING_ERROR,
      details
    );

    expect(error.details).toEqual(details);
  });

  it('should support all error codes', () => {
    const codes = [
      PDFImportErrorCode.INVALID_PDF,
      PDFImportErrorCode.ENCRYPTED_PDF,
      PDFImportErrorCode.PASSWORD_REQUIRED,
      PDFImportErrorCode.INCORRECT_PASSWORD,
      PDFImportErrorCode.EXTRACTION_FAILED,
      PDFImportErrorCode.IMAGE_EXTRACTION_FAILED,
      PDFImportErrorCode.PARSING_ERROR,
      PDFImportErrorCode.UNSUPPORTED_FEATURE
    ];

    for (const code of codes) {
      const error = new PDFImportError('Test', code);
      expect(error.code).toBe(code);
    }
  });
});

// Note: Testing PDFParser.parse() requires actual PDF files and pdfjs-dist
// which requires a DOM environment. These tests focus on the error types
// and would be supplemented with integration tests using actual PDFs.
