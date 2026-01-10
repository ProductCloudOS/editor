/**
 * Transaction-Based Undo/Redo System Types
 *
 * This system uses method interception to capture all mutations
 * across all content sources (body, header, footer, table cells, text boxes).
 */

import { TextFormattingStyle, SubstitutionField } from '../../text/types';

/**
 * Identifies a content source for undo/redo purposes.
 */
export interface ContentSourceId {
  /** The type of content source */
  type: 'body' | 'header' | 'footer' | 'tablecell' | 'textbox';
  /** Object ID for textbox or table */
  objectId?: string;
  /** Cell address for table cells */
  cellAddress?: { row: number; col: number };
}

/**
 * Identifies an object for mutation tracking.
 */
export interface ObjectSourceId {
  /** The type of object */
  type: 'textbox' | 'image' | 'table';
  /** Object ID */
  objectId: string;
}

/**
 * Text mutation types.
 */
export type TextMutationType =
  | 'insert'
  | 'delete'
  | 'format'
  | 'alignment'
  | 'field-insert'
  | 'field-delete'
  | 'field-update';

/**
 * Object mutation types.
 */
export type ObjectMutationType =
  | 'object-insert'
  | 'object-delete'
  | 'object-resize'
  | 'object-move'
  | 'object-property'
  | 'table-add-row'
  | 'table-add-column'
  | 'table-delete-row'
  | 'table-delete-column'
  | 'table-merge'
  | 'table-split';

/**
 * All mutation types.
 */
export type MutationType = TextMutationType | ObjectMutationType;

/**
 * State of text content before/after a mutation.
 */
export interface ContentState {
  cursorPosition: number;
  selection: { start: number; end: number } | null;
}

/**
 * State of an object before/after a mutation.
 */
export interface ObjectState {
  /** Serialized object data for restoration */
  data: unknown;
}

/**
 * Data for text insert mutations.
 */
export interface InsertMutationData {
  position: number;
  text: string;
  formatting?: TextFormattingStyle;
}

/**
 * Data for text delete mutations.
 */
export interface DeleteMutationData {
  position: number;
  deletedText: string;
  deletedFormatting: Map<number, TextFormattingStyle>;
  /** Objects that were deleted (for restoration) */
  deletedObjects?: Array<{ offset: number; objectData: unknown }>;
  /** Fields that were deleted (for restoration) */
  deletedFields?: Array<{ offset: number; field: SubstitutionField }>;
}

/**
 * Data for format mutations.
 */
export interface FormatMutationData {
  start: number;
  end: number;
  newFormatting: Partial<TextFormattingStyle>;
  previousFormatting: Map<number, TextFormattingStyle>;
}

/**
 * Data for alignment mutations.
 */
export interface AlignmentMutationData {
  paragraphIndex: number;
  newAlignment: 'left' | 'center' | 'right' | 'justify';
  previousAlignment: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Data for field insert mutations.
 */
export interface FieldInsertMutationData {
  position: number;
  field: SubstitutionField;
}

/**
 * Data for field update mutations.
 */
export interface FieldUpdateMutationData {
  textIndex: number;
  previousData: Partial<SubstitutionField>;
  newData: Partial<SubstitutionField>;
}

/**
 * Data for object resize mutations.
 */
export interface ResizeMutationData {
  previousSize: { width: number; height: number };
  newSize: { width: number; height: number };
}

/**
 * Data for object move mutations.
 */
export interface MoveMutationData {
  previousOffset: { x: number; y: number };
  newOffset: { x: number; y: number };
}

/**
 * Data for object property mutations.
 */
export interface PropertyMutationData {
  propertyName: string;
  previousValue: unknown;
  newValue: unknown;
}

/**
 * Data for object insert/delete mutations.
 */
export interface ObjectMutationData {
  position: number;
  objectData: unknown;
}

/**
 * Data for table structure mutations.
 */
export interface TableStructureMutationData {
  /** Snapshot of table before the change */
  beforeSnapshot: unknown;
  /** Snapshot of table after the change */
  afterSnapshot: unknown;
  /** Row/column index affected */
  index?: number;
}

/**
 * Union of all mutation data types.
 */
export type MutationData =
  | InsertMutationData
  | DeleteMutationData
  | FormatMutationData
  | AlignmentMutationData
  | FieldInsertMutationData
  | FieldUpdateMutationData
  | ResizeMutationData
  | MoveMutationData
  | PropertyMutationData
  | ObjectMutationData
  | TableStructureMutationData;

/**
 * A single mutation record.
 */
export interface MutationRecord {
  /** Unique ID for this mutation */
  id: string;
  /** Source of the mutation (content or object) */
  sourceId: ContentSourceId | ObjectSourceId;
  /** Type of mutation */
  type: MutationType;
  /** When this mutation occurred */
  timestamp: number;
  /** State before the mutation */
  beforeState: ContentState | ObjectState;
  /** State after the mutation */
  afterState: ContentState | ObjectState;
  /** Mutation-specific data */
  data: MutationData;
}

/**
 * Focus state for cursor/selection restoration.
 */
export interface FocusState {
  /** Which section is active (body/header/footer) */
  activeSection: 'body' | 'header' | 'footer';
  /** ID of focused object (textbox, table) */
  focusedObjectId: string | null;
  /** If a table is focused, which cell */
  tableCellAddress: { row: number; col: number } | null;
  /** Cursor position within active content */
  cursorPosition: number;
  /** Selection range if any */
  selection: { start: number; end: number } | null;
}

/**
 * A transaction groups related mutations into a single undoable unit.
 */
export interface Transaction {
  /** Unique ID for this transaction */
  id: string;
  /** When this transaction started */
  startTime: number;
  /** When this transaction ended */
  endTime: number;
  /** All mutations in this transaction */
  mutations: MutationRecord[];
  /** Focus state before the transaction */
  focusStateBefore: FocusState;
  /** Focus state after the transaction */
  focusStateAfter: FocusState;
  /** Human-readable description */
  description: string;
}

/**
 * Configuration for coalescing mutations.
 */
export interface CoalesceConfig {
  /** Maximum time gap between mutations to coalesce (ms) */
  maxTimeGap: number;
  /** Maximum characters before forcing a new transaction */
  maxCharacters: number;
}

/**
 * Default coalescing configuration.
 */
export const DEFAULT_COALESCE_CONFIG: CoalesceConfig = {
  maxTimeGap: 500,
  maxCharacters: 50
};

/**
 * Events emitted by the TransactionManager.
 */
export interface TransactionManagerEvents {
  'state-changed': { canUndo: boolean; canRedo: boolean };
  'undo-performed': { transaction: Transaction };
  'redo-performed': { transaction: Transaction };
  'transaction-committed': { transaction: Transaction };
  'history-cleared': void;
}

/**
 * Generate a unique ID for transactions and mutations.
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
