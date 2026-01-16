/**
 * Types for editor panes.
 * Panes are property editors that interact with PCEditor via public API only.
 */

import type { PCEditor } from '../core/PCEditor';
import type { ControlOptions, ControlAttachOptions } from '../controls/types';

/**
 * Options for creating a pane.
 */
export interface PaneOptions extends ControlOptions {
  /** CSS class to add to the pane element */
  className?: string;
}

/**
 * Options for attaching a pane to an editor.
 */
export interface PaneAttachOptions extends ControlAttachOptions {
  /** The PCEditor instance to attach to */
  editor: PCEditor;
  /** Container element where the pane should be rendered */
  container: HTMLElement;
  /**
   * Optional section element to show/hide when the pane is shown/hidden.
   * If provided, this element's display will be controlled instead of the pane element.
   * Useful for integrating with collapsible section layouts.
   */
  sectionElement?: HTMLElement;
}

/**
 * Border configuration for a single side.
 */
export interface BorderSideConfig {
  width: number;
  color: string;
  style: 'solid' | 'dashed' | 'dotted' | 'none';
}

/**
 * Full border configuration (all four sides).
 */
export interface BorderConfig {
  top: BorderSideConfig;
  right: BorderSideConfig;
  bottom: BorderSideConfig;
  left: BorderSideConfig;
}

/**
 * Cell padding configuration.
 */
export interface CellPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Updates that can be applied to table cells.
 */
export interface CellUpdates {
  backgroundColor?: string;
  border?: Partial<BorderConfig>;
  padding?: number | CellPadding;
}

/**
 * Table default settings.
 */
export interface TableDefaults {
  cellPadding?: number;
  borderColor?: string;
  borderWidth?: number;
}

/**
 * Header styling options.
 */
export interface HeaderStyle {
  backgroundColor?: string;
  bold?: boolean;
}

/**
 * Text box update properties.
 */
export interface TextBoxUpdates {
  position?: 'inline' | 'block' | 'relative';
  relativeOffset?: { x: number; y: number };
  backgroundColor?: string;
  border?: BorderConfig;
  padding?: number;
}

/**
 * Image update properties.
 */
export interface ImageUpdates {
  position?: 'inline' | 'block' | 'relative';
  relativeOffset?: { x: number; y: number };
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'tile';
  resizeMode?: 'free' | 'locked-aspect-ratio';
  alt?: string;
}

/**
 * Image source options.
 */
export interface ImageSourceOptions {
  maxWidth?: number;
  maxHeight?: number;
}
