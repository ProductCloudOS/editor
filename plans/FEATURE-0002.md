# FEATURE-0002: Table Row Loops - Implementation Plan

## Overview

Add support for marking rows in a table as a "loop" that will be replicated during data merge. When merge is applied:
- Rows marked as loop template rows are duplicated once per array element
- Substitution fields within those rows resolve to array element data
- Non-loop rows remain unchanged

This mirrors how `RepeatingSection` works for flowing text, but operates on table rows instead of text ranges.

## Analysis of Existing Implementations

### Text-Based Repeating Sections
The existing system uses:
- `RepeatingSectionManager` to track sections by text index ranges
- `RepeatingSection` interface with `startIndex`, `endIndex`, `fieldPath`
- During merge: text between indices is extracted, duplicated per array item, fields prefixed with item context

### Table Structure
- `TableObject` contains `_rows: TableRow[]`
- Each `TableRow` has properties: `id`, `isHeader`, `height`, `minHeight`, `cells`
- Rows can be serialized via `toData()` / `fromData()`
- `TableRow.clone()` creates a deep copy

### Merge Flow for Tables
Currently `substituteFieldsInEmbeddedObjects()`:
- Iterates over all rows and cells
- Calls `substituteFieldsInContent()` on each cell's `flowingContent`

## Proposed Design

### Data Structure Changes

#### New Types in `src/lib/objects/table/types.ts`

```typescript
/**
 * Configuration for a table row loop.
 * Defines which rows should be repeated for each item in an array.
 */
export interface TableRowLoop {
  id: string;
  fieldPath: string;        // e.g., "items" - array to loop over
  startRowIndex: number;    // First row of the template (inclusive)
  endRowIndex: number;      // Last row of the template (inclusive)
}

/**
 * Serialized loop data for persistence.
 */
export interface TableRowLoopData {
  id: string;
  fieldPath: string;
  startRowIndex: number;
  endRowIndex: number;
}
```

#### Extend TableObjectData

```typescript
export interface TableObjectData extends EmbeddedObjectData {
  // ... existing fields
  data: {
    columns: TableColumnConfig[];
    rows: TableRowData[];
    rowLoops?: TableRowLoopData[];  // NEW: Optional array of row loops
    // ... other defaults
  };
}
```

### TableObject Changes

Add a `TableRowLoopManager` (new class or inline in TableObject) to:
1. Store row loops: `private _rowLoops: Map<string, TableRowLoop>`
2. Provide CRUD operations: `createRowLoop()`, `removeRowLoop()`, `getRowLoop()`, `getAllRowLoops()`
3. Validate that loop ranges don't overlap and are within bounds
4. Handle row insertions/deletions by adjusting loop indices (similar to how RepeatingSectionManager handles text changes)

### Merge Logic Changes

In `PCEditor.ts`, modify or add method:

```typescript
private expandTableRowLoops(table: TableObject, data: Record<string, unknown>): void {
  const loops = table.getAllRowLoops();

  // Process loops in reverse order (end-to-start) to preserve indices
  const sortedLoops = [...loops].sort((a, b) => b.startRowIndex - a.startRowIndex);

  for (const loop of sortedLoops) {
    const arrayData = this.resolveValue(loop.fieldPath, data);
    if (!Array.isArray(arrayData) || arrayData.length === 0) continue;

    // Extract template rows
    const templateRows = table.getRowsInRange(loop.startRowIndex, loop.endRowIndex);

    // Remove original template rows
    table.removeRowsInRange(loop.startRowIndex, loop.endRowIndex);

    // Insert duplicated rows for each array item (reverse to maintain order)
    for (let i = arrayData.length - 1; i >= 0; i--) {
      const itemData = arrayData[i];
      const clonedRows = templateRows.map(row => row.clone());

      // Prefix substitution fields with iteration context
      for (const row of clonedRows) {
        for (const cell of row.cells) {
          this.prefixFieldsInContent(cell.flowingContent, loop.fieldPath, i);
        }
      }

      // Insert at the original start position
      table.insertRowsAt(loop.startRowIndex, clonedRows);
    }

    // Remove the loop definition since it's now expanded
    table.removeRowLoop(loop.id);
  }
}
```

This should be called in `applyMergeData()` before `substituteFieldsInEmbeddedObjects()`.

### Visual Rendering

The row loop should be visually indicated in the editor (similar to text repeating sections):
- Add rendering in `TableObjectRenderer` or within `TableObject.render()`
- Show a "Loop" indicator/badge on the left side of looped rows
- Different styling (e.g., colored background stripe) for loop template rows

### Selection and Interaction

- Add row-loop selection type to `EditorSelection`
- Allow clicking on loop indicator to select the loop
- Properties panel shows loop field path when selected

## Files to Modify

### Core Library

