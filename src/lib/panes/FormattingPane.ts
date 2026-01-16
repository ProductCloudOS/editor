/**
 * FormattingPane - Text formatting controls.
 *
 * Controls:
 * - Bold/Italic toggles
 * - Alignment buttons (left, center, right, justify)
 * - List buttons (bullet, numbered, indent, outdent)
 * - Font family/size dropdowns
 * - Text color and highlight color pickers
 *
 * Uses the PCEditor public API:
 * - editor.getUnifiedFormattingAtCursor()
 * - editor.applyFormattingWithFallback()
 * - editor.setPendingFormatting()
 * - editor.getSavedOrCurrentSelection()
 * - editor.getUnifiedAlignmentAtCursor()
 * - editor.setUnifiedAlignment()
 * - editor.toggleBulletList()
 * - editor.toggleNumberedList()
 * - editor.indentParagraph()
 * - editor.outdentParagraph()
 * - editor.getListFormatting()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';
import type { TextAlignment } from '../text';

/**
 * Options for FormattingPane.
 */
export interface FormattingPaneOptions {
  className?: string;
  /**
   * Available font families.
   */
  fontFamilies?: string[];
  /**
   * Available font sizes.
   */
  fontSizes?: number[];
}

const DEFAULT_FONT_FAMILIES = [
  'Arial',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New'
];

const DEFAULT_FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36];

export class FormattingPane extends BasePane {
  // Style toggles
  private boldBtn: HTMLButtonElement | null = null;
  private italicBtn: HTMLButtonElement | null = null;

  // Alignment buttons
  private alignLeftBtn: HTMLButtonElement | null = null;
  private alignCenterBtn: HTMLButtonElement | null = null;
  private alignRightBtn: HTMLButtonElement | null = null;
  private alignJustifyBtn: HTMLButtonElement | null = null;

  // List buttons
  private bulletListBtn: HTMLButtonElement | null = null;
  private numberedListBtn: HTMLButtonElement | null = null;
  private indentBtn: HTMLButtonElement | null = null;
  private outdentBtn: HTMLButtonElement | null = null;

  // Font controls
  private fontFamilySelect: HTMLSelectElement | null = null;
  private fontSizeSelect: HTMLSelectElement | null = null;
  private colorInput: HTMLInputElement | null = null;
  private highlightInput: HTMLInputElement | null = null;

  private fontFamilies: string[];
  private fontSizes: number[];

