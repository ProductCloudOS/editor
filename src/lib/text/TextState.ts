import { EventEmitter } from '../events/EventEmitter';
import { OBJECT_REPLACEMENT_CHAR } from './types';

/**
 * Callback to check if a position contains a substitution field.
 */
export type FieldCheckCallback = (textIndex: number) => boolean;

/**
 * Pure state container for text content and cursor position.
 * Handles text manipulation operations and emits change events.
 * Supports cursor skipping over substitution fields.
 */
export class TextState extends EventEmitter {
  private content: string = '';
  private cursorPosition: number = 0;
  private fieldCheckCallback: FieldCheckCallback | null = null;
  private selectionAnchor: number | null = null;

  constructor(initialContent?: string) {
    super();
    if (initialContent) {
      this.content = initialContent;
    }
  }

  /**
   * Set a callback to check if a position contains a substitution field.
   * Used for cursor skipping behavior.
   */
  setFieldCheckCallback(callback: FieldCheckCallback | null): void {
    this.fieldCheckCallback = callback;
  }

  /**
   * Check if a character is the object replacement character.
   */
  private isReplacementChar(position: number): boolean {
    return this.content.charAt(position) === OBJECT_REPLACEMENT_CHAR;
  }

  /**
   * Check if a position contains a substitution field.
   */
  private isFieldAt(position: number): boolean {
    if (!this.fieldCheckCallback) {
      return false;
    }
    return this.isReplacementChar(position) && this.fieldCheckCallback(position);
  }

  /**
   * Get the current text content.
   */
  getText(): string {
    return this.content;
  }

  /**
   * Set the entire text content.
   */
  setText(text: string): void {
    const previousContent = this.content;
    this.content = text;
    this.cursorPosition = Math.min(this.cursorPosition, text.length);

    this.emit('text-changed', {
      text,
      previousContent,
      cursorPosition: this.cursorPosition
    });
  }

  /**
   * Insert text at a specific position or at the cursor.
   * @returns The position after the inserted text
   */
  insertText(text: string, position?: number): number {
    const insertAt = position ?? this.cursorPosition;
    const previousContent = this.content;

    this.content = this.content.slice(0, insertAt) + text + this.content.slice(insertAt);
    this.cursorPosition = insertAt + text.length;

    this.emit('text-inserted', {
      text,
      position: insertAt,
      newCursorPosition: this.cursorPosition,
      previousContent
    });

    return this.cursorPosition;
  }

  /**
   * Delete text from a range.
   * @returns The removed text
   */
  deleteText(start: number, length: number): string {
    const end = start + length;
    const previousContent = this.content;
    const deletedText = this.content.slice(start, end);

    this.content = this.content.slice(0, start) + this.content.slice(end);
    this.cursorPosition = Math.min(this.cursorPosition, start);

    this.emit('text-deleted', {
      start,
      length,
      deletedText,
      newCursorPosition: this.cursorPosition,
      previousContent
    });

    return deletedText;
  }

  /**
   * Perform a backspace operation at the current cursor position.
   * If cursor is immediately after a substitution field, deletes the entire field.
   * @returns True if something was deleted, false otherwise
   */
  backspace(): boolean {
    if (this.cursorPosition === 0) {
      return false;
    }

    const positionBefore = this.cursorPosition - 1;

    // Check if the character before cursor is a substitution field
    if (this.isFieldAt(positionBefore)) {
      // Delete the entire field (the \uFFFC character)
      this.deleteText(positionBefore, 1);
      return true;
    }

    // Normal backspace
    this.deleteText(positionBefore, 1);
    return true;
  }

  /**
   * Perform a delete operation at the current cursor position.
   * If cursor is at a substitution field, deletes the entire field.
   * @returns True if something was deleted, false otherwise
   */
  deleteForward(): boolean {
    if (this.cursorPosition >= this.content.length) {
      return false;
    }

    // Check if the character at cursor is a substitution field
    if (this.isFieldAt(this.cursorPosition)) {
      // Delete the entire field (the \uFFFC character)
      this.deleteText(this.cursorPosition, 1);
      return true;
    }

    // Normal delete
    this.deleteText(this.cursorPosition, 1);
    return true;
  }

