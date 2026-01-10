import { EventEmitter } from '../events/EventEmitter';
import { TextState } from './TextState';
import { TextFormattingManager } from './TextFormatting';
import { ParagraphFormattingManager } from './ParagraphFormatting';
import { SubstitutionFieldManager } from './SubstitutionFieldManager';
import { EmbeddedObjectManager } from './EmbeddedObjectManager';
import { RepeatingSectionManager } from './RepeatingSectionManager';
import { TextLayout, LayoutContext } from './TextLayout';
import { TextMeasurer } from './TextMeasurer';
import {
  TextFormattingStyle,
  TextAlignment,
  SubstitutionField,
  SubstitutionFieldConfig,
  FlowedPage,
  RepeatingSection,
  OBJECT_REPLACEMENT_CHAR,
  PAGE_BREAK_CHAR,
  ObjectPosition,
  Focusable
} from './types';
import { BaseEmbeddedObject, EmbeddedObjectFactory } from '../objects';
import {
  FlowingTextContentData,
  TextFormattingRunData,
  EmbeddedObjectReference
} from '../types';

// Re-export types
export type {
  TextRun,
  SubstitutionField,
  RepeatingSection,
  FlowedLine,
  FlowedPage,
  ObjectPosition,
  TextAlignment
} from './types';
export type { TextFormattingStyle as TextFormatting } from './types';

/**
 * Facade for flowing text content management.
 * Coordinates text state, formatting, substitution fields, embedded objects, and layout.
 * Implements Focusable for unified focus management.
 */
export class FlowingTextContent extends EventEmitter implements Focusable {
  private textState: TextState;
  private formatting: TextFormattingManager;
  private paragraphFormatting: ParagraphFormattingManager;
  private substitutionFields: SubstitutionFieldManager;
  private embeddedObjects: EmbeddedObjectManager;
  private repeatingSections: RepeatingSectionManager;
  private layout: TextLayout;

  // Focus state
  private _hasFocus: boolean = false;
  private _cursorBlinkTimer: ReturnType<typeof setInterval> | null = null;
  private _cursorVisible: boolean = true;
  private _cursorBlinkHandlers: Set<() => void> = new Set();

  constructor(initialContent?: string) {
    super();

    this.textState = new TextState(initialContent);
    this.formatting = new TextFormattingManager();
    this.paragraphFormatting = new ParagraphFormattingManager();
    this.substitutionFields = new SubstitutionFieldManager();
    this.embeddedObjects = new EmbeddedObjectManager();
    this.repeatingSections = new RepeatingSectionManager();
    this.layout = new TextLayout();

    this.setupEventForwarding();
    this.setupFieldCheckCallback();
  }

  /**
   * Set up the callback for cursor skipping over substitution fields.
   */
  private setupFieldCheckCallback(): void {
    this.textState.setFieldCheckCallback((textIndex) => {
      return this.substitutionFields.hasFieldAt(textIndex);
    });
  }

  /**
   * Set up event forwarding from sub-components.
   */
  private setupEventForwarding(): void {
    // Forward text state events
    this.textState.on('text-changed', (data) => {
      this.emit('content-changed', {
        text: data.text,
        cursorPosition: data.cursorPosition
      });
    });

    this.textState.on('text-inserted', (data) => {
      // Note: Formatting, fields, and objects are shifted in insertText() before text insertion
      this.emit('content-changed', {
        text: this.textState.getText(),
        cursorPosition: data.newCursorPosition
      });
    });

    this.textState.on('text-deleted', (data) => {
      // Handle deletion in formatting, substitution fields, embedded objects, sections, and paragraph formatting
      this.formatting.handleDeletion(data.start, data.length);
      this.substitutionFields.handleDeletion(data.start, data.length);
      this.embeddedObjects.handleDeletion(data.start, data.length);
      this.repeatingSections.handleDeletion(data.start, data.length);
      this.paragraphFormatting.handleDeletion(data.start, data.length);

      this.emit('content-changed', {
        text: this.textState.getText(),
        cursorPosition: data.newCursorPosition
      });
    });

    this.textState.on('cursor-moved', (data) => {
      // Note: Pending formatting is NOT cleared here because cursor also moves
      // during text insertion. It's cleared in explicit navigation methods instead.
      this.emit('cursor-moved', { position: data.position });
    });

    this.textState.on('selection-changed', (data) => {
      this.emit('selection-changed', data);
    });

    // Forward formatting events
    this.formatting.on('formatting-changed', (data) => {
      this.emit('formatting-changed', data);
    });

    // Forward substitution field events
    this.substitutionFields.on('field-added', (data) => {
      this.emit('substitution-field-added', data);
    });

    this.substitutionFields.on('field-removed', (data) => {
      this.emit('substitution-field-removed', data);
    });

    this.substitutionFields.on('field-updated', (data) => {
      this.emit('substitution-field-updated', data);
    });

    // Forward embedded object events
    this.embeddedObjects.on('object-added', (data) => {
      this.emit('embedded-object-added', data);
    });

    this.embeddedObjects.on('object-removed', (data) => {
      this.emit('embedded-object-removed', data);
    });

    this.embeddedObjects.on('object-updated', (data) => {
      this.emit('embedded-object-updated', data);
      // Trigger content-changed to cause reflow when object properties change
      this.emit('content-changed', { type: 'object-updated', ...data });
    });

    // Forward repeating section events
    this.repeatingSections.on('section-added', (data) => {
      this.emit('repeating-section-added', data);
    });

    this.repeatingSections.on('section-removed', (data) => {
      this.emit('repeating-section-removed', data);
    });

    this.repeatingSections.on('section-updated', (data) => {
      this.emit('repeating-section-updated', data);
    });
  }

