/**
 * TextMutationObserver - Intercepts FlowingTextContent methods to capture text mutations.
 *
 * Uses method wrapping to intercept mutations without requiring changes to FlowingTextContent.
 * Each observed FlowingTextContent has its methods wrapped to capture before/after state.
 */

import { FlowingTextContent } from '../../text/FlowingTextContent';
import { TextFormattingStyle, SubstitutionField } from '../../text/types';
import { TransactionManager } from './TransactionManager';
import {
  ContentSourceId,
  MutationRecord,
  ContentState,
  InsertMutationData,
  DeleteMutationData,
  FormatMutationData,
  AlignmentMutationData,
  FieldInsertMutationData,
  generateId
} from './types';

/**
 * Stores original methods for a FlowingTextContent instance.
 */
interface OriginalMethods {
  insertText: FlowingTextContent['insertText'];
  deleteText: FlowingTextContent['deleteText'];
  insertTextAt: FlowingTextContent['insertTextAt'];
  deleteTextAt: FlowingTextContent['deleteTextAt'];
  applyFormatting: FlowingTextContent['applyFormatting'];
  setAlignment: FlowingTextContent['setAlignment'];
  setAlignmentForRange: FlowingTextContent['setAlignmentForRange'];
  insertSubstitutionField: FlowingTextContent['insertSubstitutionField'];
  removeSubstitutionField: FlowingTextContent['removeSubstitutionField'];
}

/**
 * TextMutationObserver intercepts FlowingTextContent methods.
 */
export class TextMutationObserver {
  private manager: TransactionManager;
  private observedContents: WeakMap<FlowingTextContent, {
    sourceId: ContentSourceId;
    originalMethods: OriginalMethods;
  }> = new WeakMap();

  constructor(manager: TransactionManager) {
    this.manager = manager;
  }

  /**
   * Start observing a FlowingTextContent instance.
   * Wraps mutation methods to intercept changes.
   */
  observe(content: FlowingTextContent, sourceId: ContentSourceId): void {
    // Check if already observing
    if (this.observedContents.has(content)) {
      // Update source ID if changed
      const existing = this.observedContents.get(content)!;
      existing.sourceId = sourceId;
      return;
    }

    // Store original methods
    const originalMethods: OriginalMethods = {
      insertText: content.insertText.bind(content),
      deleteText: content.deleteText.bind(content),
      insertTextAt: content.insertTextAt.bind(content),
      deleteTextAt: content.deleteTextAt.bind(content),
      applyFormatting: content.applyFormatting.bind(content),
      setAlignment: content.setAlignment.bind(content),
      setAlignmentForRange: content.setAlignmentForRange.bind(content),
      insertSubstitutionField: content.insertSubstitutionField.bind(content),
      removeSubstitutionField: content.removeSubstitutionField.bind(content)
    };

    this.observedContents.set(content, { sourceId, originalMethods });

    // Wrap insertText
    content.insertText = (text: string, position?: number) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.insertText(text, position);
      }

      const beforeState = this.captureState(content);
      const insertPos = position ?? content.getCursorPosition();

      originalMethods.insertText(text, position);

      const afterState = this.captureState(content);

