/**
 * DocumentInfoPane - Read-only document information display.
 *
 * Shows:
 * - Page count
 * - Page size
 * - Page orientation
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';

export class DocumentInfoPane extends BasePane {
  private pageCountEl: HTMLElement | null = null;
  private pageSizeEl: HTMLElement | null = null;
  private pageOrientationEl: HTMLElement | null = null;

  constructor(id: string = 'document-info') {
    super(id, { className: 'pc-pane-document-info' });
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    // Subscribe to document changes
    if (this.editor) {
      const updateHandler = () => this.update();
      this.editor.on('document-changed', updateHandler);
      this.editor.on('page-added', updateHandler);
      this.editor.on('page-removed', updateHandler);
      this.eventCleanup.push(() => {
        this.editor?.off('document-changed', updateHandler);
        this.editor?.off('page-added', updateHandler);
        this.editor?.off('page-removed', updateHandler);
      });

      // Initial update
      this.update();
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'pc-pane-info-list';

    // Page count
    const countRow = this.createInfoRow('Pages', '0');
    this.pageCountEl = countRow.querySelector('.pc-pane-info-value');
    container.appendChild(countRow);

    // Page size
    const sizeRow = this.createInfoRow('Size', '-');
    this.pageSizeEl = sizeRow.querySelector('.pc-pane-info-value');
    container.appendChild(sizeRow);

    // Page orientation
    const orientationRow = this.createInfoRow('Orientation', '-');
    this.pageOrientationEl = orientationRow.querySelector('.pc-pane-info-value');
    container.appendChild(orientationRow);

    return container;
  }

  private createInfoRow(label: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pc-pane-info';

    const labelEl = document.createElement('span');
    labelEl.className = 'pc-pane-info-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'pc-pane-info-value';
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
  }

  /**
   * Update the displayed information from the editor.
   */
  update(): void {
    if (!this.editor) return;

    const doc = this.editor.getDocument();

    if (this.pageCountEl) {
      this.pageCountEl.textContent = doc.pages.length.toString();
    }

    if (this.pageSizeEl && doc.settings) {
      this.pageSizeEl.textContent = doc.settings.pageSize;
    }

    if (this.pageOrientationEl && doc.settings) {
      const orientation = doc.settings.pageOrientation;
      this.pageOrientationEl.textContent =
        orientation.charAt(0).toUpperCase() + orientation.slice(1);
    }
  }
}
