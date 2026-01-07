import { EventEmitter } from '../events/EventEmitter';
import {
  SubstitutionField,
  SubstitutionFieldConfig,
  TextFormattingStyle,
  DEFAULT_FORMATTING
} from './types';

/**
 * Manages substitution fields within text content.
 * Substitution fields are atomic placeholders for data merge,
 * rendered as {{field: name}}.
 */
export class SubstitutionFieldManager extends EventEmitter {
  private fields: Map<number, SubstitutionField> = new Map();
  private nextId: number = 1;

  constructor() {
    super();
  }

  /**
   * Insert a new substitution field at a text index.
   * @param fieldName The name of the data field to substitute
   * @param textIndex The position in text where the \uFFFC placeholder is
   * @param config Optional configuration for the field
   */
  insert(
    fieldName: string,
    textIndex: number,
    config?: SubstitutionFieldConfig
  ): SubstitutionField {
    const id = `field-${this.nextId++}`;

    const field: SubstitutionField = {
      id,
      textIndex,
      fieldName,
      displayFormat: config?.displayFormat,
      defaultValue: config?.defaultValue,
      formatting: undefined
    };

    this.fields.set(textIndex, field);
    this.emit('field-added', { field });

    return field;
  }

  /**
   * Remove a substitution field at a specific text index.
   */
  remove(textIndex: number): SubstitutionField | undefined {
    const field = this.fields.get(textIndex);
    if (field) {
      this.fields.delete(textIndex);
      this.emit('field-removed', { field });
    }
    return field;
  }

  /**
   * Get a substitution field at a specific text index.
   */
  getFieldAt(textIndex: number): SubstitutionField | undefined {
    return this.fields.get(textIndex);
  }

  /**
   * Check if there is a substitution field at a specific text index.
   */
  hasFieldAt(textIndex: number): boolean {
    return this.fields.has(textIndex);
  }

  /**
   * Get all substitution fields.
   */
  getFields(): Map<number, SubstitutionField> {
    return new Map(this.fields);
  }

  /**
   * Get all substitution fields as an array, sorted by text index.
   */
  getFieldsArray(): SubstitutionField[] {
    return Array.from(this.fields.values())
      .sort((a, b) => a.textIndex - b.textIndex);
  }

  /**
   * Find a substitution field by its ID.
   */
  findById(id: string): SubstitutionField | undefined {
    for (const field of this.fields.values()) {
      if (field.id === id) {
        return field;
      }
    }
    return undefined;
  }

  /**
   * Find a substitution field by field name.
   * Returns the first match if there are multiple fields with the same name.
   */
  findByFieldName(fieldName: string): SubstitutionField | undefined {
    for (const field of this.fields.values()) {
      if (field.fieldName === fieldName) {
        return field;
      }
    }
    return undefined;
  }

  /**
   * Get all substitution fields with a specific field name.
   */
  findAllByFieldName(fieldName: string): SubstitutionField[] {
    return Array.from(this.fields.values())
      .filter(field => field.fieldName === fieldName);
  }

  /**
   * Shift field positions when text is inserted.
   * @param fromIndex The position where text was inserted
   * @param delta The number of characters inserted (positive)
   */
  shiftFields(fromIndex: number, delta: number): void {
    const updates: Array<{ oldIndex: number; field: SubstitutionField }> = [];

    for (const [textIndex, field] of this.fields) {
      if (textIndex >= fromIndex) {
        updates.push({ oldIndex: textIndex, field });
      }
    }

    // Remove old entries and add with new indices
    for (const { oldIndex, field } of updates) {
      this.fields.delete(oldIndex);
      field.textIndex = oldIndex + delta;
      this.fields.set(field.textIndex, field);
    }

    if (updates.length > 0) {
      this.emit('fields-shifted', { fromIndex, delta });
    }
  }

