/**
 * TablePane - Edit table properties.
 *
 * Shows:
 * - Table structure (row/column count)
 * - Row/column insertion/removal
 * - Header rows/columns
 * - Default cell padding and border color
 * - Cell-specific formatting (background, borders)
 *
 * Uses the PCEditor public API:
 * - editor.getFocusedTable()
 * - editor.tableInsertRow()
 * - editor.tableRemoveRow()
 * - editor.tableInsertColumn()
 * - editor.tableRemoveColumn()
 *
 * And TableObject methods:
 * - table.setHeaderRowCount()
 * - table.setHeaderColumnCount()
 * - table.getCell()
 * - table.getCellsInRange()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions, BorderConfig } from './types';
import type { TableObject } from '../objects';

/**
 * Options for TablePane.
 */
export interface TablePaneOptions {
  className?: string;
  /**
   * Callback when table changes are applied.
   */
  onApply?: (success: boolean, error?: Error) => void;
}

export class TablePane extends BasePane {
  // Structure info
  private rowCountDisplay: HTMLElement | null = null;
  private colCountDisplay: HTMLElement | null = null;
  private cellSelectionDisplay: HTMLElement | null = null;

  // Header controls
  private headerRowInput: HTMLInputElement | null = null;
  private headerColInput: HTMLInputElement | null = null;

  // Default controls
  private defaultPaddingInput: HTMLInputElement | null = null;
  private defaultBorderColorInput: HTMLInputElement | null = null;

  // Cell formatting controls
  private cellBgColorInput: HTMLInputElement | null = null;
  private borderTopCheck: HTMLInputElement | null = null;
  private borderRightCheck: HTMLInputElement | null = null;
  private borderBottomCheck: HTMLInputElement | null = null;
  private borderLeftCheck: HTMLInputElement | null = null;
  private borderWidthInput: HTMLInputElement | null = null;
  private borderColorInput: HTMLInputElement | null = null;
  private borderStyleSelect: HTMLSelectElement | null = null;

  private currentTable: TableObject | null = null;
  private onApplyCallback?: (success: boolean, error?: Error) => void;

