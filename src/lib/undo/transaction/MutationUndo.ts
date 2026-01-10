/**
 * MutationUndo - Handles undoing and redoing mutations.
 *
 * Provides the logic for reversing text and object mutations.
 */

import { FlowingTextContent } from '../../text/FlowingTextContent';
import {
  MutationRecord,
  ContentSourceId,
  ObjectSourceId,
  InsertMutationData,
  DeleteMutationData,
  FormatMutationData,
  AlignmentMutationData,
  FieldInsertMutationData,
  FieldUpdateMutationData,
  ResizeMutationData,
  MoveMutationData,
  PropertyMutationData,
  TableStructureMutationData
} from './types';
import { BaseEmbeddedObject, TableObject } from '../../objects';

/**
 * Callback to get a FlowingTextContent by source ID.
 */
export type GetContentFn = (sourceId: ContentSourceId) => FlowingTextContent | null;

/**
 * Callback to get an object by source ID.
 */
export type GetObjectFn = (sourceId: ObjectSourceId) => BaseEmbeddedObject | null;

/**
 * MutationUndo provides undo/redo logic for mutations.
 */
export class MutationUndo {
  private getContent: GetContentFn;
  private getObject: GetObjectFn;

  constructor(getContent: GetContentFn, getObject: GetObjectFn) {
    this.getContent = getContent;
    this.getObject = getObject;
  }

  /**
   * Undo a mutation.
   */
  undoMutation(mutation: MutationRecord): void {
    switch (mutation.type) {
      case 'insert':
        this.undoInsert(mutation);
        break;
      case 'delete':
        this.undoDelete(mutation);
        break;
      case 'format':
        this.undoFormat(mutation);
        break;
      case 'alignment':
        this.undoAlignment(mutation);
        break;
      case 'field-insert':
        this.undoFieldInsert(mutation);
        break;
      case 'field-update':
        this.undoFieldUpdate(mutation);
        break;
      case 'object-resize':
        this.undoResize(mutation);
        break;
      case 'object-move':
        this.undoMove(mutation);
        break;
      case 'object-property':
        this.undoProperty(mutation);
        break;
      case 'table-add-row':
      case 'table-add-column':
      case 'table-delete-row':
      case 'table-delete-column':
      case 'table-merge':
      case 'table-split':
        this.undoTableStructure(mutation);
        break;
      default:
        console.warn('Unknown mutation type for undo:', mutation.type);
    }
  }

  /**
   * Redo a mutation.
   */
  redoMutation(mutation: MutationRecord): void {
    switch (mutation.type) {
      case 'insert':
        this.redoInsert(mutation);
        break;
      case 'delete':
        this.redoDelete(mutation);
        break;
      case 'format':
        this.redoFormat(mutation);
        break;
      case 'alignment':
        this.redoAlignment(mutation);
        break;
      case 'field-insert':
        this.redoFieldInsert(mutation);
        break;
      case 'field-update':
        this.redoFieldUpdate(mutation);
        break;
      case 'object-resize':
        this.redoResize(mutation);
        break;
      case 'object-move':
        this.redoMove(mutation);
        break;
      case 'object-property':
        this.redoProperty(mutation);
        break;
      case 'table-add-row':
      case 'table-add-column':
      case 'table-delete-row':
      case 'table-delete-column':
      case 'table-merge':
      case 'table-split':
        this.redoTableStructure(mutation);
        break;
      default:
        console.warn('Unknown mutation type for redo:', mutation.type);
    }
  }

  // --- Text Mutations ---

  private undoInsert(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as InsertMutationData;
    content.deleteTextAt(data.position, data.text.length);
  }

  private redoInsert(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as InsertMutationData;
    content.insertTextAt(data.position, data.text);

    // Restore formatting if present
    if (data.formatting) {
      const fm = content.getFormattingManager();
      fm.applyFormatting(data.position, data.position + data.text.length, data.formatting);
    }
  }

  private undoDelete(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as DeleteMutationData;

    // Restore deleted text
    content.insertTextAt(data.position, data.deletedText);

    // Restore formatting
    if (data.deletedFormatting) {
      const fm = content.getFormattingManager();
      data.deletedFormatting.forEach((style, offset) => {
        fm.applyFormatting(data.position + offset, data.position + offset + 1, style);
      });
    }

    // Restore substitution fields
    if (data.deletedFields) {
      const fieldManager = content.getSubstitutionFieldManager();
      for (const { offset, field } of data.deletedFields) {
        fieldManager.insertAt(data.position + offset, field);
      }
    }

    // Note: Object restoration would require more complex handling
    // For now, objects are restored via snapshot-based undo
  }

  private redoDelete(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as DeleteMutationData;
    content.deleteTextAt(data.position, data.deletedText.length);
  }

