import { EventEmitter } from '../events/EventEmitter';
import { ParagraphFormatting, TextAlignment, DEFAULT_PARAGRAPH_FORMATTING } from './types';

/**
 * Manages per-paragraph formatting (alignment, etc.).
 *
 * Paragraphs are identified by their start index (0 or position after \n).
 * Each paragraph stores its formatting; unset paragraphs use default.
 */
export class ParagraphFormattingManager extends EventEmitter {
  // Map from paragraph start index to formatting
  private formatting: Map<number, ParagraphFormatting> = new Map();
  private _defaultFormatting: ParagraphFormatting;

  constructor(defaultFormatting?: Partial<ParagraphFormatting>) {
    super();
    this._defaultFormatting = { ...DEFAULT_PARAGRAPH_FORMATTING, ...defaultFormatting };
  }

  /**
   * Get the default formatting applied to unformatted paragraphs.
   */
  get defaultFormatting(): ParagraphFormatting {
    return { ...this._defaultFormatting };
  }

  /**
   * Update the default formatting.
   */
  setDefaultFormatting(formatting: Partial<ParagraphFormatting>): void {
    this._defaultFormatting = { ...this._defaultFormatting, ...formatting };
    this.emit('default-formatting-changed', { formatting: this._defaultFormatting });
  }

  /**
   * Get the paragraph start index for a given text position.
   * Searches backward for the nearest \n or returns 0.
   */
  getParagraphStart(textIndex: number, content: string): number {
    if (textIndex <= 0) return 0;
    // Clamp to content length
    const searchFrom = Math.min(textIndex - 1, content.length - 1);
    for (let i = searchFrom; i >= 0; i--) {
      if (content[i] === '\n') {
        return i + 1;
      }
    }
    return 0;
  }

  /**
   * Get formatting for a paragraph containing the given text index.
   */
  getFormattingAt(textIndex: number, content: string): ParagraphFormatting {
    const paragraphStart = this.getParagraphStart(textIndex, content);
    return this.getFormattingForParagraph(paragraphStart);
  }

  /**
   * Get formatting for a paragraph by its start index.
   */
  getFormattingForParagraph(paragraphStartIndex: number): ParagraphFormatting {
    const override = this.formatting.get(paragraphStartIndex);
    return override ? { ...override } : { ...this._defaultFormatting };
  }

  /**
   * Set alignment for a paragraph.
   */
  setAlignment(paragraphStartIndex: number, alignment: TextAlignment): void {
    const current = this.formatting.get(paragraphStartIndex) || { ...this._defaultFormatting };
    this.formatting.set(paragraphStartIndex, { ...current, alignment });
    this.emit('paragraph-formatting-changed', { paragraphStart: paragraphStartIndex, alignment });
  }

  /**
   * Apply formatting to a range of paragraphs (by text range).
   * Finds all paragraph starts within the range and applies formatting.
   */
  applyToRange(start: number, end: number, content: string, formatting: Partial<ParagraphFormatting>): void {
    // Get all paragraph boundaries in range
    const boundaries = this.getParagraphBoundariesInRange(start, end, content);
    for (const boundary of boundaries) {
      const current = this.formatting.get(boundary) || { ...this._defaultFormatting };
      this.formatting.set(boundary, { ...current, ...formatting });
    }
    this.emit('paragraph-formatting-changed', { start, end, formatting });
  }

  /**
   * Get paragraph boundaries within a text range.
   */
  private getParagraphBoundariesInRange(start: number, end: number, content: string): number[] {
    const boundaries: number[] = [];

    // Include the paragraph containing 'start'
    const firstParagraphStart = this.getParagraphStart(start, content);
    boundaries.push(firstParagraphStart);

    // Find all paragraph starts between start and end
    for (let i = start; i < end && i < content.length; i++) {
      if (content[i] === '\n' && i + 1 <= end) {
        boundaries.push(i + 1);
      }
    }

    return [...new Set(boundaries)]; // Remove duplicates
  }

  /**
   * Shift paragraph indices when text is inserted.
   * @param fromIndex The position where text was inserted
   * @param delta The number of characters inserted (positive)
   * @param content The content AFTER insertion (used to check for new paragraphs)
   */
  shiftParagraphs(fromIndex: number, delta: number, content: string): void {
    if (delta === 0) return;

    const toShift = new Map<number, ParagraphFormatting>();

    // Collect entries that need to be shifted
    for (const [index, format] of this.formatting.entries()) {
      if (index > fromIndex) {
        this.formatting.delete(index);
        const newIndex = index + delta;
        if (newIndex >= 0) {
          toShift.set(newIndex, format);
        }
      }
    }

    // Apply shifted entries
    for (const [newIndex, format] of toShift.entries()) {
      this.formatting.set(newIndex, format);
    }

    // If new paragraphs were created (newlines inserted), they inherit formatting
    // from the original paragraph they were part of
    const insertedText = content.slice(fromIndex, fromIndex + delta);
    if (insertedText.includes('\n')) {
      const originalParagraphStart = this.getParagraphStart(fromIndex, content);
      const originalFormatting = this.formatting.get(originalParagraphStart);

      if (originalFormatting) {
        // Find new paragraph starts in inserted text
        for (let i = 0; i < insertedText.length; i++) {
          if (insertedText[i] === '\n') {
            const newParagraphStart = fromIndex + i + 1;
            // Only set if not already set
            if (!this.formatting.has(newParagraphStart)) {
              this.formatting.set(newParagraphStart, { ...originalFormatting });
            }
          }
        }
      }
    }
  }

  /**
   * Handle text deletion - remove affected paragraphs, shift remaining.
   * @param start Start of deleted range
   * @param length Length of deleted text
   */
  handleDeletion(start: number, length: number): void {
    const end = start + length;

    // Remove formatting for paragraphs that start within deleted range
    for (const index of this.formatting.keys()) {
      if (index > start && index < end) {
        this.formatting.delete(index);
      }
    }

    // Shift remaining (indices after the deleted range)
    const toShift = new Map<number, ParagraphFormatting>();
    for (const [index, format] of this.formatting.entries()) {
      if (index >= end) {
        this.formatting.delete(index);
        const newIndex = index - length;
        if (newIndex >= 0) {
          toShift.set(newIndex, format);
        }
      }
    }

    for (const [newIndex, format] of toShift.entries()) {
      this.formatting.set(newIndex, format);
    }
  }

  /**
   * Clear all paragraph formatting.
   */
  clear(): void {
    this.formatting.clear();
    this.emit('paragraph-formatting-cleared');
  }

  /**
   * Serialize for storage.
   */
  toJSON(): Array<{ paragraphStart: number; formatting: ParagraphFormatting }> {
    return Array.from(this.formatting.entries()).map(([start, format]) => ({
      paragraphStart: start,
      formatting: format
    }));
  }

  /**
   * Deserialize from storage.
   */
  fromJSON(data: Array<{ paragraphStart: number; formatting: ParagraphFormatting }>): void {
    this.formatting.clear();
    for (const item of data) {
      this.formatting.set(item.paragraphStart, item.formatting);
    }
    this.emit('paragraph-formatting-loaded');
  }

  /**
   * Get all formatting entries (for debugging/inspection).
   */
  getAllFormatting(): Map<number, ParagraphFormatting> {
    return new Map(this.formatting);
  }
}
