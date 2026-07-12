/**
 * Unit tests for the pure layout pass (Phase 1 of docs/refactor-v2.md).
 *
 * The LayoutTree must fully paginate content — including table slices — so
 * that rendering, hit-testing, and caret geometry all read one structure.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildLayoutTree, EMBEDDED_OBJECT_SPACING } from '../../../lib/layout/tree/buildLayoutTree';
import { LayoutGeometry } from '../../../lib/layout/tree/types';
import { FlowedLine } from '../../../lib/text/types';
import { TableObject } from '../../../lib/objects/table/TableObject';

const GEOMETRY: LayoutGeometry = {
  contentOrigin: { x: 50, y: 40 },
  contentWidth: 500,
  availableHeightFirstPage: 300,
  availableHeightOtherPages: 300
};

function mockCtx(): CanvasRenderingContext2D {
  return {
    measureText: vi.fn((text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3
    })),
    save: vi.fn(),
    restore: vi.fn(),
    font: ''
  } as unknown as CanvasRenderingContext2D;
}

function textLine(startIndex: number, endIndex: number, height = 20): FlowedLine {
  return {
    text: 'x'.repeat(Math.max(endIndex - startIndex, 0)),
    width: 100,
    height,
    baseline: height * 0.8,
    runs: [],
    substitutionFields: [],
    embeddedObjects: [],
    startIndex,
    endIndex,
    alignment: 'left'
  };
}

function tableLine(table: TableObject, startIndex: number): FlowedLine {
  return {
    text: '￼',
    width: table.width,
    height: table.height,
    baseline: 0,
    runs: [],
    substitutionFields: [],
    embeddedObjects: [{ object: table, textIndex: startIndex, x: 0, isBlock: true }],
    startIndex,
    endIndex: startIndex + 1,
    alignment: 'left',
    isBlockObjectLine: true
  };
}

function makeTable(id: string, rowCount: number, rowHeight: number): TableObject {
  return new TableObject({
    id,
    columns: 1,
    rowData: Array.from({ length: rowCount }, (_, i) => ({
      height: rowHeight,
      cells: [{ content: `Row ${i + 1}` }]
    }))
  });
}

describe('buildLayoutTree', () => {
  it('paginates plain text lines by available height', () => {
    // 20 lines of 20px into 300px pages => 15 per page
    const lines = Array.from({ length: 20 }, (_, i) => textLine(i * 5, i * 5 + 5));
    const tree = buildLayoutTree(lines, GEOMETRY, mockCtx());

    expect(tree.pageCount).toBe(2);
    expect(tree.pages[0].fragments).toHaveLength(15);
    expect(tree.pages[1].fragments).toHaveLength(5);
    // Rects are page-local and stacked
    expect(tree.pages[0].fragments[0].rect.y).toBe(40);
    expect(tree.pages[0].fragments[1].rect.y).toBe(60);
    expect(tree.pages[1].fragments[0].rect.y).toBe(40);
  });

  it('honours explicit page breaks', () => {
    const l1 = textLine(0, 5);
    l1.endsWithPageBreak = true;
    const l2 = textLine(6, 11);
    const tree = buildLayoutTree([l1, l2], GEOMETRY, mockCtx());

    expect(tree.pageCount).toBe(2);
    expect(tree.pages[1].fragments[0].contentRange.start).toBe(6);
  });

  it('lays out a fitting table as a single "only" slice', () => {
    const table = makeTable('t-fit', 2, 50);
    const tree = buildLayoutTree(
      [textLine(0, 5), tableLine(table, 5)],
      GEOMETRY,
      mockCtx()
    );

    const slices = tree.slicesForObject('t-fit');
    expect(slices).toHaveLength(1);
    expect(slices[0].slicePosition).toBe('only');
    expect(slices[0].pageIndex).toBe(0);
  });

  it('slices a page-spanning table onto consecutive pages with following text below the last slice', () => {
    // Table taller than one page: rows sum past 300px available
    const table = makeTable('t-span', 8, 60); // ~480px
    const after = textLine(6, 16);
    const tree = buildLayoutTree(
      [textLine(0, 5), tableLine(table, 5), after],
      GEOMETRY,
      mockCtx()
    );

    const slices = tree.slicesForObject('t-span');
    expect(slices.length).toBeGreaterThanOrEqual(2);
    expect(slices[0].slicePosition).toBe('first');
    expect(slices[slices.length - 1].slicePosition).toBe('last');
    // Consecutive pages
    slices.forEach((s, i) => expect(s.pageIndex).toBe(slices[0].pageIndex + i));

    // The following text must sit BELOW the last slice on the SAME page
    const lastSlice = slices[slices.length - 1];
    const afterLoc = tree.caretLocation(6)!;
    expect(afterLoc.pageIndex).toBe(lastSlice.pageIndex);
    expect(afterLoc.fragment.rect.y).toBeGreaterThanOrEqual(
      lastSlice.rect.y + lastSlice.rect.height
    );
  });

  it('lays out a table spanning three or more pages (old model could not represent this)', () => {
    // 19 rows x 60px = 1140px over 300px pages -> 4 slices, last one partial
    const table = makeTable('t-3page', 19, 60);
    const after = textLine(2, 10);
    const tree = buildLayoutTree([tableLine(table, 1), after], GEOMETRY, mockCtx());

    const slices = tree.slicesForObject('t-3page');
    expect(slices.length).toBeGreaterThanOrEqual(3);
    const middle = slices.slice(1, -1);
    middle.forEach(s => expect(s.slicePosition).toBe('middle'));
    // Text still lands after the final slice — on its page when space
    // remains, never before it
    const lastSlice = slices[slices.length - 1];
    const afterLoc = tree.caretLocation(2)!;
    expect(afterLoc.pageIndex).toBe(lastSlice.pageIndex);
    expect(afterLoc.fragment.rect.y).toBeGreaterThanOrEqual(
      lastSlice.rect.y + lastSlice.rect.height
    );
  });

  it('pushes a table to the next page when no useful fragment fits after the headers', () => {
    // Fill the page so only 10px remain — below the 20px minimum row
    // fragment (DEFAULT_TABLE_STYLE.minRowHeight), so the table cannot start
    // a slice here and must move to the next page.
    const filler = Array.from({ length: 14 }, (_, i) => textLine(i * 2, i * 2 + 2, 20)); // 280px
    const smallLine = textLine(28, 29, 10); // 290 total, 10 left
    const table = makeTable('t-push', 3, 60);
    const tree = buildLayoutTree(
      [...filler, smallLine, tableLine(table, 30)],
      GEOMETRY,
      mockCtx()
    );

    const slices = tree.slicesForObject('t-push');
    expect(slices[0].pageIndex).toBe(1);
    expect(slices[0].rect.y).toBe(GEOMETRY.contentOrigin.y);
  });

  it('caretLocation uses half-open ranges: the index after a block object binds to the next fragment', () => {
    const table = makeTable('t-caret', 2, 50);
    const after = textLine(6, 16);
    const tree = buildLayoutTree(
      [textLine(0, 5), tableLine(table, 5), after],
      GEOMETRY,
      mockCtx()
    );

    // Index 5 = the object anchor itself -> the slice fragment
    expect(tree.caretLocation(5)!.fragment.kind).toBe('object-slice');
    // Index 6 = "after the table" -> the following line, never the slice
    const afterLoc = tree.caretLocation(6)!;
    expect(afterLoc.fragment.kind).toBe('line');
    expect(afterLoc.fragment.contentRange.start).toBe(6);
  });

  it('fragmentAt is page-qualified: the same point on another page misses', () => {
    const table = makeTable('t-hit', 8, 60); // spans to page 2
    const tree = buildLayoutTree(
      [textLine(0, 5), tableLine(table, 5)],
      GEOMETRY,
      mockCtx()
    );
    const slices = tree.slicesForObject('t-hit');
    const secondSlice = slices[1];
    const probe = {
      x: secondSlice.rect.x + 10,
      y: secondSlice.rect.y + 10
    };

    const hitOnItsPage = tree.fragmentAt(secondSlice.pageIndex, probe);
    expect(hitOnItsPage).toBe(secondSlice);

    // Same point queried on page 0 must not return the page-1 slice
    const hitOnPage0 = tree.fragmentAt(0, probe);
    expect(hitOnPage0).not.toBe(secondSlice);
  });

  it('slice rects advance with the object spacing constant', () => {
    const table = makeTable('t-space', 2, 50);
    const after = textLine(6, 16);
    const tree = buildLayoutTree([tableLine(table, 5), after], GEOMETRY, mockCtx());
    const slice = tree.slicesForObject('t-space')[0];
    const afterLoc = tree.caretLocation(6)!;
    expect(afterLoc.fragment.rect.y).toBe(
      slice.rect.y + slice.rect.height + EMBEDDED_OBJECT_SPACING
    );
  });
});
