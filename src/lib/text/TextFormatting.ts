import { EventEmitter } from '../events/EventEmitter';
import { TextFormattingStyle, DEFAULT_FORMATTING } from './types';

/**
 * Manages per-character text formatting.
 * Stores formatting overrides for specific character positions.
 */
export class TextFormattingManager extends EventEmitter {
  private formatting: Map<number, TextFormattingStyle> = new Map();
  private _defaultFormatting: TextFormattingStyle;
  private _pendingFormatting: Partial<TextFormattingStyle> | null = null;

  constructor(defaultFormatting?: Partial<TextFormattingStyle>) {
    super();
    this._defaultFormatting = { ...DEFAULT_FORMATTING, ...defaultFormatting };
  }

  /**
   * Get the default formatting applied to unformatted text.
   */
  get defaultFormatting(): TextFormattingStyle {
    return { ...this._defaultFormatting };
  }

  /**
   * Update the default formatting.
   */
  setDefaultFormatting(formatting: Partial<TextFormattingStyle>): void {
    this._defaultFormatting = { ...this._defaultFormatting, ...formatting };
    this.emit('default-formatting-changed', { formatting: this._defaultFormatting });
  }

  /**
   * Get formatting at a specific character position.
   * Returns the position-specific formatting or the default.
   */
  getFormattingAt(position: number): TextFormattingStyle {
    const override = this.formatting.get(position);
    if (override) {
      return { ...override };
    }
    return { ...this._defaultFormatting };
  }

  /**
   * Apply formatting to a range of characters.
   */
  applyFormatting(start: number, end: number, formatting: Partial<TextFormattingStyle>): void {
    for (let i = start; i < end; i++) {
      const current = this.formatting.get(i) || { ...this._defaultFormatting };
      this.formatting.set(i, { ...current, ...formatting });
    }
    this.emit('formatting-changed', { start, end, formatting });
  }

  /**
   * Remove formatting from a range, reverting to default.
   */
  clearFormatting(start: number, end: number): void {
    for (let i = start; i < end; i++) {
      this.formatting.delete(i);
    }
    this.emit('formatting-cleared', { start, end });
  }

  /**
   * Shift formatting positions when text is inserted or deleted.
   * @param fromIndex The position where the change occurred
   * @param delta Positive for insertion, negative for deletion
   */
  shiftFormatting(fromIndex: number, delta: number): void {
    if (delta === 0) return;

    const toShift = new Map<number, TextFormattingStyle>();

    // Collect entries that need to be shifted
    for (const [index, style] of this.formatting.entries()) {
      if (index >= fromIndex) {
        this.formatting.delete(index);
        const newIndex = index + delta;
        // Only keep if new index is valid (not shifted to negative)
        if (newIndex >= 0) {
          toShift.set(newIndex, style);
        }
      }
    }

    // Apply shifted entries
    for (const [newIndex, style] of toShift.entries()) {
      this.formatting.set(newIndex, style);
    }
  }

  /**
   * Remove formatting for deleted text range and shift remaining.
   * @param start Start of deleted range
   * @param length Length of deleted text
   */
  handleDeletion(start: number, length: number): void {
    // Remove formatting in the deleted range
    for (let i = start; i < start + length; i++) {
      this.formatting.delete(i);
    }

    // Shift remaining formatting
    this.shiftFormatting(start + length, -length);
  }

  /**
   * Get all formatting entries (for serialization).
   */
  getAllFormatting(): Map<number, TextFormattingStyle> {
    return new Map(this.formatting);
  }

  /**
   * Restore formatting from a map (for deserialization).
   */
  setAllFormatting(formatting: Map<number, TextFormattingStyle>): void {
    this.formatting = new Map(formatting);
    this.emit('formatting-restored');
  }

  /**
   * Clear all formatting.
   */
  clear(): void {
    this.formatting.clear();
    this._pendingFormatting = null;
    this.emit('formatting-cleared', { start: 0, end: Infinity });
  }

  // ============================================
  // Pending Formatting (for cursor-only state)
  // ============================================

  /**
   * Set pending formatting to apply to the next inserted character.
   * Used when formatting is applied with just a cursor (no selection).
   */
  setPendingFormatting(formatting: Partial<TextFormattingStyle>): void {
    // Merge with existing pending formatting
    this._pendingFormatting = {
      ...this._pendingFormatting,
      ...formatting
    };
    this.emit('pending-formatting-changed', { formatting: this._pendingFormatting });
  }

  /**
   * Get the current pending formatting, if any.
   */
  getPendingFormatting(): Partial<TextFormattingStyle> | null {
    return this._pendingFormatting ? { ...this._pendingFormatting } : null;
  }

  /**
   * Check if there is pending formatting.
   */
  hasPendingFormatting(): boolean {
    return this._pendingFormatting !== null;
  }

  /**
   * Clear pending formatting.
   */
  clearPendingFormatting(): void {
    if (this._pendingFormatting !== null) {
      this._pendingFormatting = null;
      this.emit('pending-formatting-cleared');
    }
  }

  /**
   * Apply pending formatting to a range.
   * Called when text is inserted. Does NOT clear pending formatting
   * so it can be applied to subsequent typed characters.
   */
  applyPendingFormatting(start: number, length: number): void {
    if (this._pendingFormatting && length > 0) {
      this.applyFormatting(start, start + length, this._pendingFormatting);
      // Note: We don't clear pending formatting here so it applies to
      // subsequent characters. It's cleared on explicit cursor navigation.
    }
  }
}
