/**
 * MergeDataPane - JSON data input for mail merge/substitution.
 *
 * Uses the PCEditor public API:
 * - editor.applyMergeData()
 */

import { BasePane } from './BasePane';
import type { PaneOptions } from './types';

/**
 * Options for MergeDataPane.
 */
export interface MergeDataPaneOptions extends PaneOptions {
  /**
   * Initial JSON data to display.
   */
  initialData?: Record<string, unknown>;
  /**
   * Placeholder text for the textarea.
   */
  placeholder?: string;
  /**
   * Number of visible rows for the textarea.
   */
  rows?: number;
  /**
   * Callback when merge data is applied (for status messages).
   */
  onApply?: (success: boolean, error?: Error) => void;
}

export class MergeDataPane extends BasePane {
  private textarea: HTMLTextAreaElement | null = null;
  private errorHint: HTMLElement | null = null;
  private initialData?: Record<string, unknown>;
  private placeholder: string;
  private rows: number;
  private onApply?: (success: boolean, error?: Error) => void;

  constructor(id: string = 'merge-data', options: MergeDataPaneOptions = {}) {
    super(id, { className: 'pc-pane-merge-data', ...options });
    this.initialData = options.initialData;
    this.placeholder = options.placeholder || '{"customerName": "John Doe", "orderNumber": "12345"}';
    this.rows = options.rows ?? 10;
    this.onApply = options.onApply;
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Textarea for JSON
    const textareaGroup = this.createFormGroup('JSON Data', this.createTextarea());
    container.appendChild(textareaGroup);

    // Error hint (hidden by default)
    this.errorHint = this.createHint('');
    this.errorHint.style.display = 'none';
    this.errorHint.style.color = '#dc3545';
    container.appendChild(this.errorHint);

    // Apply button
    const applyBtn = this.createButton('Apply Merge Data', { variant: 'primary' });
    this.addButtonListener(applyBtn, () => this.applyMergeData());
    container.appendChild(applyBtn);

    return container;
  }

  private createTextarea(): HTMLTextAreaElement {
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'pc-pane-textarea pc-pane-merge-data-input';
    this.textarea.rows = this.rows;
    this.textarea.placeholder = this.placeholder;
    this.textarea.spellcheck = false;

    if (this.initialData) {
      this.textarea.value = JSON.stringify(this.initialData, null, 2);
    }

    // Clear error on input
    this.textarea.addEventListener('input', () => {
      if (this.errorHint) {
        this.errorHint.style.display = 'none';
      }
    });

    return this.textarea;
  }

  private applyMergeData(): void {
    if (!this.editor || !this.textarea) return;

    try {
      const mergeData = JSON.parse(this.textarea.value);
      this.editor.applyMergeData(mergeData);

      if (this.errorHint) {
        this.errorHint.style.display = 'none';
      }

      this.onApply?.(true);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (this.errorHint) {
        if (error instanceof SyntaxError) {
          this.errorHint.textContent = 'Invalid JSON syntax';
        } else {
          this.errorHint.textContent = err.message;
        }
        this.errorHint.style.display = 'block';
      }

      this.onApply?.(false, err);
    }
  }

  /**
   * Get the current JSON data from the textarea.
   * Returns null if the JSON is invalid.
   */
  getData(): Record<string, unknown> | null {
    if (!this.textarea) return null;

    try {
      return JSON.parse(this.textarea.value);
    } catch {
      return null;
    }
  }

  /**
   * Set the JSON data in the textarea.
   */
  setData(data: Record<string, unknown>): void {
    if (this.textarea) {
      this.textarea.value = JSON.stringify(data, null, 2);
      if (this.errorHint) {
        this.errorHint.style.display = 'none';
      }
    }
  }

  /**
   * Update the pane (no-op for MergeDataPane as it doesn't track editor state).
   */
  update(): void {
    // MergeDataPane doesn't need to update from editor state
  }
}
