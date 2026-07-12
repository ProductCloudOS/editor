/**
 * Regression tests for the multi-page selection and pagination defect classes
 * documented in docs/refactor-v2.md (§2).
 *
 * These tests encode the *page-aware contracts* that Phase 0 fixes must satisfy
 * and that the v2 architecture must preserve:
 *
 *  A. Hit-testing must be page-qualified — an object rendered on page N must not
 *     match a point queried for page M (refactor doc §2.1, TODO T20).
 *  B. Stale per-page render state must be invalidated on relayout (§2.2).
 *  C. A page-spanning table must keep its continuation page alive across
 *     subsequent content changes (§2.3, checkForEmptyPages disagreement).
 *  D. The caret placed immediately after a block object must bind to the line
 *     *after* the object, not the object's own line (§2.3, inclusive-boundary).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TextBoxObject } from '../../lib/objects/TextBoxObject';
import { TableObject } from '../../lib/objects/table/TableObject';
import { TableCell } from '../../lib/objects/table/TableCell';
import { PCEditor } from '../../lib/core/PCEditor';
import {
  createEditor,
  cleanupEditor,
  waitForTicks
} from '../helpers';

const FFFC = '￼';

// ---------------------------------------------------------------------------
// A. Page-qualified hit-testing (unit contracts)
// ---------------------------------------------------------------------------

describe('regression: page-qualified hit-testing', () => {
  describe('TextBoxObject.containsPointInRegion', () => {
    let textBox: TextBoxObject;

    beforeEach(() => {
      textBox = new TextBoxObject({
        id: 'tb-page-test',
        textIndex: 0,
        size: { width: 200, height: 100 }
      });
      // Simulate the renderer having drawn this text box on page 0 at (100, 100)
      textBox.renderedPosition = { x: 100, y: 100 };
      textBox.renderedPageIndex = 0;
    });

    it('matches a point inside its bounds on its rendered page', () => {
      expect(textBox.containsPointInRegion({ x: 150, y: 150 }, 0)).toBe(true);
    });

    it('does NOT match the same in-page point queried for a different page', () => {
      // Bug class A: pages have independent canvases, so page-local coordinates
      // numerically overlap. A text box on page 0 must not swallow clicks made
      // at the same coordinates on page 1.
      expect(textBox.containsPointInRegion({ x: 150, y: 150 }, 1)).toBe(false);
    });
  });

  describe('TableCell page-qualified bounds', () => {
    let cell: TableCell;

    beforeEach(() => {
      cell = new TableCell({});
      cell.setBounds({ x: 0, y: 0, width: 200, height: 50 });
      // Simulate render on page 2 at (100, 100)
      cell.setRenderedPosition({ x: 100, y: 100 });
      cell.renderedPageIndex = 2;
    });

    it('matches a point inside the cell on its rendered page', () => {
      expect(cell.containsPointInRegion({ x: 150, y: 120 }, 2)).toBe(true);
    });

    it('does NOT match the same in-page point queried for a different page', () => {
      expect(cell.containsPointInRegion({ x: 150, y: 120 }, 0)).toBe(false);
    });

    it('getRegionBounds returns null for a page the cell was not rendered on', () => {
      expect(cell.getRegionBounds(0)).toBeNull();
      expect(cell.getRegionBounds(2)).not.toBeNull();
    });
  });

  describe('TableObject stale slice invalidation', () => {
    it('calculatePageLayout clears slice records from earlier layouts', () => {
      const table = new TableObject({
        id: 'stale-slice-table',
        columns: 1,
        rowData: [
          { height: 100, cells: [{ content: 'Row 1' }] },
          { height: 100, cells: [{ content: 'Row 2' }] }
        ]
      });

      // Simulate a previous render where the table spanned onto page 5.
      table.setRenderedSlice(5, { x: 0, y: 0 }, 100, 'last', 1);
      expect(table.getRenderedPageIndices()).toContain(5);

      // Relayout where the table now fits on a single page: the stale page-5
      // record must not survive, otherwise page-5 clicks keep hitting this
      // table forever (bug class B / TODO T20 recurrence).
      table.calculatePageLayout(1000, 1000);
      expect(table.getRenderedPageIndices()).not.toContain(5);
    });
  });
});

// ---------------------------------------------------------------------------
// C + D. Page-spanning table behaviour (integration contracts)
// ---------------------------------------------------------------------------

describe('regression: page-spanning table', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  /** Build a table tall enough to be guaranteed to span an A4 page. */
  function makeTallTable(id: string): TableObject {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      height: 100,
      cells: [{ content: `Row ${i + 1}` }]
    }));
    return new TableObject({ id, columns: 1, rowData: rows });
  }

  beforeEach(async () => {
    ({ editor, container } = await createEditor());
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  it('creates and RETAINS a continuation page for a page-spanning table', async () => {
    editor.insertText('Before table');
    editor.insertEmbeddedObject(makeTallTable('span-table-1'), 'block');
    await waitForTicks(10); // page creation is deferred via setTimeout(0)

    const pagesAfterInsert = editor.getDocument().pages.length;
    expect(pagesAfterInsert).toBeGreaterThanOrEqual(2);

    // Trigger another content change: checkForEmptyPages runs on
    // content-changed and must NOT delete the continuation page the table's
    // tail slices occupy (refactor doc §2.3: the add/remove paths must agree).
    editor.setCursorPosition(0);
    editor.insertText('X');
    await waitForTicks(10);

    expect(editor.getDocument().pages.length).toBe(pagesAfterInsert);
  });

  it('binds the caret AFTER a block table to the following line, not the table line', async () => {
    editor.insertText('Hello');
    editor.insertEmbeddedObject(makeTallTable('span-table-2'), 'block');
    await waitForTicks(10);

    // Find the object anchor and place the caret immediately after it.
    const content = editor.getFlowingText();
    const anchorIndex = content.indexOf(FFFC);
    expect(anchorIndex).toBeGreaterThan(-1);

    // White-box: resolve the caret's line binding the same way cursor
    // rendering does. This is the exact decision that today parks the caret
    // at the table's top-right corner (refactor doc §2.3, inclusive-boundary
    // match at FlowingTextRenderer.findCursorLocationInBody).
    // NOTE: internal access — re-point this assertion at the LayoutTree caret
    // API when Phase 1/2 replaces the renderer.
    const renderer = (editor as unknown as {
      canvasManager: { flowingTextRenderer: unknown };
    }).canvasManager.flowingTextRenderer as {
      findCursorLocationInBody(index: number): {
        line?: { isBlockObjectLine?: boolean };
      } | null;
    };

    const location = renderer.findCursorLocationInBody(anchorIndex + 1);
    expect(location).not.toBeNull();
    expect(location?.line?.isBlockObjectLine ?? false).toBe(false);
  });

  it('typing at the position after the table lands after the anchor character', async () => {
    editor.insertText('Hello');
    editor.insertEmbeddedObject(makeTallTable('span-table-3'), 'block');
    await waitForTicks(10);

    const before = editor.getFlowingText();
    const anchorIndex = before.indexOf(FFFC);

    editor.setCursorPosition(anchorIndex + 1);
    editor.insertText('After');
    await waitForTicks(5);

    const after = editor.getFlowingText();
    expect(after.indexOf(FFFC)).toBe(anchorIndex);
    expect(after.slice(anchorIndex + 1, anchorIndex + 6)).toBe('After');
  });
});
