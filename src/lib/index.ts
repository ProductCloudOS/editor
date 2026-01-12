export { PCEditor } from './core/PCEditor';

export * from './types';

export { Document } from './core/Document';
export { Page } from './core/Page';

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
  TextLayout,
  TextPositionCalculator,
  BaseTextRegion,
  RegionManager,
  BodyTextRegion,
  HeaderTextRegion,
  FooterTextRegion
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
  ParagraphFormatting,
  EditableTextRegion,
  RegionType,
  LineAtYResult,
  PageBoundsProvider,
  HeaderBoundsProvider,
  FooterBoundsProvider
} from './text';

// Objects module exports
export {
  BaseEmbeddedObject,
  ImageObject,
  TextBoxObject,
  TableObject,
  TableRow,
  TableCell,
  EmbeddedObjectFactory
} from './objects';

export type {
  EmbeddedObjectConfig,
  EmbeddedObjectData,
  ImageObjectConfig,
  TextBoxObjectConfig,
  TableObjectConfig,
  TableCellConfig,
  TableRowConfig,
  TableColumnConfig,
  CellAddress,
  CellRange,
  ResizeHandle,
  Size,
  Point,
  Rect,
  ImageFitMode
} from './objects';

// Clipboard module exports
export {
  ClipboardManager,
  HtmlConverter
} from './clipboard';

export type {
  ClipboardContent,
  ClipboardReadResult,
  PCEditorClipboardData,
  ClipboardContentType,
  CopyOptions,
  PasteOptions
} from './clipboard';

// Controls module exports (optional components)
export {
  BaseControl,
  HorizontalRuler,
  VerticalRuler,
  RulerControl
} from './controls';

export type {
  EditorControl,
  ControlAttachOptions,
  ControlOptions,
  Units,
  RulerOptions,
  RulerOrientation,
  TickMark
} from './controls';