  // ============================================
  // Text Content Operations (delegated to TextState)
  // ============================================

  /**
   * Get the current text content.
   */
  getText(): string {
    return this.textState.getText();
  }

  /**
   * Set the entire text content.
   */
  setText(text: string): void {
    this.textState.setText(text);
  }

  /**
   * Insert text at a position or at the cursor.
   */
  insertText(text: string, position?: number): void {
    const insertAt = position ?? this.textState.getCursorPosition();

    // Determine what formatting to apply to the new text:
    // 1. If pending formatting exists, use it
    // 2. Otherwise, inherit from surrounding text (char before, or char after if at start)
    const pendingFormatting = this.formatting.getPendingFormatting();
    let formattingToApply: Partial<TextFormattingStyle> | null = null;

    if (pendingFormatting) {
      formattingToApply = pendingFormatting;
    } else {
      // Inherit from surrounding text
      const currentText = this.textState.getText();
      if (insertAt > 0) {
        // Use formatting from character before cursor
        formattingToApply = this.formatting.getFormattingAt(insertAt - 1);
      } else if (currentText.length > 0) {
        // At start - use formatting from first character
        formattingToApply = this.formatting.getFormattingAt(0);
      }
      // If empty text, formattingToApply stays null and default formatting is used
    }

    // Shift formatting, fields, objects, and sections after the insertion point
    this.formatting.shiftFormatting(insertAt, text.length);
    this.substitutionFields.shiftFields(insertAt, text.length);
    this.embeddedObjects.shiftObjects(insertAt, text.length);
    this.repeatingSections.shiftSections(insertAt, text.length);

    // Insert the text first so we have the full content
    this.textState.insertText(text, insertAt);

    // Now shift paragraph formatting with the complete content
    this.paragraphFormatting.shiftParagraphs(insertAt, text.length, this.textState.getText());

    // Apply formatting to the newly inserted text (silent=true to avoid breaking undo coalescing)
    if (formattingToApply && text.length > 0) {
      this.formatting.applyFormatting(insertAt, insertAt + text.length, formattingToApply, true);
    }

    // Emit text-inserted event for undo recording
    this.emit('text-inserted', {
      position: insertAt,
      text,
      formatting: formattingToApply as TextFormattingStyle | undefined
    });
  }

  /**
   * Insert a page break at the cursor position.
   */
  insertPageBreak(): void {
    this.insertText(PAGE_BREAK_CHAR);
  }

  /**
   * Delete text from a range.
   * @param start The starting position
   * @param length The number of characters to delete
   * @param isBackspace Whether this is a backspace deletion (vs forward delete)
   */
  deleteText(start: number, length: number, isBackspace: boolean = true): void {
    // Capture the deleted text and formatting before deletion for undo
    const deletedText = this.textState.substring(start, start + length);
    const deletedFormatting = new Map<number, TextFormattingStyle>();
    for (let i = 0; i < length; i++) {
      const formatting = this.formatting.getFormattingAt(start + i);
      if (formatting) {
        deletedFormatting.set(i, formatting);
      }
    }

    // Capture embedded objects in the deleted range before deletion
    const objectsInRange = this.embeddedObjects.getObjectsInRange(start, start + length);
    const deletedObjects = objectsInRange.map(entry => ({
      offset: entry.textIndex - start,
      object: entry.object
    }));

    // Capture substitution fields in the deleted range before deletion
    const fieldsInRange = this.substitutionFields.getFieldsInRange(start, start + length);
    const deletedFields = fieldsInRange.map(entry => ({
      offset: entry.textIndex - start,
      field: entry.field
    }));

    // Perform the actual deletion
    this.textState.deleteText(start, length);

    // Emit text-deleted event for undo recording
    this.emit('text-deleted', {
      position: start,
      deletedText,
      deletedFormatting,
      deletedObjects,
      deletedFields,
      isBackspace
    });
  }

  /**
   * Insert text at a specific position (for undo/redo commands).
   * This method inserts text without moving the cursor or affecting pending formatting.
   */
  insertTextAt(position: number, text: string): void {
    // Shift formatting, fields, objects, and sections after the insertion point
    this.formatting.shiftFormatting(position, text.length);
    this.substitutionFields.shiftFields(position, text.length);
    this.embeddedObjects.shiftObjects(position, text.length);
    this.repeatingSections.shiftSections(position, text.length);

    // Insert the text
    const content = this.textState.getText();
    this.textState.setText(content.slice(0, position) + text + content.slice(position));

    // Shift paragraph formatting with the complete content
    this.paragraphFormatting.shiftParagraphs(position, text.length, this.textState.getText());
  }

  /**
   * Delete text at a specific position (for undo/redo commands).
   * This method deletes text without moving the cursor.
   */
  deleteTextAt(position: number, length: number): void {
    // Handle deletion in formatting, substitution fields, embedded objects, sections, and paragraph formatting
    this.formatting.handleDeletion(position, length);
    this.substitutionFields.handleDeletion(position, length);
    this.embeddedObjects.handleDeletion(position, length);
    this.repeatingSections.handleDeletion(position, length);
    this.paragraphFormatting.handleDeletion(position, length);

    // Delete the text
    const content = this.textState.getText();
    this.textState.setText(content.slice(0, position) + content.slice(position + length));
  }

