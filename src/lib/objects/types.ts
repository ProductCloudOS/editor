/**
 * Object-related type definitions for embedded objects in text flow.
 */

/**
 * Position type for objects within text flow.
 * - inline: Within text flow, affects line height
 * - block: Standalone paragraph with implicit newlines before and after
 * - relative: Free position relative to anchor point in text
 *
 * Note: Tables only support 'block' positioning.
 */
export type ObjectPosition = 'inline' | 'block' | 'relative';

/**
 * Offset for relative-positioned objects.
 * Position is relative to the top-left of the anchor line.
 */
export interface RelativeOffset {
  x: number;
  y: number;
}

/**
 * Resize handle positions.
 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * Basic size type.
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Basic point type.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Basic rectangle type.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Configuration for creating an embedded object.
 */
export interface EmbeddedObjectConfig {
  id: string;
  textIndex: number;
  position?: ObjectPosition;
  size: Size;
  relativeOffset?: RelativeOffset;  // For 'relative' position mode
}

/**
 * Serialized data for an embedded object.
 */
export interface EmbeddedObjectData {
  id: string;
  objectType: string;
  textIndex: number;
  position: ObjectPosition;
  size: Size;
  data: Record<string, unknown>;
  relativeOffset?: RelativeOffset;  // For 'relative' position mode
}

/**
 * Configuration specific to image objects.
 */
export interface ImageObjectConfig extends EmbeddedObjectConfig {
  src: string;
  fit?: ImageFitMode;
  resizeMode?: ImageResizeMode;
  alt?: string;
  naturalWidth?: number;   // Cached natural dimensions (for serialization)
  naturalHeight?: number;
}

/**
 * Border style options.
 */
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none';

/**
 * Configuration for a single border side.
 */
export interface BorderSide {
  width: number;
  color: string;
  style: BorderStyle;
}

/**
 * Full border configuration with per-side control.
 */
export interface TextBoxBorder {
  top: BorderSide;
  right: BorderSide;
  bottom: BorderSide;
  left: BorderSide;
}

/**
 * Default border side values.
 */
export const DEFAULT_BORDER_SIDE: BorderSide = {
  width: 1,
  color: '#cccccc',
  style: 'solid'
};

/**
 * Configuration specific to text box objects.
 */
export interface TextBoxObjectConfig extends EmbeddedObjectConfig {
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  /** @deprecated Use border instead */
  borderColor?: string;
  border?: Partial<TextBoxBorder>;
  padding?: number;
}

/**
 * Image fit modes - how the image content displays within its bounding box.
 * - contain: Fit image within bounds, preserving aspect ratio (letterboxed)
 * - cover: Fill bounds, preserving aspect ratio (may crop)
 * - fill: Stretch to fill (distorts if aspect ratios differ)
 * - none: Original size, centered
 * - tile: Repeat image to fill bounds
 */
export type ImageFitMode = 'contain' | 'cover' | 'fill' | 'none' | 'tile';

/**
 * Image resize modes - how the bounding box resizes when user drags handles.
 * - free: Width and height can be changed independently
 * - locked-aspect-ratio: Resizing preserves the original aspect ratio
 */
export type ImageResizeMode = 'free' | 'locked-aspect-ratio';
