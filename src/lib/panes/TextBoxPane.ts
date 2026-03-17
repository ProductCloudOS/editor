/**
 * TextBoxPane - Edit text box properties.
 *
 * Shows:
 * - Position (inline, block, relative)
 * - Relative offset (for relative positioning)
 * - Background color
 * - Border (width, color, style)
 * - Padding
 *
 * Uses the PCEditor public API:
 * - editor.getSelectedTextBox()
 * - editor.updateTextBox()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';
import type { TextBoxObject } from '../objects';

/**
 * Options for TextBoxPane.
 */
export interface TextBoxPaneOptions {
  className?: string;
  /**
   * Callback when text box changes are applied.
   */
  onApply?: (success: boolean, error?: Error) => void;
}

export class TextBoxPane extends BasePane {
  private positionSelect: HTMLSelectElement | null = null;
  private offsetGroup: HTMLElement | null = null;
  private offsetXInput: HTMLInputElement | null = null;
  private offsetYInput: HTMLInputElement | null = null;
  private bgColorInput: HTMLInputElement | null = null;
  private borderWidthInput: HTMLInputElement | null = null;
  private borderColorInput: HTMLInputElement | null = null;
  private borderStyleSelect: HTMLSelectElement | null = null;
  private paddingInput: HTMLInputElement | null = null;
  private _isUpdating: boolean = false;

  private currentTextBox: TextBoxObject | null = null;
  private onApplyCallback?: (success: boolean, error?: Error) => void;