  constructor(id: string = 'table', options: TablePaneOptions = {}) {
    super(id, { className: 'pc-pane-table', ...options });
    this.onApplyCallback = options.onApply;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    if (this.editor) {
      // Listen for selection/focus changes
      const updateHandler = () => this.updateFromFocusedTable();
      this.editor.on('selection-change', updateHandler);
      this.editor.on('table-cell-focus', updateHandler);
      this.editor.on('table-cell-selection', updateHandler);

      this.eventCleanup.push(() => {
        this.editor?.off('selection-change', updateHandler);
        this.editor?.off('table-cell-focus', updateHandler);
        this.editor?.off('table-cell-selection', updateHandler);
      });

      // Initial update
      this.updateFromFocusedTable();
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Structure section
    const structureSection = this.createSection('Structure');
    const structureInfo = document.createElement('div');
    structureInfo.className = 'pc-pane-info-list';

    this.rowCountDisplay = document.createElement('span');
    this.colCountDisplay = document.createElement('span');

    const rowInfo = document.createElement('div');
    rowInfo.className = 'pc-pane-info';
    rowInfo.innerHTML = '<span class="pc-pane-info-label">Rows</span>';
    rowInfo.appendChild(this.rowCountDisplay);

    const colInfo = document.createElement('div');
    colInfo.className = 'pc-pane-info';
    colInfo.innerHTML = '<span class="pc-pane-info-label">Columns</span>';
    colInfo.appendChild(this.colCountDisplay);

    structureInfo.appendChild(rowInfo);
    structureInfo.appendChild(colInfo);
    structureSection.appendChild(structureInfo);

    // Row/column buttons
    const structureBtns = this.createButtonGroup();
    const addRowBtn = this.createButton('+ Row');
    this.addButtonListener(addRowBtn, () => this.insertRow());
    const removeRowBtn = this.createButton('- Row');
    this.addButtonListener(removeRowBtn, () => this.removeRow());
    const addColBtn = this.createButton('+ Column');
    this.addButtonListener(addColBtn, () => this.insertColumn());
    const removeColBtn = this.createButton('- Column');
    this.addButtonListener(removeColBtn, () => this.removeColumn());

    structureBtns.appendChild(addRowBtn);
    structureBtns.appendChild(removeRowBtn);
    structureBtns.appendChild(addColBtn);
    structureBtns.appendChild(removeColBtn);
    structureSection.appendChild(structureBtns);
    container.appendChild(structureSection);

    // Headers section
    const headersSection = this.createSection('Headers');
    const headerRow = this.createRow();
    this.headerRowInput = this.createNumberInput({ min: 0, max: 10, value: 0 });
    this.headerColInput = this.createNumberInput({ min: 0, max: 10, value: 0 });
    headerRow.appendChild(this.createFormGroup('Header Rows', this.headerRowInput, { inline: true }));
    headerRow.appendChild(this.createFormGroup('Header Cols', this.headerColInput, { inline: true }));
    headersSection.appendChild(headerRow);

    const applyHeadersBtn = this.createButton('Apply Headers');
    this.addButtonListener(applyHeadersBtn, () => this.applyHeaders());
    headersSection.appendChild(applyHeadersBtn);
    container.appendChild(headersSection);

    // Defaults section
    const defaultsSection = this.createSection('Defaults');
    const defaultsRow = this.createRow();
    this.defaultPaddingInput = this.createNumberInput({ min: 0, max: 20, value: 8 });
    this.defaultBorderColorInput = this.createColorInput('#cccccc');
    defaultsRow.appendChild(this.createFormGroup('Padding', this.defaultPaddingInput, { inline: true }));
    defaultsRow.appendChild(this.createFormGroup('Border', this.defaultBorderColorInput, { inline: true }));
    defaultsSection.appendChild(defaultsRow);

    const applyDefaultsBtn = this.createButton('Apply Defaults');
    this.addButtonListener(applyDefaultsBtn, () => this.applyDefaults());
    defaultsSection.appendChild(applyDefaultsBtn);
    container.appendChild(defaultsSection);

    // Cell formatting section
    const cellSection = this.createSection('Cell Formatting');

    this.cellSelectionDisplay = this.createHint('No cell selected');
    cellSection.appendChild(this.cellSelectionDisplay);

    // Background
    this.cellBgColorInput = this.createColorInput('#ffffff');
    cellSection.appendChild(this.createFormGroup('Background', this.cellBgColorInput));

    // Border checkboxes
    const borderChecks = document.createElement('div');
    borderChecks.className = 'pc-pane-row';
    borderChecks.style.flexWrap = 'wrap';
    borderChecks.style.gap = '4px';

    this.borderTopCheck = document.createElement('input');
    this.borderTopCheck.type = 'checkbox';
    this.borderTopCheck.checked = true;
    this.borderRightCheck = document.createElement('input');
    this.borderRightCheck.type = 'checkbox';
    this.borderRightCheck.checked = true;
    this.borderBottomCheck = document.createElement('input');
    this.borderBottomCheck.type = 'checkbox';
    this.borderBottomCheck.checked = true;
    this.borderLeftCheck = document.createElement('input');
    this.borderLeftCheck.type = 'checkbox';
    this.borderLeftCheck.checked = true;

    borderChecks.appendChild(this.createCheckbox('Top', true));
    borderChecks.appendChild(this.createCheckbox('Right', true));
    borderChecks.appendChild(this.createCheckbox('Bottom', true));
    borderChecks.appendChild(this.createCheckbox('Left', true));

    // Replace created checkboxes with our tracked ones
    const checkLabels = borderChecks.querySelectorAll('label');
    if (checkLabels[0]) checkLabels[0].replaceChild(this.borderTopCheck, checkLabels[0].querySelector('input')!);
    if (checkLabels[1]) checkLabels[1].replaceChild(this.borderRightCheck, checkLabels[1].querySelector('input')!);
    if (checkLabels[2]) checkLabels[2].replaceChild(this.borderBottomCheck, checkLabels[2].querySelector('input')!);
    if (checkLabels[3]) checkLabels[3].replaceChild(this.borderLeftCheck, checkLabels[3].querySelector('input')!);

    cellSection.appendChild(this.createFormGroup('Borders', borderChecks));

    // Border properties
    const borderPropsRow = this.createRow();
    this.borderWidthInput = this.createNumberInput({ min: 0, max: 5, value: 1 });
    this.borderColorInput = this.createColorInput('#cccccc');
    borderPropsRow.appendChild(this.createFormGroup('Width', this.borderWidthInput, { inline: true }));
    borderPropsRow.appendChild(this.createFormGroup('Color', this.borderColorInput, { inline: true }));
    cellSection.appendChild(borderPropsRow);

    this.borderStyleSelect = this.createSelect([
      { value: 'solid', label: 'Solid' },
      { value: 'dashed', label: 'Dashed' },
      { value: 'dotted', label: 'Dotted' },
      { value: 'none', label: 'None' }
    ], 'solid');
    cellSection.appendChild(this.createFormGroup('Style', this.borderStyleSelect));

    const applyCellBtn = this.createButton('Apply to Cell(s)', { variant: 'primary' });
    this.addButtonListener(applyCellBtn, () => this.applyCellFormatting());
    cellSection.appendChild(applyCellBtn);

    container.appendChild(cellSection);

    return container;
  }

  private updateFromFocusedTable(): void {
    if (!this.editor) return;

    const table = this.editor.getFocusedTable();

    if (table) {
      this.showTable(table);
    } else {
      this.hideTable();
    }
  }

  /**
   * Show the pane with the given table.
   */
  showTable(table: TableObject): void {
    this.currentTable = table;

    // Update structure info
    if (this.rowCountDisplay) {
      this.rowCountDisplay.textContent = String(table.rowCount);
      this.rowCountDisplay.className = 'pc-pane-info-value';
    }
    if (this.colCountDisplay) {
      this.colCountDisplay.textContent = String(table.columnCount);
      this.colCountDisplay.className = 'pc-pane-info-value';
    }

    // Update header counts
    if (this.headerRowInput) {
      this.headerRowInput.value = String(table.headerRowCount);
    }
    if (this.headerColInput) {
      this.headerColInput.value = String(table.headerColumnCount);
    }

    // Update defaults
    if (this.defaultPaddingInput) {
      this.defaultPaddingInput.value = String(table.defaultCellPadding);
    }
    if (this.defaultBorderColorInput) {
      this.defaultBorderColorInput.value = table.defaultBorderColor;
    }

    // Update cell selection info
    this.updateCellSelectionInfo(table);

    this.show();
  }

  /**
   * Hide the pane and clear current table.
   */
  hideTable(): void {
    this.currentTable = null;
    this.hide();
  }

  private updateCellSelectionInfo(table: TableObject): void {
    if (!this.cellSelectionDisplay) return;

    const focusedCell = table.focusedCell;
    const selectedRange = table.selectedRange;

    if (selectedRange) {
      const count = (selectedRange.end.row - selectedRange.start.row + 1) *
                    (selectedRange.end.col - selectedRange.start.col + 1);
      this.cellSelectionDisplay.textContent = `${count} cells selected`;
    } else if (focusedCell) {
      this.cellSelectionDisplay.textContent = `Cell [${focusedCell.row}, ${focusedCell.col}]`;

      // Update cell formatting controls from focused cell
      const cell = table.getCell(focusedCell.row, focusedCell.col);
      if (cell) {
        if (this.cellBgColorInput) {
          this.cellBgColorInput.value = cell.backgroundColor || '#ffffff';
        }

        // Update border controls
        const border = cell.border;
        if (this.borderTopCheck) this.borderTopCheck.checked = border.top.style !== 'none';
        if (this.borderRightCheck) this.borderRightCheck.checked = border.right.style !== 'none';
        if (this.borderBottomCheck) this.borderBottomCheck.checked = border.bottom.style !== 'none';
        if (this.borderLeftCheck) this.borderLeftCheck.checked = border.left.style !== 'none';

        // Use first active border for properties
        const activeBorder = border.top.style !== 'none' ? border.top :
                            border.right.style !== 'none' ? border.right :
                            border.bottom.style !== 'none' ? border.bottom :
                            border.left.style !== 'none' ? border.left : border.top;

        if (this.borderWidthInput) this.borderWidthInput.value = String(activeBorder.width);
        if (this.borderColorInput) this.borderColorInput.value = activeBorder.color;
        if (this.borderStyleSelect) this.borderStyleSelect.value = activeBorder.style;
      }
    } else {
      this.cellSelectionDisplay.textContent = 'No cell selected';
    }
  }

  private insertRow(): void {
    if (!this.editor || !this.currentTable) return;
    const focusedCell = this.currentTable.focusedCell;
    const rowIndex = focusedCell ? focusedCell.row + 1 : this.currentTable.rowCount;
    this.editor.tableInsertRow(this.currentTable, rowIndex);
    this.updateFromFocusedTable();
  }

  private removeRow(): void {
    if (!this.editor || !this.currentTable) return;
    const focusedCell = this.currentTable.focusedCell;
    if (focusedCell && this.currentTable.rowCount > 1) {
      this.editor.tableRemoveRow(this.currentTable, focusedCell.row);
      this.updateFromFocusedTable();
    }
  }

  private insertColumn(): void {
    if (!this.editor || !this.currentTable) return;
    const focusedCell = this.currentTable.focusedCell;
    const colIndex = focusedCell ? focusedCell.col + 1 : this.currentTable.columnCount;
    this.editor.tableInsertColumn(this.currentTable, colIndex);
    this.updateFromFocusedTable();
  }

  private removeColumn(): void {
    if (!this.editor || !this.currentTable) return;
    const focusedCell = this.currentTable.focusedCell;
    if (focusedCell && this.currentTable.columnCount > 1) {
      this.editor.tableRemoveColumn(this.currentTable, focusedCell.col);
      this.updateFromFocusedTable();
    }
  }

  private applyHeaders(): void {
    if (!this.currentTable) return;

    if (this.headerRowInput) {
      const count = parseInt(this.headerRowInput.value, 10);
      this.currentTable.setHeaderRowCount(count);
    }
    if (this.headerColInput) {
      const count = parseInt(this.headerColInput.value, 10);
      this.currentTable.setHeaderColumnCount(count);
    }

    this.editor?.render();
    this.onApplyCallback?.(true);
  }

  private applyDefaults(): void {
    if (!this.currentTable) return;

    if (this.defaultPaddingInput) {
      this.currentTable.defaultCellPadding = parseInt(this.defaultPaddingInput.value, 10);
    }
    if (this.defaultBorderColorInput) {
      this.currentTable.defaultBorderColor = this.defaultBorderColorInput.value;
    }

    this.editor?.render();
    this.onApplyCallback?.(true);
  }

  private applyCellFormatting(): void {
    if (!this.currentTable) return;

    const focusedCell = this.currentTable.focusedCell;
    const selectedRange = this.currentTable.selectedRange;

    // Determine cells to update
    const cells: Array<{ row: number; col: number }> = [];

    if (selectedRange) {
      for (let row = selectedRange.start.row; row <= selectedRange.end.row; row++) {
        for (let col = selectedRange.start.col; col <= selectedRange.end.col; col++) {
          cells.push({ row, col });
        }
      }
    } else if (focusedCell) {
      cells.push(focusedCell);
    }

    if (cells.length === 0) return;

    // Build border config
    const width = parseInt(this.borderWidthInput?.value || '1', 10);
    const color = this.borderColorInput?.value || '#cccccc';
    const style = (this.borderStyleSelect?.value || 'solid') as 'solid' | 'dashed' | 'dotted' | 'none';

    const borderSide = { width, color, style };
    const noneBorder = { width: 0, color: '#000000', style: 'none' as const };

    const border: BorderConfig = {
      top: this.borderTopCheck?.checked ? { ...borderSide } : { ...noneBorder },
      right: this.borderRightCheck?.checked ? { ...borderSide } : { ...noneBorder },
      bottom: this.borderBottomCheck?.checked ? { ...borderSide } : { ...noneBorder },
      left: this.borderLeftCheck?.checked ? { ...borderSide } : { ...noneBorder }
    };

    const bgColor = this.cellBgColorInput?.value;

    // Apply to each cell
    for (const { row, col } of cells) {
      const cell = this.currentTable.getCell(row, col);
      if (cell) {
        if (bgColor) {
          cell.backgroundColor = bgColor;
        }
        cell.border = border;
      }
    }

    this.editor?.render();
    this.onApplyCallback?.(true);
  }

  /**
   * Get the currently focused table.
   */
  getCurrentTable(): TableObject | null {
    return this.currentTable;
  }

  /**
   * Check if a table is currently focused.
   */
  hasTable(): boolean {
    return this.currentTable !== null;
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    this.updateFromFocusedTable();
  }
}