  /**
   * Get the current cursor position.
   */
  getCursorPosition(): number {
    return this.cursorPosition;
  }

  /**
   * Set the cursor position directly.
   * Note: This does not skip over substitution fields - use moveCursorLeft/Right
   * for navigation that should skip fields.
   */
  setCursorPosition(position: number): void {
    const previousPosition = this.cursorPosition;
    const newPosition = Math.max(0, Math.min(position, this.content.length));

    this.cursorPosition = newPosition;

    if (this.cursorPosition !== previousPosition) {
      this.emit('cursor-moved', {
        position: this.cursorPosition,
        previousPosition
      });

      // If selection anchor is set, emit selection-changed to update display
      if (this.selectionAnchor !== null) {
        this.emitSelectionChange();
      }
    }
  }

  /**
   * Move cursor by a delta, skipping over substitution fields.
   */
  moveCursor(delta: number): void {
    if (delta === 0) return;

    if (delta < 0) {
      // Moving backwards
      for (let i = 0; i < Math.abs(delta); i++) {
        this.moveCursorLeft();
      }
    } else {
      // Moving forwards
      for (let i = 0; i < delta; i++) {
        this.moveCursorRight();
      }
    }
  }

  /**
   * Move cursor left, skipping over substitution fields.
   * When cursor is after a field, it moves to before the field.
   */
  moveCursorLeft(): void {
    if (this.cursorPosition === 0) return;

    const newPosition = this.cursorPosition - 1;

    // If we're landing on a field (the \uFFFC character), the cursor
    // should be positioned before the field, which is at newPosition.
    // This is correct - cursor at position N means cursor is BEFORE character N.
    // So landing on the field position means we're before the field.

    this.setCursorPosition(newPosition);
  }

  /**
   * Move cursor right, skipping over substitution fields.
   * When cursor is before a field, it moves to after the field.
   */
  moveCursorRight(): void {
    if (this.cursorPosition >= this.content.length) return;

    const newPosition = this.cursorPosition + 1;

    // If the character at current position is a field, skip past it entirely
    // (cursor moves from before the field to after the field)
    if (this.isFieldAt(this.cursorPosition)) {
      // The field is at cursorPosition, so we're already moving to cursorPosition + 1
      // which is after the field. This is correct.
    }

    this.setCursorPosition(newPosition);
  }

  /**
   * Get the length of the content.
   */
  get length(): number {
    return this.content.length;
  }

  /**
   * Check if the content is empty.
   */
  get isEmpty(): boolean {
    return this.content.length === 0;
  }

  /**
   * Get a character at a specific position.
   */
  charAt(position: number): string {
    return this.content.charAt(position);
  }

  /**
   * Get a substring of the content.
   */
  substring(start: number, end?: number): string {
    return this.content.substring(start, end);
  }

  /**
   * Find the index of a substring.
   */
  indexOf(searchString: string, position?: number): number {
    return this.content.indexOf(searchString, position);
  }

  /**
   * Clear all content.
   */
  clear(): void {
    this.setText('');
  }

  // ============================================
  // Selection Operations
  // ============================================

  /**
   * Set the selection anchor point.
   * Call this when starting a selection (e.g., shift key pressed).
   */
  setSelectionAnchor(position?: number): void {
    this.selectionAnchor = position ?? this.cursorPosition;
  }

  /**
   * Get the current selection range.
   * Returns null if no selection is active.
   */
  getSelection(): { start: number; end: number } | null {
    if (this.selectionAnchor === null) {
      return null;
    }
    const start = Math.min(this.selectionAnchor, this.cursorPosition);
    const end = Math.max(this.selectionAnchor, this.cursorPosition);
    if (start === end) {
      return null; // No actual selection if anchor equals cursor
    }
    return { start, end };
  }

  /**
   * Check if there is an active selection.
   */
  hasSelection(): boolean {
    return this.getSelection() !== null;
  }

  /**
   * Check if the selection anchor is set (even if cursor equals anchor).
   */
  hasSelectionAnchor(): boolean {
    return this.selectionAnchor !== null;
  }