  constructor(id: string = 'textbox', options: TextBoxPaneOptions = {}) {
    super(id, { className: 'pc-pane-textbox', ...options });
    this.onApplyCallback = options.onApply;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    if (this.editor) {
      // Listen for selection changes
      const updateHandler = () => this.updateFromSelection();
      this.editor.on('selection-change', updateHandler);
      this.editor.on('textbox-updated', updateHandler);

      this.eventCleanup.push(() => {
        this.editor?.off('selection-change', updateHandler);
        this.editor?.off('textbox-updated', updateHandler);
      });

      // Initial update
      this.updateFromSelection();
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Position section - Type on same row as label
    const positionSection = this.createSection('Position');
    this.positionSelect = this.createSelect([
      { value: 'inline', label: 'Inline' },
      { value: 'block', label: 'Block' },
      { value: 'relative', label: 'Relative' }
    ], 'inline');
    this.addImmediateApplyListener(this.positionSelect, () => {
      this.updateOffsetVisibility();
      this.applyChanges();
    });
    positionSection.appendChild(this.createFormGroup('Type:', this.positionSelect, { inline: true }));

    // Offset group (only visible for relative positioning)
    this.offsetGroup = document.createElement('div');
    this.offsetGroup.style.display = 'none';
    const offsetRow = this.createRow();
    this.offsetXInput = this.createNumberInput({ value: 0 });
    this.offsetYInput = this.createNumberInput({ value: 0 });
    this.addImmediateApplyListener(this.offsetXInput, () => this.applyChanges());
    this.addImmediateApplyListener(this.offsetYInput, () => this.applyChanges());
    offsetRow.appendChild(this.createFormGroup('X:', this.offsetXInput, { inline: true }));
    offsetRow.appendChild(this.createFormGroup('Y:', this.offsetYInput, { inline: true }));
    this.offsetGroup.appendChild(offsetRow);
    positionSection.appendChild(this.offsetGroup);
    container.appendChild(positionSection);

    // Background - color on same row as label
    const bgSection = this.createSection();
    this.bgColorInput = this.createColorInput('#ffffff');
    this.addImmediateApplyListener(this.bgColorInput, () => this.applyChanges());
    bgSection.appendChild(this.createFormGroup('Background:', this.bgColorInput, { inline: true }));
    container.appendChild(bgSection);

    // Border section
    const borderSection = this.createSection('Border');
    const borderRow = this.createRow();
    this.borderWidthInput = this.createNumberInput({ min: 0, max: 10, value: 1 });
    this.borderColorInput = this.createColorInput('#cccccc');
    this.addImmediateApplyListener(this.borderWidthInput, () => this.applyChanges());
    this.addImmediateApplyListener(this.borderColorInput, () => this.applyChanges());
    borderRow.appendChild(this.createFormGroup('Width:', this.borderWidthInput, { inline: true }));
    borderRow.appendChild(this.createFormGroup('Color:', this.borderColorInput, { inline: true }));
    borderSection.appendChild(borderRow);

    // Border style on same row as label
    this.borderStyleSelect = this.createSelect([
      { value: 'solid', label: 'Solid' },
      { value: 'dashed', label: 'Dashed' },
      { value: 'dotted', label: 'Dotted' },
      { value: 'none', label: 'None' }
    ], 'solid');
    this.addImmediateApplyListener(this.borderStyleSelect, () => this.applyChanges());
    borderSection.appendChild(this.createFormGroup('Style:', this.borderStyleSelect, { inline: true }));
    container.appendChild(borderSection);

    // Padding on same row as label
    const paddingSection = this.createSection();
    this.paddingInput = this.createNumberInput({ min: 0, max: 50, value: 8 });
    this.addImmediateApplyListener(this.paddingInput, () => this.applyChanges());
    paddingSection.appendChild(this.createFormGroup('Padding:', this.paddingInput, { inline: true }));
    container.appendChild(paddingSection);

    return container;
  }

  private updateFromSelection(): void {
    if (!this.editor || this._isUpdating) return;

    this._isUpdating = true;
    try {
      const textBox = this.editor.getSelectedTextBox?.();

      if (textBox && !textBox.editing) {
        this.showTextBox(textBox);
      } else {
        this.hideTextBox();
      }
    } finally {
      this._isUpdating = false;
    }
  }

  /**
   * Show the pane with the given text box.
   */
  showTextBox(textBox: TextBoxObject): void {
    this.currentTextBox = textBox;

    // Populate position
    if (this.positionSelect) {
      this.positionSelect.value = textBox.position || 'inline';
    }
    this.updateOffsetVisibility();

    // Populate offset
    if (this.offsetXInput) {
      this.offsetXInput.value = String(textBox.relativeOffset?.x ?? 0);
    }
    if (this.offsetYInput) {
      this.offsetYInput.value = String(textBox.relativeOffset?.y ?? 0);
    }

    // Populate background
    if (this.bgColorInput) {
      this.bgColorInput.value = textBox.backgroundColor || '#ffffff';
    }

    // Populate border (use first side with non-none style)
    const border = textBox.border;
    const activeBorder = border.top.style !== 'none' ? border.top :
                         border.right.style !== 'none' ? border.right :
                         border.bottom.style !== 'none' ? border.bottom :
                         border.left.style !== 'none' ? border.left : border.top;

    if (this.borderWidthInput) {
      this.borderWidthInput.value = String(activeBorder.width);
    }
    if (this.borderColorInput) {
      this.borderColorInput.value = activeBorder.color;
    }
    if (this.borderStyleSelect) {
      this.borderStyleSelect.value = activeBorder.style;
    }

    // Populate padding
    if (this.paddingInput) {
      this.paddingInput.value = String(textBox.padding ?? 8);
    }

    this.show();
  }

  /**
   * Hide the pane and clear current text box.
   */
  hideTextBox(): void {
    this.currentTextBox = null;
    this.hide();
  }

  private updateOffsetVisibility(): void {
    if (this.offsetGroup && this.positionSelect) {
      this.offsetGroup.style.display = this.positionSelect.value === 'relative' ? 'block' : 'none';
    }
  }

  private applyChanges(): void {
    if (!this.editor || !this.currentTextBox) {
      return;
    }

    const updates: Parameters<typeof this.editor.updateTextBox>[1] = {};

    // Position
    if (this.positionSelect) {
      updates.position = this.positionSelect.value as 'inline' | 'block' | 'relative';
    }

    // Relative offset
    if (this.positionSelect?.value === 'relative') {
      updates.relativeOffset = {
        x: parseInt(this.offsetXInput?.value || '0', 10),
        y: parseInt(this.offsetYInput?.value || '0', 10)
      };
    }

    // Background color
    if (this.bgColorInput) {
      updates.backgroundColor = this.bgColorInput.value;
    }

    // Border
    const width = parseInt(this.borderWidthInput?.value || '1', 10);
    const color = this.borderColorInput?.value || '#cccccc';
    const style = (this.borderStyleSelect?.value || 'solid') as 'solid' | 'dashed' | 'dotted' | 'none';

    const borderSide = { width, color, style };
    updates.border = {
      top: { ...borderSide },
      right: { ...borderSide },
      bottom: { ...borderSide },
      left: { ...borderSide }
    };

    // Padding
    if (this.paddingInput) {
      updates.padding = parseInt(this.paddingInput.value, 10);
    }

    try {
      const success = this.editor.updateTextBox(this.currentTextBox.id, updates);
      this.onApplyCallback?.(success);
    } catch (error) {
      this.onApplyCallback?.(false, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get the currently selected text box.
   */
  getCurrentTextBox(): TextBoxObject | null {
    return this.currentTextBox;
  }

  /**
   * Check if a text box is currently selected.
   */
  hasTextBox(): boolean {
    return this.currentTextBox !== null;
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    this.updateFromSelection();
  }
}
