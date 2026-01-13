import { BaseEmbeddedObject, ObjectPosition } from '../objects';

/**
 * Interface for controls that can receive keyboard focus.
 * Only one Focusable can be active at a time in the editor.
 */
export interface Focusable {
  /**
   * Called when this control receives focus.
   * Should start cursor blinking and prepare for keyboard input.
   */
  focus(): void;

  /**
   * Called when this control loses focus.
   * Should stop cursor blinking and hide cursor.
   */
  blur(): void;

  /**
   * Returns whether this control currently has focus.
   */
  hasFocus(): boolean;

  /**
   * Handle a keyboard event.
   * @returns true if the event was handled, false otherwise
   */
  handleKeyDown(e: KeyboardEvent): boolean;

  /**
   * Subscribe to cursor blink events (for re-rendering).
   */
  onCursorBlink(handler: () => void): void;

  /**
   * Unsubscribe from cursor blink events.
   */
  offCursorBlink(handler: () => void): void;
}

/**
 * Alignment options for paragraphs.
 */
export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

/**
 * Bullet point styles for unordered lists.
 */
export type BulletStyle = 'disc' | 'circle' | 'square' | 'dash' | 'none';

/**
 * Numbering styles for ordered lists.
 */
export type NumberStyle = 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';

/**
 * Type of list (bullet, numbered, or none).
 */
export type ListType = 'bullet' | 'number' | 'none';

/**
 * List formatting properties for a paragraph.
 */
export interface ListFormatting {
  listType: ListType;
  bulletStyle?: BulletStyle;      // For bullet lists
  numberStyle?: NumberStyle;      // For numbered lists
  nestingLevel: number;           // 0 = top level, 1+ = nested
  startNumber?: number;           // For numbered lists, starting number
}

/**
 * Default list formatting values.
 */
export const DEFAULT_LIST_FORMATTING: ListFormatting = {
  listType: 'bullet',
  bulletStyle: 'disc',
  nestingLevel: 0
};

/**
 * Indent per nesting level in pixels.
 */
export const LIST_INDENT_PER_LEVEL = 24;

/**
 * Paragraph formatting properties.
 * Applied at paragraph level (delimited by \n characters).
 */
export interface ParagraphFormatting {
  alignment: TextAlignment;
  listFormatting?: ListFormatting;  // Optional - undefined means not a list
}

/**
 * Text formatting style applied to characters.
 */
export interface TextFormattingStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  fontStyle?: string;
  color: string;
  backgroundColor?: string;
}

/**
 * A run of text with consistent formatting.
 */
export interface TextRun {
  text: string;
  formatting: TextFormattingStyle;
  startIndex: number;
  endIndex: number;
}

/**
 * Type of substitution field.
 * - 'data': Regular field replaced by merge data
 * - 'pageNumber': Replaced by current page number during rendering
 * - 'pageCount': Replaced by total page count during rendering
 */
export type SubstitutionFieldType = 'data' | 'pageNumber' | 'pageCount';

/**
 * Type of value expected for formatting purposes.
 */
export type FieldValueType = 'string' | 'number' | 'currency' | 'date' | 'markdown';

/**
 * Predefined format patterns for numbers.
 */
export type NumberFormatPreset =
  | 'integer'           // 1234
  | 'decimal'           // 1234.56
  | 'decimal-1'         // 1234.5
  | 'decimal-3'         // 1234.567
  | 'thousands'         // 1,234
  | 'percent'           // 12.34%
  | 'scientific';       // 1.23e+3

/**
 * Predefined format patterns for currency.
 */
export type CurrencyFormatPreset =
  | 'USD'               // $1,234.56
  | 'EUR'               // €1.234,56
  | 'GBP'               // £1,234.56
  | 'JPY'               // ¥1,234
  | 'custom';           // Custom via currencySymbol

/**
 * Predefined format patterns for dates.
 */
export type DateFormatPreset =
  | 'short'             // 1/15/24
  | 'medium'            // Jan 15, 2024
  | 'long'              // January 15, 2024
  | 'full'              // Monday, January 15, 2024
  | 'iso'               // 2024-01-15
  | 'time-short'        // 3:30 PM
  | 'time-long'         // 3:30:45 PM
  | 'datetime-short'    // 1/15/24, 3:30 PM
  | 'datetime-long';    // January 15, 2024 at 3:30 PM

/**
 * Configuration for field value formatting.
 */
export interface FieldFormatConfig {
  /** Type of value for formatting purposes */
  valueType?: FieldValueType;

  // Number formatting options
  /** Preset or custom format pattern for numbers */
  numberFormat?: NumberFormatPreset | string;
  /** Number of decimal places */
  decimalPlaces?: number;
  /** Use thousands separator grouping */
  useGrouping?: boolean;

