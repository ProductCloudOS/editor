/**
 * SubstitutionFieldPane - Edit substitution field properties.
 *
 * Shows:
 * - Field name
 * - Default value
 * - Format configuration (value type, number/currency/date formats)
 *
 * Uses the PCEditor public API:
 * - editor.getFieldAt()
 * - editor.updateField()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';
import type { SubstitutionField, SubstitutionFieldConfig } from '../text';

/**
 * Options for SubstitutionFieldPane.
 */
export interface SubstitutionFieldPaneOptions {
  className?: string;
  /**
   * Callback when field changes are applied.
   */
  onApply?: (success: boolean, error?: Error) => void;
}

export class SubstitutionFieldPane extends BasePane {
  private fieldNameInput: HTMLInputElement | null = null;
  private fieldDefaultInput: HTMLInputElement | null = null;
  private valueTypeSelect: HTMLSelectElement | null = null;
  private numberFormatSelect: HTMLSelectElement | null = null;
  private currencyFormatSelect: HTMLSelectElement | null = null;
  private dateFormatSelect: HTMLSelectElement | null = null;
  private positionHint: HTMLElement | null = null;

  private numberFormatGroup: HTMLElement | null = null;
  private currencyFormatGroup: HTMLElement | null = null;
  private dateFormatGroup: HTMLElement | null = null;

  private currentField: SubstitutionField | null = null;
  private onApplyCallback?: (success: boolean, error?: Error) => void;

