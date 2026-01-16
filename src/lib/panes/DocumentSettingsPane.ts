/**
 * DocumentSettingsPane - Edit margins, page size, and orientation.
 *
 * Uses the PCEditor public API:
 * - editor.getDocumentSettings()
 * - editor.updateDocumentSettings()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';

export class DocumentSettingsPane extends BasePane {
  private marginTopInput: HTMLInputElement | null = null;
  private marginRightInput: HTMLInputElement | null = null;
  private marginBottomInput: HTMLInputElement | null = null;
  private marginLeftInput: HTMLInputElement | null = null;
  private pageSizeSelect: HTMLSelectElement | null = null;
  private orientationSelect: HTMLSelectElement | null = null;

  constructor(id: string = 'document-settings') {
    super(id, { className: 'pc-pane-document-settings' });
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    // Load current settings
    if (this.editor) {
      this.loadSettings();

      // Subscribe to document changes
      const updateHandler = () => this.loadSettings();
      this.editor.on('document-changed', updateHandler);
      this.eventCleanup.push(() => {
        this.editor?.off('document-changed', updateHandler);
      });
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Margins section
    const marginsSection = this.createSection('Margins (mm)');
    const marginsGrid = document.createElement('div');
    marginsGrid.className = 'pc-pane-margins-grid';

    this.marginTopInput = this.createNumberInput({ min: 5, max: 50, step: 0.5, value: 20 });
    this.marginRightInput = this.createNumberInput({ min: 5, max: 50, step: 0.5, value: 20 });
    this.marginBottomInput = this.createNumberInput({ min: 5, max: 50, step: 0.5, value: 20 });
    this.marginLeftInput = this.createNumberInput({ min: 5, max: 50, step: 0.5, value: 20 });

    marginsGrid.appendChild(this.createFormGroup('Top', this.marginTopInput, { inline: true }));
    marginsGrid.appendChild(this.createFormGroup('Right', this.marginRightInput, { inline: true }));
    marginsGrid.appendChild(this.createFormGroup('Bottom', this.marginBottomInput, { inline: true }));
    marginsGrid.appendChild(this.createFormGroup('Left', this.marginLeftInput, { inline: true }));

    marginsSection.appendChild(marginsGrid);

    // Apply margins button
    const applyMarginsBtn = this.createButton('Apply Margins');
    this.addButtonListener(applyMarginsBtn, () => this.applyMargins());
    marginsSection.appendChild(applyMarginsBtn);

    container.appendChild(marginsSection);

    // Page size section
    const pageSizeSection = this.createSection();
    this.pageSizeSelect = this.createSelect([
      { value: 'A4', label: 'A4' },
      { value: 'Letter', label: 'Letter' },
      { value: 'Legal', label: 'Legal' },
      { value: 'A3', label: 'A3' }
    ], 'A4');
    this.addImmediateApplyListener(this.pageSizeSelect, () => this.applyPageSettings());
    pageSizeSection.appendChild(this.createFormGroup('Page Size', this.pageSizeSelect));
    container.appendChild(pageSizeSection);

    // Orientation section
    const orientationSection = this.createSection();
    this.orientationSelect = this.createSelect([
      { value: 'portrait', label: 'Portrait' },
      { value: 'landscape', label: 'Landscape' }
    ], 'portrait');
    this.addImmediateApplyListener(this.orientationSelect, () => this.applyPageSettings());
    orientationSection.appendChild(this.createFormGroup('Orientation', this.orientationSelect));
    container.appendChild(orientationSection);

    return container;
  }

  private loadSettings(): void {
    if (!this.editor) return;

    try {
      const settings = this.editor.getDocumentSettings();

      if (this.marginTopInput) {
        this.marginTopInput.value = settings.margins.top.toString();
      }
      if (this.marginRightInput) {
        this.marginRightInput.value = settings.margins.right.toString();
      }
      if (this.marginBottomInput) {
        this.marginBottomInput.value = settings.margins.bottom.toString();
      }
      if (this.marginLeftInput) {
        this.marginLeftInput.value = settings.margins.left.toString();
      }
      if (this.pageSizeSelect) {
        this.pageSizeSelect.value = settings.pageSize;
      }
      if (this.orientationSelect) {
        this.orientationSelect.value = settings.pageOrientation;
      }
    } catch (error) {
      console.error('Failed to load document settings:', error);
    }
  }

  private applyMargins(): void {
    if (!this.editor) return;

    const margins = {
      top: parseFloat(this.marginTopInput?.value || '20'),
      right: parseFloat(this.marginRightInput?.value || '20'),
      bottom: parseFloat(this.marginBottomInput?.value || '20'),
      left: parseFloat(this.marginLeftInput?.value || '20')
    };

    try {
      this.editor.updateDocumentSettings({ margins });
    } catch (error) {
      console.error('Failed to update margins:', error);
    }
  }

  private applyPageSettings(): void {
    if (!this.editor) return;

    const settings: Record<string, string> = {};

    if (this.pageSizeSelect) {
      settings.pageSize = this.pageSizeSelect.value;
    }
    if (this.orientationSelect) {
      settings.pageOrientation = this.orientationSelect.value;
    }

    try {
      this.editor.updateDocumentSettings(settings);
    } catch (error) {
      console.error('Failed to update page settings:', error);
    }
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    this.loadSettings();
  }
}
