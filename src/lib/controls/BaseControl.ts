/**
 * BaseControl - Abstract base class for all editor controls.
 *
 * Controls are optional components that work with PCEditor via the public API only.
 * They are completely decoupled from the core library.
 */

import { EventEmitter } from '../events/EventEmitter';
import type { PCEditor } from '../core/PCEditor';
import type { EditorControl, ControlAttachOptions, ControlOptions } from './types';

/**
 * Abstract base class for editor controls.
 */
export abstract class BaseControl extends EventEmitter implements EditorControl {
  readonly id: string;
  protected _isAttached: boolean = false;
  protected _isVisible: boolean = true;
  protected editor: PCEditor | null = null;
  protected container: HTMLElement | null = null;
  protected element: HTMLElement | null = null;
  protected eventCleanup: Array<() => void> = [];

  constructor(id: string, options: ControlOptions = {}) {
    super();
    this.id = id;
    this._isVisible = options.visible !== false;
  }

  get isAttached(): boolean {
    return this._isAttached;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  /**
   * Attach the control to an editor.
   */
  attach(options: ControlAttachOptions): void {
    if (this._isAttached) {
      throw new Error(`Control ${this.id} is already attached`);
    }

    this.editor = options.editor;
    this.container = options.container;

    // Create the control element
    this.element = this.createElement();
    this.container.appendChild(this.element);

    // Set up event listeners on the editor
    this.setupEventListeners();

    this._isAttached = true;

    // Initial update
    this.update();

    // Apply visibility
    if (!this._isVisible) {
      this.element.style.display = 'none';
    }

    this.emit('attached', { editor: this.editor });
  }

  /**
   * Detach the control from the editor.
   */
  detach(): void {
    if (!this._isAttached) {
      return;
    }

    // Clean up event listeners
    this.cleanupEventListeners();

    // Remove element from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this._isAttached = false;
    this.editor = null;
    this.container = null;
    this.element = null;

    this.emit('detached', undefined);
  }

  /**
   * Show the control.
   */
  show(): void {
    this._isVisible = true;
    if (this.element) {
      this.element.style.display = '';
      this.update();
    }
    this.emit('visibility-changed', { visible: true });
  }

  /**
   * Hide the control.
   */
  hide(): void {
    this._isVisible = false;
    if (this.element) {
      this.element.style.display = 'none';
    }
    this.emit('visibility-changed', { visible: false });
  }

  /**
   * Toggle visibility.
   */
  toggle(): void {
    if (this._isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Clean up and destroy the control.
   */
  destroy(): void {
    this.detach();
    this.removeAllListeners();
  }

  /**
   * Create the control's DOM element.
   * Subclasses must implement this.
   */
  protected abstract createElement(): HTMLElement;

  /**
   * Set up event listeners on the editor.
   * Subclasses should override this to add their own listeners.
   */
  protected setupEventListeners(): void {
    // Default implementation - subclasses add their own
  }

  /**
   * Clean up event listeners.
   */
  protected cleanupEventListeners(): void {
    for (const cleanup of this.eventCleanup) {
      cleanup();
    }
    this.eventCleanup = [];
  }

  /**
   * Add an event listener with automatic cleanup.
   */
  protected addEditorListener<T>(
    event: string,
    handler: (data: T) => void
  ): void {
    if (this.editor) {
      this.editor.on(event, handler);
      this.eventCleanup.push(() => this.editor?.off(event, handler));
    }
  }

  /**
   * Update the control's display.
   * Subclasses must implement this.
   */
  abstract update(): void;
}