  constructor(id: string = 'substitution-field', options: SubstitutionFieldPaneOptions = {}) {
    super(id, { className: 'pc-pane-substitution-field', ...options });
    this.onApplyCallback = options.onApply;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    if (this.editor) {
      // Listen for field selection events
      const selectionHandler = (event: { type?: string; field?: SubstitutionField }) => {
        if (event.type === 'field' && event.field) {
          this.showField(event.field);
        } else if (!event.type || event.type !== 'field') {
          // Don't hide if some other selection type happens - let the consumer manage visibility
        }
      };

      this.editor.on('selection-change', selectionHandler);
      this.eventCleanup.push(() => {
        this.editor?.off('selection-change', selectionHandler);
      });
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Field name input
    this.fieldNameInput = this.createTextInput({ placeholder: 'Field name' });
    container.appendChild(this.createFormGroup('Field Name', this.fieldNameInput));

    // Default value input
    this.fieldDefaultInput = this.createTextInput({ placeholder: 'Default value (optional)' });
    container.appendChild(this.createFormGroup('Default Value', this.fieldDefaultInput));

    // Value type select
    this.valueTypeSelect = this.createSelect([
      { value: '', label: '(None)' },
      { value: 'number', label: 'Number' },
      { value: 'currency', label: 'Currency' },
      { value: 'date', label: 'Date' }
    ]);
    this.addImmediateApplyListener(this.valueTypeSelect, () => this.updateFormatGroups());
    container.appendChild(this.createFormGroup('Value Type', this.valueTypeSelect));

    // Number format group
    this.numberFormatGroup = this.createSection();
    this.numberFormatGroup.style.display = 'none';
    this.numberFormatSelect = this.createSelect([
      { value: '0', label: 'Integer (0)' },
      { value: '0.00', label: 'Two decimals (0.00)' },
      { value: '0,0', label: 'Thousands separator (0,0)' },
      { value: '0,0.00', label: 'Thousands + decimals (0,0.00)' }
    ]);
    this.numberFormatGroup.appendChild(this.createFormGroup('Number Format', this.numberFormatSelect));
    container.appendChild(this.numberFormatGroup);

    // Currency format group
    this.currencyFormatGroup = this.createSection();
    this.currencyFormatGroup.style.display = 'none';
    this.currencyFormatSelect = this.createSelect([
      { value: 'USD', label: 'USD ($)' },
      { value: 'EUR', label: 'EUR' },
      { value: 'GBP', label: 'GBP' },
      { value: 'JPY', label: 'JPY' }
    ]);
    this.currencyFormatGroup.appendChild(this.createFormGroup('Currency', this.currencyFormatSelect));
    container.appendChild(this.currencyFormatGroup);

    // Date format group
    this.dateFormatGroup = this.createSection();
    this.dateFormatGroup.style.display = 'none';
    this.dateFormatSelect = this.createSelect([
      { value: 'MMMM D, YYYY', label: 'January 1, 2026' },
      { value: 'MM/DD/YYYY', label: '01/01/2026' },
      { value: 'DD/MM/YYYY', label: '01/01/2026 (EU)' },
      { value: 'YYYY-MM-DD', label: '2026-01-01 (ISO)' }
    ]);
    this.dateFormatGroup.appendChild(this.createFormGroup('Date Format', this.dateFormatSelect));
    container.appendChild(this.dateFormatGroup);

    // Apply button
    const applyBtn = this.createButton('Apply Changes', { variant: 'primary' });
    this.addButtonListener(applyBtn, () => this.applyChanges());
    container.appendChild(applyBtn);

    // Position hint
    this.positionHint = this.createHint('');
    container.appendChild(this.positionHint);

    return container;
  }

  private updateFormatGroups(): void {
    const valueType = this.valueTypeSelect?.value || '';

    if (this.numberFormatGroup) {
      this.numberFormatGroup.style.display = valueType === 'number' ? 'block' : 'none';
    }
    if (this.currencyFormatGroup) {
      this.currencyFormatGroup.style.display = valueType === 'currency' ? 'block' : 'none';
    }
    if (this.dateFormatGroup) {
      this.dateFormatGroup.style.display = valueType === 'date' ? 'block' : 'none';
    }
  }

  /**
   * Show the pane with the given field.
   */
  showField(field: SubstitutionField): void {
    this.currentField = field;

    if (this.fieldNameInput) {
      this.fieldNameInput.value = field.fieldName;
    }
    if (this.fieldDefaultInput) {
      this.fieldDefaultInput.value = field.defaultValue || '';
    }
    if (this.positionHint) {
      this.positionHint.textContent = `Field at position ${field.textIndex}`;
    }

    // Populate format options
    if (this.valueTypeSelect) {
      this.valueTypeSelect.value = field.formatConfig?.valueType || '';
    }
    if (this.numberFormatSelect && field.formatConfig?.numberFormat) {
      this.numberFormatSelect.value = field.formatConfig.numberFormat;
    }
    if (this.currencyFormatSelect && field.formatConfig?.currencyFormat) {
      this.currencyFormatSelect.value = field.formatConfig.currencyFormat;
    }
    if (this.dateFormatSelect && field.formatConfig?.dateFormat) {
      this.dateFormatSelect.value = field.formatConfig.dateFormat;
    }

    this.updateFormatGroups();
    this.show();
  }

  /**
   * Hide the pane and clear the current field.
   */
  hideField(): void {
    this.currentField = null;
    this.hide();
  }

  private applyChanges(): void {
    if (!this.editor || !this.currentField) {
      this.onApplyCallback?.(false, new Error('No field selected'));
      return;
    }

    const fieldName = this.fieldNameInput?.value.trim();
    if (!fieldName) {
      this.onApplyCallback?.(false, new Error('Field name cannot be empty'));
      return;
    }

    const updates: {
      fieldName?: string;
      defaultValue?: string;
      formatConfig?: SubstitutionFieldConfig['formatConfig'];
    } = {};

    if (fieldName !== this.currentField.fieldName) {
      updates.fieldName = fieldName;
    }

    const defaultValue = this.fieldDefaultInput?.value || undefined;
    if (defaultValue !== this.currentField.defaultValue) {
      updates.defaultValue = defaultValue;
    }

    // Build format config
    const valueType = this.valueTypeSelect?.value as 'number' | 'currency' | 'date' | '';
    if (valueType) {
      const formatConfig: NonNullable<SubstitutionFieldConfig['formatConfig']> = {
        valueType: valueType as 'number' | 'currency' | 'date'
      };

      if (valueType === 'number' && this.numberFormatSelect?.value) {
        formatConfig.numberFormat = this.numberFormatSelect.value;
      } else if (valueType === 'currency' && this.currencyFormatSelect?.value) {
        formatConfig.currencyFormat = this.currencyFormatSelect.value as 'USD' | 'EUR' | 'GBP' | 'JPY';
      } else if (valueType === 'date' && this.dateFormatSelect?.value) {
        formatConfig.dateFormat = this.dateFormatSelect.value;
      }

      updates.formatConfig = formatConfig;
    } else if (this.currentField.formatConfig) {
      updates.formatConfig = undefined;
    }

    if (Object.keys(updates).length === 0) {
      return; // No changes
    }

    try {
      const success = this.editor.updateField(this.currentField.textIndex, updates);

      if (success) {
        // Update the current field reference
        this.currentField = this.editor.getFieldAt(this.currentField.textIndex) || null;
        this.onApplyCallback?.(true);
      } else {
        this.onApplyCallback?.(false, new Error('Failed to update field'));
      }
    } catch (error) {
      this.onApplyCallback?.(false, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get the currently selected field.
   */
  getCurrentField(): SubstitutionField | null {
    return this.currentField;
  }

  /**
   * Check if a field is currently selected.
   */
  hasField(): boolean {
    return this.currentField !== null;
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    // Field pane doesn't auto-update - it's driven by selection events
  }
}