  /**
   * Clear the selection anchor.
   */
  clearSelection(): void {
    if (this.selectionAnchor !== null) {
      this.selectionAnchor = null;
      this.emit('selection-changed', { selection: null });
    }
  }

  /**
   * Get the selected text content.
   */
  getSelectedText(): string {
    const selection = this.getSelection();
    if (!selection) {
      return '';
    }
    return this.content.substring(selection.start, selection.end);
  }

  /**
   * Delete the selected text and clear selection.
   * Returns true if text was deleted.
   */
  deleteSelection(): boolean {
    const selection = this.getSelection();
    if (!selection) {
      return false;
    }
    this.deleteText(selection.start, selection.end - selection.start);
    this.selectionAnchor = null;
    return true;
  }

  /**
   * Move cursor left while extending selection.
   */
  selectLeft(): void {
    if (this.selectionAnchor === null) {
      this.selectionAnchor = this.cursorPosition;
    }
    this.moveCursorLeft();
    this.emitSelectionChange();
  }

  /**
   * Move cursor right while extending selection.
   */
  selectRight(): void {
    if (this.selectionAnchor === null) {
      this.selectionAnchor = this.cursorPosition;
    }
    this.moveCursorRight();
    this.emitSelectionChange();
  }

  /**
   * Emit selection change event.
   */
  private emitSelectionChange(): void {
    this.emit('selection-changed', { selection: this.getSelection() });
  }

  // ============================================
  // Word and Paragraph Detection
  // ============================================

  /**
   * Check if character is a word character (alphanumeric or underscore).
   * Includes accented characters common in European languages.
   */
  private isWordChar(char: string): boolean {
    return /[\w\u00C0-\u024F]/.test(char);
  }

  /**
   * Find word boundaries at a text position.
   * Words are sequences of alphanumeric characters, not including spaces/punctuation.
   */
  getWordBoundaries(position: number): { start: number; end: number } {
    if (this.content.length === 0) return { start: 0, end: 0 };

    // Clamp position to valid range
    const pos = Math.max(0, Math.min(position, this.content.length));

    // Handle position at or past end
    if (pos >= this.content.length) {
      let start = pos;
      while (start > 0 && this.isWordChar(this.content.charAt(start - 1))) {
        start--;
      }
      return { start, end: this.content.length };
    }

    // Check if position is on a word character
    const charAtPos = this.content.charAt(pos);
    if (!this.isWordChar(charAtPos)) {
      // Not on a word - check if we're immediately after a word
      if (pos > 0 && this.isWordChar(this.content.charAt(pos - 1))) {
        let start = pos - 1;
        while (start > 0 && this.isWordChar(this.content.charAt(start - 1))) {
          start--;
        }
        return { start, end: pos };
      }
      return { start: pos, end: pos };
    }

    // Find word start (scan backwards)
    let start = pos;
    while (start > 0 && this.isWordChar(this.content.charAt(start - 1))) {
      start--;
    }

    // Find word end (scan forwards)
    let end = pos;
    while (end < this.content.length && this.isWordChar(this.content.charAt(end))) {
      end++;
    }

    return { start, end };
  }

  /**
   * Find paragraph boundaries at a text position.
   * Paragraphs are delimited by newline characters.
   */
  getParagraphBoundaries(position: number): { start: number; end: number } {
    if (this.content.length === 0) return { start: 0, end: 0 };

    const pos = Math.max(0, Math.min(position, this.content.length));

    // Find paragraph start (scan backwards for \n)
    let start = pos;
    while (start > 0 && this.content.charAt(start - 1) !== '\n') {
      start--;
    }

    // Find paragraph end (scan forwards for \n)
    let end = pos;
    while (end < this.content.length && this.content.charAt(end) !== '\n') {
      end++;
    }

    return { start, end };
  }

  /**
   * Select the word at the current cursor position.
   */
  selectWord(): void {
    const { start, end } = this.getWordBoundaries(this.cursorPosition);
    if (start !== end) {
      this.selectionAnchor = start;
      this.cursorPosition = end;
      this.emitSelectionChange();
    }
  }

