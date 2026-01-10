# FEATURE-0004: Multi-Page Table Support with Header Replication

## Status: ✅ COMPLETE

Implemented multi-page table support with the following changes:
- Phase 1: Fixed layout timing in FlowingTextRenderer.ts - ensure calculateLayout is called before page split decisions
- Phase 2: Improved row fitting algorithm in calculatePageLayout to handle header rows correctly
- Phase 3: Added adjustSliceEndForMergedCells() to handle merged cells at page boundaries
- Phase 4: Added renderedPageIndex property to TableCell for multi-page hit detection; updated renderTableCellText() to set page index when rendering cells in slices

Key files modified:
- src/lib/objects/table/TableObject.ts - calculatePageLayout improvements, merged cell handling
- src/lib/objects/table/TableCell.ts - added renderedPageIndex property
- src/lib/rendering/FlowingTextRenderer.ts - layout timing fixes, cell position tracking in slices

## Overview

Tables need to properly span multiple pages with header rows automatically replicated at the top of each page that the table crosses over.

## Current State Analysis

### Existing Implementation (Partial)

The codebase already has significant multi-page table infrastructure:

1. **TablePageSlice/TablePageLayout types** in `types.ts` (lines 277-302)
2. **calculatePageLayout()** method in `TableObject.ts` (lines 963-1060)
3. **renderSlice()** method in `TableObject.ts` (lines 1068-1181)
4. **Header row management** methods in `TableObject.ts` (lines 162-226)
5. **tableContinuations tracking** in `FlowingTextRenderer.ts` (lines 31-47)
6. **Multi-page table rendering** in `renderEmbeddedObject()` (lines 1121-1246)

### Gaps to Address

| Issue | Description |
|-------|-------------|
| Text flow integration | Tables embedded in flowing text don't properly adjust subsequent content position when split |
| Cell content overflow | No handling for individual cells that might need to split across pages |
| Layout timing | Row heights must be calculated before page layout can be computed |
| Continuation state | The continuation tracking in FlowingTextRenderer may lose state on re-renders |
| Height calculation | `needsPageSplit()` is called but available height calculation may be incorrect |

## Proposed Design

### Phase 1: Fix Height Calculation and Layout Timing

The current flow has timing issues:
1. `renderEmbeddedObject()` calls `table.calculateLayout(ctx)`
2. Then checks `table.needsPageSplit(availableHeight)`
3. But `calculatePageLayout()` uses `cachedRowHeights` which may be stale

**Solution**: Ensure `calculateLayout()` is always called before any page layout calculations.

### Phase 2: Improve Text Flow Integration

When a table spans multiple pages, the text flow needs to:
1. Know the height of the table slice on each page
2. Place subsequent content after the table slice on each page
3. Handle continuation properly when re-rendering

**Key change**: The `FlowedEmbeddedObject` should track per-page heights when the object spans pages.

### Phase 3: Handle Cell Content at Page Boundaries

Options:
1. **Row atomic** (current): Rows are atomic units - if a row doesn't fit, it goes to the next page
2. **Cell split** (future): Cells with long content could split across pages

For this feature, we'll maintain **row atomic** behavior but improve the row fitting logic.

### Phase 4: Improve Header Row Rendering

The current `renderSlice()` logic for header rows needs:
1. Correct cell bounds calculation relative to slice position
2. Proper rendered position tracking for hit detection
3. Border rendering between header and data rows on continuation pages

## Detailed Implementation

### Step 1: Ensure Layout Calculation Order

**File: `/Users/james/code/pc/pc-editor/src/lib/rendering/FlowingTextRenderer.ts`**

In `renderEmbeddedObject()`, ensure layout is always calculated first:

```typescript
if (object instanceof TableObject) {
  const table = object as TableObject;

  // CRITICAL: Calculate layout BEFORE any page layout decisions
  table.calculateLayout(ctx, true); // Force recalculation

  // Reflow text in each cell
  for (const row of table.rows) {
    for (const cell of row.cells) {
      cell.reflow(ctx);
    }
  }

  // NOW check if split is needed
  const contentBounds = page?.getContentBounds();
  if (contentBounds) {
    const availableHeight = contentBounds.position.y + contentBounds.size.height - elementY;
    // ...
  }
}
```

### Step 2: Fix Available Height Calculation

