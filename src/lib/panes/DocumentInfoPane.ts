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
    container.className = 'pc-pane-label-value-grid';

    // Page count
    container.appendChild(this.createLabel('Pages:'));
    this.pageCountEl = this.createValue('0');
    container.appendChild(this.pageCountEl);
    container.appendChild(this.createSpacer());

    // Page size
    container.appendChild(this.createLabel('Size:'));
    this.pageSizeEl = this.createValue('-');
    container.appendChild(this.pageSizeEl);
    container.appendChild(this.createSpacer());

    // Page orientation
    container.appendChild(this.createLabel('Orientation:'));
    this.pageOrientationEl = this.createValue('-');
    container.appendChild(this.pageOrientationEl);
    container.appendChild(this.createSpacer());

    return container;
  }

  private createLabel(text: string): HTMLElement {
    const label = document.createElement('span');
    label.className = 'pc-pane-label pc-pane-margin-label';
    label.textContent = text;
    return label;
  }

  private createValue(text: string): HTMLElement {
    const value = document.createElement('span');
    value.className = 'pc-pane-info-value';
    value.textContent = text;
    return value;
  }

  private createSpacer(): HTMLElement {
    return document.createElement('div');
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
