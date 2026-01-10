/**
 * Hit test system types for efficient click/hover detection.
 *
 * All coordinates are in document space (not affected by zoom).
 */

import { Rect, ResizeHandle } from '../objects/types';
import type { BaseEmbeddedObject } from '../objects/BaseEmbeddedObject';
import type { TableObject } from '../objects/table/TableObject';

/**
 * Categories for hit targets, enabling efficient selective deregistration.
 *
 * - 'content': Targets registered during reflow (text, objects, cells)
 * - 'resize-handles': Resize handles for selected objects
 * - 'table-dividers': Column/row dividers for focused table
 */
export type HitTargetCategory = 'content' | 'resize-handles' | 'table-dividers';

/**
 * Types of hit targets.
 */
export type HitTargetType =
  | 'resize-handle'
  | 'embedded-object'
  | 'table-cell'
  | 'table-divider'
  | 'text-region'
  | 'substitution-field';

/**
 * Priority constants for hit targets.
 * Higher values are checked first (have priority over lower values).
 */
export const HIT_PRIORITY = {
  RESIZE_HANDLE: 100,
  TABLE_DIVIDER: 90,
  EMBEDDED_OBJECT: 80,
  TABLE_CELL: 70,
  SUBSTITUTION_FIELD: 60,
  TEXT_REGION: 50,
} as const;

/**
 * Data for a resize handle target.
 */
export interface ResizeHandleData {
  type: 'resize-handle';
  handle: ResizeHandle;
  element: BaseEmbeddedObject;
}

/**
 * Data for an embedded object target.
 */
export interface EmbeddedObjectData {
  type: 'embedded-object';
  object: BaseEmbeddedObject;
}

/**
 * Data for a table cell target.
 */
export interface TableCellData {
  type: 'table-cell';
  table: TableObject;
  row: number;
  col: number;
}

/**
 * Data for a table divider (column/row border) target.
 */
export interface TableDividerData {
  type: 'table-divider';
  table: TableObject;
  dividerType: 'row' | 'column';
  index: number;
}

/**
 * Data for a text region target.
 */
export interface TextRegionData {
  type: 'text-region';
  lineIndex: number;
  /** Starting text index of this line */
  startIndex: number;
  /** Ending text index of this line */
  endIndex: number;
}

/**
 * Data for a substitution field target.
 */
export interface SubstitutionFieldData {
  type: 'substitution-field';
  fieldId: string;
  textIndex: number;
}

/**
 * Union of all hit target data types.
 */
export type HitTargetData =
  | ResizeHandleData
  | EmbeddedObjectData
  | TableCellData
  | TableDividerData
  | TextRegionData
  | SubstitutionFieldData;

/**
 * A hit target registered in the HitTestManager.
 */
export interface HitTarget {
  /** The type of target */
  type: HitTargetType;
  /** Category for selective deregistration */
  category: HitTargetCategory;
  /** Bounding rectangle in document coordinates */
  bounds: Rect;
  /** Priority for overlapping targets (higher = checked first) */
  priority: number;
  /** Type-specific data */
  data: HitTargetData;
}

/**
 * Result of a hit test query.
 */
export interface HitTestResult {
  /** The page index where the hit occurred */
  pageIndex: number;
  /** The hit target that was found */
  target: HitTarget;
}