  // ============================================
  // Cursor Operations (delegated to TextState)
  // ============================================

  /**
   * Get the current cursor position.
   */
  getCursorPosition(): number {
    return this.textState.getCursorPosition();
  }

  /**
   * Set the cursor position.
   * Clears pending formatting since this is explicit cursor navigation.
   */
  setCursorPosition(position: number): void {
    this.formatting.clearPendingFormatting();
    this.textState.setCursorPosition(position);
  }

  /**
   * Move cursor left, skipping over substitution fields.
   * Clears pending formatting since this is explicit cursor navigation.
   */
  moveCursorLeft(): void {
    this.formatting.clearPendingFormatting();
    this.textState.moveCursorLeft();
  }

  /**
   * Move cursor right, skipping over substitution fields.
   * Clears pending formatting since this is explicit cursor navigation.
   */
  moveCursorRight(): void {
    this.formatting.clearPendingFormatting();
    this.textState.moveCursorRight();
  }

  // ============================================
  // Selection Operations (delegated to TextState)
  // ============================================

  /**
   * Get the current text selection range.
   */
  getSelection(): { start: number; end: number } | null {
    return this.textState.getSelection();
  }

  /**
   * Set the selection anchor point.
   * Call this when starting a selection (e.g., mouse down).
   */
  setSelectionAnchor(position?: number): void {
    this.textState.setSelectionAnchor(position);
  }

  /**
   * Check if there is an active text selection.
   */
  hasSelection(): boolean {
    return this.textState.hasSelection();
  }

  /**
   * Check if the selection anchor is set (even if cursor equals anchor).
   */
  hasSelectionAnchor(): boolean {
    return this.textState.hasSelectionAnchor();
  }

  /**
   * Clear the current text selection.
   */
  clearSelection(): void {
    this.textState.clearSelection();
  }

  /**
   * Set a selection range.
   * Sets the anchor at start and cursor at end.
   */
  setSelection(start: number, end: number): void {
    this.textState.setSelectionAnchor(start);
    this.textState.setCursorPosition(end);
  }

  /**
   * Get the selected text content.
   */
  getSelectedText(): string {
    return this.textState.getSelectedText();
  }

  /**
   * Delete the selected text.
   */
  deleteSelection(): boolean {
    const selection = this.getSelection();
    if (!selection) {
      return false;
    }
    // Use our deleteText method which properly records undo
    this.deleteText(selection.start, selection.end - selection.start);
    // Clear the selection
    this.clearSelection();
    return true;
  }

  /**
   * Replace the selected text with new text.
   * This is a compound operation that will be undone as a single action.
   */
  replaceSelection(text: string): void {
    const hasSelection = this.hasSelection();
    if (hasSelection) {
      this.emit('compound-operation-start', {});
      this.deleteSelection();
    }
    this.insertText(text);
    if (hasSelection) {
      this.emit('compound-operation-end', { description: 'Replace' });
    }
  }

  /**
   * Signal the start of a compound operation (for undo grouping).
   */
  beginCompoundOperation(description?: string): void {
    this.emit('compound-operation-start', { description });
  }

  /**
   * Signal the end of a compound operation (for undo grouping).
   */
  endCompoundOperation(): void {
    this.emit('compound-operation-end', {});
  }

  /**
   * Move cursor left while extending selection (shift+left).
   */
  selectLeft(): void {
    this.textState.selectLeft();
  }

  /**
   * Move cursor right while extending selection (shift+right).
   */
  selectRight(): void {
    this.textState.selectRight();
  }

  // ============================================
  // Formatting Operations (delegated to TextFormattingManager)
  // ============================================

  /**
   * Get formatting at a specific position.
   */
  getFormattingAt(position: number): TextFormattingStyle {
    return this.formatting.getFormattingAt(position);
  }

  /**
   * Apply formatting to a range of text.
   * Also updates any substitution fields within the range.
   */
  applyFormatting(start: number, end: number, formatting: Partial<TextFormattingStyle>): void {
    // Capture previous formatting for undo
    const previousFormatting = new Map<number, TextFormattingStyle>();
    for (let i = start; i < end; i++) {
      const fmt = this.formatting.getFormattingAt(i);
      if (fmt) {
        previousFormatting.set(i - start, fmt);
      }
    }

    this.formatting.applyFormatting(start, end, formatting);

    // Also update any substitution fields within the range
    for (const field of this.substitutionFields.getFieldsArray()) {
      if (field.textIndex >= start && field.textIndex < end) {
        // Merge the new formatting with existing field formatting
        const currentFormatting = field.formatting || this.formatting.defaultFormatting;
        const mergedFormatting: TextFormattingStyle = {
          ...currentFormatting,
          ...formatting
        };
        this.substitutionFields.setFieldFormatting(field.textIndex, mergedFormatting);
      }
    }

    // Emit formatting-changed event for undo recording
    this.emit('formatting-changed', {
      start,
      end,
      newFormatting: formatting,
      previousFormatting
    });

    // Emit content-changed to trigger reflow (e.g., for table cells)
    this.emit('content-changed', {
      type: 'formatting',
      start,
      end
    });
  }

  /**
   * Get the default formatting.
   */
  getDefaultFormatting(): TextFormattingStyle {
    return this.formatting.defaultFormatting;
  }

