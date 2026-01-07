import { FlowedLine, FlowedSubstitutionField, FlowedEmbeddedObject, TextFormattingStyle } from './types';

/**
 * Result of finding a line at a Y position.
 */
export interface LineAtYResult {
  line: FlowedLine;
  lineIndex: number;
  lineY: number;  // Y position of the line's top
}

/**
 * Utility class for text position calculations.
 * Consolidates duplicated logic from FlowingTextRenderer and TextBoxObject.
 * All methods are static - no instance state required.
 */
export class TextPositionCalculator {
  /**
   * Build a CSS font string from formatting properties.
   */
  static getFontString(formatting: TextFormattingStyle): string {
    return `${formatting.fontStyle || ''} ${formatting.fontWeight || ''} ${formatting.fontSize}px ${formatting.fontFamily}`.trim();
  }

  /**
   * Calculate the alignment offset for a line.
   * @param line The flowed line
   * @param maxWidth The available width for the line
   * @returns The X offset to apply before rendering the line
   */
  static getAlignmentOffset(line: FlowedLine, maxWidth: number): number {
    switch (line.alignment) {
      case 'center':
        return (maxWidth - line.width) / 2;
      case 'right':
        return maxWidth - line.width;
      case 'left':
      case 'justify':
      default:
        return 0;
    }
  }

  /**
   * Find which line is at a given Y position.
   * @param flowedLines Array of flowed lines
   * @param y Y position relative to the top of the first line
   * @returns The line info or null if y is outside the lines
   */
  static findLineAtY(flowedLines: FlowedLine[], y: number): LineAtYResult | null {
    if (flowedLines.length === 0) return null;

    let lineY = 0;
    for (let i = 0; i < flowedLines.length; i++) {
      const line = flowedLines[i];
      if (y >= lineY && y < lineY + line.height) {
        return { line, lineIndex: i, lineY };
      }
      lineY += line.height;
    }

    // If y is past all lines, return the last line
    if (y >= lineY && flowedLines.length > 0) {
      const lastIndex = flowedLines.length - 1;
      const lastLine = flowedLines[lastIndex];
      return {
        line: lastLine,
        lineIndex: lastIndex,
        lineY: lineY - lastLine.height
      };
    }

    return null;
  }

  /**
   * Get the X position for a text index within a line.
   * Does NOT include alignment offset - caller should add that separately.
   *
   * @param line The flowed line
   * @param textIndex The text index to find the X position for
   * @param ctx Canvas context for text measurement (must have font set per-run)
   * @returns The X position relative to the line start (before alignment)
   */
  static getXPositionForTextIndex(
    line: FlowedLine,
    textIndex: number,
    ctx: CanvasRenderingContext2D
  ): number {
    if (textIndex <= line.startIndex) return 0;

    // For justify mode, return the full justified width at end of line
    if (textIndex >= line.endIndex) {
      if (line.alignment === 'justify' && line.extraWordSpacing) {
        // Calculate total justified width
        return line.width + (this.countWordGapsUpTo(line, line.endIndex) * line.extraWordSpacing);
      }
      return line.width;
    }

    // Build maps for quick lookup of substitution fields and embedded objects
    const substitutionFieldMap = this.buildSubstitutionFieldMap(line);
    const embeddedObjectMap = this.buildEmbeddedObjectMap(line);

    let x = 0;

    // Measure character by character to handle embedded content correctly
    for (const run of line.runs) {
      ctx.font = this.getFontString(run.formatting);

      for (let i = 0; i < run.text.length; i++) {
        const charIndex = run.startIndex + i;

        // If we've reached the target index, return current x
        if (charIndex >= textIndex) {
          return x;
        }

        const char = run.text[i];
        const charWidth = this.getCharWidth(char, charIndex, ctx, substitutionFieldMap, embeddedObjectMap);

        x += charWidth;

        // Add extra word spacing for justify mode after whitespace
        if (line.alignment === 'justify' && line.extraWordSpacing && /\s/.test(char)) {
          x += line.extraWordSpacing;
        }
      }
    }

    return x;
  }