**Issue**: The current code calculates `availableHeight` as distance from table start to page bottom, but doesn't account for header height on continuation pages.

**File: `/Users/james/code/pc/pc-editor/src/lib/objects/table/TableObject.ts`**

Modify `calculatePageLayout()` to better handle the first page vs continuation pages:

```typescript
calculatePageLayout(
  availableHeightFirstPage: number,
  availableHeightOtherPages: number
): TablePageLayout {
  // Ensure layout is calculated
  if (this._layoutDirty || this._cachedRowHeights.length !== this._rows.length) {
    console.warn('[TableObject.calculatePageLayout] Layout is dirty, results may be inaccurate');
  }

  const headerHeight = this.getHeaderHeight();
  const headerRowIndices = this.getHeaderRowIndices();

  // ... rest of implementation
}
```

### Step 3: Track Table Slice Heights in Text Flow

**File: `/Users/james/code/pc/pc-editor/src/lib/text/types.ts`**

Extend `FlowedEmbeddedObject` to track per-page heights:

```typescript
export interface FlowedEmbeddedObject {
  object: BaseEmbeddedObject;
  textIndex: number;
  x: number;
  // NEW: Height of this object on the current page (for multi-page objects)
  heightOnPage?: number;
  // NEW: Whether this is a continuation from previous page
  isContinuation?: boolean;
}
```

### Step 4: Improve Row Fitting Algorithm

**File: `/Users/james/code/pc/pc-editor/src/lib/objects/table/TableObject.ts`**

The current `calculatePageLayout()` has issues with the row fitting loop. Improve it:

```typescript
// In calculatePageLayout():

// Skip header rows in iteration - they're handled separately
for (let rowIdx = 0; rowIdx < this._rows.length; rowIdx++) {
  const row = this._rows[rowIdx];

  // Header rows are always included with their respective slices
  if (row.isHeader) continue;

  const rowHeight = row.calculatedHeight;

  // Check if row fits in current slice
  const spaceNeeded = isContinuation ? (sliceHeight + rowHeight) : rowHeight;
  const spaceAvailable = isContinuation ? availableHeight : effectiveAvailable;

  if (spaceNeeded > spaceAvailable && sliceEndRow > currentRow) {
    // Row doesn't fit and we have at least one row - end slice
    break;
  }

  sliceHeight += rowHeight;
  yOffset += rowHeight;
  sliceEndRow = rowIdx + 1;
}
```

### Step 5: Improve Continuation Tracking

**File: `/Users/james/code/pc/pc-editor/src/lib/rendering/FlowingTextRenderer.ts`**

The current implementation clears continuations at render start, which can cause issues with incremental rendering. Improve tracking:

```typescript
// Track which tables have been fully rendered
private renderedTableIds: Set<string> = new Set();

// Clear on full reflow only
clearTableContinuations(): void {
  this.tableContinuations.clear();
  this.renderedTableIds.clear();
}

// Check if table is complete
isTableFullyRendered(tableId: string): boolean {
  return this.renderedTableIds.has(tableId) &&
         !this.tableContinuations.has(tableId);
}
```

### Step 6: Fix Cell Rendered Positions for Slices

**File: `/Users/james/code/pc/pc-editor/src/lib/rendering/FlowingTextRenderer.ts`**

In `renderTableCellText()`, ensure cells have correct rendered positions for hit detection:

```typescript
private renderTableCellText(
  table: TableObject,
  rows: TableRow[],
  ctx: CanvasRenderingContext2D,
  pageIndex: number,
  tableX: number,
  tableY: number,
  slice: TablePageSlice,
  pageLayout: TablePageLayout
): void {
  // ... existing code ...

  // After rendering each cell, also update the row's rendered state
  // for proper hit detection on continuation pages
  for (const cell of row.cells) {
    cell.setRenderedPosition({
      x: tableX + columnPositions[colIdx],
      y: tableY + y
    });

    // Store which page this cell was rendered on
    // (Important for tables spanning multiple pages)
    cell.renderedPageIndex = pageIndex;
  }
}
```

### Step 7: Handle Row-Spanning Merged Cells

**Issue**: Cells with `rowSpan > 1` may span the page break boundary.

**Solution**: For rows with cells that span into the "next page" portion, we need to either:
a) Keep the entire spanned region on the same page (move break point up)
b) Split the cell visually (complex, not recommended for v1)

For this implementation, use option (a):