  /**
   * Select the paragraph at the current cursor position.
   */
  selectParagraph(): void {
    const { start, end } = this.getParagraphBoundaries(this.cursorPosition);
    this.selectionAnchor = start;
    this.cursorPosition = end;
    this.emitSelectionChange();
  }

  /**
   * Select all text content.
   */
  selectAll(): void {
    if (this.content.length === 0) return;
    this.selectionAnchor = 0;
    this.cursorPosition = this.content.length;
    this.emitSelectionChange();
  }

  // ============================================
  // Line and Document Navigation
  // ============================================

  /**
   * Move cursor to the start of the current line.
   */
  moveCursorToLineStart(): void {
    let pos = this.cursorPosition;
    while (pos > 0 && this.content.charAt(pos - 1) !== '\n') {
      pos--;
    }
    this.setCursorPosition(pos);
  }

  /**
   * Move cursor to the end of the current line.
   */
  moveCursorToLineEnd(): void {
    let pos = this.cursorPosition;
    while (pos < this.content.length && this.content.charAt(pos) !== '\n') {
      pos++;
    }
    this.setCursorPosition(pos);
  }

  /**
   * Move cursor to the start of the document.
   */
  moveCursorToDocumentStart(): void {
    this.setCursorPosition(0);
  }

  /**
   * Move cursor to the end of the document.
   */
  moveCursorToDocumentEnd(): void {
    this.setCursorPosition(this.content.length);
  }

  /**
   * Select from current cursor to line start.
   */
  selectToLineStart(): void {
    if (this.selectionAnchor === null) {
      this.selectionAnchor = this.cursorPosition;
    }
    this.moveCursorToLineStart();
    this.emitSelectionChange();
  }

  /**
   * Select from current cursor to line end.
   */
  selectToLineEnd(): void {
    if (this.selectionAnchor === null) {
      this.selectionAnchor = this.cursorPosition;
    }
    this.moveCursorToLineEnd();
    this.emitSelectionChange();
  }

  /**
   * Select from current cursor to document start.
   */
  selectToDocumentStart(): void {
    if (this.selectionAnchor === null) {
      this.selectionAnchor = this.cursorPosition;
    }
    this.moveCursorToDocumentStart();
    this.emitSelectionChange();
  }

  /**
   * Select from current cursor to document end.
   */
  selectToDocumentEnd(): void {
    if (this.selectionAnchor === null) {
      this.selectionAnchor = this.cursorPosition;
    }
    this.moveCursorToDocumentEnd();
    this.emitSelectionChange();
  }

  // ============================================
  // Word-by-Word Navigation
  // ============================================

  /**
   * Move cursor to the start of the previous word.
   */
  moveCursorWordLeft(): void {
    if (this.cursorPosition === 0) return;

    let pos = this.cursorPosition - 1;

    // Skip any whitespace/punctuation
    while (pos > 0 && !this.isWordChar(this.content.charAt(pos))) {
      pos--;
    }

    // Skip to start of word
    while (pos > 0 && this.isWordChar(this.content.charAt(pos - 1))) {
      pos--;
    }

    this.setCursorPosition(pos);
  }

  /**
   * Move cursor to the start of the next word.
   */
  moveCursorWordRight(): void {
    if (this.cursorPosition >= this.content.length) return;

    let pos = this.cursorPosition;

    // Skip current word if on one
    while (pos < this.content.length && this.isWordChar(this.content.charAt(pos))) {
      pos++;
    }

    // Skip whitespace/punctuation
    while (pos < this.content.length && !this.isWordChar(this.content.charAt(pos))) {
      pos++;
    }

    this.setCursorPosition(pos);
  }

  /**
   * Select word left from current position.
   */
  selectWordLeft(): void {
    if (this.selectionAnchor === null) {
      this.selectionAnchor = this.cursorPosition;
    }
    this.moveCursorWordLeft();
    this.emitSelectionChange();
  }

  /**
   * Select word right from current position.
   */
  selectWordRight(): void {
    if (this.selectionAnchor === null) {
      this.selectionAnchor = this.cursorPosition;
    }
    this.moveCursorWordRight();
    this.emitSelectionChange();
  }
}