  constructor(id: string = 'formatting', options: FormattingPaneOptions = {}) {
    super(id, { className: 'pc-pane-formatting', ...options });
    this.fontFamilies = options.fontFamilies ?? DEFAULT_FONT_FAMILIES;
    this.fontSizes = options.fontSizes ?? DEFAULT_FONT_SIZES;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    if (this.editor) {
      // Update on cursor/selection changes
      const updateHandler = () => this.updateFromEditor();
      this.editor.on('cursor-changed', updateHandler);
      this.editor.on('selection-changed', updateHandler);
      this.editor.on('text-changed', updateHandler);
      this.editor.on('formatting-changed', updateHandler);

      this.eventCleanup.push(() => {
        this.editor?.off('cursor-changed', updateHandler);
        this.editor?.off('selection-changed', updateHandler);
        this.editor?.off('text-changed', updateHandler);
        this.editor?.off('formatting-changed', updateHandler);
      });

      // Initial update
      this.updateFromEditor();
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Style section (Bold, Italic)
    const styleSection = this.createSection('Style');
    const styleGroup = this.createButtonGroup();

    this.boldBtn = this.createButton('B');
    this.boldBtn.title = 'Bold';
    this.boldBtn.style.fontWeight = 'bold';
    this.addButtonListener(this.boldBtn, () => this.toggleBold());

    this.italicBtn = this.createButton('I');
    this.italicBtn.title = 'Italic';
    this.italicBtn.style.fontStyle = 'italic';
    this.addButtonListener(this.italicBtn, () => this.toggleItalic());

    styleGroup.appendChild(this.boldBtn);
    styleGroup.appendChild(this.italicBtn);
    styleSection.appendChild(styleGroup);
    container.appendChild(styleSection);

    // Alignment section
    const alignSection = this.createSection('Alignment');
    const alignGroup = this.createButtonGroup();

    this.alignLeftBtn = this.createButton('');
    this.alignLeftBtn.title = 'Align Left';
    this.alignLeftBtn.classList.add('pc-pane-button--icon', 'pc-pane-button--align-left');
    this.addButtonListener(this.alignLeftBtn, () => this.setAlignment('left'));

    this.alignCenterBtn = this.createButton('');
    this.alignCenterBtn.title = 'Center';
    this.alignCenterBtn.classList.add('pc-pane-button--icon', 'pc-pane-button--align-center');
    this.addButtonListener(this.alignCenterBtn, () => this.setAlignment('center'));

    this.alignRightBtn = this.createButton('');
    this.alignRightBtn.title = 'Align Right';
    this.alignRightBtn.classList.add('pc-pane-button--icon', 'pc-pane-button--align-right');
    this.addButtonListener(this.alignRightBtn, () => this.setAlignment('right'));

    this.alignJustifyBtn = this.createButton('');
    this.alignJustifyBtn.title = 'Justify';
    this.alignJustifyBtn.classList.add('pc-pane-button--icon', 'pc-pane-button--align-justify');
    this.addButtonListener(this.alignJustifyBtn, () => this.setAlignment('justify'));

    alignGroup.appendChild(this.alignLeftBtn);
    alignGroup.appendChild(this.alignCenterBtn);
    alignGroup.appendChild(this.alignRightBtn);
    alignGroup.appendChild(this.alignJustifyBtn);
    alignSection.appendChild(alignGroup);
    container.appendChild(alignSection);

    // Lists section
    const listsSection = this.createSection('Lists');
    const listsGroup = this.createButtonGroup();

    this.bulletListBtn = this.createButton('\u2022'); // •
    this.bulletListBtn.title = 'Bullet List';
    this.addButtonListener(this.bulletListBtn, () => this.toggleBulletList());

    this.numberedListBtn = this.createButton('1.');
    this.numberedListBtn.title = 'Numbered List';
    this.addButtonListener(this.numberedListBtn, () => this.toggleNumberedList());

    this.indentBtn = this.createButton('\u2192'); // →
    this.indentBtn.title = 'Increase Indent';
    this.addButtonListener(this.indentBtn, () => this.indent());

    this.outdentBtn = this.createButton('\u2190'); // ←
    this.outdentBtn.title = 'Decrease Indent';
    this.addButtonListener(this.outdentBtn, () => this.outdent());

    listsGroup.appendChild(this.bulletListBtn);
    listsGroup.appendChild(this.numberedListBtn);
    listsGroup.appendChild(this.indentBtn);
    listsGroup.appendChild(this.outdentBtn);
    listsSection.appendChild(listsGroup);
    container.appendChild(listsSection);

    // Font section
    const fontSection = this.createSection('Font');
    this.fontFamilySelect = this.createSelect(
      this.fontFamilies.map(f => ({ value: f, label: f })),
      'Arial'
    );
    this.addImmediateApplyListener(this.fontFamilySelect, () => this.applyFontFamily());
    fontSection.appendChild(this.createFormGroup('Family', this.fontFamilySelect));

    this.fontSizeSelect = this.createSelect(
      this.fontSizes.map(s => ({ value: s.toString(), label: s.toString() })),
      '14'
    );
    this.addImmediateApplyListener(this.fontSizeSelect, () => this.applyFontSize());
    fontSection.appendChild(this.createFormGroup('Size', this.fontSizeSelect));
    container.appendChild(fontSection);

    // Color section
    const colorSection = this.createSection('Color');
    const colorRow = this.createRow();

    const colorGroup = document.createElement('div');
    this.colorInput = this.createColorInput('#000000');
    this.addImmediateApplyListener(this.colorInput, () => this.applyTextColor());
    colorGroup.appendChild(this.createFormGroup('Text', this.colorInput));
    colorRow.appendChild(colorGroup);

    const highlightGroup = document.createElement('div');
    this.highlightInput = this.createColorInput('#ffff00');
    this.addImmediateApplyListener(this.highlightInput, () => this.applyHighlight());
    const highlightForm = this.createFormGroup('Highlight', this.highlightInput);

    const clearHighlightBtn = this.createButton('Clear');
    clearHighlightBtn.className = 'pc-pane-button';
    clearHighlightBtn.style.marginLeft = '4px';
    this.addButtonListener(clearHighlightBtn, () => this.clearHighlight());
    highlightForm.appendChild(clearHighlightBtn);

    highlightGroup.appendChild(highlightForm);
    colorRow.appendChild(highlightGroup);

    colorSection.appendChild(colorRow);
    container.appendChild(colorSection);

    return container;
  }

  private updateFromEditor(): void {
    if (!this.editor) return;

    // Get formatting at cursor
    const formatting = this.editor.getUnifiedFormattingAtCursor();
    if (formatting) {
      // Update bold button
      this.boldBtn?.classList.toggle('pc-pane-button--active', formatting.fontWeight === 'bold');

      // Update italic button
      this.italicBtn?.classList.toggle('pc-pane-button--active', formatting.fontStyle === 'italic');

      // Update font family
      if (this.fontFamilySelect && formatting.fontFamily) {
        this.fontFamilySelect.value = formatting.fontFamily;
      }

      // Update font size
      if (this.fontSizeSelect && formatting.fontSize) {
        this.fontSizeSelect.value = formatting.fontSize.toString();
      }

      // Update color
      if (this.colorInput && formatting.color) {
        this.colorInput.value = formatting.color;
      }

      // Update highlight
      if (this.highlightInput && formatting.backgroundColor) {
        this.highlightInput.value = formatting.backgroundColor;
      }
    }

    // Update alignment buttons
    const alignment = this.editor.getUnifiedAlignmentAtCursor();
    this.updateAlignmentButtons(alignment);

    // Update list buttons
    this.updateListButtons();
  }

  private updateAlignmentButtons(alignment: TextAlignment): void {
    const buttons = [
      { btn: this.alignLeftBtn, align: 'left' },
      { btn: this.alignCenterBtn, align: 'center' },
      { btn: this.alignRightBtn, align: 'right' },
      { btn: this.alignJustifyBtn, align: 'justify' }
    ];

    for (const { btn, align } of buttons) {
      btn?.classList.toggle('pc-pane-button--active', align === alignment);
    }
  }

  private updateListButtons(): void {
    if (!this.editor) return;

    try {
      const listFormatting = this.editor.getListFormatting();
      if (listFormatting) {
        this.bulletListBtn?.classList.toggle('pc-pane-button--active', listFormatting.listType === 'bullet');
        this.numberedListBtn?.classList.toggle('pc-pane-button--active', listFormatting.listType === 'number');
      }
    } catch {
      // No text editing active
    }
  }

  private getSelection(): { start: number; end: number } | null {
    if (!this.editor) return null;
    return this.editor.getSavedOrCurrentSelection();
  }

  private applyFormatting(formatting: Record<string, unknown>): void {
    if (!this.editor) return;

    const selection = this.getSelection();

    try {
      if (selection) {
        this.editor.applyFormattingWithFallback(selection.start, selection.end, formatting);
      } else {
        this.editor.setPendingFormatting(formatting);
      }
      this.editor.clearSavedEditingContext();
      this.updateFromEditor();
      this.editor.enableTextInput();
    } catch (error) {
      console.error('Formatting error:', error);
    }
  }

  private toggleBold(): void {
    const isActive = this.boldBtn?.classList.contains('pc-pane-button--active');
    this.applyFormatting({ fontWeight: isActive ? 'normal' : 'bold' });
  }

  private toggleItalic(): void {
    const isActive = this.italicBtn?.classList.contains('pc-pane-button--active');
    this.applyFormatting({ fontStyle: isActive ? 'normal' : 'italic' });
  }

  private applyFontFamily(): void {
    if (this.fontFamilySelect) {
      this.applyFormatting({ fontFamily: this.fontFamilySelect.value });
    }
  }

  private applyFontSize(): void {
    if (this.fontSizeSelect) {
      this.applyFormatting({ fontSize: parseInt(this.fontSizeSelect.value, 10) });
    }
  }

  private applyTextColor(): void {
    if (this.colorInput) {
      this.applyFormatting({ color: this.colorInput.value });
    }
  }

  private applyHighlight(): void {
    if (this.highlightInput) {
      this.applyFormatting({ backgroundColor: this.highlightInput.value });
    }
  }

  private clearHighlight(): void {
    this.applyFormatting({ backgroundColor: undefined });
  }

  private setAlignment(alignment: TextAlignment): void {
    if (!this.editor) return;

    try {
      this.editor.setUnifiedAlignment(alignment);
      this.updateAlignmentButtons(alignment);
    } catch (error) {
      console.error('Alignment error:', error);
    }
  }

  private toggleBulletList(): void {
    if (!this.editor) return;

    try {
      this.editor.toggleBulletList();
      this.updateListButtons();
    } catch (error) {
      console.error('Bullet list error:', error);
    }
  }

  private toggleNumberedList(): void {
    if (!this.editor) return;

    try {
      this.editor.toggleNumberedList();
      this.updateListButtons();
    } catch (error) {
      console.error('Numbered list error:', error);
    }
  }

  private indent(): void {
    if (!this.editor) return;

    try {
      this.editor.indentParagraph();
      this.updateListButtons();
    } catch (error) {
      console.error('Indent error:', error);
    }
  }

  private outdent(): void {
    if (!this.editor) return;

    try {
      this.editor.outdentParagraph();
      this.updateListButtons();
    } catch (error) {
      console.error('Outdent error:', error);
    }
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    this.updateFromEditor();
  }
}
