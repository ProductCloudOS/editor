/**
 * ConditionalSectionPane - Edit conditional section properties.
 *
 * Shows:
 * - Predicate input (boolean expression in merge data)
 * - Position information
 *
 * Uses the PCEditor public API:
 * - editor.getConditionalSection()
 * - editor.updateConditionalSectionPredicate()
 * - editor.removeConditionalSection()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';
import type { ConditionalSection } from '../text';

/**
 * Options for ConditionalSectionPane.
 */
export interface ConditionalSectionPaneOptions {
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

export class ConditionalSectionPane extends BasePane {
  private predicateInput: HTMLInputElement | null = null;
  private positionHint: HTMLElement | null = null;
  private currentSection: ConditionalSection | null = null;
  private onApplyCallback?: (success: boolean, error?: Error) => void;
  private onRemoveCallback?: (success: boolean) => void;

  constructor(id: string = 'conditional-section', options: ConditionalSectionPaneOptions = {}) {
    super(id, { className: 'pc-pane-conditional-section', ...options });
    this.onApplyCallback = options.onApply;
    this.onRemoveCallback = options.onRemove;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    if (this.editor) {
      // Listen for conditional section selection
      const selectionHandler = (event: { selection?: { type?: string; sectionId?: string } }) => {
        const sel = event.selection || event as any;
        if (sel.type === 'conditional-section' && sel.sectionId) {
          const section = this.editor?.getConditionalSection(sel.sectionId);
          if (section) {
            this.showSection(section);
          }
        } else {
          // Selection changed away from conditional section — hide pane
          this.hideSection();
        }
      };

      const removedHandler = () => {
        this.hideSection();
      };

      this.editor.on('selection-change', selectionHandler);
      this.editor.on('conditional-section-removed', removedHandler);

      this.eventCleanup.push(() => {
        this.editor?.off('selection-change', selectionHandler);
        this.editor?.off('conditional-section-removed', removedHandler);
      });
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Predicate input
    this.predicateInput = this.createTextInput({ placeholder: 'isActive' });
    container.appendChild(this.createFormGroup('Condition:', this.predicateInput, {
      hint: 'Boolean expression evaluated against merge data (e.g., "isActive", "count > 0")'
    }));

    // Apply button
    const applyBtn = this.createButton('Apply Changes', { variant: 'primary' });
    this.addButtonListener(applyBtn, () => this.applyChanges());
    container.appendChild(applyBtn);

    // Remove button
    const removeBtn = this.createButton('Remove Condition', { variant: 'danger' });
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
  showSection(section: ConditionalSection): void {
    this.currentSection = section;

    if (this.predicateInput) {
      this.predicateInput.value = section.predicate;
    }
    if (this.positionHint) {
      this.positionHint.textContent = `Condition from position ${section.startIndex} to ${section.endIndex}`;
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

    const predicate = this.predicateInput?.value.trim();
    if (!predicate) {
      this.onApplyCallback?.(false, new Error('Predicate cannot be empty'));
      return;
    }

    if (predicate === this.currentSection.predicate) {
      return; // No changes
    }

    try {
      const success = this.editor.updateConditionalSectionPredicate(this.currentSection.id, predicate);

      if (success) {
        this.currentSection = this.editor.getConditionalSection(this.currentSection.id) || null;
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
      this.editor.removeConditionalSection(this.currentSection.id);
      this.hideSection();
      this.onRemoveCallback?.(true);
    } catch {
      this.onRemoveCallback?.(false);
    }
  }

  /**
   * Get the currently selected section.
   */
  getCurrentSection(): ConditionalSection | null {
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
