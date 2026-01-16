/**
 * BasePane - Abstract base class for editor property panes.
 *
 * Panes are property editors that work with PCEditor via the public API only.
 * They are content-only (no title bar) for flexible layout by consumers.
 */

import { BaseControl } from '../controls/BaseControl';
import type { PaneOptions, PaneAttachOptions } from './types';

/**
 * Abstract base class for editor panes.
 */
export abstract class BasePane extends BaseControl {
  protected className: string;
  protected sectionElement: HTMLElement | null = null;

  constructor(id: string, options: PaneOptions = {}) {
    super(id, options);
    this.className = options.className || '';
  }

  /**
   * Attach the pane to an editor.
   */
  attach(options: PaneAttachOptions): void {
    // Store the section element if provided
    this.sectionElement = options.sectionElement || null;
    super.attach(options);
  }

  /**
   * Show the pane (and section element if provided).
   */
  show(): void {
    this._isVisible = true;
    if (this.sectionElement) {
      this.sectionElement.style.display = '';
    }
    if (this.element) {
      this.element.style.display = '';
      this.update();
    }
    this.emit('visibility-changed', { visible: true });
  }

  /**
   * Hide the pane (and section element if provided).
   */
  hide(): void {
    this._isVisible = false;
    if (this.sectionElement) {
      this.sectionElement.style.display = 'none';
    }
    if (this.element) {
      this.element.style.display = 'none';
    }
    this.emit('visibility-changed', { visible: false });
  }

  /**
   * Create a form group element with label.
   */
  protected createFormGroup(label: string, inputElement: HTMLElement, options?: {
    hint?: string;
    inline?: boolean;
  }): HTMLElement {
    const group = document.createElement('div');
    group.className = 'pc-pane-form-group';
    if (options?.inline) {
      group.classList.add('pc-pane-form-group--inline');
    }

    const labelEl = document.createElement('label');
    labelEl.className = 'pc-pane-label';
    labelEl.textContent = label;

    group.appendChild(labelEl);
    group.appendChild(inputElement);

    if (options?.hint) {
      const hintEl = document.createElement('span');
      hintEl.className = 'pc-pane-hint';
      hintEl.textContent = options.hint;
      group.appendChild(hintEl);
    }

    return group;
  }

  /**
   * Create a text input element.
   */
  protected createTextInput(options?: {
    type?: string;
    placeholder?: string;
    value?: string;
  }): HTMLInputElement {
    const input = document.createElement('input');
    input.type = options?.type || 'text';
    input.className = 'pc-pane-input';
    if (options?.placeholder) {
      input.placeholder = options.placeholder;
    }
    if (options?.value !== undefined) {
      input.value = options.value;
    }
    return input;
  }

  /**
   * Create a number input element.
   */
  protected createNumberInput(options?: {
    min?: number;
    max?: number;
    step?: number;
    value?: number;
  }): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'pc-pane-input pc-pane-input--number';
    if (options?.min !== undefined) input.min = String(options.min);
    if (options?.max !== undefined) input.max = String(options.max);
    if (options?.step !== undefined) input.step = String(options.step);
    if (options?.value !== undefined) input.value = String(options.value);
    return input;
  }

  /**
   * Create a select element with options.
   */
  protected createSelect(optionsList: Array<{ value: string; label: string }>, selectedValue?: string): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'pc-pane-select';

    for (const opt of optionsList) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    return select;
  }

  /**
   * Create a color input element.
   */
  protected createColorInput(value?: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'pc-pane-color';
    if (value) {
      input.value = value;
    }
    return input;
  }

  /**
   * Create a checkbox element.
   */
  protected createCheckbox(label: string, checked?: boolean): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'pc-pane-checkbox';

    const input = document.createElement('input');
    input.type = 'checkbox';
    if (checked) {
      input.checked = true;
    }

    const span = document.createElement('span');
    span.textContent = label;

    wrapper.appendChild(input);
    wrapper.appendChild(span);

    return wrapper;
  }

  /**
   * Create a button element.
   */
  protected createButton(label: string, options?: {
    variant?: 'primary' | 'secondary' | 'danger';
    icon?: string;
  }): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pc-pane-button';
    if (options?.variant) {
      button.classList.add(`pc-pane-button--${options.variant}`);
    }
    button.textContent = label;
    return button;
  }

  /**
   * Create a button group container.
   */
  protected createButtonGroup(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'pc-pane-button-group';
    return group;
  }

  /**
   * Create a section divider with optional label.
   */
  protected createSection(label?: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'pc-pane-section';

    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'pc-pane-section-label';
      labelEl.textContent = label;
      section.appendChild(labelEl);
    }

    return section;
  }

  /**
   * Create a row container for inline elements.
   */
  protected createRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'pc-pane-row';
    return row;
  }

  /**
   * Create a hint/info text element.
   */
  protected createHint(text: string): HTMLElement {
    const hint = document.createElement('div');
    hint.className = 'pc-pane-hint';
    hint.textContent = text;
    return hint;
  }

  /**
   * Add immediate apply listener for text inputs (blur + Enter).
   */
  protected addImmediateApplyListener(
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    handler: (value: string) => void
  ): void {
    const apply = () => {
      handler(element.value);
    };

    // Selects and color inputs: apply on change
    if (element instanceof HTMLSelectElement ||
        (element instanceof HTMLInputElement && element.type === 'color')) {
      element.addEventListener('change', apply);
      this.eventCleanup.push(() => element.removeEventListener('change', apply));
    } else {
      // Text/number inputs: apply on blur or Enter
      element.addEventListener('blur', apply);
      const keyHandler = (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          e.preventDefault();
          apply();
        }
      };
      element.addEventListener('keydown', keyHandler);
      this.eventCleanup.push(() => {
        element.removeEventListener('blur', apply);
        element.removeEventListener('keydown', keyHandler);
      });
    }
  }

  /**
   * Add immediate apply listener for checkbox inputs.
   */
  protected addCheckboxListener(
    element: HTMLInputElement,
    handler: (checked: boolean) => void
  ): void {
    const apply = () => handler(element.checked);
    element.addEventListener('change', apply);
    this.eventCleanup.push(() => element.removeEventListener('change', apply));
  }

  /**
   * Add button click handler with focus steal prevention.
   */
  protected addButtonListener(
    button: HTMLButtonElement,
    handler: () => void
  ): void {
    // Prevent focus steal on mousedown
    const preventFocus = (e: MouseEvent) => {
      e.preventDefault();
      this.saveEditorContext();
    };

    button.addEventListener('mousedown', preventFocus);
    button.addEventListener('click', handler);

    this.eventCleanup.push(() => {
      button.removeEventListener('mousedown', preventFocus);
      button.removeEventListener('click', handler);
    });
  }

  /**
   * Save editor context before UI elements steal focus.
   */
  protected saveEditorContext(): void {
    if (this.editor) {
      this.editor.saveEditingContext();
    }
  }

  /**
   * Abstract method: create the pane content DOM.
   * Subclasses implement this to build their form elements.
   */
  protected abstract createContent(): HTMLElement;

  /**
   * Final createElement that wraps content in pane structure.
   * Content-only, no title bar.
   */
  protected createElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'pc-pane';
    if (this.className) {
      wrapper.classList.add(this.className);
    }
    wrapper.setAttribute('data-pane-id', this.id);

    const content = this.createContent();
    wrapper.appendChild(content);

    return wrapper;
  }
}