      this.recordMutation(content, {
        id: generateId(),
        sourceId: this.getSourceId(content),
        type: 'insert',
        timestamp: Date.now(),
        beforeState,
        afterState,
        data: {
          position: insertPos,
          text,
          formatting: content.getFormattingManager().getFormattingAt(insertPos)
        } as InsertMutationData
      });
    };

    // Wrap deleteText
    content.deleteText = (start: number, length: number, isBackspace: boolean = true) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.deleteText(start, length, isBackspace);
      }

      const beforeState = this.captureState(content);

      // Capture deleted content before deletion
      const deletedText = content.getText().substring(start, start + length);
      const deletedFormatting = this.captureFormattingInRange(content, start, length);
      const deletedFields = this.captureFieldsInRange(content, start, length);
      const deletedObjects = this.captureObjectsInRange(content, start, length);

      originalMethods.deleteText(start, length, isBackspace);

      const afterState = this.captureState(content);

      this.recordMutation(content, {
        id: generateId(),
        sourceId: this.getSourceId(content),
        type: 'delete',
        timestamp: Date.now(),
        beforeState,
        afterState,
        data: {
          position: start,
          deletedText,
          deletedFormatting,
          deletedFields,
          deletedObjects
        } as DeleteMutationData
      });
    };

    // Wrap insertTextAt (used for undo/redo, usually skip recording)
    content.insertTextAt = (position: number, text: string) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.insertTextAt(position, text);
      }

      const beforeState = this.captureState(content);

      originalMethods.insertTextAt(position, text);

      const afterState = this.captureState(content);

      this.recordMutation(content, {
        id: generateId(),
        sourceId: this.getSourceId(content),
        type: 'insert',
        timestamp: Date.now(),
        beforeState,
        afterState,
        data: {
          position,
          text
        } as InsertMutationData
      });
    };

    // Wrap deleteTextAt (used for undo/redo, usually skip recording)
    content.deleteTextAt = (position: number, length: number) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.deleteTextAt(position, length);
      }

      const beforeState = this.captureState(content);
      const deletedText = content.getText().substring(position, position + length);
      const deletedFormatting = this.captureFormattingInRange(content, position, length);

      originalMethods.deleteTextAt(position, length);

      const afterState = this.captureState(content);

      this.recordMutation(content, {
        id: generateId(),
        sourceId: this.getSourceId(content),
        type: 'delete',
        timestamp: Date.now(),
        beforeState,
        afterState,
        data: {
          position,
          deletedText,
          deletedFormatting
        } as DeleteMutationData
      });
    };

    // Wrap applyFormatting
    content.applyFormatting = (start: number, end: number, formatting: Partial<TextFormattingStyle>) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.applyFormatting(start, end, formatting);
      }

      const beforeState = this.captureState(content);
      const previousFormatting = this.captureFormattingInRange(content, start, end - start);

      // Create boundary - formatting changes don't coalesce with typing
      this.manager.createBoundary();

      originalMethods.applyFormatting(start, end, formatting);

      const afterState = this.captureState(content);

      this.recordMutation(content, {
        id: generateId(),
        sourceId: this.getSourceId(content),
        type: 'format',
        timestamp: Date.now(),
        beforeState,
        afterState,
        data: {
          start,
          end,
          newFormatting: formatting,
          previousFormatting
        } as FormatMutationData
      });
    };

    // Wrap setAlignment
    content.setAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.setAlignment(alignment);
      }

      const beforeState = this.captureState(content);
      const cursorPos = content.getCursorPosition();
      const paragraphBoundaries = content.getParagraphBoundaries();
      const paragraphIndex = this.getParagraphIndexFromBoundaries(cursorPos, paragraphBoundaries);
      const previousAlignment = content.getAlignmentAt(cursorPos);

      this.manager.createBoundary();

      originalMethods.setAlignment(alignment);

      const afterState = this.captureState(content);

      this.recordMutation(content, {
        id: generateId(),
        sourceId: this.getSourceId(content),
        type: 'alignment',
        timestamp: Date.now(),
        beforeState,
        afterState,
        data: {
          paragraphIndex,
          newAlignment: alignment,
          previousAlignment
        } as AlignmentMutationData
      });
    };

    // Wrap insertSubstitutionField
    content.insertSubstitutionField = (fieldName: string, config?: any) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.insertSubstitutionField(fieldName, config);
      }

      const beforeState = this.captureState(content);
      const position = content.getCursorPosition();

      this.manager.createBoundary();

      const result = originalMethods.insertSubstitutionField(fieldName, config);

      const afterState = this.captureState(content);

      // Get the field that was just inserted
      const fieldManager = content.getSubstitutionFieldManager();
      const field = fieldManager.getFieldAt(position);

      if (field) {
        this.recordMutation(content, {
          id: generateId(),
          sourceId: this.getSourceId(content),
          type: 'field-insert',
          timestamp: Date.now(),
          beforeState,
          afterState,
          data: {
            position,
            field: { ...field }
          } as FieldInsertMutationData
        });
      }

      return result;
    };
  }

  /**
   * Stop observing a FlowingTextContent instance.
   * Restores original methods.
   */
  unobserve(content: FlowingTextContent): void {
    const observed = this.observedContents.get(content);
    if (!observed) return;

    // Restore original methods
    const { originalMethods } = observed;
    content.insertText = originalMethods.insertText;
    content.deleteText = originalMethods.deleteText;
    content.insertTextAt = originalMethods.insertTextAt;
    content.deleteTextAt = originalMethods.deleteTextAt;
    content.applyFormatting = originalMethods.applyFormatting;
    content.setAlignment = originalMethods.setAlignment;
    content.setAlignmentForRange = originalMethods.setAlignmentForRange;
    content.insertSubstitutionField = originalMethods.insertSubstitutionField;
    content.removeSubstitutionField = originalMethods.removeSubstitutionField;

    this.observedContents.delete(content);
  }

  /**
   * Check if a FlowingTextContent is being observed.
   */
  isObserving(content: FlowingTextContent): boolean {
    return this.observedContents.has(content);
  }

  /**
   * Get the source ID for a FlowingTextContent.
   */
  private getSourceId(content: FlowingTextContent): ContentSourceId {
    const observed = this.observedContents.get(content);
    return observed?.sourceId ?? { type: 'body' };
  }

  /**
   * Capture current content state.
   */
  private captureState(content: FlowingTextContent): ContentState {
    const selection = content.getSelection();
    return {
      cursorPosition: content.getCursorPosition(),
      selection: selection ? { start: selection.start, end: selection.end } : null
    };
  }

  /**
   * Capture formatting in a range.
   */
  private captureFormattingInRange(
    content: FlowingTextContent,
    start: number,
    length: number
  ): Map<number, TextFormattingStyle> {
    const formatting = new Map<number, TextFormattingStyle>();
    const formattingManager = content.getFormattingManager();

    for (let i = 0; i < length; i++) {
      const style = formattingManager.getFormattingAt(start + i);
      if (style) {
        formatting.set(i, { ...style });
      }
    }

    return formatting;
  }

  /**
   * Capture substitution fields in a range.
   */
  private captureFieldsInRange(
    content: FlowingTextContent,
    start: number,
    length: number
  ): Array<{ offset: number; field: SubstitutionField }> {
    const fieldManager = content.getSubstitutionFieldManager();
    const fields = fieldManager.getFieldsInRange(start, start + length);

    return fields.map(entry => ({
      offset: entry.textIndex - start,
      field: { ...entry.field }
    }));
  }

  /**
   * Capture embedded objects in a range.
   */
  private captureObjectsInRange(
    content: FlowingTextContent,
    start: number,
    length: number
  ): Array<{ offset: number; objectData: unknown }> {
    const objects: Array<{ offset: number; objectData: unknown }> = [];
    const embeddedObjects = content.getEmbeddedObjects();

    // getEmbeddedObjects() returns a Map<number, BaseEmbeddedObject>
    for (const [textIndex, obj] of embeddedObjects) {
      if (textIndex >= start && textIndex < start + length) {
        objects.push({
          offset: textIndex - start,
          objectData: obj.toData()
        });
      }
    }

    return objects;
  }

  /**
   * Get paragraph index from cursor position and paragraph boundaries.
   */
  private getParagraphIndexFromBoundaries(cursorPos: number, boundaries: number[]): number {
    for (let i = 0; i < boundaries.length; i++) {
      if (cursorPos < boundaries[i]) {
        return Math.max(0, i - 1);
      }
    }
    return Math.max(0, boundaries.length - 1);
  }

  /**
   * Record a mutation with the transaction manager.
   */
  private recordMutation(_content: FlowingTextContent, mutation: MutationRecord): void {
    this.manager.recordMutation(mutation);
  }
}
