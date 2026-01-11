/**
 * Clipboard types for PC Editor copy/paste functionality.
 */

import type {
  TextFormattingRunData,
  ParagraphFormattingData,
  SubstitutionFieldData,
  EmbeddedObjectReference,
  HyperlinkSerializedData
} from '../types';

export const CLIPBOARD_FORMAT_VERSION = '1.0.0';
export const PCEDITOR_MIME_TYPE = 'application/x-pceditor-content';

/**
 * Type of content in the clipboard.
 */
export type ClipboardContentType = 'text' | 'object' | 'mixed';

/**
 * The proprietary clipboard format for PC Editor.
 * Contains all information needed to preserve full fidelity on paste.
 */
export interface PCEditorClipboardData {
  version: string;
  type: ClipboardContentType;
  content: ClipboardContent;
  metadata?: ClipboardMetadata;
}

/**
 * The actual content being copied.
 */
export interface ClipboardContent {
  /** The plain text content (with U+FFFC for embedded objects) */
  text: string;
  /** Text formatting runs, with indices relative to the copied text (0-based) */
  formattingRuns?: TextFormattingRunData[];
  /** Paragraph formatting, with indices relative to the copied text (0-based) */
  paragraphFormatting?: ParagraphFormattingData[];
  /** Substitution fields, with indices relative to the copied text (0-based) */
  substitutionFields?: SubstitutionFieldData[];
  /** Embedded objects, with indices relative to the copied text (0-based) */
  embeddedObjects?: EmbeddedObjectReference[];
  /** Hyperlinks, with indices relative to the copied text (0-based) */
  hyperlinks?: HyperlinkSerializedData[];
}

/**
 * Metadata about the copy operation.
 */
export interface ClipboardMetadata {
  /** Which section the content was copied from */
  sourceSection?: 'header' | 'body' | 'footer';
  /** If copied from a text box or table cell, the object ID */
  sourceObjectId?: string;
  /** Timestamp of when the content was copied */
  copiedAt?: string;
}

/**
 * Result of reading from the clipboard.
 */
export interface ClipboardReadResult {
  /** The format that was successfully read */
  type: 'pceditor' | 'html' | 'text' | 'image' | 'empty';
  /** The data read from clipboard */
  data: PCEditorClipboardData | string | Blob | null;
}

/**
 * Options for the copy operation.
 */
export interface CopyOptions {
  /** Include plain text fallback (default: true) */
  includePlainText?: boolean;
  /** Include HTML fallback (default: true) */
  includeHtml?: boolean;
}

/**
 * Options for the paste operation.
 */
export interface PasteOptions {
  /** Preferred format to paste (default: auto-detect best available) */
  preferredFormat?: 'pceditor' | 'html' | 'text';
  /** If true, paste as plain text only, stripping all formatting */
  asPlainText?: boolean;
}
