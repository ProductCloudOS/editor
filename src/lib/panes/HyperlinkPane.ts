/**
 * HyperlinkPane - Edit hyperlink URL and title.
 *
 * This pane is shown when a hyperlink is selected/cursor is in a hyperlink.
 *
 * Uses the PCEditor public API:
 * - editor.getHyperlinkAt()
 * - editor.updateHyperlink()
 * - editor.removeHyperlink()
 * - editor.getCursorPosition()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';

/**
 * Hyperlink data.
 */
export interface HyperlinkData {
  id: string;
  url: string;
  title?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Options for HyperlinkPane.
 */
export interface HyperlinkPaneOptions {
  className?: string;
  /**
   * Callback when hyperlink changes are applied.
   */
  onApply?: (success: boolean, error?: Error) => void;
  /**
   * Callback when hyperlink is removed.
   */
  onRemove?: (success: boolean) => void;
}

export class HyperlinkPane extends BasePane {
  private urlInput: HTMLInputElement | null = null;
  private titleInput: HTMLInputElement | null = null;
  private rangeHint: HTMLElement | null = null;
  private currentHyperlink: HyperlinkData | null = null;
  private onApply?: (success: boolean, error?: Error) => void;
  private onRemove?: (success: boolean) => void;

  constructor(id: string = 'hyperlink', options: HyperlinkPaneOptions = {}) {
    super(id, { className: 'pc-pane-hyperlink', ...options });
    this.onApply = options.onApply;
    this.onRemove = options.onRemove;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    if (this.editor) {
      // Update on cursor changes
      const updateHandler = () => this.updateFromCursor();
      this.editor.on('cursor-changed', updateHandler);
      this.editor.on('selection-changed', updateHandler);

      this.eventCleanup.push(() => {
        this.editor?.off('cursor-changed', updateHandler);
        this.editor?.off('selection-changed', updateHandler);
      });

      // Initial update
      this.updateFromCursor();
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // URL input
    this.urlInput = this.createTextInput({ placeholder: 'https://example.com' });
    container.appendChild(this.createFormGroup('URL', this.urlInput));

    // Title input
    this.titleInput = this.createTextInput({ placeholder: 'Link title (optional)' });
    container.appendChild(this.createFormGroup('Title', this.titleInput));

    // Apply button
    const applyBtn = this.createButton('Apply Changes', { variant: 'primary' });
    this.addButtonListener(applyBtn, () => this.applyChanges());
    container.appendChild(applyBtn);

    // Remove button
    const removeBtn = this.createButton('Remove Link', { variant: 'danger' });
    removeBtn.style.marginTop = '0.5rem';
    this.addButtonListener(removeBtn, () => this.removeHyperlink());
    container.appendChild(removeBtn);

    // Range hint
    this.rangeHint = this.createHint('');
    container.appendChild(this.rangeHint);

    return container;
  }

  private updateFromCursor(): void {
    if (!this.editor) return;

    const cursorPos = this.editor.getCursorPosition();
    const hyperlink = this.editor.getHyperlinkAt(cursorPos);

    if (hyperlink) {
      this.showHyperlink(hyperlink);
    } else {
      this.hideHyperlink();
    }
  }

  private showHyperlink(hyperlink: HyperlinkData): void {
    this.currentHyperlink = hyperlink;

    if (this.urlInput) {
      this.urlInput.value = hyperlink.url;
    }
    if (this.titleInput) {
      this.titleInput.value = hyperlink.title || '';
    }
    if (this.rangeHint) {
      this.rangeHint.textContent = `Link spans characters ${hyperlink.startIndex} to ${hyperlink.endIndex}`;
    }

    // Show the pane
    this.show();
  }

  private hideHyperlink(): void {
    this.currentHyperlink = null;
    this.hide();
  }

  private applyChanges(): void {
    if (!this.editor || !this.currentHyperlink) return;

    try {
      const url = this.urlInput?.value.trim() || '';
      const title = this.titleInput?.value.trim() || undefined;

      if (!url) {
        this.onApply?.(false, new Error('URL is required'));
        return;
      }

      this.editor.updateHyperlink(this.currentHyperlink.id, { url, title });

      // Update local reference
      this.currentHyperlink.url = url;
      this.currentHyperlink.title = title;

      this.onApply?.(true);
    } catch (error) {
      this.onApply?.(false, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private removeHyperlink(): void {
    if (!this.editor || !this.currentHyperlink) return;

    try {
      this.editor.removeHyperlink(this.currentHyperlink.id);
      this.hideHyperlink();
      this.onRemove?.(true);
    } catch {
      this.onRemove?.(false);
    }
  }

  /**
   * Get the currently selected hyperlink.
   */
  getCurrentHyperlink(): HyperlinkData | null {
    return this.currentHyperlink;
  }

  /**
   * Check if a hyperlink is currently selected.
   */
  hasHyperlink(): boolean {
    return this.currentHyperlink !== null;
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    this.updateFromCursor();
  }
}
