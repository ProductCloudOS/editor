export { PCEditor } from './core/PCEditor';

export * from './types';

export { BaseElement } from './elements/BaseElement';

export { Document } from './core/Document';
export { Page } from './core/Page';
export { Section } from './core/Section';

export { EventEmitter } from './events/EventEmitter';

// Text module exports
export {
  FlowingTextContent,
  TextState,
  TextFormattingManager,
  SubstitutionFieldManager,
  EmbeddedObjectManager,
  RepeatingSectionManager,
  TextMeasurer,
  TextLayout
} from './text';

export type {
  TextFormattingStyle,
  TextRun,
  SubstitutionField,
  SubstitutionFieldConfig,
  RepeatingSection,
  RepeatingSectionVisualState,
  FlowedLine,
  FlowedPage,
  FlowedSubstitutionField,
  FlowedEmbeddedObject,
  ObjectPosition,
  TextAlignment,
  ParagraphFormatting
} from './text';

// Objects module exports
export {
  BaseEmbeddedObject,
  ImageObject,
  TextBoxObject,
  EmbeddedObjectFactory
} from './objects';

export type {
  EmbeddedObjectConfig,
  EmbeddedObjectData,
  ImageObjectConfig,
  TextBoxObjectConfig,
  ResizeHandle,
  Size,
  Point,
  Rect,
  ImageFitMode
} from './objects';