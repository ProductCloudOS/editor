/**
 * TableRowLoopPane - Edit table row loop properties.
 *
 * Shows:
 * - Field path (array property in merge data)
 * - Row range information
 *
 * Uses the TableObject API:
 * - table.getRowLoop()
 * - table.updateRowLoopFieldPath()
 * - table.removeRowLoop()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';
import type { TableObject } from '../objects';
import type { TableRowLoop } from '../objects/table/types';

/**
 * Options for TableRowLoopPane.
 */
export interface TableRowLoopPaneOptions {
  className?: string;
  /**
   * Callback when loop changes are applied.
   */
  onApply?: (success: boolean, error?: Error) => void;
  /**
   * Callback when loop is removed.
   */
  onRemove?: (success: boolean) => void;
}

export class TableRowLoopPane extends BasePane {
  private fieldPathInput: HTMLInputElement | null = null;
  private rangeHint: HTMLElement | null = null;
  private currentLoop: TableRowLoop | null = null;
  private currentTable: TableObject | null = null;
  private onApplyCallback?: (success: boolean, error?: Error) => void;
  private onRemoveCallback?: (success: boolean) => void;

  constructor(id: string = 'table-row-loop', options: TableRowLoopPaneOptions = {}) {
    super(id, { className: 'pc-pane-table-row-loop', ...options });
    this.onApplyCallback = options.onApply;
    this.onRemoveCallback = options.onRemove;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    // Table row loop pane is typically shown manually when a table's row loop is selected
    // The consumer is responsible for calling showLoop() with the table and loop
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Field path input
    this.fieldPathInput = this.createTextInput({ placeholder: 'items' });
    container.appendChild(this.createFormGroup('Array Field Path', this.fieldPathInput, {
      hint: 'Path to array in merge data (e.g., "items" or "orders")'
    }));

    // Apply button
    const applyBtn = this.createButton('Apply Changes', { variant: 'primary' });
    this.addButtonListener(applyBtn, () => this.applyChanges());
    container.appendChild(applyBtn);

    // Remove button
    const removeBtn = this.createButton('Remove Loop', { variant: 'danger' });
    removeBtn.style.marginTop = '0.5rem';
    this.addButtonListener(removeBtn, () => this.removeLoop());
    container.appendChild(removeBtn);

    // Range hint
    this.rangeHint = this.createHint('');
    container.appendChild(this.rangeHint);

    return container;
  }

  /**
   * Show the pane with the given table and loop.
   */
  showLoop(table: TableObject, loop: TableRowLoop): void {
    this.currentTable = table;
    this.currentLoop = loop;

    if (this.fieldPathInput) {
      this.fieldPathInput.value = loop.fieldPath;
    }
    if (this.rangeHint) {
      this.rangeHint.textContent = `Rows ${loop.startRowIndex} - ${loop.endRowIndex}`;
    }

    this.show();
  }

  /**
   * Hide the pane and clear current loop.
   */
  hideLoop(): void {
    this.currentTable = null;
    this.currentLoop = null;
    this.hide();
  }

  private applyChanges(): void {
    if (!this.currentTable || !this.currentLoop) {
      this.onApplyCallback?.(false, new Error('No loop selected'));
      return;
    }

    const fieldPath = this.fieldPathInput?.value.trim();
    if (!fieldPath) {
      this.onApplyCallback?.(false, new Error('Field path cannot be empty'));
      return;
    }

    if (fieldPath === this.currentLoop.fieldPath) {
      return; // No changes
    }

    try {
      const success = this.currentTable.updateRowLoopFieldPath(this.currentLoop.id, fieldPath);

      if (success) {
        // Update the current loop reference
        this.currentLoop = this.currentTable.getRowLoop(this.currentLoop.id) || null;
        if (this.currentLoop) {
          this.showLoop(this.currentTable, this.currentLoop);
        }
        this.onApplyCallback?.(true);
      } else {
        this.onApplyCallback?.(false, new Error('Failed to update loop'));
      }
    } catch (error) {
      this.onApplyCallback?.(false, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private removeLoop(): void {
    if (!this.currentTable || !this.currentLoop) return;

    try {
      const success = this.currentTable.removeRowLoop(this.currentLoop.id);
      if (success) {
        this.hideLoop();
        this.onRemoveCallback?.(true);
      } else {
        this.onRemoveCallback?.(false);
      }
    } catch {
      this.onRemoveCallback?.(false);
    }
  }

  /**
   * Get the currently selected loop.
   */
  getCurrentLoop(): TableRowLoop | null {
    return this.currentLoop;
  }

  /**
   * Get the currently selected table.
   */
  getCurrentTable(): TableObject | null {
    return this.currentTable;
  }

  /**
   * Check if a loop is currently selected.
   */
  hasLoop(): boolean {
    return this.currentLoop !== null;
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    // Table row loop pane doesn't auto-update - it's driven by showLoop() calls
  }
}