  // Currency formatting options
  /** Currency format preset */
  currencyFormat?: CurrencyFormatPreset;
  /** Custom currency symbol (when currencyFormat is 'custom') */
  currencySymbol?: string;
  /** Position of currency symbol */
  currencyPosition?: 'before' | 'after';

  // Date formatting options
  /** Date format preset or custom pattern */
  dateFormat?: DateFormatPreset | string;

  // Locale settings
  /** Locale for formatting (e.g., 'en-US', 'de-DE') */
  locale?: string;
}

/**
 * Configuration for a substitution field.
 */
export interface SubstitutionFieldConfig {
  displayFormat?: string;
  defaultValue?: string;
  fieldType?: SubstitutionFieldType;
  formatting?: TextFormattingStyle;
  /** Format configuration for value transformation */
  formatConfig?: FieldFormatConfig;
}

/**
 * A substitution field - text placeholder for data merge or page numbers.
 * Regular fields rendered as {{fieldName}} and replaced during merge.
 * Page number fields rendered as the current page number.
 */
export interface SubstitutionField {
  id: string;
  textIndex: number;
  fieldName: string;
  fieldType?: SubstitutionFieldType;  // undefined or 'data' = regular field
  displayFormat?: string;
  defaultValue?: string;
  formatting?: TextFormattingStyle;
  /** Format configuration for value transformation during merge */
  formatConfig?: FieldFormatConfig;
}

/**
 * Reference to an embedded object within a flowed line.
 */
export interface FlowedEmbeddedObject {
  object: BaseEmbeddedObject;
  textIndex: number;
  x: number;
  isBlock?: boolean;      // True for block-positioned objects (standalone paragraph)
  isAnchor?: boolean;     // True for relative objects (anchor marker only, object rendered separately)
}

/**
 * Reference to a substitution field within a flowed line.
 */
export interface FlowedSubstitutionField {
  field: SubstitutionField;
  textIndex: number;
  x: number;
  width: number;
}

/**
 * List marker information for a line.
 */
export interface ListMarker {
  text: string;           // The marker to render (bullet char or "1.", "a.", etc.)
  width: number;          // Width of marker area
  indent: number;         // Total left indent for this line
  isFirstLineOfListItem: boolean;  // Only first line shows marker
}

/**
 * A single line of flowed text with its measurements and content.
 */
export interface FlowedLine {
  text: string;
  width: number;
  height: number;
  baseline: number;
  runs: TextRun[];
  substitutionFields: FlowedSubstitutionField[];
  embeddedObjects: FlowedEmbeddedObject[];
  startIndex: number;
  endIndex: number;
  endsWithNewline?: boolean;
  endsWithPageBreak?: boolean;  // Line ends with page break character
  alignment: TextAlignment;
  extraWordSpacing?: number;  // For justify mode - extra space per word gap
  isBlockObjectLine?: boolean;  // True if line contains only a block-positioned object
  allowPageBreakBefore?: boolean;  // True if page can break before this line (e.g., block objects)
  listMarker?: ListMarker;  // List formatting info for this line
}

/**
 * A page of flowed text content.
 */
export interface FlowedPage {
  lines: FlowedLine[];
  height: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Default text formatting values.
 */
export const DEFAULT_FORMATTING: TextFormattingStyle = {
  fontFamily: 'Arial',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#000000'
};

/**
 * Default paragraph formatting values.
 */
export const DEFAULT_PARAGRAPH_FORMATTING: ParagraphFormatting = {
  alignment: 'left'
};

/**
 * The Unicode Object Replacement Character used for embedded content.
 * Both substitution fields and embedded objects use this character.
 */
export const OBJECT_REPLACEMENT_CHAR = '\uFFFC';

/**
 * The Form Feed character used for page breaks.
 * Inserted via Ctrl+Enter and forces content to start on a new page.
 */
export const PAGE_BREAK_CHAR = '\u000C';

/**
 * Visual state of a repeating section, computed during render.
 */
export interface RepeatingSectionVisualState {
  startPageIndex: number;
  startY: number;
  endPageIndex: number;
  endY: number;
  spansMultiplePages: boolean;
}

/**
 * A repeating section that loops over array data during merge.
 * Starts and ends at paragraph boundaries.
 */
export interface RepeatingSection {
  id: string;
  fieldPath: string;           // e.g., "items" - the array to loop over
  startIndex: number;          // Text index at paragraph start
  endIndex: number;            // Text index at closing paragraph start
  visualState?: RepeatingSectionVisualState;  // Computed during render
}

// Re-export ObjectPosition for convenience
export type { ObjectPosition };