  /**
   * Set the default formatting.
   */
  setDefaultFormatting(formatting: Partial<TextFormattingStyle>): void {
    this.formatting.setDefaultFormatting(formatting);
  }

  // ============================================
  // Pending Formatting (cursor-only state)
  // ============================================

  /**
   * Set pending formatting to apply to the next inserted character.
   * Used when formatting is applied with just a cursor (no selection).
   */
  setPendingFormatting(formatting: Partial<TextFormattingStyle>): void {
    this.formatting.setPendingFormatting(formatting);
  }

  /**
   * Get the current pending formatting, if any.
   */
  getPendingFormatting(): Partial<TextFormattingStyle> | null {
    return this.formatting.getPendingFormatting();
  }

  /**
   * Check if there is pending formatting.
   */
  hasPendingFormatting(): boolean {
    return this.formatting.hasPendingFormatting();
  }

  /**
   * Clear pending formatting.
   */
  clearPendingFormatting(): void {
    this.formatting.clearPendingFormatting();
  }

  /**
   * Get the effective formatting at cursor, considering pending formatting.
   * If pending formatting exists, merge it with the formatting at cursor position.
   * Otherwise, return the formatting at the position before cursor (or default if at start).
   */
  getEffectiveFormattingAtCursor(): TextFormattingStyle {
    const cursorPos = this.getCursorPosition();
    const pending = this.getPendingFormatting();

    // Get base formatting: from character before cursor, or default if at start
    let baseFormatting: TextFormattingStyle;
    if (cursorPos > 0) {
      baseFormatting = this.formatting.getFormattingAt(cursorPos - 1);
    } else {
      // At start of line - use formatting at cursor position or default
      const text = this.getText();
      if (text.length > 0) {
        baseFormatting = this.formatting.getFormattingAt(0);
      } else {
        baseFormatting = this.formatting.defaultFormatting;
      }
    }

    // Merge pending formatting if exists
    if (pending) {
      return { ...baseFormatting, ...pending };
    }

    return baseFormatting;
  }

  // ============================================
  // Substitution Field Operations
  // ============================================

  /**
   * Get all substitution fields.
   */
  getSubstitutionFields(): Map<number, SubstitutionField> {
    return this.substitutionFields.getFields();
  }

  /**
   * Insert a substitution field at the current cursor position.
   * The field inherits the text formatting at the cursor position.
   */
  insertSubstitutionField(
    fieldName: string,
    config?: SubstitutionFieldConfig
  ): SubstitutionField {
    const insertAt = this.textState.getCursorPosition();

    // Get the text formatting at the cursor position to inherit
    // If config already has formatting, use that instead
    const cursorFormatting = config?.formatting || this.formatting.getFormattingAt(insertAt);

    // Shift existing formatting, fields, objects, and sections
    this.formatting.shiftFormatting(insertAt, 1);
    this.substitutionFields.shiftFields(insertAt, 1);
    this.embeddedObjects.shiftObjects(insertAt, 1);
    this.repeatingSections.shiftSections(insertAt, 1);

    // Insert the placeholder character
    this.textState.insertText(OBJECT_REPLACEMENT_CHAR, insertAt);

    // Shift paragraph formatting with the complete content
    this.paragraphFormatting.shiftParagraphs(insertAt, 1, this.textState.getText());

    // Register the substitution field with inherited formatting
    const field = this.substitutionFields.insert(fieldName, insertAt, {
      ...config,
      formatting: cursorFormatting
    });

    // Apply formatting to the placeholder character
    if (cursorFormatting) {
      this.formatting.applyFormatting(insertAt, insertAt + 1, cursorFormatting, true);
    }

    // Emit substitution-field-inserted event for undo recording
    // (not text-inserted, because redo needs to re-register the field)
    this.emit('substitution-field-inserted', {
      position: insertAt,
      field
    });

    this.emit('content-changed', {
      text: this.textState.getText(),
      cursorPosition: this.textState.getCursorPosition()
    });

    return field;
  }

  /**
   * Insert a page number field at the current cursor position.
   * @param displayFormat Optional format string (e.g., "Page %d")
   */
  insertPageNumberField(displayFormat?: string): SubstitutionField {
    return this.insertSubstitutionField('page', {
      fieldType: 'pageNumber',
      displayFormat
    });
  }

  /**
   * Insert a page count field at the current cursor position.
   * @param displayFormat Optional format string (e.g., "of %d")
   */
  insertPageCountField(displayFormat?: string): SubstitutionField {
    return this.insertSubstitutionField('pages', {
      fieldType: 'pageCount',
      displayFormat
    });
  }

  /**
   * Remove a substitution field at a specific text index.
   */
  removeSubstitutionField(textIndex: number): boolean {
    const field = this.substitutionFields.remove(textIndex);
    if (field) {
      // Remove the placeholder character
      this.textState.deleteText(textIndex, 1);
      return true;
    }
    return false;
  }

  /**
   * Get a substitution field at a specific text index.
   */
  getSubstitutionFieldAt(textIndex: number): SubstitutionField | undefined {
    return this.substitutionFields.getFieldAt(textIndex);
  }

  /**
   * Update a substitution field's configuration.
   */
  updateSubstitutionFieldConfig(
    textIndex: number,
    config: Partial<SubstitutionFieldConfig & { fieldName?: string }>
  ): boolean {
    return this.substitutionFields.updateFieldConfig(textIndex, config);
  }

  // ============================================
  // Embedded Object Operations
  // ============================================

