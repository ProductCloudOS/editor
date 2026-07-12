/**
 * @productcloudos/editor — public API surface.
 *
 * v2.0.0 deliberately narrows this surface to the supported contract
 * (docs/refactor-v2.md §4): the editor class, the optional UI modules
 * (panes and rulers), the embedded-object classes consumers type-check
 * against, and the document/serialisation types. Internal machinery —
 * layout, rendering, text model, regions, undo, clipboard — is no longer
 * exported; it is not part of the compatibility contract and changes
 * without notice.
 */

// The editor
export { PCEditor } from './core/PCEditor';

// Public types: options, events, selection, document/serialisation format
export * from './types';

// Embedded object classes (returned by selection/focus APIs; instanceof
// checks in hosts) and their configuration/serialisation types
export {
  BaseEmbeddedObject,
  ImageObject,
  TextBoxObject,
  TableObject,
  TableRow,
  TableCell
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
  ImageFitMode
} from './objects';

// Content-facing types used in PCEditor method signatures
export type {
  TextFormattingStyle,
  SubstitutionField,
  SubstitutionFieldConfig,
  RepeatingSection,
  ConditionalSection,
  ObjectPosition,
  TextAlignment,
  ParagraphFormatting
} from './text';

// Optional ruler controls
export {
  BaseControl,
  HorizontalRuler,
  VerticalRuler
} from './controls';

export type {
  EditorControl,
  ControlAttachOptions,
  ControlOptions,
  Units,
  RulerOptions,
  RulerOrientation
} from './controls';

// Optional property-editor panes
export {
  BasePane,
  DocumentInfoPane,
  ViewSettingsPane,
  DocumentSettingsPane,
  MergeDataPane,
  FormattingPane,
  HyperlinkPane,
  SubstitutionFieldPane,
  RepeatingSectionPane,
  ConditionalSectionPane,
  TableRowLoopPane,
  TextBoxPane,
  ImagePane,
  TablePane
} from './panes';

export type {
  PaneOptions,
  PaneAttachOptions,
  BorderSideConfig,
  BorderConfig,
  CellPadding,
  CellUpdates,
  TableDefaults,
  HeaderStyle,
  TextBoxUpdates,
  ImageUpdates,
  ImageSourceOptions,
  ViewSettingsPaneOptions,
  MergeDataPaneOptions,
  FormattingPaneOptions,
  HyperlinkData,
  HyperlinkPaneOptions,
  SubstitutionFieldPaneOptions,
  RepeatingSectionPaneOptions,
  ConditionalSectionPaneOptions,
  TableRowLoopPaneOptions,
  TextBoxPaneOptions,
  ImagePaneOptions,
  TablePaneOptions
} from './panes';

// PDF import: the pipeline runs behind PCEditor.importPDF; only the option,
// progress/result, and error types are part of the contract
export { PDFImportError, PDFImportErrorCode, DEFAULT_IMPORT_OPTIONS } from './import';
export type {
  PDFImportProgress,
  PDFImportResult,
  PDFImportOptions
} from './import';

// Font registration types (PCEditor.registerFont)
export type { RegisterFontOptions, FontRegistration, FontVariant } from './fonts';
