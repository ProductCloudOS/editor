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

// Table
export { TableObject, TableRow, TableCell } from './table';
export type {
  TableObjectConfig,
  TableObjectData,
  TableRowConfig,
  TableRowData,
  TableCellConfig,
  TableCellData,
  TableColumnConfig,
  CellAddress,
  CellRange,
  CellBorder,
  CellPadding,
  VerticalAlign
} from './table';

// Factory
export { EmbeddedObjectFactory } from './EmbeddedObjectFactory';
