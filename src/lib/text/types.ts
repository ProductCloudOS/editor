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
 * Paragraph formatting properties.
 * Applied at paragraph level (delimited by \n characters).
 */
export interface ParagraphFormatting {
  alignment: TextAlignment;
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
 * Configuration for a substitution field.
 */
export interface SubstitutionFieldConfig {
  displayFormat?: string;
  defaultValue?: string;
}

/**
 * A substitution field - text placeholder for data merge.
 * Rendered as {{field: name}} and behaves atomically.
 */
export interface SubstitutionField {
  id: string;
  textIndex: number;
  fieldName: string;
  displayFormat?: string;
  defaultValue?: string;
  formatting?: TextFormattingStyle;
}

/**
 * Reference to an embedded object within a flowed line.
 */
export interface FlowedEmbeddedObject {
  object: BaseEmbeddedObject;
  textIndex: number;
  x: number;
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
  alignment: TextAlignment;
  extraWordSpacing?: number;  // For justify mode - extra space per word gap
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