  private undoFormat(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as FormatMutationData;
    const fm = content.getFormattingManager();

    // Restore previous formatting
    data.previousFormatting.forEach((style, offset) => {
      fm.applyFormatting(data.start + offset, data.start + offset + 1, style);
    });
  }

  private redoFormat(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as FormatMutationData;
    const fm = content.getFormattingManager();
    fm.applyFormatting(data.start, data.end, data.newFormatting);
  }

  private undoAlignment(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as AlignmentMutationData;
    const pm = content.getParagraphFormattingManager();
    const paragraphBoundaries = content.getParagraphBoundaries();

    if (data.paragraphIndex < paragraphBoundaries.length) {
      pm.setAlignment(paragraphBoundaries[data.paragraphIndex], data.previousAlignment);
    }
  }

  private redoAlignment(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as AlignmentMutationData;
    const pm = content.getParagraphFormattingManager();
    const paragraphBoundaries = content.getParagraphBoundaries();

    if (data.paragraphIndex < paragraphBoundaries.length) {
      pm.setAlignment(paragraphBoundaries[data.paragraphIndex], data.newAlignment);
    }
  }

  private undoFieldInsert(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as FieldInsertMutationData;
    content.removeSubstitutionField(data.position);
  }

  private redoFieldInsert(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as FieldInsertMutationData;
    content.setCursorPosition(data.position);
    content.insertSubstitutionField(data.field.fieldName, {
      fieldType: data.field.fieldType,
      displayFormat: data.field.displayFormat,
      defaultValue: data.field.defaultValue,
      formatting: data.field.formatting
    });
  }

  private undoFieldUpdate(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as FieldUpdateMutationData;
    const fieldManager = content.getSubstitutionFieldManager();
    fieldManager.updateFieldConfig(data.textIndex, data.previousData);
  }

  private redoFieldUpdate(mutation: MutationRecord): void {
    const content = this.getContent(mutation.sourceId as ContentSourceId);
    if (!content) return;

    const data = mutation.data as FieldUpdateMutationData;
    const fieldManager = content.getSubstitutionFieldManager();
    fieldManager.updateFieldConfig(data.textIndex, data.newData);
  }

  // --- Object Mutations ---

  private undoResize(mutation: MutationRecord): void {
    const object = this.getObject(mutation.sourceId as ObjectSourceId);
    if (!object) return;

    const data = mutation.data as ResizeMutationData;
    object.width = data.previousSize.width;
    object.height = data.previousSize.height;
  }

  private redoResize(mutation: MutationRecord): void {
    const object = this.getObject(mutation.sourceId as ObjectSourceId);
    if (!object) return;

    const data = mutation.data as ResizeMutationData;
    object.width = data.newSize.width;
    object.height = data.newSize.height;
  }

  private undoMove(mutation: MutationRecord): void {
    const object = this.getObject(mutation.sourceId as ObjectSourceId);
    if (!object) return;

    const data = mutation.data as MoveMutationData;
    object.relativeOffset = data.previousOffset;
  }

  private redoMove(mutation: MutationRecord): void {
    const object = this.getObject(mutation.sourceId as ObjectSourceId);
    if (!object) return;

    const data = mutation.data as MoveMutationData;
    object.relativeOffset = data.newOffset;
  }

  private undoProperty(mutation: MutationRecord): void {
    const object = this.getObject(mutation.sourceId as ObjectSourceId);
    if (!object) return;

    const data = mutation.data as PropertyMutationData;
    (object as any)[data.propertyName] = data.previousValue;
  }

  private redoProperty(mutation: MutationRecord): void {
    const object = this.getObject(mutation.sourceId as ObjectSourceId);
    if (!object) return;

    const data = mutation.data as PropertyMutationData;
    (object as any)[data.propertyName] = data.newValue;
  }

  private undoTableStructure(mutation: MutationRecord): void {
    const object = this.getObject(mutation.sourceId as ObjectSourceId);
    if (!object || !(object instanceof TableObject)) return;

    const data = mutation.data as TableStructureMutationData;
    // Restore table from before snapshot
    if ('restoreFromData' in object && typeof (object as any).restoreFromData === 'function') {
      (object as any).restoreFromData(data.beforeSnapshot);
    }
  }

  private redoTableStructure(mutation: MutationRecord): void {
    const object = this.getObject(mutation.sourceId as ObjectSourceId);
    if (!object || !(object instanceof TableObject)) return;

    const data = mutation.data as TableStructureMutationData;
    // Restore table from after snapshot
    if ('restoreFromData' in object && typeof (object as any).restoreFromData === 'function') {
      (object as any).restoreFromData(data.afterSnapshot);
    }
  }
}
