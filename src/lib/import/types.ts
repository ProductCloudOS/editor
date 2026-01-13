/**
 * Types for PDF import functionality.
 */

import { TextFormattingStyle } from '../text/types';

// ============================================
// PDF Extraction Types (raw data from PDF.js)
// ============================================

/**
 * Raw extracted content from a PDF document.
 */
export interface PDFExtractedContent {
  pageCount: number;
  pages: PDFExtractedPage[];
  metadata?: PDFMetadata;
}

/**
 * PDF document metadata.
 */
export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

/**
 * Extracted content from a single PDF page.
 */
export interface PDFExtractedPage {
  pageNumber: number;
  width: number;
  height: number;
  textItems: PDFTextItem[];
  images: PDFImage[];
}

/**
 * A text item extracted from PDF.
 */
export interface PDFTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: PDFColor;
  transform?: number[];
}

/**
 * RGB color from PDF.
 */
export interface PDFColor {
  r: number;
  g: number;
  b: number;
}

/**
 * An image extracted from PDF.
 */
export interface PDFImage {
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  mimeType: 'image/png' | 'image/jpeg';
}

// ============================================
// Content Analysis Types
// ============================================

/**
 * Analyzed content with detected structure.
 */
export interface AnalyzedContent {
  paragraphs: AnalyzedParagraph[];
  images: AnalyzedImage[];
  tables: AnalyzedTable[];
  pageInfo: PageInfo;
}

/**
 * Page layout information.
 */
export interface PageInfo {
  width: number;
  height: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * A detected paragraph with formatting.
 */
export interface AnalyzedParagraph {
  text: string;
  formattingRuns: FormattingRun[];
  alignment: 'left' | 'center' | 'right' | 'justify';
  pageNumber: number;
  y: number;
  endsWithNewline: boolean;
}

/**
 * A formatting run within a paragraph.
 */
export interface FormattingRun {
  startIndex: number;
  endIndex: number;
  formatting: Partial<TextFormattingStyle>;
}

/**
 * An analyzed image with position.
 */
export interface AnalyzedImage {
  dataUrl: string;
  width: number;
  height: number;
  pageNumber: number;
  y: number;
  position: 'inline' | 'block';
}

/**
 * A detected table structure.
 */
export interface AnalyzedTable {
  rows: AnalyzedTableRow[];
  columnWidths: number[];
  pageNumber: number;
  y: number;
  confidence: number;
}

/**
 * A row in an analyzed table.
 */
export interface AnalyzedTableRow {
  cells: AnalyzedTableCell[];
}

/**
 * A cell in an analyzed table.
 */
export interface AnalyzedTableCell {
  text: string;
  formattingRuns: FormattingRun[];
}

// ============================================
// Import Options and Errors
// ============================================

/**
 * Options for PDF import.
 */
export interface PDFImportOptions {
  /** Whether to attempt table detection (default: true) */
  detectTables?: boolean;
  /** Whether to extract images (default: true) */
  extractImages?: boolean;
  /** Minimum confidence for table detection (0-1, default: 0.7) */
  tableConfidenceThreshold?: number;
  /** Password for encrypted PDFs */
  password?: string;
}

/**
 * Default import options.
 */
export const DEFAULT_IMPORT_OPTIONS: Required<PDFImportOptions> = {
  detectTables: true,
  extractImages: true,
  tableConfidenceThreshold: 0.7,
  password: ''
};

/**
 * Error codes for PDF import failures.
 */
export enum PDFImportErrorCode {
  INVALID_PDF = 'INVALID_PDF',
  ENCRYPTED_PDF = 'ENCRYPTED_PDF',
  PASSWORD_REQUIRED = 'PASSWORD_REQUIRED',
  INCORRECT_PASSWORD = 'INCORRECT_PASSWORD',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  IMAGE_EXTRACTION_FAILED = 'IMAGE_EXTRACTION_FAILED',
  PARSING_ERROR = 'PARSING_ERROR',
  UNSUPPORTED_FEATURE = 'UNSUPPORTED_FEATURE'
}

/**
 * Error class for PDF import failures.
 */
export class PDFImportError extends Error {
  constructor(
    message: string,
    public readonly code: PDFImportErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'PDFImportError';
  }
}
