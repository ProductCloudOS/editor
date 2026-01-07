// Object types
export type {
  ObjectPosition,
  ResizeHandle,
  Size,
  Point,
  Rect,
  EmbeddedObjectConfig,
  EmbeddedObjectData,
  ImageObjectConfig,
  TextBoxObjectConfig,
  ImageFitMode,
  BorderStyle,
  BorderSide,
  TextBoxBorder
} from './types';

export { DEFAULT_BORDER_SIDE } from './types';

// Base class
export { BaseEmbeddedObject } from './BaseEmbeddedObject';

// Concrete object types
export { ImageObject } from './ImageObject';
export { TextBoxObject } from './TextBoxObject';

// Factory
export { EmbeddedObjectFactory } from './EmbeddedObjectFactory';