  /**
   * Get the text index at an X position within a line.
   * The x parameter should NOT include alignment offset - caller should subtract that first.
   *
   * @param line The flowed line
   * @param x X position relative to line start (after removing alignment offset)
   * @param ctx Canvas context for text measurement
   * @returns The text index at that position
   */
  static getTextIndexAtX(
    line: FlowedLine,
    x: number,
    ctx: CanvasRenderingContext2D
  ): number {
    if (x <= 0) return line.startIndex;

    // Build maps for quick lookup of substitution fields and embedded objects
    const substitutionFieldMap = this.buildSubstitutionFieldMap(line);
    const embeddedObjectMap = this.buildEmbeddedObjectMap(line);

    let currentX = 0;
    const extraWordSpacing = line.extraWordSpacing || 0;

    for (const run of line.runs) {
      ctx.font = this.getFontString(run.formatting);

      // Process character by character to handle embedded content correctly
      for (let i = 0; i < run.text.length; i++) {
        const charIndex = run.startIndex + i;
        const char = run.text[i];

        // Check for substitution field - clicking anywhere on field positions cursor after it
        const field = substitutionFieldMap.get(charIndex);
        if (field) {
          const charWidth = field.width;
          if (x >= currentX && x < currentX + charWidth) {
            return charIndex + 1; // Position cursor after the field
          }
          currentX += charWidth;
          // Add justify spacing after whitespace
          if (extraWordSpacing > 0 && /\s/.test(char)) {
            currentX += extraWordSpacing;
          }
          continue;
        }

        const charWidth = this.getCharWidth(char, charIndex, ctx, substitutionFieldMap, embeddedObjectMap);

        // Check if click is within this character's bounds
        if (x >= currentX && x < currentX + charWidth) {
          // Click is on this character - return position before or after based on midpoint
          if (x < currentX + charWidth / 2) {
            return charIndex;
          } else {
            return charIndex + 1;
          }
        }

        currentX += charWidth;

        // Add justify spacing after whitespace characters
        if (extraWordSpacing > 0 && /\s/.test(char)) {
          currentX += extraWordSpacing;
        }
      }
    }

    return line.endIndex;
  }

  /**
   * Get the width of a character, handling special cases like substitution fields,
   * embedded objects, tabs, and orphaned replacement characters.
   */
  private static getCharWidth(
    char: string,
    charIndex: number,
    ctx: CanvasRenderingContext2D,
    substitutionFieldMap: Map<number, FlowedSubstitutionField>,
    embeddedObjectMap: Map<number, FlowedEmbeddedObject>
  ): number {
    // Check for substitution field
    const field = substitutionFieldMap.get(charIndex);
    if (field) {
      return field.width;
    }

    // Check for embedded object
    const embeddedObj = embeddedObjectMap.get(charIndex);
    if (embeddedObj) {
      return embeddedObj.object.width + 2; // Match the spacing from renderEmbeddedObject
    }

    // Regular character (skip orphaned replacement chars)
    if (char !== '\uFFFC') {
      // Tab characters need special handling (4 spaces width)
      return char === '\t'
        ? ctx.measureText('    ').width
        : ctx.measureText(char).width;
    }

    // Orphaned replacement char - treat as zero width
    return 0;
  }

  /**
   * Build a map of substitution fields by text index for quick lookup.
   */
  private static buildSubstitutionFieldMap(line: FlowedLine): Map<number, FlowedSubstitutionField> {
    const map = new Map<number, FlowedSubstitutionField>();
    if (line.substitutionFields) {
      line.substitutionFields.forEach(f => map.set(f.textIndex, f));
    }
    return map;
  }

  /**
   * Build a map of embedded objects by text index for quick lookup.
   */
  private static buildEmbeddedObjectMap(line: FlowedLine): Map<number, FlowedEmbeddedObject> {
    const map = new Map<number, FlowedEmbeddedObject>();
    if (line.embeddedObjects) {
      line.embeddedObjects.forEach(o => map.set(o.textIndex, o));
    }
    return map;
  }

  /**
   * Count word gaps up to a certain text index for justify spacing calculation.
   */
  private static countWordGapsUpTo(line: FlowedLine, textIndex: number): number {
    let gaps = 0;
    let inWord = false;

    for (let i = line.startIndex; i < Math.min(textIndex, line.endIndex); i++) {
      const charOffset = i - line.startIndex;
      if (charOffset >= line.text.length) break;

      const char = line.text[charOffset];
      const isWhitespace = /\s/.test(char);

      if (!isWhitespace && !inWord) {
        inWord = true;
      } else if (isWhitespace && inWord) {
        gaps++;
        inWord = false;
      }
    }

    return gaps;
  }
}