| File | Changes |
|------|---------|
| `src/lib/objects/table/types.ts` | Add `TableRowLoop`, `TableRowLoopData` interfaces; extend `TableObjectData` |
| `src/lib/objects/table/TableObject.ts` | Add `_rowLoops` Map, loop management methods, serialization, rendering |
| `src/lib/objects/table/TableRow.ts` | No changes needed (clone already exists) |
| `src/lib/core/PCEditor.ts` | Add `expandTableRowLoops()` method; call in `applyMergeData()` |
| `src/lib/types/index.ts` | Add `'table-row-loop'` to `EditorSelection` type if needed |
| `src/lib/index.ts` | Export new types |

### Rendering

| File | Changes |
|------|---------|
| `src/lib/rendering/CanvasManager.ts` | Handle click detection for row loop indicators |
| `src/lib/rendering/FlowingTextRenderer.ts` or new file | Render row loop indicators (or add to TableObject.render) |

### Demo

| File | Changes |
|------|---------|
| `src/demo/demo.ts` | Add UI for creating/editing/deleting row loops; handle selection events |
| `src/demo/index.html` | Add "Table Row Loop" section in properties panel |
| `src/demo/sample-data.ts` | Add sample table with row loop for testing |

## Step-by-Step Implementation

### Phase 1: Data Model (Low Risk)
1. Add `TableRowLoop` and `TableRowLoopData` interfaces to `types.ts`
2. Extend `TableObjectData` to include optional `rowLoops` array
3. Implement row loop manager functionality in `TableObject`:
   - `_rowLoops: Map<string, TableRowLoop>`
   - `createRowLoop(startRow, endRow, fieldPath): TableRowLoop | null`
   - `removeRowLoop(id): boolean`
   - `getRowLoop(id): TableRowLoop | undefined`
   - `getAllRowLoops(): TableRowLoop[]`
   - Update `toData()` and `fromData()` for serialization

### Phase 2: Merge Logic (Medium Risk)
1. Add `expandTableRowLoops()` private method to `PCEditor.ts`
2. Add helper methods:
   - `table.getRowsInRange(start, end): TableRow[]`
   - `table.removeRowsInRange(start, end): void`
   - `table.insertRowsAt(index, rows: TableRow[]): void`
3. Integrate into `applyMergeData()` flow
4. Add unit tests for merge behavior

### Phase 3: Validation and Index Management (Medium Risk)
1. Validate loop ranges don't overlap
2. Validate ranges are within table bounds
3. Handle row insertion/deletion adjusting loop indices:
   - When row inserted: shift loops that start after insertion point
   - When row deleted: shift loops, invalidate if loop rows deleted

### Phase 4: Visual Rendering (Low Risk)
1. Add loop indicator rendering in `TableObject.render()`:
   - Small "Loop" badge or icon in left margin
   - Subtle background tint for template rows
2. Add selected state rendering (blue highlight when loop selected)

### Phase 5: Demo UI (Low Risk)
1. Add "Table Row Loops" section to properties panel (visible when table selected)
2. Add "Create Row Loop" button:
   - Requires row range selection in table
   - Prompts for field path
3. Show existing loops with edit/delete options
4. Add loop selection events and feedback

### Phase 6: Testing and Polish
1. Test with sample data containing arrays
2. Verify multi-row loop templates work
3. Test edge cases:
   - Empty arrays
   - Single item arrays
   - Nested fields in array items
   - Multiple loops in same table
   - Loop rows with merged cells
4. Update CLAUDE.md documentation

## Data Flow Example

**Before merge:**
```
Table:
  Row 0: Header row (Name, Price, Qty)
  Row 1: [LOOP START: "items"] {{items.name}}, {{items.price}}, {{items.qty}}
  Row 2: [LOOP END]
  Row 3: Total row
```

**Merge data:**
```json
{
  "items": [
    { "name": "Widget A", "price": "$10", "qty": "5" },
    { "name": "Widget B", "price": "$20", "qty": "3" }
  ]
}
```

**After merge:**
```
Table:
  Row 0: Header row (Name, Price, Qty)
  Row 1: Widget A, $10, 5
  Row 2: Widget B, $20, 3
  Row 3: Total row
```

## Testing Strategy

1. **Unit Tests**
   - Test loop creation validation
   - Test loop serialization/deserialization
   - Test row range expansion logic
   - Test field prefixing

2. **Integration Tests**
   - Test full merge flow with table loops
   - Test multiple loops in one table
   - Test loops combined with header rows
   - Test nested data paths

3. **Manual Testing**
   - Create loop via demo UI
   - Edit loop field path
   - Delete loop
   - Apply merge and verify results
   - Test with various data shapes

## Risks and Considerations

1. **Cell Merging Complexity**: If template rows contain merged cells spanning outside the loop range, behavior could be undefined. Consider validating against this.

2. **Header Row Interaction**: Loop rows should not be header rows (they get duplicated). Add validation.

3. **Multi-page Tables**: If the table spans pages and has loops, ensure correct behavior after expansion.

4. **Undo/Redo**: This feature modifies document state. When undo/redo is implemented (FEATURE-0009), consider how loop expansion affects history.

5. **Performance**: For large arrays, row duplication could be slow. Consider batching operations.

## Estimated Complexity

- **New code**: ~500-700 lines
- **Modified files**: 8-10
- **Risk level**: Medium (new feature, touches merge logic)
