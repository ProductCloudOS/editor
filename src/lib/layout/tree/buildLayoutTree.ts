/**
 * buildLayoutTree — the pure layout pass (refactor doc §3 P1).
 *
 * Consumes the wrapped visual lines produced by TextLayout and fully
 * paginates them, INCLUDING table slicing, into an immutable LayoutTree of
 * per-page fragments with page-local rects.
 *
 * This absorbs two previously disconnected mechanisms:
 *  - TextLayout.paginateLines, which distributed lines into model pages but
 *    kept a page-spanning table as a single line on its start page; and
 *  - the render-time table splitting in FlowingTextRenderer
 *    (tableContinuations / pageTextOffsets), which produced the real slices
 *    as a painting side effect the model never saw.
 *
 * Because slices are laid out here, content following a spanning table is
 * positioned below the table's LAST slice on that slice's page — tables
 * spanning three or more pages lay out correctly, which the old model could
 * not represent (refactor doc §2.3).
 */
import { FlowedLine } from '../../text/types';
import { TableObject } from '../../objects/table/TableObject';
import {
  ContentRange,
  LayoutFragment,
  LayoutGeometry,
  LayoutPage,
  LayoutTree,
  LineFragment,
  ObjectSliceFragment,
  CaretLocation
} from './types';
import { Point } from '../../types';

/**
 * Vertical gap between a block object's final slice and the following
 * content. Zero for now: legacy consumers still derive Y positions by
 * summing line heights (no inter-object gap), and fragment rects must agree
 * with that arithmetic exactly until those consumers read the tree directly
 * (Phase 2). The inline "+ 2" spacing lives inside line metrics, not here.
 */
export const EMBEDDED_OBJECT_SPACING = 0;

class LayoutTreeImpl implements LayoutTree {
  constructor(public readonly pages: LayoutPage[]) {}

  get pageCount(): number {
    return Math.max(1, this.pages.length);
  }

  caretLocation(index: number): CaretLocation | null {
    // Half-open matching: a fragment owns [start, end). The boundary index
    // after a block object therefore belongs to the following fragment.
    let last: CaretLocation | null = null;
    for (const page of this.pages) {
      for (let i = 0; i < page.fragments.length; i++) {
        const f = page.fragments[i];
        if (index >= f.contentRange.start && index < f.contentRange.end) {
          return { pageIndex: page.pageIndex, fragment: f, fragmentIndex: i };
        }
        last = { pageIndex: page.pageIndex, fragment: f, fragmentIndex: i };
      }
    }
    // Caret at the very end of the document binds to the final fragment.
    return last;
  }

  fragmentAt(pageIndex: number, point: Point): LayoutFragment | null {
    const page = this.pages[pageIndex];
    if (!page) return null;
    // Later fragments paint on top; search back-to-front.
    for (let i = page.fragments.length - 1; i >= 0; i--) {
      const f = page.fragments[i];
      const r = f.rect;
      if (
        point.x >= r.x && point.x <= r.x + r.width &&
        point.y >= r.y && point.y <= r.y + r.height
      ) {
        return f;
      }
    }
    return null;
  }

  slicesForObject(objectId: string): ObjectSliceFragment[] {
    const slices: ObjectSliceFragment[] = [];
    for (const page of this.pages) {
      for (const f of page.fragments) {
        if (f.kind === 'object-slice' && f.object.id === objectId) {
          slices.push(f);
        }
      }
    }
    return slices;
  }
}

/** Mutable page under construction. */
interface PageBuilder {
  pageIndex: number;
  fragments: LayoutFragment[];
  cursorY: number; // next free Y, page-local, relative to contentOrigin.y
}

