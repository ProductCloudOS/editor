import { EventEmitter } from '../events/EventEmitter';
import {
  ParagraphFormatting,
  TextAlignment,
  DEFAULT_PARAGRAPH_FORMATTING,
  ListFormatting,
  BulletStyle,
  NumberStyle,
  DEFAULT_LIST_FORMATTING
} from './types';

// Bullet style cycle for indentation
const BULLET_STYLE_CYCLE: BulletStyle[] = ['disc', 'circle', 'square'];
// Number style cycle for indentation
const NUMBER_STYLE_CYCLE: NumberStyle[] = ['decimal', 'lower-alpha', 'lower-roman'];
// Maximum nesting level
const MAX_NESTING_LEVEL = 8;

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
   * Set list formatting for a paragraph.
   * Pass undefined to remove list formatting.
   */
  setListFormatting(paragraphStartIndex: number, listFormatting: ListFormatting | undefined): void {
    const current = this.formatting.get(paragraphStartIndex) || { ...this._defaultFormatting };
    if (listFormatting === undefined) {
      // Remove list formatting
      const { listFormatting: _, ...rest } = current;
      this.formatting.set(paragraphStartIndex, rest as ParagraphFormatting);
    } else {
      this.formatting.set(paragraphStartIndex, { ...current, listFormatting });
    }
    this.emit('paragraph-formatting-changed', { paragraphStart: paragraphStartIndex, listFormatting });
  }

  /**
   * Clear list formatting from a paragraph (preserving other formatting).
   */
  clearListFormatting(paragraphStartIndex: number): void {
    this.setListFormatting(paragraphStartIndex, undefined);
  }

  /**
   * Toggle list type for a paragraph.
   * If paragraph already has the same list type, remove list formatting.
   * If paragraph has different list type or no list, apply the new type.
   */
  toggleList(paragraphStartIndex: number, listType: 'bullet' | 'number'): void {
    const current = this.formatting.get(paragraphStartIndex);
    const existingList = current?.listFormatting;

    if (existingList?.listType === listType) {
      // Same type - toggle off
      this.clearListFormatting(paragraphStartIndex);
    } else {
      // Different type or no list - apply new type
      const nestingLevel = existingList?.nestingLevel ?? 0;
      const newListFormatting: ListFormatting = listType === 'bullet'
        ? {
            listType: 'bullet',
            bulletStyle: this.getBulletStyleForLevel(nestingLevel),
            nestingLevel
          }
        : {
            listType: 'number',
            numberStyle: this.getNumberStyleForLevel(nestingLevel),
            nestingLevel
          };
      this.setListFormatting(paragraphStartIndex, newListFormatting);
    }
  }

  /**
   * Increase the nesting level of a list paragraph.
   * If paragraph is not a list, convert it to a bullet list at level 0.
   */
  indentParagraph(paragraphStartIndex: number): void {
    const current = this.formatting.get(paragraphStartIndex);
    const existingList = current?.listFormatting;

    if (!existingList) {
      // Not a list - convert to bullet list at level 0
      this.setListFormatting(paragraphStartIndex, { ...DEFAULT_LIST_FORMATTING });
      return;
    }

    // Already at max level - don't increase
    if (existingList.nestingLevel >= MAX_NESTING_LEVEL) {
      return;
    }

    const newLevel = existingList.nestingLevel + 1;
    const newListFormatting: ListFormatting = existingList.listType === 'bullet'
      ? {
          ...existingList,
          nestingLevel: newLevel,
          bulletStyle: this.getBulletStyleForLevel(newLevel)
        }
      : {
          ...existingList,
          nestingLevel: newLevel,
          numberStyle: this.getNumberStyleForLevel(newLevel)
        };
    this.setListFormatting(paragraphStartIndex, newListFormatting);
  }

  /**
   * Decrease the nesting level of a list paragraph.
   * If at level 0, remove list formatting entirely.
   */
  outdentParagraph(paragraphStartIndex: number): void {
    const current = this.formatting.get(paragraphStartIndex);
    const existingList = current?.listFormatting;

    if (!existingList) {
      // Not a list - nothing to do
      return;
    }

    if (existingList.nestingLevel === 0) {
      // At level 0 - remove list formatting
      this.clearListFormatting(paragraphStartIndex);
      return;
    }

    const newLevel = existingList.nestingLevel - 1;
    const newListFormatting: ListFormatting = existingList.listType === 'bullet'
      ? {
          ...existingList,
          nestingLevel: newLevel,
          bulletStyle: this.getBulletStyleForLevel(newLevel)
        }
      : {
          ...existingList,
          nestingLevel: newLevel,
          numberStyle: this.getNumberStyleForLevel(newLevel)
        };
    this.setListFormatting(paragraphStartIndex, newListFormatting);
  }

  /**
   * Get the bullet style for a given nesting level.
   */
  private getBulletStyleForLevel(level: number): BulletStyle {
    return BULLET_STYLE_CYCLE[level % BULLET_STYLE_CYCLE.length];
  }

  /**
   * Get the number style for a given nesting level.
   */
  private getNumberStyleForLevel(level: number): NumberStyle {
    return NUMBER_STYLE_CYCLE[level % NUMBER_STYLE_CYCLE.length];
  }

  /**
   * Get the list number for a numbered paragraph.
   * Returns undefined for bullet lists or non-list paragraphs.
   * Counts consecutive numbered paragraphs at the same nesting level.
   * Nested items (higher nesting level) don't break the sequence.
   */
  getListNumber(paragraphStartIndex: number, content: string): number | undefined {
    const formatting = this.getFormattingForParagraph(paragraphStartIndex);
    const listFormatting = formatting.listFormatting;

    if (!listFormatting || listFormatting.listType !== 'number') {
      return undefined;
    }

    const targetLevel = listFormatting.nestingLevel;

    // Find all paragraph starts
    const paragraphStarts: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') {
        paragraphStarts.push(i + 1);
      }
    }

    // Find this paragraph's position in the list
    const thisParaIdx = paragraphStarts.indexOf(paragraphStartIndex);
    if (thisParaIdx === -1) {
      return listFormatting.startNumber ?? 1;
    }

    // Count backwards to find the start of this numbered sequence
    let count = 0;
    let startNumber = 1;
    for (let i = thisParaIdx; i >= 0; i--) {
      const paraStart = paragraphStarts[i];
      const paraFormatting = this.getFormattingForParagraph(paraStart);
      const paraList = paraFormatting.listFormatting;

      // Skip nested items (higher nesting level)
      if (paraList && paraList.nestingLevel > targetLevel) {
        continue;
      }

      // Sequence broken if: no list, not a number list, or different nesting level
      if (!paraList || paraList.listType !== 'number' || paraList.nestingLevel !== targetLevel) {
        break;
      }

      count++;
      if (paraList.startNumber !== undefined) {
        startNumber = paraList.startNumber;
        break;
      }
    }

    return startNumber + count - 1;
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