  /**
   * Handle deletion of text range.
   * Fields within the deleted range are removed.
   * Fields after the range are shifted.
   * @returns Array of removed fields
   */
  handleDeletion(start: number, length: number): SubstitutionField[] {
    const end = start + length;
    const removedFields: SubstitutionField[] = [];
    const updates: Array<{ oldIndex: number; field: SubstitutionField }> = [];

    for (const [textIndex, field] of this.fields) {
      if (textIndex >= start && textIndex < end) {
        // Field is within deleted range
        removedFields.push(field);
      } else if (textIndex >= end) {
        // Field is after deleted range, needs to shift
        updates.push({ oldIndex: textIndex, field });
      }
    }

    // Remove deleted fields
    for (const field of removedFields) {
      this.fields.delete(field.textIndex);
      this.emit('field-removed', { field });
    }

    // Shift remaining fields
    for (const { oldIndex, field } of updates) {
      this.fields.delete(oldIndex);
      field.textIndex = oldIndex - length;
      this.fields.set(field.textIndex, field);
    }

    if (removedFields.length > 0 || updates.length > 0) {
      this.emit('fields-changed');
    }

    return removedFields;
  }

  /**
   * Update a field's configuration.
   */
  updateFieldConfig(
    textIndex: number,
    config: Partial<SubstitutionFieldConfig & { fieldName?: string }>
  ): boolean {
    const field = this.fields.get(textIndex);
    if (!field) {
      return false;
    }

    if (config.fieldName !== undefined) {
      field.fieldName = config.fieldName;
    }
    if (config.displayFormat !== undefined) {
      field.displayFormat = config.displayFormat;
    }
    if (config.defaultValue !== undefined) {
      field.defaultValue = config.defaultValue;
    }

    this.emit('field-updated', { field });
    return true;
  }

  /**
   * Set formatting for a specific field.
   */
  setFieldFormatting(textIndex: number, formatting: TextFormattingStyle): boolean {
    const field = this.fields.get(textIndex);
    if (!field) {
      return false;
    }

    field.formatting = { ...formatting };
    this.emit('field-formatting-changed', { field });
    return true;
  }

  /**
   * Get formatting for a specific field.
   * Returns the field's custom formatting or default formatting.
   */
  getFieldFormatting(textIndex: number): TextFormattingStyle {
    const field = this.fields.get(textIndex);
    return field?.formatting || DEFAULT_FORMATTING;
  }

  /**
   * Get the display text for a substitution field.
   * This is what gets rendered: {{field: name}}
   */
  getDisplayText(field: SubstitutionField): string {
    return `{{field: ${field.fieldName}}}`;
  }

  /**
   * Get the display text for a field at a specific index.
   */
  getDisplayTextAt(textIndex: number): string | undefined {
    const field = this.fields.get(textIndex);
    if (!field) {
      return undefined;
    }
    return this.getDisplayText(field);
  }

  /**
   * Get the number of substitution fields.
   */
  get count(): number {
    return this.fields.size;
  }

  /**
   * Check if there are any substitution fields.
   */
  get isEmpty(): boolean {
    return this.fields.size === 0;
  }

  /**
   * Clear all substitution fields.
   */
  clear(): void {
    const hadFields = this.fields.size > 0;
    this.fields.clear();
    if (hadFields) {
      this.emit('fields-cleared');
    }
  }

  /**
   * Serialize all fields to JSON.
   */
  toJSON(): SubstitutionField[] {
    return this.getFieldsArray();
  }

  /**
   * Load fields from serialized data.
   */
  fromJSON(data: SubstitutionField[]): void {
    this.clear();

    for (const fieldData of data) {
      const field: SubstitutionField = {
        id: fieldData.id,
        textIndex: fieldData.textIndex,
        fieldName: fieldData.fieldName,
        displayFormat: fieldData.displayFormat,
        defaultValue: fieldData.defaultValue,
        formatting: fieldData.formatting ? { ...fieldData.formatting } : undefined
      };

      this.fields.set(field.textIndex, field);

      // Update nextId to avoid collisions
      const idNum = parseInt(fieldData.id.replace('field-', ''), 10);
      if (!isNaN(idNum) && idNum >= this.nextId) {
        this.nextId = idNum + 1;
      }
    }

    this.emit('fields-loaded', { count: this.fields.size });
  }
}
