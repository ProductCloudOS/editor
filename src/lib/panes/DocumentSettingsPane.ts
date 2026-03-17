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

    // Five-column grid: label, edit, label, edit, stretch
    const marginsGrid = document.createElement('div');
    marginsGrid.className = 'pc-pane-margins-grid-5col';

    this.marginTopInput = this.createNumberInput({ min: 5, max: 50, step: 0.5, value: 20 });
    this.marginRightInput = this.createNumberInput({ min: 5, max: 50, step: 0.5, value: 20 });
    this.marginBottomInput = this.createNumberInput({ min: 5, max: 50, step: 0.5, value: 20 });
    this.marginLeftInput = this.createNumberInput({ min: 5, max: 50, step: 0.5, value: 20 });

    // Apply margins on blur
    const applyMargins = () => this.applyMargins();
    this.marginTopInput.addEventListener('blur', applyMargins);
    this.marginRightInput.addEventListener('blur', applyMargins);
    this.marginBottomInput.addEventListener('blur', applyMargins);
    this.marginLeftInput.addEventListener('blur', applyMargins);
    this.eventCleanup.push(() => {
      this.marginTopInput?.removeEventListener('blur', applyMargins);
      this.marginRightInput?.removeEventListener('blur', applyMargins);
      this.marginBottomInput?.removeEventListener('blur', applyMargins);
      this.marginLeftInput?.removeEventListener('blur', applyMargins);
    });

    // Row 1: Top / Right
    const topLabel = this.createMarginLabel('Top:');
    const rightLabel = this.createMarginLabel('Right:');
    marginsGrid.appendChild(topLabel);
    marginsGrid.appendChild(this.marginTopInput);
    marginsGrid.appendChild(rightLabel);
    marginsGrid.appendChild(this.marginRightInput);
    marginsGrid.appendChild(this.createSpacer());

    // Row 2: Bottom / Left
    const bottomLabel = this.createMarginLabel('Bottom:');
    const leftLabel = this.createMarginLabel('Left:');
    marginsGrid.appendChild(bottomLabel);
    marginsGrid.appendChild(this.marginBottomInput);
    marginsGrid.appendChild(leftLabel);
    marginsGrid.appendChild(this.marginLeftInput);
    marginsGrid.appendChild(this.createSpacer());

    marginsSection.appendChild(marginsGrid);
    container.appendChild(marginsSection);

    // Page settings section using label-value grid: label, value, stretch
    const pageSection = this.createSection();
    const pageGrid = document.createElement('div');
    pageGrid.className = 'pc-pane-label-value-grid';

    // Page Size
    this.pageSizeSelect = this.createSelect([
      { value: 'A4', label: 'A4' },
      { value: 'Letter', label: 'Letter' },
      { value: 'Legal', label: 'Legal' },
      { value: 'A3', label: 'A3' }
    ], 'A4');
    this.addImmediateApplyListener(this.pageSizeSelect, () => this.applyPageSettings());
    pageGrid.appendChild(this.createMarginLabel('Page Size:'));
    pageGrid.appendChild(this.pageSizeSelect);
    pageGrid.appendChild(this.createSpacer());

    // Orientation
    this.orientationSelect = this.createSelect([
      { value: 'portrait', label: 'Portrait' },
      { value: 'landscape', label: 'Landscape' }
    ], 'portrait');
    this.addImmediateApplyListener(this.orientationSelect, () => this.applyPageSettings());
    pageGrid.appendChild(this.createMarginLabel('Orientation:'));
    pageGrid.appendChild(this.orientationSelect);
    pageGrid.appendChild(this.createSpacer());

    pageSection.appendChild(pageGrid);
    container.appendChild(pageSection);

    return container;
  }

  private createMarginLabel(text: string): HTMLElement {
    const label = document.createElement('label');
    label.className = 'pc-pane-label pc-pane-margin-label';
    label.textContent = text;
    return label;
  }

  private createSpacer(): HTMLElement {
    const spacer = document.createElement('div');
    return spacer;
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
