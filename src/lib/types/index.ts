export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type PageSize = 'A4' | 'Letter' | 'Legal' | 'A3' | 'Custom';
export type PageOrientation = 'portrait' | 'landscape';
export type Units = 'px' | 'mm' | 'in' | 'pt';

/**
 * Represents which section of the document is being edited.
 */
export type EditingSection = 'header' | 'body' | 'footer';

export interface PageDimensions {
  width: number;
  height: number;
  units: Units;
}

export interface EditorOptions {
  pageSize?: PageSize;
  pageOrientation?: PageOrientation;
  customPageSize?: PageDimensions | undefined;
  units?: Units;
  gridSize?: number;
  showGrid?: boolean;
  showRulers?: boolean;
  showControlCharacters?: boolean;
  defaultFont?: string;
  defaultFontSize?: number;
  theme?: 'light' | 'dark';
}

/**
 * Serialized flowing text content for header/footer.
 */
export interface FlowingTextContentData {
  text: string;
  // Formatting, fields, and embedded objects are serialized by FlowingTextContent
}

export interface DocumentData {
  version: string;
  pages: PageData[];
  settings?: DocumentSettings;
  headerContent?: FlowingTextContentData;
  footerContent?: FlowingTextContentData;
}

export interface DocumentSettings {
  pageSize: PageSize;
  pageOrientation: PageOrientation;
  customPageSize?: PageDimensions;
  margins: Margin;
  units: Units;
}

export interface PageData {
  id: string;
}

export interface EditorEvent {
  type: string;
  data?: any;
}

/**
 * Unified selection type representing cursor position, text selection, or no selection.
 * Text-based selections (cursor, text) include which section is being edited.
 */
export type EditorSelection =
  | { type: 'cursor'; position: number; section: EditingSection }
  | { type: 'text'; start: number; end: number; section: EditingSection }
  | { type: 'repeating-section'; sectionId: string }
  | { type: 'none' };

export interface SelectionEvent extends EditorEvent {
  type: 'selection-change';
  data: {
    selection: EditorSelection;
  };
}

export interface DocumentChangeEvent extends EditorEvent {
  type: 'document-change';
  data: {
    document: DocumentData;
  };
}

export interface DataBindingContext {
  [key: string]: any;
}

export interface PDFExportOptions {
  quality?: number;
  compress?: boolean;
  embedFonts?: boolean;
}