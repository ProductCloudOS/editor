# PC Editor v2 Refactor Proposal

**Status:** Implemented (v2.0.0) — all phases delivered except the physical
InputController file extraction (§3 P2 organisation step), which is deferred
until interaction E2E coverage exists; its functional payload (page-qualified
DocPoint input, single hit-test authority) shipped. Phase P6 shipped as the
eager-registration fix for undo content sources; the full change-record
rework remains internal-debt for a future minor release.
**Target:** Major version increment (v1.0.x → v2.0.0)
**Date:** July 2026

---

## 1. Motivation

The editor works well functionally but suffers recurring instability in selection and
multi-page behaviour. Reported defect classes include:

- Clicking a point on page 2+ sometimes selects an object on page 1 when the in-page
  coordinates overlap (previously reported as T20, "fixed", recurred).
- Tables spanning a page boundary sometimes make it impossible to place the cursor or
  add text after the table.
- Selection state generally fragile across multiple pages (resize handles, double-click
  to edit, cell cursor placement on continuation pages).

These are not independent bugs. They are symptoms of a small number of architectural
facts, which is why point fixes have not stopped the class of defect from recurring.
The commit history reflects this ("Many fixes applied", "Big fixes applied", "Fixes for
table cell merge and multi-page selection, etc").

This document diagnoses the structural causes with code references, then proposes a
staged refactor to a v2 architecture that removes each cause rather than patching its
symptoms.

---

## 2. Diagnosis

### 2.1 Page identity is not part of a coordinate — and it gets dropped

Each page is its own canvas (`CanvasManager.createCanvases`, `CanvasManager.ts:121`),
so page-local coordinates on different pages **numerically overlap**. Page identity
travels as a separate `pageIndex` parameter, and several hit paths discard it:

- `TextBoxObject.containsPointInRegion(point, _pageIndex)` — `TextBoxObject.ts:740`.
  The doc comment reads *"The page index (ignored for text boxes)"*. It tests against a
  single cached `_renderedPosition`. Reached from double-click
  (`CanvasManager.ts:2452`) and editing-textbox mousedown (`CanvasManager.ts:591`).
- `TableCell.getRegionBounds(_pageIndex)` — `TableCell.ts:355`. Same pattern. The cell
  *stores* `_renderedPageIndex` (`TableCell.ts:67`) but no hit method consults it.
- `BaseEmbeddedObject._renderedPosition` / `_renderedPageIndex`
  (`BaseEmbeddedObject.ts:25-26`) are **single-valued** but overwritten for every page a
  multi-page object renders on — after a full render they hold whichever page was
  painted last. Header rows repeated on table continuation pages make this worse for
  cells (`FlowingTextRenderer.ts:1782-1788`, `:1833-1839`).

Consequence: an object rendered on page 1 at (x, y) matches a click at the same
in-page (x, y) on page 2. This is the reported cross-page selection defect, verbatim.

### 2.2 Stale hit state accumulates forever

`TableObject.clearRenderedSlices()` is defined (`TableObject.ts:1829`) and **has zero
callers**. `_renderedSlices` (the per-page slice geometry map — the one page-aware
table structure) accumulates entries across relayouts. A table that previously occupied
page 1 and no longer does still answers hit queries, divider registration, and resize
registration for page 1 (`CanvasManager.ts:470,827,1118,1635,2468`;
`FlowingTextRenderer.ts:1974,2034-2038`). This is why T20 recurred after being fixed.

### 2.3 The layout model cannot represent a multi-page object

The deepest cause, and the direct source of "cannot type after a page-spanning table":

- The layout pass keeps a splittable table as a **single `FlowedLine` on a single
  `FlowedPage`** with the comment *"The rendering layer will split the object as
  needed"* (`TextLayout.ts:861`). The model has no representation of an object spanning
  two pages. The real split happens at render time, in renderer-private state
  (`tableContinuations`, `FlowingTextRenderer.ts:67`; slice geometry cached on the
  object, `TableObject.ts:78`). Slice advancement is a *side effect of rendering*
  (`FlowingTextRenderer.ts:1574-1581`), so output depends on render order.
- The caret is a bare character index (`TextState.cursorPosition`). Caret geometry is
  derived by `findCursorLocationInBody`, which matches lines **inclusively**
  (`textIndex >= line.startIndex && textIndex <= line.endIndex`,
  `FlowingTextRenderer.ts:117`). A table's block line is `[T, T+1]` and the following
  text line starts at `T+1`, so the caret "after the table" binds to the table's own
  line and renders at the table's top-right corner on its start page. The same
  inclusive-boundary pattern is duplicated at `FlowingTextRenderer.ts:153,822,3425` and
  `TextLayout.ts:920`.
- Clicking a continuation-only page finds no flowed lines for that page
  (`FlowingTextRenderer.ts:628-638`) and falls through to `setCursorPosition(0)`
  (`:554-561`) — the caret jumps to the document start.
- `CanvasManager.checkForEmptyPages` computes the needed page count from **text-flow
  pages only** (`neededPages = firstPageFlowed.length`, `CanvasManager.ts:2258`),
  never consulting table continuations. The page-add path (renderer, counts slices via
  `text-overflow`) and the page-remove path therefore **disagree on how many pages the
  document needs**: the editor creates the continuation page, then deletes it out from
  under the table on the next `content-changed`. The table's tail slices have no page
  to exist on — and neither does the cursor.
- Structural limit: because trailing text is always placed exactly one model page after
  the table's block line, a table spanning three or more pages cannot be reconciled at
  all.

### 2.4 Three hit-testing paradigms, four copies of selection state

- A correct, page-keyed, well-tested `HitTestManager` exists
  (`src/lib/hit-test/HitTestManager.ts`, map keyed by `pageIndex`), but the mouse
  pipeline bypasses it constantly: manual rect maths for tables and text boxes in
  `handleMouseDown` / `handleClick` / `handleDoubleClick` (four near-duplicate
  point-in-slice implementations: `CanvasManager.ts:475-496`, `:1119-1128`,
  `:2476-2505`, `:1128`), plus a third page-agnostic line-scan path in the renderer
  (`getInlineElementAtPoint` / `getEmbeddedObjectAtPoint`,
  `FlowingTextRenderer.ts:2721-2762`).
- Two query types the code asks for (`'table-cell'` at `CanvasManager.ts:1582`,
  `'text-region'` at `:1589`) are **never registered** by production code — the queries
  always miss and control falls through to the page-unaware scans.
- Selection state lives in four places: `TextState` (the real model, one per content),
  `CanvasManager.selectedElements` (`CanvasManager.ts:29`),
  `FlowingTextRenderer.selectedText` (`FlowingTextRenderer.ts:64`), and
  `PCEditor.currentSelection` (`PCEditor.ts:54`). "Active section" is similarly stored
  in three places. `PCEditor.getTextSelection` bypasses its own mirror and reads the
  model directly — an admission the mirror is unreliable.

### 2.5 Layout as a side effect of render, synced by an unmanaged event cascade

- `CanvasManager.render()` triggers `TextLayout.flowText` from scratch on every render
  of page 0 (`FlowingTextRenderer.ts:350-356`); layout can synchronously emit
  `text-overflow`, which mutates the document (adds pages) mid-render.
- One keystroke produces: two synchronous renders, a third render deferred 100 ms by a
  **vestigial** `LayoutEngine` whose `performLayout` does nothing
  (`layout/LayoutEngine.ts:68-73`; `FlowManager` is entirely no-ops), an empty-page
  check, and a potential re-entrant `document.change` cascade.
- Re-entrancy is tamed by ad-hoc suppress flags (`isHandlingOverflow`, `isLayouting`,
  `isPerformingUndoRedo`, `wasResizing`, pane `_isUpdating`) and five `setTimeout`
  deferrals with comments like *"Defer the render to break the synchronous call
  chain"*. Any code path that renders in the wrong order, skips a render, or
  double-fires an event corrupts hit-testing or selection somewhere else.

### 2.6 Undo couples to all of the above via monkey-patching

`TextMutationObserver` / `ObjectMutationObserver` rebind content and object methods at
runtime to record mutations. The auto-registration path for table-cell text is
confirmed dead: `ContentDiscovery` subscribes to `tablecell-focused` and
`table-editing-ended` (`ContentDiscovery.ts:81,118`), events that nothing emits;
`registerObject()` (`:231`) has no callers. Typing in a table cell is not reliably
undoable.

### 2.7 What is sound and must be preserved

The **content model** is good: a single flat string as the source of truth for document
order (`TextState.content`), embedded objects anchored by U+FFFC, parallel index-keyed
managers shifted in lock-step on insert/delete. It carries the majority of the 1,805
existing tests and is not implicated in any of the defect classes. The refactor
targets layout → render → hit-test → selection, **not** the content model. That is
what makes this a refactor rather than a rewrite.

Coverage inversion worth noting: `CanvasManager.ts` (2,758 lines) and
`FlowingTextRenderer.ts` (3,822 lines) have **zero** direct tests, while the leaf model
classes are well covered. Replacing the two renderers loses no test coverage.

---

## 3. Target architecture (v2)

### P1 — Layout is a pure, complete, immutable artifact

```
layout(content, pageGeometry) → LayoutTree
```

- The `LayoutTree` fully paginates everything. Every positioned piece of content —
  every line, every object, and **every table slice** — becomes a
  `LayoutFragment { pageIndex, rect, contentRange }`.
- A page-spanning table is N fragments. The model finally represents reality; there is
  no renderer-private continuation state (`tableContinuations`, `pageTextOffsets`,
  `_renderedSlices` are deleted).
- Rendering becomes a dumb painter of the tree and mutates nothing.
- Caret geometry, hit-testing, and page count all derive from the same tree, so they
  can never disagree with what is painted.
- **Page count becomes a pure derivation** (`tree.pageCount`). The add/remove
  oscillation in §2.3 is impossible by construction: there is exactly one counter.
- `PDFGenerator` consumes the same `LayoutTree` instead of re-implementing page
  rendering (removing the hand-sync requirement documented in CLAUDE.md). Screen/PDF
  fidelity becomes structural.

### P2 — Page-qualified coordinates as a type

```ts
interface DocPoint { pageIndex: number; x: number; y: number }
hitTest(tree: LayoutTree, point: DocPoint): HitResult
```

- Below the DOM event handler, coordinates without page identity do not exist. The
  type system enforces what today relies on programmer discipline.
- All spatial queries go through the one `hitTest` API against the `LayoutTree`.
  `containsPointInRegion`, the duplicate slice rect maths, the renderer line-scans, and
  the cached `_renderedPosition` fields are deleted — there is nothing left to go
  stale (§2.1, §2.2).

### P3 — Caret = index + affinity; ranges are half-open

- Lines own `[start, end)` (half-open). The caret carries
  `{ index, affinity: 'before' | 'after' }` to disambiguate positions at fragment
  boundaries — exactly the ambiguity at a table's `[T, T+1]` block line (§2.3). This is
  the standard model used by browsers and mainstream editor frameworks.

### P4 — Single interaction-state store

- One `EditorState` (selection, focus, active section, editing context, drag/resize
  machine) with explicit update methods and change notification. `PCEditor`, the
  painter, and the input controller read it; nobody mirrors it. The four selection
  stores and three active-section stores in §2.4 collapse to one.

### P5 — Deterministic update loop

```
mutation → invalidate → schedule (microtask) → layout() → reconcile pages → paint → emit public events once
```

- One scheduler owns the loop. Layout never runs during paint; paint never mutates.
- The suppress flags and `setTimeout` sequencing exist only to compensate for the
  re-entrant synchronous cascade — with a deterministic loop they are deleted, not
  managed.
- The vestigial `LayoutEngine` / `FlowManager` are removed.

### P6 — Undo via explicit change records

- All mutations already flow through `FlowingTextContent` methods. Those methods emit
  change records to the `TransactionManager` directly; the runtime method-wrapping
  observers are removed. Every content instance (body, header, footer, each cell, each
  text box) registers on creation — fixing the dead table-cell undo path (§2.6).

---

## 4. Compatibility contract

### Unchanged in v2 (hard constraints)

| Surface | Reason |
|---|---|
| Document JSON format (`toData()` / `fromData()`) | Persisted templates in ProductCloud must load unchanged. Non-negotiable. |
| Content model (`TextState`, `FlowingTextContent`, index-keyed managers, U+FFFC anchoring) | Sound, well tested, not implicated in the defects. |
| `PCEditor` public methods | Consumers use a small surface (~15 methods: `loadDocumentFromJSON`, `saveDocument`, `getSelection`, `insertSubstitutionField`, repeating/conditional sections, zoom, undo/redo, `on`, `destroy`, …). All preserved. |
| Public event names | Panes and hosts key off them. Duplicates (`selection-change` vs `text-selection-changed` vs `cursor-changed`) are kept but deprecated. |
| Panes, rulers, fonts, clipboard, PDF import | They drive the editor exclusively through public methods and events. |

### Replaced outright (no consumer breakage — not exported)

- `CanvasManager` internals (input pipeline, page lifecycle, imperative hit maths)
- `FlowingTextRenderer` internals (layout-during-render, continuation state, line-scan
  hit-testing, cursor geometry)
- `LayoutEngine` / `FlowManager` (vestigial)

### The breaking change that justifies v2.0.0

Trim the export surface. v1 exports effectively the entire internals (`TextState`,
`TextLayout`, `RegionManager`, region classes, all managers, ~80 types). v2 exports:
`PCEditor`, the panes/rulers, the object classes consumers type-check against
(`TableObject`, `TextBoxObject`, `ImageObject`), document-format types, and the public
event/option types — nothing else. Known consumer (pc-client) imports only
`{ PCEditor }` plus panes/rulers/object classes; all retained.

---

## 5. Phasing

Each phase ships with the full test suite green.

### Phase 0 — Characterise and stop the bleeding (ships as v1.0.x)

Write failing regression tests for the defect classes first (the jsdom +
mocked-`measureText` harness already exercises flow logic). Then four surgical fixes:

1. Invalidate `_renderedSlices` at the start of each table layout pass (call the
   existing, currently-dead `clearRenderedSlices()`).
2. Respect `pageIndex` in `TextBoxObject.containsPointInRegion` and the `TableCell`
   hit/bounds paths (consult the already-stored `_renderedPageIndex`).
3. Make `checkForEmptyPages` account for table continuation pages
   (consult `hasTableContinuations()` / slice count) so add/remove paths agree.
4. Fix the caret boundary: exclusive end-index (or a block-line special case) in
   `findCursorLocationInBody` and its duplicated comparisons, so index `T+1` binds to
   the line after a table, and continuation-page clicks resolve to the position after
   the table instead of `setCursorPosition(0)`.

These do not fix the architecture, but they directly address the defects users hit
today, and the regression tests carry forward as the v2 acceptance suite.

### Phase 1 — Real layout engine (the core of v2)

- Implement `LayoutTree` with per-page `LayoutFragment`s, including table slices,
  produced by a pure layout pass.
- Make the canvas painter consume the tree; delete `tableContinuations`,
  `pageTextOffsets`, `_renderedSlices`, and layout-during-render.
- Migrate `PDFGenerator` onto the tree.
- Largest phase, largest payoff: §2.3 and §2.5 die here.

### Phase 2 — Unified input and hit-testing

- Introduce `DocPoint`; route all spatial queries through `hitTest(tree, point)`.
- One `InputController` replaces the ~800-line mouse pipeline in `CanvasManager`;
  delete the fallback scans, duplicate slice maths, and dead query types.
- §2.1, §2.2, §2.4 (hit-testing half) die here.

### Phase 3 — State and scheduler

- `EditorState` store; typed event bus; deterministic update loop.
- Delete suppress flags and `setTimeout` sequencing; collapse the selection and
  active-section mirrors.
- §2.4 (state half) and the remainder of §2.5 die here.

### Phase 4 — Undo, API trim, release

- Change-record undo replacing the mutation observers; register every content instance
  at creation.
- Export-surface trim; deprecation shims for duplicate events.
- Release v2.0.0.

### Sizing

Phase 0 is days. Phases 1–2 are the bulk of the work (weeks, combined). Phases 3–4 are
smaller. The existing 1,805 tests plus the Phase 0 regression tests are the safety net
throughout; the two files being replaced wholesale currently have zero direct test
coverage, so nothing is lost.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Layout output changes subtly (line breaks, spacing) between v1 and v2 | Phase 0 characterisation tests capture current flow output for representative documents; Phase 1 must reproduce it (except where a defect is deliberately fixed, each recorded explicitly). |
| Document JSON drift | Round-trip tests (export → import → export, byte/checksum comparison) already exist in the demo (T12/T37); promote them to CI acceptance tests. |
| Consumer breakage via deep imports | pc-client audit shows only `{ PCEditor }` + panes/rulers/objects are imported. Publish a v2 migration note; keep deprecated event aliases for one minor cycle. |
| Long-running branch divergence | Phases are independently shippable; Phase 0 lands on v1 immediately. Phase 1 can ship behind the same public API before Phases 2–4 begin. |
| Hidden behaviour in the replaced renderers | Port decisions are guided by the defect analysis in §2; anything intentional (e.g. block-table spacing constants) is extracted into the layout pass with a named constant and a test. |

---

## 7. Appendix — evidence index

| Fact | Location |
|---|---|
| Page index ignored in text box hit test | `src/lib/objects/TextBoxObject.ts:740` |
| Page index ignored in cell bounds | `src/lib/objects/table/TableCell.ts:355` |
| Single-valued rendered position/page | `src/lib/objects/BaseEmbeddedObject.ts:25-26` |
| `clearRenderedSlices()` never called | `src/lib/objects/table/TableObject.ts:1829` |
| Table kept as one line on one page ("rendering layer will split") | `src/lib/text/TextLayout.ts:861` |
| Renderer-private continuation state | `src/lib/rendering/FlowingTextRenderer.ts:67,69` |
| Slice advancement as render side effect | `src/lib/rendering/FlowingTextRenderer.ts:1574-1581` |
| Inclusive caret/line boundary match | `src/lib/rendering/FlowingTextRenderer.ts:117` (dup: `:153,822,3425`; `TextLayout.ts:920`) |
| Continuation-page click → cursor 0 | `src/lib/rendering/FlowingTextRenderer.ts:554-561,628-638` |
| Empty-page check ignores continuations | `src/lib/rendering/CanvasManager.ts:2258` |
| Never-registered hit query types | `src/lib/rendering/CanvasManager.ts:1582,1589` |
| Four selection stores | `TextState.ts:16,18`; `CanvasManager.ts:29`; `FlowingTextRenderer.ts:64`; `PCEditor.ts:54` |
| Vestigial LayoutEngine (100 ms no-op render) | `src/lib/layout/LayoutEngine.ts:61-73` |
| Suppress flags / deferred renders | `CanvasManager.ts:40,2094,2126,2276`; `PCEditor.ts:158`; pane `_isUpdating` |
| Dead undo registration for table cells | `src/lib/undo/transaction/ContentDiscovery.ts:81,118,231` |
| Renderers have zero direct tests | no test file references `CanvasManager` or `FlowingTextRenderer` |
