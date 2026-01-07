// Types
export type {
  Focusable,
  TextFormattingStyle,
  TextRun,
  SubstitutionField,
  SubstitutionFieldConfig,
  FlowedLine,
  FlowedPage,
  FlowedSubstitutionField,
  FlowedEmbeddedObject,
  RepeatingSection,
  RepeatingSectionVisualState,
  ObjectPosition,
  TextAlignment,
  ParagraphFormatting
} from './types';

export { DEFAULT_FORMATTING, OBJECT_REPLACEMENT_CHAR } from './types';

// Classes
export { FlowingTextContent } from './FlowingTextContent';
export { TextState } from './TextState';
export type { FieldCheckCallback } from './TextState';
export { TextFormattingManager } from './TextFormatting';
export { SubstitutionFieldManager } from './SubstitutionFieldManager';
export { EmbeddedObjectManager } from './EmbeddedObjectManager';
export type { EmbeddedObjectEntry } from './EmbeddedObjectManager';
export { RepeatingSectionManager } from './RepeatingSectionManager';
export { TextMeasurer } from './TextMeasurer';
export type { EmbeddedMeasurement } from './TextMeasurer';
export { TextLayout } from './TextLayout';
export type { LayoutContext } from './TextLayout';
export { TextPositionCalculator } from './TextPositionCalculator';
export type { LineAtYResult } from './TextPositionCalculator';
export { BaseTextRegion } from './EditableTextRegion';
export type { EditableTextRegion, RegionType } from './EditableTextRegion';
export { RegionManager } from './RegionManager';

// Region implementations
export { BodyTextRegion, HeaderTextRegion, FooterTextRegion } from './regions';
export type { PageBoundsProvider, HeaderBoundsProvider, FooterBoundsProvider } from './regions';
