/**
 * Object-related type definitions for embedded objects in text flow.
 */

/**
 * Position type for objects within text flow.
 */
export type ObjectPosition = 'inline' | 'float-left' | 'float-right';

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
}

/**
 * Configuration specific to image objects.
 */
export interface ImageObjectConfig extends EmbeddedObjectConfig {
  src: string;
  fit?: 'contain' | 'cover' | 'fill' | 'none';
  alt?: string;
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
 * Image fit modes.
 */
export type ImageFitMode = 'contain' | 'cover' | 'fill' | 'none';
