/**
 * LayoutTree — the immutable output of the layout pass (refactor doc §3 P1).
 *
 * The tree fully paginates the document: every positioned piece of content —
 * every text line and every slice of every embedded object — is a
 * LayoutFragment carrying its page index and page-local rect. A page-spanning
 * table is simply N fragments on N pages.
 *
 * Rendering paints the tree; hit-testing and caret geometry query it. None of
 * them recompute layout, so they can never disagree about where content is.
 *
 * Content ranges are half-open: [start, end). A fragment "contains" caret
 * index i when start <= i < end; the position immediately after a block
 * object (its line's end boundary) therefore belongs to the NEXT fragment,
 * which is what makes "type after the table" unambiguous.
 */
import { Point, Rect } from '../../types';
import { FlowedLine } from '../../text/types';
import { BaseEmbeddedObject } from '../../objects/BaseEmbeddedObject';
import { TableObject } from '../../objects/table/TableObject';
import { TablePageSlice, TablePageLayout } from '../../objects/table/types';

/** Half-open character range [start, end). */
export interface ContentRange {
  start: number;
  end: number;
}

interface LayoutFragmentBase {
  /** Page this fragment is painted on (document page index). */
  pageIndex: number;
  /** Page-local rect (canvas pixel coordinates). */
  rect: Rect;
  /** Half-open character range this fragment covers. */
  contentRange: ContentRange;
}

/** A single visual line of text. */
export interface LineFragment extends LayoutFragmentBase {
  kind: 'line';
  line: FlowedLine;
}

/**
 * One page's slice of a block embedded object. Objects that fit on a single
 * page produce exactly one slice fragment ('only'); a page-spanning table
 * produces one per page ('first' | 'middle' | 'last').
 */
export interface ObjectSliceFragment extends LayoutFragmentBase {
  kind: 'object-slice';
  object: BaseEmbeddedObject;
  /** The line that anchors the object in the text flow. */
  line: FlowedLine;
  slicePosition: 'only' | 'first' | 'middle' | 'last';
  sliceIndex: number;
  /** Table-specific slice details (undefined for non-table objects). */
  tableSlice?: TablePageSlice;
  /** The full table page layout the slice belongs to. */
  tablePageLayout?: TablePageLayout;
}

export type LayoutFragment = LineFragment | ObjectSliceFragment;

export interface LayoutPage {
  pageIndex: number;
  fragments: LayoutFragment[];
  /** Total occupied content height on this page. */
  contentHeight: number;
}

/** Geometry the builder lays out against (uniform across pages). */
export interface LayoutGeometry {
  /** Page-local origin of the content area (inside margins). */
  contentOrigin: Point;
  contentWidth: number;
  /** Available content height on the first page. */
  availableHeightFirstPage: number;
  /** Available content height on subsequent pages. */
  availableHeightOtherPages: number;
}

/** Where a caret at a given character index should be anchored. */
export interface CaretLocation {
  pageIndex: number;
  fragment: LayoutFragment;
  /** Index of the fragment within its page's fragment list. */
  fragmentIndex: number;
}

export interface LayoutTree {
  pages: LayoutPage[];
  /** Derived page requirement — the single source of truth for page count. */
  readonly pageCount: number;
  /** Locate the fragment a caret index belongs to (half-open semantics). */
  caretLocation(index: number): CaretLocation | null;
  /** Topmost fragment containing a page-local point on the given page. */
  fragmentAt(pageIndex: number, point: Point): LayoutFragment | null;
  /** All fragments of a given table across pages (its slices, in order). */
  slicesForObject(objectId: string): ObjectSliceFragment[];
}

/** Narrowing helper for table slice fragments. */
export function isTableSlice(
  f: LayoutFragment
): f is ObjectSliceFragment & { object: TableObject } {
  return f.kind === 'object-slice' && f.object instanceof TableObject;
}