  /**
   * Get all embedded objects.
   */
  getEmbeddedObjects(): Map<number, BaseEmbeddedObject> {
    return this.embeddedObjects.getObjects();
  }

  /**
   * Insert an embedded object at the current cursor position.
   */
  insertEmbeddedObject(
    object: BaseEmbeddedObject,
    position: ObjectPosition = 'inline'
  ): void {
    const insertAt = this.textState.getCursorPosition();

    // Shift existing fields and objects
    this.substitutionFields.shiftFields(insertAt, 1);
    this.embeddedObjects.shiftObjects(insertAt, 1);

    // Insert the placeholder character
    this.textState.insertText(OBJECT_REPLACEMENT_CHAR, insertAt);

    // Tables ONLY support block positioning - enforce this constraint
    const effectivePosition = object.objectType === 'table' ? 'block' : position;

    // Set the object's position mode and register it
    object.position = effectivePosition;
    this.embeddedObjects.insert(object, insertAt);

    // Emit event for undo recording
    this.emit('embedded-object-inserted', {
      position: insertAt,
      object,
      objectPosition: effectivePosition
    });

    this.emit('content-changed', {
      text: this.textState.getText(),
      cursorPosition: this.textState.getCursorPosition()
    });
  }

  /**
   * Insert an embedded object at a specific position (for undo/redo).
   * This doesn't emit the embedded-object-inserted event to avoid duplicate undo entries.
   */
  insertEmbeddedObjectAt(
    object: BaseEmbeddedObject,
    textIndex: number,
    position: ObjectPosition = 'inline'
  ): void {
    // Shift existing fields and objects
    this.substitutionFields.shiftFields(textIndex, 1);
    this.embeddedObjects.shiftObjects(textIndex, 1);

    // Insert the placeholder character
    const content = this.textState.getText();
    this.textState.setText(content.slice(0, textIndex) + OBJECT_REPLACEMENT_CHAR + content.slice(textIndex));

    // Set the object's position mode and register it
    object.position = position;
    this.embeddedObjects.insert(object, textIndex);

    this.emit('content-changed', {
      text: this.textState.getText(),
      cursorPosition: this.textState.getCursorPosition()
    });
  }

  /**
   * Remove an embedded object at a specific text index.
   */
  removeEmbeddedObject(textIndex: number): boolean {
    const object = this.embeddedObjects.remove(textIndex);
    if (object) {
      // Remove the placeholder character
      this.textState.deleteText(textIndex, 1);
      return true;
    }
    return false;
  }

  /**
   * Get an embedded object at a specific text index.
   */
  getEmbeddedObjectAt(textIndex: number): BaseEmbeddedObject | undefined {
    return this.embeddedObjects.getObjectAt(textIndex);
  }

  /**
   * Find an embedded object by its ID.
   */
  findEmbeddedObjectById(objectId: string): { object: BaseEmbeddedObject; textIndex: number } | undefined {
    return this.embeddedObjects.findById(objectId);
  }

  /**
   * Get the currently selected embedded object.
   */
  getSelectedEmbeddedObject(): { object: BaseEmbeddedObject; textIndex: number } | undefined {
    return this.embeddedObjects.getSelectedObject();
  }

  /**
   * Deselect all embedded objects.
   */
  deselectAllEmbeddedObjects(): void {
    this.embeddedObjects.deselectAll();
  }

  // ============================================
  // Layout Operations
  // ============================================

  /**
   * Flow text into pages based on available dimensions.
   * This is the main layout operation.
   */
  flowText(
    availableWidth: number,
    availableHeight: number,
    ctx: CanvasRenderingContext2D
  ): FlowedPage[] {
    const measurer = new TextMeasurer(ctx);
    const content = this.textState.getText();

    const context: LayoutContext = {
      availableWidth,
      availableHeight,
      measurer,
      formatting: this.formatting,
      paragraphFormatting: this.paragraphFormatting,
      substitutionFields: this.substitutionFields,
      embeddedObjects: this.embeddedObjects,
      content
    };

    return this.layout.flowText(content, context);
  }

