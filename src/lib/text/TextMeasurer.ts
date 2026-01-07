import {
  TextFormattingStyle,
  SubstitutionField,
  OBJECT_REPLACEMENT_CHAR,
  DEFAULT_FORMATTING
} from './types';
import { BaseEmbeddedObject } from '../objects';

/**
 * Result of measuring embedded content at a position.
 */
export interface EmbeddedMeasurement {
  width: number;
  height: number;
  type: 'field' | 'object' | 'none';
  field?: SubstitutionField;
  object?: BaseEmbeddedObject;
}

/**
 * Encapsulates all text measurement operations.
 * Single source of truth for font string generation and text metrics.
 */
export class TextMeasurer {
  private ctx: CanvasRenderingContext2D;
  private fontCache: Map<string, string> = new Map();

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Convert formatting to a CSS font string.
   * This is the canonical implementation - all other code should use this.
   */
  toFontString(formatting: TextFormattingStyle): string {
    const cacheKey = `${formatting.fontStyle}-${formatting.fontWeight}-${formatting.fontSize}-${formatting.fontFamily}`;

    let fontString = this.fontCache.get(cacheKey);
    if (!fontString) {
      fontString = `${formatting.fontStyle || ''} ${formatting.fontWeight || ''} ${formatting.fontSize}px ${formatting.fontFamily}`.trim();
      this.fontCache.set(cacheKey, fontString);
    }

    return fontString;
  }

  /**
   * Measure the width of text with given formatting.
   */
  measureText(text: string, formatting: TextFormattingStyle): number {
    this.ctx.font = this.toFontString(formatting);
    return this.ctx.measureText(text).width;
  }

  /**
   * Measure a single character width.
   * Handles special characters like tabs.
   */
  measureCharacter(char: string, formatting: TextFormattingStyle): number {
    // Tab characters should have a fixed width (4 spaces)
    if (char === '\t') {
      return this.measureText('    ', formatting);
    }
    return this.measureText(char, formatting);
  }

  /**
   * Calculate the line height for given formatting.
   */
  getLineHeight(formatting: TextFormattingStyle): number {
    return formatting.fontSize * 1.2;
  }

  /**
   * Calculate the baseline offset for given formatting.
   */
  getBaseline(formatting: TextFormattingStyle): number {
    return formatting.fontSize * 0.8;
  }

  /**
   * Find the character index at a given x position within text.
   * Returns the index of the character at or just before the x position.
   */
  getCharacterIndexAtX(
    text: string,
    x: number,
    formatting: TextFormattingStyle,
    startIndex: number = 0
  ): number {
    if (x <= 0) return startIndex;

    this.ctx.font = this.toFontString(formatting);
    let currentX = 0;

    for (let i = 0; i < text.length; i++) {
      const charWidth = this.ctx.measureText(text[i]).width;
      const charMidpoint = currentX + charWidth / 2;

      // If x is before the midpoint of this character, cursor goes before it
      if (x < charMidpoint) {
        return startIndex + i;
      }

      currentX += charWidth;
    }

    // x is past the end of the text
    return startIndex + text.length;
  }

  /**
   * Get the x position for a character index within text.
   */
  getXPositionForIndex(
    text: string,
    index: number,
    formatting: TextFormattingStyle,
    startIndex: number = 0
  ): number {
    const relativeIndex = index - startIndex;
    if (relativeIndex <= 0) return 0;
    if (relativeIndex >= text.length) {
      return this.measureText(text, formatting);
    }

    return this.measureText(text.substring(0, relativeIndex), formatting);
  }

  /**
   * Update the canvas context (e.g., when switching pages).
   */
  setContext(ctx: CanvasRenderingContext2D): void {
    this.ctx = ctx;
  }

  // ============================================
  // New methods for substitution fields and embedded objects
  // ============================================

  /**
   * Get the display text for a substitution field.
   */
  getFieldDisplayText(field: SubstitutionField): string {
    return `{{field: ${field.fieldName}}}`;
  }

  /**
   * Measure a substitution field's display text.
   */
  measureSubstitutionField(
    field: SubstitutionField,
    defaultFormatting?: TextFormattingStyle
  ): { width: number; height: number } {
    const displayText = this.getFieldDisplayText(field);
    const formatting = field.formatting || defaultFormatting || DEFAULT_FORMATTING;

    return {
      width: this.measureText(displayText, formatting),
      height: this.getLineHeight(formatting)
    };
  }

  /**
   * Measure an embedded object.
   */
  measureEmbeddedObject(object: BaseEmbeddedObject): { width: number; height: number } {
    return {
      width: object.width,
      height: object.height
    };
  }

  /**
   * Measure embedded content at a specific position.
   * Checks both substitution fields and embedded objects.
   */
  measureEmbeddedAt(
    textIndex: number,
    fields: Map<number, SubstitutionField>,
    objects: Map<number, BaseEmbeddedObject>,
    defaultFormatting?: TextFormattingStyle
  ): EmbeddedMeasurement {
    // Check for substitution field
    const field = fields.get(textIndex);
    if (field) {
      const measurement = this.measureSubstitutionField(field, defaultFormatting);
      return {
        ...measurement,
        type: 'field',
        field
      };
    }

    // Check for embedded object
    const object = objects.get(textIndex);
    if (object) {
      const measurement = this.measureEmbeddedObject(object);
      return {
        ...measurement,
        type: 'object',
        object
      };
    }

    return { width: 0, height: 0, type: 'none' };
  }

  /**
   * Measure a word, accounting for both substitution fields and embedded objects.
   * Returns the total width including all embedded content widths, plus x offsets
   * for each field and object within the word.
   */
  measureWordWithEmbedded(
    word: string,
    formatting: TextFormattingStyle,
    fields: Map<number, SubstitutionField>,
    objects: Map<number, BaseEmbeddedObject>,
    wordStartIndex: number
  ): {
    width: number;
    height: number;
    fields: Array<{ field: SubstitutionField; textIndex: number; width: number; xOffset: number }>;
    objects: Array<{ object: BaseEmbeddedObject; textIndex: number; xOffset: number }>;
  } {
    let width = 0;
    let height = this.getLineHeight(formatting);
    const fieldRefs: Array<{ field: SubstitutionField; textIndex: number; width: number; xOffset: number }> = [];
    const objectRefs: Array<{ object: BaseEmbeddedObject; textIndex: number; xOffset: number }> = [];

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const charIndex = wordStartIndex + i;

      if (char === OBJECT_REPLACEMENT_CHAR) {
        // Check what type of embedded content this is
        const measurement = this.measureEmbeddedAt(charIndex, fields, objects, formatting);

        if (measurement.type === 'field' && measurement.field) {
          fieldRefs.push({
            field: measurement.field,
            textIndex: charIndex,
            width: measurement.width,
            xOffset: width  // Current x position within the word
          });
          width += measurement.width;
          height = Math.max(height, measurement.height);
        } else if (measurement.type === 'object' && measurement.object) {
          objectRefs.push({
            object: measurement.object,
            textIndex: charIndex,
            xOffset: width  // Current x position within the word
          });
          width += measurement.width;
          if (measurement.object.position === 'inline') {
            height = Math.max(height, measurement.height);
          }
        }
        // Skip orphaned replacement characters
      } else {
        // Regular character
        width += this.measureCharacter(char, formatting);
      }
    }

    return { width, height, fields: fieldRefs, objects: objectRefs };
  }
}
