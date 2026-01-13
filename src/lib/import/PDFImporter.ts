/**
 * PDFImporter - Main orchestrator for PDF import functionality.
 *
 * Coordinates PDFParser, ContentAnalyzer, and DocumentBuilder to convert
 * PDF files into PC Editor DocumentData format.
 */

import { DocumentData } from '../types';
import { PDFParser } from './PDFParser';
import { ContentAnalyzer } from './ContentAnalyzer';
import { DocumentBuilder } from './DocumentBuilder';
import {
  PDFImportOptions,
  DEFAULT_IMPORT_OPTIONS,
  PDFImportError,
  PDFImportErrorCode
} from './types';

/**
 * Progress callback for PDF import.
 */
export interface PDFImportProgress {
  stage: 'parsing' | 'analyzing' | 'building';
  progress: number; // 0-100
  message: string;
}

/**
 * Result of PDF import operation.
 */
export interface PDFImportResult {
  document: DocumentData;
  warnings: string[];
  metadata?: {
    title?: string;
    author?: string;
    pageCount: number;
  };
}

/**
 * Main class for importing PDF documents into PC Editor format.
 */
export class PDFImporter {
  private parser: PDFParser;
  private analyzer: ContentAnalyzer;
  private builder: DocumentBuilder;

  constructor() {
    this.parser = new PDFParser();
    this.analyzer = new ContentAnalyzer();
    this.builder = new DocumentBuilder();
  }

  /**
   * Import a PDF document from an ArrayBuffer.
   *
   * @param source - The PDF file as an ArrayBuffer
   * @param options - Import options
   * @param onProgress - Optional progress callback
   * @returns The imported document data
   */
  async import(
    source: ArrayBuffer,
    options: PDFImportOptions = {},
    onProgress?: (progress: PDFImportProgress) => void
  ): Promise<PDFImportResult> {
    const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options };
    const warnings: string[] = [];

    try {
      // Stage 1: Parse PDF
      onProgress?.({
        stage: 'parsing',
        progress: 0,
        message: 'Loading PDF document...'
      });

      const extractedContent = await this.parser.parse(source, opts.password);

      onProgress?.({
        stage: 'parsing',
        progress: 100,
        message: 'PDF parsed successfully'
      });

      // Stage 2: Analyze content
      onProgress?.({
        stage: 'analyzing',
        progress: 0,
        message: 'Analyzing document structure...'
      });

      const analyzedContent = this.analyzer.analyze(extractedContent, {
        detectTables: opts.detectTables,
        extractImages: opts.extractImages,
        tableConfidenceThreshold: opts.tableConfidenceThreshold
      });

      // Collect warnings from analysis
      if (analyzedContent.tables.length > 0) {
        const lowConfidenceTables = analyzedContent.tables.filter(
          t => t.confidence < 0.8
        );
        if (lowConfidenceTables.length > 0) {
          warnings.push(
            `${lowConfidenceTables.length} table(s) detected with low confidence - please verify structure`
          );
        }
      }

      onProgress?.({
        stage: 'analyzing',
        progress: 100,
        message: 'Content analysis complete'
      });

      // Stage 3: Build document
      onProgress?.({
        stage: 'building',
        progress: 0,
        message: 'Building document...'
      });

      const document = this.builder.build(analyzedContent, extractedContent.pageCount);

      onProgress?.({
        stage: 'building',
        progress: 100,
        message: 'Document built successfully'
      });

      return {
        document,
        warnings,
        metadata: {
          title: extractedContent.metadata?.title,
          author: extractedContent.metadata?.author,
          pageCount: extractedContent.pageCount
        }
      };
    } catch (error) {
      if (error instanceof PDFImportError) {
        throw error;
      }
      throw new PDFImportError(
        'Failed to import PDF document',
        PDFImportErrorCode.PARSING_ERROR,
        error
      );
    }
  }

  /**
   * Import a PDF document from a File object.
   *
   * @param file - The PDF file
   * @param options - Import options
   * @param onProgress - Optional progress callback
   * @returns The imported document data
   */
  async importFile(
    file: File,
    options: PDFImportOptions = {},
    onProgress?: (progress: PDFImportProgress) => void
  ): Promise<PDFImportResult> {
    // Validate file type
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new PDFImportError(
        'Invalid file type. Please select a PDF file.',
        PDFImportErrorCode.INVALID_PDF
      );
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    return this.import(arrayBuffer, options, onProgress);
  }

  /**
   * Import a PDF document from a URL.
   *
   * @param url - The URL to fetch the PDF from
   * @param options - Import options
   * @param onProgress - Optional progress callback
   * @returns The imported document data
   */
  async importUrl(
    url: string,
    options: PDFImportOptions = {},
    onProgress?: (progress: PDFImportProgress) => void
  ): Promise<PDFImportResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new PDFImportError(
          `Failed to fetch PDF: ${response.statusText}`,
          PDFImportErrorCode.INVALID_PDF
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return this.import(arrayBuffer, options, onProgress);
    } catch (error) {
      if (error instanceof PDFImportError) {
        throw error;
      }
      throw new PDFImportError(
        'Failed to fetch PDF from URL',
        PDFImportErrorCode.INVALID_PDF,
        error
      );
    }
  }
}