export function buildLayoutTree(
  lines: FlowedLine[],
  geometry: LayoutGeometry,
  measureCtx: CanvasRenderingContext2D
): LayoutTree {
  const pages: PageBuilder[] = [];

  const availableHeight = (pageIndex: number): number =>
    pageIndex === 0
      ? geometry.availableHeightFirstPage
      : geometry.availableHeightOtherPages;

  const newPage = (): PageBuilder => {
    const page: PageBuilder = { pageIndex: pages.length, fragments: [], cursorY: 0 };
    pages.push(page);
    return page;
  };

  let page = newPage();

  const lineRange = (line: FlowedLine): ContentRange => ({
    start: line.startIndex,
    end: Math.max(line.endIndex, line.startIndex)
  });

  const placeLine = (line: FlowedLine): void => {
    if (
      page.cursorY + line.height > availableHeight(page.pageIndex) &&
      page.fragments.length > 0
    ) {
      page = newPage();
    }
    const fragment: LineFragment = {
      kind: 'line',
      pageIndex: page.pageIndex,
      rect: {
        x: geometry.contentOrigin.x,
        y: geometry.contentOrigin.y + page.cursorY,
        width: Math.max(line.width, 0),
        height: line.height
      },
      contentRange: lineRange(line),
      line
    };
    page.fragments.push(fragment);
    page.cursorY += line.height;
  };

  const placeBlockObject = (line: FlowedLine): void => {
    const objectRef = line.embeddedObjects?.[0];
    const object = objectRef?.object;
    if (!object) {
      placeLine(line);
      return;
    }

    const remaining = availableHeight(page.pageIndex) - page.cursorY;
    const range = lineRange(line);

    if (object instanceof TableObject) {
      // Accurate row heights before any split decision (matches the painter's
      // previous behaviour of recalculating before slicing).
      object.calculateLayout(measureCtx, true);
      for (const row of object.rows) {
        for (const cell of row.cells) {
          cell.reflow(measureCtx);
        }
      }
      object.calculateLayout(measureCtx, true);

      const fitsWhole = object.height <= remaining;
      const splittableHere =
        !fitsWhole &&
        object.getHeaderHeight() +
          Math.min(object.getFirstDataRowHeight(), object.getMinDataRowFragmentHeight()) <=
          remaining;

      if (!fitsWhole && !splittableHere && page.fragments.length > 0) {
        // Nothing useful fits after the headers — push the table to the next
        // page and split from there if it is taller than a full page.
        page = newPage();
      }

      const heightHere = availableHeight(page.pageIndex) - page.cursorY;
      const pageLayout = object.calculatePageLayout(
        heightHere,
        geometry.availableHeightOtherPages
      );

      pageLayout.slices.forEach((slice, sliceIndex) => {
        if (sliceIndex > 0) {
          page = newPage();
        }
        const slicePosition =
          pageLayout.slices.length === 1
            ? 'only'
            : sliceIndex === 0
              ? 'first'
              : sliceIndex === pageLayout.slices.length - 1
                ? 'last'
                : 'middle';
        const fragment: ObjectSliceFragment = {
          kind: 'object-slice',
          pageIndex: page.pageIndex,
          rect: {
            x: geometry.contentOrigin.x,
            y: geometry.contentOrigin.y + page.cursorY,
            width: object.width,
            height: slice.height
          },
          contentRange: range,
          object,
          line,
          slicePosition,
          sliceIndex,
          tableSlice: slice,
          tablePageLayout: pageLayout
        };
        page.fragments.push(fragment);
        page.cursorY += slice.height + EMBEDDED_OBJECT_SPACING;
      });
      return;
    }

    // Non-table block objects (images, text boxes) never split: wrap the
    // whole object to the next page when it does not fit.
    if (object.height > remaining && page.fragments.length > 0) {
      page = newPage();
    }
    const fragment: ObjectSliceFragment = {
      kind: 'object-slice',
      pageIndex: page.pageIndex,
      rect: {
        x: geometry.contentOrigin.x,
        y: geometry.contentOrigin.y + page.cursorY,
        width: object.width,
        height: object.height
      },
      contentRange: range,
      object,
      line,
      slicePosition: 'only',
      sliceIndex: 0
    };
    page.fragments.push(fragment);
    page.cursorY += object.height + EMBEDDED_OBJECT_SPACING;
  };

  for (const line of lines) {
    if (line.isBlockObjectLine) {
      placeBlockObject(line);
    } else {
      placeLine(line);
    }
    if (line.endsWithPageBreak) {
      page = newPage();
    }
  }

  // Drop a trailing page that ended up empty (e.g. a page break at the very
  // end of the document) but always keep at least one page.
  while (pages.length > 1 && pages[pages.length - 1].fragments.length === 0) {
    pages.pop();
  }

  return new LayoutTreeImpl(
    pages.map(p => ({
      pageIndex: p.pageIndex,
      fragments: p.fragments,
      contentHeight: p.cursorY
    }))
  );
}
