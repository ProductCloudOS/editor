/**
 * RepeatingSectionPane - Edit repeating section (loop) properties.
 *
 * Shows:
 * - Field path (array property in merge data)
 * - Position information
 *
 * Uses the PCEditor public API:
 * - editor.getRepeatingSection()
 * - editor.updateRepeatingSectionFieldPath()
 * - editor.removeRepeatingSection()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';
import type { RepeatingSection } from '../text';

/**
 * Options for RepeatingSectionPane.
 */
export interface RepeatingSectionPaneOptions {
  className?: string;
  /**
   * Callback when section changes are applied.
   */
  onApply?: (success: boolean, error?: Error) => void;
  /**
   * Callback when section is removed.
   */
  onRemove?: (success: boolean) => void;
}

export class RepeatingSectionPane extends BasePane {
  private fieldPathInput: HTMLInputElement | null = null;
  private positionHint: HTMLElement | null = null;
  private currentSection: RepeatingSection | null = null;
  private onApplyCallback?: (success: boolean, error?: Error) => void;
  private onRemoveCallback?: (success: boolean) => void;

  constructor(id: string = 'repeating-section', options: RepeatingSectionPaneOptions = {}) {
    super(id, { className: 'pc-pane-repeating-section', ...options });
    this.onApplyCallback = options.onApply;
    this.onRemoveCallback = options.onRemove;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    if (this.editor) {
      // Listen for repeating section selection
      const selectionHandler = (event: { type?: string; sectionId?: string }) => {
        if (event.type === 'repeating-section' && event.sectionId) {
          const section = this.editor?.getRepeatingSection(event.sectionId);
          if (section) {
            this.showSection(section);
          }
        }
      };

      const removedHandler = () => {
        this.hideSection();
      };

      this.editor.on('selection-change', selectionHandler);
      this.editor.on('repeating-section-removed', removedHandler);

      this.eventCleanup.push(() => {
        this.editor?.off('selection-change', selectionHandler);
        this.editor?.off('repeating-section-removed', removedHandler);
      });
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Field path input
    this.fieldPathInput = this.createTextInput({ placeholder: 'items' });
    container.appendChild(this.createFormGroup('Array Field Path', this.fieldPathInput, {
      hint: 'Path to array in merge data (e.g., "items" or "contact.addresses")'
    }));

    // Apply button
    const applyBtn = this.createButton('Apply Changes', { variant: 'primary' });
    this.addButtonListener(applyBtn, () => this.applyChanges());
    container.appendChild(applyBtn);

    // Remove button
    const removeBtn = this.createButton('Remove Loop', { variant: 'danger' });
    removeBtn.style.marginTop = '0.5rem';
    this.addButtonListener(removeBtn, () => this.removeSection());
    container.appendChild(removeBtn);

    // Position hint
    this.positionHint = this.createHint('');
    container.appendChild(this.positionHint);

    return container;
  }

  /**
   * Show the pane with the given section.
   */
  showSection(section: RepeatingSection): void {
    this.currentSection = section;

    if (this.fieldPathInput) {
      this.fieldPathInput.value = section.fieldPath;
    }
    if (this.positionHint) {
      this.positionHint.textContent = `Loop from position ${section.startIndex} to ${section.endIndex}`;
    }

    this.show();
  }

  /**
   * Hide the pane and clear the current section.
   */
  hideSection(): void {
    this.currentSection = null;
    this.hide();
  }

  private applyChanges(): void {
    if (!this.editor || !this.currentSection) {
      this.onApplyCallback?.(false, new Error('No section selected'));
      return;
    }

    const fieldPath = this.fieldPathInput?.value.trim();
    if (!fieldPath) {
      this.onApplyCallback?.(false, new Error('Field path cannot be empty'));
      return;
    }

    if (fieldPath === this.currentSection.fieldPath) {
      return; // No changes
    }

    try {
      const success = this.editor.updateRepeatingSectionFieldPath(this.currentSection.id, fieldPath);

      if (success) {
        // Update the current section reference
        this.currentSection = this.editor.getRepeatingSection(this.currentSection.id) || null;
        if (this.currentSection) {
          this.showSection(this.currentSection);
        }
        this.onApplyCallback?.(true);
      } else {
        this.onApplyCallback?.(false, new Error('Failed to update section'));
      }
    } catch (error) {
      this.onApplyCallback?.(false, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private removeSection(): void {
    if (!this.editor || !this.currentSection) return;

    try {
      this.editor.removeRepeatingSection(this.currentSection.id);
      this.hideSection();
      this.onRemoveCallback?.(true);
    } catch {
      this.onRemoveCallback?.(false);
    }
  }

  /**
   * Get the currently selected section.
   */
  getCurrentSection(): RepeatingSection | null {
    return this.currentSection;
  }

  /**
   * Check if a section is currently selected.
   */
  hasSection(): boolean {
    return this.currentSection !== null;
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    // Section pane doesn't auto-update - it's driven by selection events
  }
}
