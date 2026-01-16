/**
 * ViewSettingsPane - Toggle buttons for view options.
 *
 * Toggles:
 * - Rulers (requires external callback since rulers are optional controls)
 * - Control characters
 * - Margin lines
 * - Grid
 */

import { BasePane } from './BasePane';
import type { PaneOptions, PaneAttachOptions } from './types';

/**
 * Options for ViewSettingsPane.
 */
export interface ViewSettingsPaneOptions extends PaneOptions {
  /**
   * Callback to toggle rulers visibility.
   * Since rulers are optional external controls, this must be provided
   * by the consumer if ruler toggle is desired.
   */
  onToggleRulers?: () => void;
  /**
   * Initial state for rulers visibility.
   */
  rulersVisible?: boolean;
}

export class ViewSettingsPane extends BasePane {
  private rulersBtn: HTMLButtonElement | null = null;
  private controlCharsBtn: HTMLButtonElement | null = null;
  private marginLinesBtn: HTMLButtonElement | null = null;
  private gridBtn: HTMLButtonElement | null = null;

  private onToggleRulers?: () => void;
  private rulersVisible: boolean;

  constructor(id: string = 'view-settings', options: ViewSettingsPaneOptions = {}) {
    super(id, { className: 'pc-pane-view-settings', ...options });
    this.onToggleRulers = options.onToggleRulers;
    this.rulersVisible = options.rulersVisible ?? true;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    // Subscribe to editor events
    if (this.editor) {
      const updateHandler = () => this.updateButtonStates();

      this.editor.on('grid-changed', updateHandler);
      this.editor.on('margin-lines-changed', updateHandler);
      this.editor.on('control-characters-changed', updateHandler);

      this.eventCleanup.push(() => {
        this.editor?.off('grid-changed', updateHandler);
        this.editor?.off('margin-lines-changed', updateHandler);
        this.editor?.off('control-characters-changed', updateHandler);
      });

      // Initial state
      this.updateButtonStates();
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'pc-pane-button-group pc-pane-view-toggles';

    // Rulers toggle (only if callback provided)
    if (this.onToggleRulers) {
      this.rulersBtn = this.createToggleButton('Rulers', this.rulersVisible);
      this.addButtonListener(this.rulersBtn, () => this.toggleRulers());
      container.appendChild(this.rulersBtn);
    }

    // Control characters toggle
    this.controlCharsBtn = this.createToggleButton('Control Chars', false);
    this.addButtonListener(this.controlCharsBtn, () => this.toggleControlChars());
    container.appendChild(this.controlCharsBtn);

    // Margin lines toggle
    this.marginLinesBtn = this.createToggleButton('Margin Lines', true);
    this.addButtonListener(this.marginLinesBtn, () => this.toggleMarginLines());
    container.appendChild(this.marginLinesBtn);

    // Grid toggle
    this.gridBtn = this.createToggleButton('Grid', true);
    this.addButtonListener(this.gridBtn, () => this.toggleGrid());
    container.appendChild(this.gridBtn);

    return container;
  }

  private createToggleButton(label: string, active: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pc-pane-toggle';
    if (active) {
      button.classList.add('pc-pane-toggle--active');
    }
    button.textContent = label;
    button.title = `Toggle ${label}`;
    return button;
  }

  private toggleRulers(): void {
    if (this.onToggleRulers) {
      this.onToggleRulers();
      this.rulersVisible = !this.rulersVisible;
      this.rulersBtn?.classList.toggle('pc-pane-toggle--active', this.rulersVisible);
    }
  }

  private toggleControlChars(): void {
    if (!this.editor) return;
    const current = this.editor.getShowControlCharacters();
    this.editor.setShowControlCharacters(!current);
  }

  private toggleMarginLines(): void {
    if (!this.editor) return;
    const current = this.editor.getShowMarginLines();
    this.editor.setShowMarginLines(!current);
  }

  private toggleGrid(): void {
    if (!this.editor) return;
    const current = this.editor.getShowGrid();
    this.editor.setShowGrid(!current);
  }

  private updateButtonStates(): void {
    if (!this.editor) return;

    if (this.controlCharsBtn) {
      this.controlCharsBtn.classList.toggle(
        'pc-pane-toggle--active',
        this.editor.getShowControlCharacters()
      );
    }

    if (this.marginLinesBtn) {
      this.marginLinesBtn.classList.toggle(
        'pc-pane-toggle--active',
        this.editor.getShowMarginLines()
      );
    }

    if (this.gridBtn) {
      this.gridBtn.classList.toggle(
        'pc-pane-toggle--active',
        this.editor.getShowGrid()
      );
    }
  }

  /**
   * Update ruler button state externally (since rulers are external controls).
   */
  setRulersVisible(visible: boolean): void {
    this.rulersVisible = visible;
    this.rulersBtn?.classList.toggle('pc-pane-toggle--active', visible);
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    this.updateButtonStates();
  }
}