```typescript
// In calculatePageLayout():
// Check for row spans that would cross the page break
if (sliceEndRow < this._rows.length) {
  // Look for any cells in rows before sliceEndRow that span past it
  for (let r = sliceStartRow; r < sliceEndRow; r++) {
    for (let c = 0; c < this._columns.length; c++) {
      const cell = this.getCell(r, c);
      if (cell && cell.rowSpan > 1) {
        const spanEnd = r + cell.rowSpan;
        if (spanEnd > sliceEndRow) {
          // This cell spans past our break point - adjust break
          sliceEndRow = r; // Break before this cell's row
          // Recalculate slice height
          sliceHeight = this.calculateSliceHeight(sliceStartRow, sliceEndRow, isContinuation, pageLayout);
          break;
        }
      }
    }
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/objects/table/TableObject.ts` | Fix `calculatePageLayout()` algorithm, add merged cell handling, improve height tracking |
| `src/lib/objects/table/TableCell.ts` | Add `renderedPageIndex` property for multi-page hit detection |
| `src/lib/objects/table/types.ts` | Extend types if needed for better slice tracking |
| `src/lib/rendering/FlowingTextRenderer.ts` | Fix layout timing, improve continuation tracking, fix cell positioning |
| `src/lib/text/types.ts` | Add `heightOnPage` and `isContinuation` to `FlowedEmbeddedObject` |
| `src/lib/text/TextLayout.ts` | Account for multi-page object heights in line height calculations |

## Implementation Phases

### Phase 1: Fix Core Layout Timing (Low Risk)
1. Ensure `calculateLayout()` is called before `calculatePageLayout()`
2. Fix available height calculation for first page vs subsequent
3. Add debug logging for height values

### Phase 2: Improve Row Fitting Algorithm (Medium Risk)
1. Fix the row iteration logic in `calculatePageLayout()`
2. Handle header rows correctly in iteration
3. Add tests for various table configurations

### Phase 3: Handle Merged Cells at Boundaries (Medium Risk)
1. Detect row spans that would cross page breaks
2. Adjust break points to keep spanned regions together
3. Test with various merge configurations

### Phase 4: Fix Continuation Rendering (Medium Risk)
1. Improve continuation state tracking
2. Fix cell rendered positions for slices
3. Ensure header rows render correctly on continuation pages

### Phase 5: Integration Testing (Low Risk)
1. Test with various page sizes
2. Test with different margin configurations
3. Test with tables at different positions in text flow
4. Test with multiple tables in same document

## Testing Strategy

### Unit Tests
- `calculatePageLayout()` with various table sizes
- Row fitting with different available heights
- Merged cell detection at boundaries
- Header height calculations

### Integration Tests
- Table split across 2, 3, 4+ pages
- Tables with 1, 2, 3 header rows
- Tables with merged cells in header
- Tables with merged cells in body
- Multiple tables in document

### Visual Tests
- Header rows appear at top of each page
- Borders render correctly at split points
- Cell text aligns correctly on continuation pages
- Selection handles work on all pages

## Risks and Considerations

1. **Cell Content Clipping**: Long cell content near page breaks may need special handling
2. **Performance**: Very tall tables (100+ pages) may need optimization
3. **Undo/Redo**: Table split state should not affect undo history
4. **Print/Export**: PDF export must respect page splits
5. **Merged Cells**: Complex merge patterns may cause edge cases

## Estimated Complexity

- **Modified code**: ~300-400 lines
- **New code**: ~100-150 lines
- **Files modified**: 6
- **Risk level**: Medium (modifying existing rendering logic)

## Critical Files for Implementation

1. **/Users/james/code/pc/pc-editor/src/lib/objects/table/TableObject.ts** - Core logic for `calculatePageLayout()`, `renderSlice()`, and header management
2. **/Users/james/code/pc/pc-editor/src/lib/rendering/FlowingTextRenderer.ts** - Integration with text flow, `renderEmbeddedObject()` logic, continuation tracking
3. **/Users/james/code/pc/pc-editor/src/lib/objects/table/types.ts** - `TablePageSlice` and `TablePageLayout` interfaces to potentially extend
4. **/Users/james/code/pc/pc-editor/src/lib/objects/table/TableCell.ts** - May need `renderedPageIndex` for multi-page hit detection
5. **/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts** - Pattern reference for how text flow handles multi-page content