  /**
   * Find the page and line for a given text index.
   */
  findPositionForIndex(
    pages: FlowedPage[],
    textIndex: number
  ): { pageIndex: number; lineIndex: number } | null {
    return this.layout.findPositionForIndex(pages, textIndex);
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get the text length.
   */
  get length(): number {
    return this.textState.length;
  }

  /**
   * Check if content is empty.
   */
  get isEmpty(): boolean {
    return this.textState.isEmpty;
  }

  /**
   * Clear all content, formatting, and embedded content.
   */
  clear(): void {
    this.textState.clear();
    this.formatting.clear();
    this.paragraphFormatting.clear();
    this.substitutionFields.clear();
    this.embeddedObjects.clear();
    this.repeatingSections.clear();
  }

  // ============================================
  // Focusable Interface Implementation
  // ============================================

  /**
   * Called when this control receives focus.
   * Starts cursor blinking and prepares for keyboard input.
   */
  focus(): void {
    if (this._hasFocus) return;

    this._hasFocus = true;
    this._cursorVisible = true;
    this.startCursorBlink();
    this.emit('focus');
  }

  /**
   * Called when this control loses focus.
   * Stops cursor blinking and hides cursor.
   */
  blur(): void {
    if (!this._hasFocus) return;

    this._hasFocus = false;
    this._cursorVisible = false;
    this.stopCursorBlink();
    this.emit('blur');
  }

  /**
   * Returns whether this control currently has focus.
   */
  hasFocus(): boolean {
    return this._hasFocus;
  }

  /**
   * Returns whether the cursor should be visible (for rendering).
   */
  isCursorVisible(): boolean {
    return this._hasFocus && this._cursorVisible;
  }

  /**
   * Handle a keyboard event.
   * @returns true if the event was handled, false otherwise
   */
  handleKeyDown(e: KeyboardEvent): boolean {
    console.log('[FlowingTextContent.handleKeyDown] Key:', e.key, '_hasFocus:', this._hasFocus);
    if (!this._hasFocus) {
      console.log('[FlowingTextContent.handleKeyDown] No focus, returning false');
      return false;
    }

    switch (e.key) {
      case 'Backspace':
        e.preventDefault();
        if (!this.deleteSelection()) {
          const cursorPos = this.getCursorPosition();
          if (cursorPos > 0) {
            this.deleteText(cursorPos - 1, 1);
          }
        }
        return true;

      case 'Delete':
        e.preventDefault();
        if (!this.deleteSelection()) {
          const deletePos = this.getCursorPosition();
          if (deletePos < this.getText().length) {
            this.deleteText(deletePos, 1, false); // Forward delete, not backspace
          }
        }
        return true;

      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey) {
          this.selectLeft();
        } else {
          this.clearSelection();
          this.moveCursorLeft();
        }
        this.resetCursorBlink();
        return true;

      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey) {
          this.selectRight();
        } else {
          this.clearSelection();
          this.moveCursorRight();
        }
        this.resetCursorBlink();
        return true;

      case 'ArrowUp':
      case 'ArrowDown':
        // Vertical navigation requires layout context - return false to let caller handle
        // Set selection anchor if shift is held
        if (e.shiftKey && !this.hasSelectionAnchor()) {
          this.setSelectionAnchor();
        } else if (!e.shiftKey) {
          this.clearSelection();
        }
        return false;

      case 'Enter':
        e.preventDefault();
        // Ctrl+Enter (or Cmd+Enter on Mac) inserts a page break
        if (e.ctrlKey || e.metaKey) {
          this.replaceSelection(PAGE_BREAK_CHAR);
        } else {
          this.replaceSelection('\n');
        }
        return true;

      case 'Tab':
        e.preventDefault();
        this.replaceSelection('\t');
        return true;

      default:
        // Handle regular text input
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          this.replaceSelection(e.key);
          return true;
        }
        return false;
    }
  }

  /**
   * Subscribe to cursor blink events (for re-rendering).
   */
  onCursorBlink(handler: () => void): void {
    this._cursorBlinkHandlers.add(handler);
  }

  /**
   * Unsubscribe from cursor blink events.
   */
  offCursorBlink(handler: () => void): void {
    this._cursorBlinkHandlers.delete(handler);
  }

  /**
   * Start the cursor blink timer.
   */
  private startCursorBlink(): void {
    this.stopCursorBlink();
    this._cursorVisible = true;

    this._cursorBlinkTimer = setInterval(() => {
      this._cursorVisible = !this._cursorVisible;
      // Notify all blink handlers
      for (const handler of this._cursorBlinkHandlers) {
        handler();
      }
      this.emit('cursor-blink', { visible: this._cursorVisible });
    }, 530);
  }

  /**
   * Stop the cursor blink timer.
   */
  private stopCursorBlink(): void {
    if (this._cursorBlinkTimer) {
      clearInterval(this._cursorBlinkTimer);
      this._cursorBlinkTimer = null;
    }
  }

  /**
   * Reset cursor blink (e.g., after typing).
   * Makes cursor visible and restarts the blink timer.
   */
  resetCursorBlink(): void {
    if (this._hasFocus) {
      this._cursorVisible = true;
      this.startCursorBlink();
    }
  }

  // ============================================
  // Paragraph Alignment Operations
  // ============================================

  /**
   * Get alignment at a specific text position.
   */
  getAlignmentAt(textIndex: number): TextAlignment {
    return this.paragraphFormatting.getFormattingAt(textIndex, this.textState.getText()).alignment;
  }

  /**
   * Set alignment for the paragraph at the cursor position.
   */
  setAlignment(alignment: TextAlignment): void {
    const cursorPos = this.textState.getCursorPosition();
    const content = this.textState.getText();
    const paragraphStart = this.paragraphFormatting.getParagraphStart(cursorPos, content);

    // Capture previous alignment for undo
    const previousAlignment = this.paragraphFormatting.getFormattingAt(cursorPos, content).alignment;

    this.paragraphFormatting.setAlignment(paragraphStart, alignment);

    // Emit alignment-changed event for undo recording (using paragraph start as index)
    this.emit('alignment-changed', {
      paragraphIndex: paragraphStart,
      newAlignment: alignment,
      previousAlignment
    });

    this.emit('content-changed', {
      text: content,
      cursorPosition: cursorPos
    });
  }

  /**
   * Set alignment for all paragraphs in a text range.
   */
  setAlignmentForRange(start: number, end: number, alignment: TextAlignment): void {
    const content = this.textState.getText();
    this.paragraphFormatting.applyToRange(start, end, content, { alignment });

    this.emit('content-changed', {
      text: content,
      cursorPosition: this.textState.getCursorPosition()
    });
  }

  // ============================================
  // Direct access to sub-components (for advanced use)
  // ============================================

  /**
   * Get the text state manager.
   */
  getTextState(): TextState {
    return this.textState;
  }

  /**
   * Get the formatting manager.
   */
  getFormattingManager(): TextFormattingManager {
    return this.formatting;
  }

  /**
   * Get the paragraph formatting manager.
   */
  getParagraphFormattingManager(): ParagraphFormattingManager {
    return this.paragraphFormatting;
  }

  /**
   * Get the substitution field manager.
   */
  getSubstitutionFieldManager(): SubstitutionFieldManager {
    return this.substitutionFields;
  }

  /**
   * Get the embedded object manager.
   */
  getEmbeddedObjectManager(): EmbeddedObjectManager {
    return this.embeddedObjects;
  }

  /**
   * Get the repeating section manager.
   */
  getRepeatingSectionManager(): RepeatingSectionManager {
    return this.repeatingSections;
  }

  /**
   * Get the layout engine.
   */
  getLayoutEngine(): TextLayout {
    return this.layout;
  }

  // ============================================
  // Repeating Section Operations
  // ============================================

  /**
   * Get all paragraph boundaries in the current content.
   * Returns indices that are valid start/end points for repeating sections.
   */
  getParagraphBoundaries(): number[] {
    return this.layout.getParagraphBoundaries(this.textState.getText());
  }

  /**
   * Get all repeating sections.
   */
  getRepeatingSections(): RepeatingSection[] {
    return this.repeatingSections.getSections();
  }

  /**
   * Create a repeating section.
   * @param startIndex Text index at paragraph start (must be at a paragraph boundary)
   * @param endIndex Text index at closing paragraph start (must be at a paragraph boundary)
   * @param fieldPath The field path to the array to loop over
   * @returns The created section, or null if boundaries are invalid
   */
  createRepeatingSection(
    startIndex: number,
    endIndex: number,
    fieldPath: string
  ): RepeatingSection | null {
    const content = this.textState.getText();

    // Validate boundaries
    if (!this.repeatingSections.validateBoundaries(startIndex, endIndex, content)) {
      return null;
    }

    const section = this.repeatingSections.create(startIndex, endIndex, fieldPath);

    this.emit('content-changed', {
      text: content,
      cursorPosition: this.textState.getCursorPosition()
    });

    return section;
  }

  /**
   * Remove a repeating section by ID.
   */
  removeRepeatingSection(id: string): boolean {
    const section = this.repeatingSections.remove(id);
    if (section) {
      this.emit('content-changed', {
        text: this.textState.getText(),
        cursorPosition: this.textState.getCursorPosition()
      });
      return true;
    }
    return false;
  }

  /**
   * Get a repeating section by ID.
   */
  getRepeatingSection(id: string): RepeatingSection | undefined {
    return this.repeatingSections.getSection(id);
  }

  /**
   * Find a repeating section that has a boundary at the given text index.
   */
  getRepeatingSectionAtBoundary(textIndex: number): RepeatingSection | undefined {
    return this.repeatingSections.getSectionAtBoundary(textIndex);
  }

  /**
   * Update a repeating section's field path.
   */
  updateRepeatingSectionFieldPath(id: string, fieldPath: string): boolean {
    const result = this.repeatingSections.updateFieldPath(id, fieldPath);
    if (result) {
      this.emit('content-changed', {
        text: this.textState.getText(),
        cursorPosition: this.textState.getCursorPosition()
      });
    }
    return result;
  }

  // ============================================
  // Serialization
  // ============================================

  /**
   * Serialize the complete FlowingTextContent state to JSON-compatible data.
   */
  toData(): FlowingTextContentData {
    // Serialize text content
    const text = this.textState.getText();

    // Serialize text formatting as runs - only output when format changes
    // This optimizes document size by not storing redundant formatting entries
    const formattingRuns: TextFormattingRunData[] = [];
    const defaultFormat = this.formatting.defaultFormatting;
    let lastFormat: TextFormattingStyle | null = null;

    for (let i = 0; i < text.length; i++) {
      const currentFormat = this.formatting.getFormattingAt(i);

      // Check if formatting changed from previous character
      const formatChanged = lastFormat === null ||
        currentFormat.fontFamily !== lastFormat.fontFamily ||
        currentFormat.fontSize !== lastFormat.fontSize ||
        currentFormat.fontWeight !== lastFormat.fontWeight ||
        currentFormat.fontStyle !== lastFormat.fontStyle ||
        currentFormat.color !== lastFormat.color ||
        currentFormat.backgroundColor !== lastFormat.backgroundColor;

      if (formatChanged) {
        // Only output if different from default (to further reduce size)
        const isDefault =
          currentFormat.fontFamily === defaultFormat.fontFamily &&
          currentFormat.fontSize === defaultFormat.fontSize &&
          currentFormat.fontWeight === defaultFormat.fontWeight &&
          currentFormat.fontStyle === defaultFormat.fontStyle &&
          currentFormat.color === defaultFormat.color &&
          currentFormat.backgroundColor === defaultFormat.backgroundColor;

        // Always output first run if it's not default, or output when format changes
        if (!isDefault || formattingRuns.length > 0) {
          formattingRuns.push({
            index: i,
            formatting: {
              fontFamily: currentFormat.fontFamily,
              fontSize: currentFormat.fontSize,
              fontWeight: currentFormat.fontWeight,
              fontStyle: currentFormat.fontStyle,
              color: currentFormat.color,
              backgroundColor: currentFormat.backgroundColor
            }
          });
        }
        lastFormat = currentFormat;
      }
    }

    // Serialize paragraph formatting
    const paragraphFormatting = this.paragraphFormatting.toJSON();

    // Serialize substitution fields
    const substitutionFieldsData = this.substitutionFields.toJSON().map(field => ({
      id: field.id,
      textIndex: field.textIndex,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      displayFormat: field.displayFormat,
      defaultValue: field.defaultValue,
      formatting: field.formatting ? {
        fontFamily: field.formatting.fontFamily,
        fontSize: field.formatting.fontSize,
        fontWeight: field.formatting.fontWeight,
        fontStyle: field.formatting.fontStyle,
        color: field.formatting.color,
        backgroundColor: field.formatting.backgroundColor
      } : undefined
    }));

    // Serialize repeating sections
    const repeatingSectionsData = this.repeatingSections.toJSON();

    // Serialize embedded objects
    const embeddedObjects: EmbeddedObjectReference[] = [];
    const objectsMap = this.embeddedObjects.getObjects();
    objectsMap.forEach((object, textIndex) => {
      embeddedObjects.push({
        textIndex,
        object: object.toData()
      });
    });

    return {
      text,
      formattingRuns: formattingRuns.length > 0 ? formattingRuns : undefined,
      paragraphFormatting: paragraphFormatting.length > 0 ? paragraphFormatting : undefined,
      substitutionFields: substitutionFieldsData.length > 0 ? substitutionFieldsData : undefined,
      repeatingSections: repeatingSectionsData.length > 0 ? repeatingSectionsData : undefined,
      embeddedObjects: embeddedObjects.length > 0 ? embeddedObjects : undefined
    };
  }

  /**
   * Restore FlowingTextContent state from serialized data.
   * Static factory method for creating from data.
   */
  static fromData(data: FlowingTextContentData): FlowingTextContent {
    const content = new FlowingTextContent(data.text);

    // Restore text formatting from runs
    // Each run specifies where formatting changes; apply it to the range until the next run
    if (data.formattingRuns && data.formattingRuns.length > 0) {
      const textLength = data.text.length;
      const formattingManager = content.getFormattingManager();

      for (let i = 0; i < data.formattingRuns.length; i++) {
        const run = data.formattingRuns[i];
        const nextRun = data.formattingRuns[i + 1];

        // Range is from this run's index to the next run's index (or end of text)
        const start = run.index;
        const end = nextRun ? nextRun.index : textLength;

        if (start < end) {
          formattingManager.applyFormatting(start, end, run.formatting as TextFormattingStyle);
        }
      }
    }

    // Restore paragraph formatting
    if (data.paragraphFormatting && data.paragraphFormatting.length > 0) {
      content.getParagraphFormattingManager().fromJSON(data.paragraphFormatting);
    }

    // Restore substitution fields
    if (data.substitutionFields && data.substitutionFields.length > 0) {
      content.getSubstitutionFieldManager().fromJSON(data.substitutionFields);
    }

    // Restore repeating sections
    if (data.repeatingSections && data.repeatingSections.length > 0) {
      content.getRepeatingSectionManager().fromJSON(data.repeatingSections);
    }

    // Restore embedded objects using factory
    if (data.embeddedObjects && data.embeddedObjects.length > 0) {
      for (const ref of data.embeddedObjects) {
        const object = EmbeddedObjectFactory.tryCreate(ref.object);
        if (object) {
          content.getEmbeddedObjectManager().insert(object, ref.textIndex);
        } else {
          console.warn(`Failed to create embedded object of type: ${ref.object.objectType}`);
        }
      }
    }

    return content;
  }

  /**
   * Load state from serialized data into this instance.
   * Instance method for updating existing FlowingTextContent.
   */
  loadFromData(data: FlowingTextContentData): void {
    // Clear existing state
    this.clear();

    // Set text content
    this.textState.setText(data.text);

    // Restore text formatting from runs
    // Each run specifies where formatting changes; apply it to the range until the next run
    if (data.formattingRuns && data.formattingRuns.length > 0) {
      const textLength = data.text.length;

      for (let i = 0; i < data.formattingRuns.length; i++) {
        const run = data.formattingRuns[i];
        const nextRun = data.formattingRuns[i + 1];

        // Range is from this run's index to the next run's index (or end of text)
        const start = run.index;
        const end = nextRun ? nextRun.index : textLength;

        if (start < end) {
          this.formatting.applyFormatting(start, end, run.formatting as TextFormattingStyle);
        }
      }
    }

    // Restore paragraph formatting
    if (data.paragraphFormatting && data.paragraphFormatting.length > 0) {
      this.paragraphFormatting.fromJSON(data.paragraphFormatting);
    }

    // Restore substitution fields
    if (data.substitutionFields && data.substitutionFields.length > 0) {
      this.substitutionFields.fromJSON(data.substitutionFields);
    }

    // Restore repeating sections
    if (data.repeatingSections && data.repeatingSections.length > 0) {
      this.repeatingSections.fromJSON(data.repeatingSections);
    }

    // Restore embedded objects
    if (data.embeddedObjects && data.embeddedObjects.length > 0) {
      for (const ref of data.embeddedObjects) {
        const object = EmbeddedObjectFactory.tryCreate(ref.object);
        if (object) {
          this.embeddedObjects.insert(object, ref.textIndex);
        } else {
          console.warn(`Failed to create embedded object of type: ${ref.object.objectType}`);
        }
      }
    }
  }
}
