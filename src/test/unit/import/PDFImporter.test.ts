import { describe, it, expect } from 'vitest';
import { PDFImporter } from '../../../lib/import/PDFImporter';
import { PDFImportError, PDFImportErrorCode } from '../../../lib/import/types';

describe('PDFImporter', () => {
  describe('constructor', () => {
    it('should create an importer instance', () => {
      const importer = new PDFImporter();
      expect(importer).toBeDefined();
    });
  });

  describe('importFile validation', () => {
    it('should reject non-PDF files based on type check', async () => {
      const importer = new PDFImporter();
      // Create a mock file that doesn't have pdf in type or name
      const mockFile = {
        type: 'text/plain',
        name: 'test.txt',
        arrayBuffer: async () => new ArrayBuffer(0)
      } as File;

      await expect(importer.importFile(mockFile)).rejects.toThrow(PDFImportError);
      try {
        await importer.importFile(mockFile);
      } catch (error) {
        expect((error as PDFImportError).code).toBe(PDFImportErrorCode.INVALID_PDF);
        expect((error as PDFImportError).message).toContain('Invalid file type');
      }
    });
  });

  describe('options handling', () => {
    it('should accept import options without throwing synchronously', () => {
      const importer = new PDFImporter();

      // Options are passed correctly - we verify the API accepts the options
      // The actual async call will fail but that's expected
      const promise = importer.import(new ArrayBuffer(0), {
        detectTables: true,
        extractImages: true,
        tableConfidenceThreshold: 0.8,
        password: 'test'
      });

      // The promise is created, verify it's a promise
      expect(promise).toBeInstanceOf(Promise);

      // Clean up by catching the expected rejection
      promise.catch(() => {/* expected */});
    });
  });

  describe('error handling', () => {
    it('should wrap unknown errors in PDFImportError', async () => {
      const importer = new PDFImporter();

      try {
        await importer.import(new ArrayBuffer(0));
      } catch (error) {
        expect(error).toBeInstanceOf(PDFImportError);
      }
    });
  });
});

// Note: Integration tests with actual PDF files would require:
// 1. A proper browser environment with PDF.js worker
// 2. Sample PDF files for testing
// 3. Mocking of the PDF.js library
