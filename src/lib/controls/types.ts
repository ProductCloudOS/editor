/**
 * Types for optional editor controls.
 * Controls are standalone components that interact with PCEditor via public API only.
 */

import type { PCEditor } from '../core/PCEditor';

/**
 * Units for measurement display.
 */
export type Units = 'mm' | 'in' | 'px' | 'pt';

/**
 * Options for attaching a control to an editor.
 */
export interface ControlAttachOptions {
  /** The PCEditor instance to attach to */
  editor: PCEditor;
  /** Container element where the control should be rendered */
  container: HTMLElement;
}

/**
 * Base interface for all editor controls.
 */
export interface EditorControl {
  /** Unique identifier for this control instance */
  readonly id: string;
  /** Whether the control is currently attached to an editor */
  readonly isAttached: boolean;
  /** Attach the control to an editor */
  attach(options: ControlAttachOptions): void;
  /** Detach the control from the editor */
  detach(): void;
  /** Update the control's display */
  update(): void;
  /** Show the control */
  show(): void;
  /** Hide the control */
  hide(): void;
  /** Clean up and destroy the control */
  destroy(): void;
}

/**
 * Control visibility state.
 */
export type ControlVisibility = 'visible' | 'hidden';

/**
 * Base options for creating a control.
 */
export interface ControlOptions {
  /** Initial visibility state */
  visible?: boolean;
}
