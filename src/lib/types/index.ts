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
 * Complete serialized FlowingTextContent.
 */
export interface FlowingTextContentData {
  text: string;
  formattingRuns?: TextFormattingRunData[];
  paragraphFormatting?: ParagraphFormattingData[];
  substitutionFields?: SubstitutionFieldData[];
  repeatingSections?: RepeatingSectionData[];
  embeddedObjects?: EmbeddedObjectReference[];
  hyperlinks?: HyperlinkSerializedData[];
}

export interface DocumentData {
  version: string;
  pages: PageData[];
  settings?: DocumentSettings;
  bodyContent?: FlowingTextContentData;
  headerContent?: FlowingTextContentData;
  footerContent?: FlowingTextContentData;
  metadata?: {
    createdAt?: string;
    modifiedAt?: string;
    title?: string;
    author?: string;
  };
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
  /** If true, apply merge data before generating PDF */
  applyMergeData?: boolean;
  /** Data to use for merge (requires applyMergeData: true) */
  mergeData?: Record<string, unknown>;
}

// ============================================
// Serialization Types
// ============================================

/**
 * Serialized text formatting run.
 * Represents formatting applied at a specific character index.
 */
export interface TextFormattingRunData {
  index: number;
  formatting: {
    fontFamily: string;
    fontSize: number;
    fontWeight?: string;
    fontStyle?: string;
    color: string;
    backgroundColor?: string;
  };
}

/**
 * Serialized paragraph formatting.
 */
export interface ParagraphFormattingData {
  paragraphStart: number;
  formatting: {
    alignment: 'left' | 'center' | 'right' | 'justify';
  };
}

/**
 * Serialized field format configuration.
 */
export interface FieldFormatConfigData {
  valueType?: 'string' | 'number' | 'currency' | 'date' | 'markdown';
  numberFormat?: string;
  decimalPlaces?: number;
  useGrouping?: boolean;
  currencyFormat?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'custom';
  currencySymbol?: string;
  currencyPosition?: 'before' | 'after';
  dateFormat?: string;
  locale?: string;
}

/**
 * Serialized substitution field.
 */
export interface SubstitutionFieldData {
  id: string;
  textIndex: number;
  fieldName: string;
  fieldType?: 'data' | 'pageNumber' | 'pageCount';
  displayFormat?: string;
  defaultValue?: string;
  formatting?: TextFormattingRunData['formatting'];
  formatConfig?: FieldFormatConfigData;
}

/**
 * Serialized repeating section.
 */
export interface RepeatingSectionData {
  id: string;
  fieldPath: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Serialized embedded object reference in FlowingTextContent.
 */
export interface EmbeddedObjectReference {
  textIndex: number;
  object: import('../objects').EmbeddedObjectData;
}

/**
 * Serialized hyperlink.
 */
export interface HyperlinkSerializedData {
  id: string;
  url: string;
  startIndex: number;
  endIndex: number;
  title?: string;
  formatting?: {
    color?: string;
    underline?: boolean;
  };
}