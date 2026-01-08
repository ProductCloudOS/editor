# FEATURE-0003: Table Pane Implementation Plan

## Overview

Add a table pane on the right sidebar that appears when a table is selected or being edited. This pane will provide controls for:
- Column/row addition and deletion
- Cell merging and splitting
- Cell background color
- Border styling (color, width, style)
- Header row/column configuration
- Number of header rows/columns
- Different formatting for headers vs normal cells

## Current State Analysis

### Existing TableObject Capabilities

**Already Implemented:**
- `insertRow(rowIndex)` / `removeRow(rowIndex)` - Row management
- `insertColumn(colIndex, width?)` / `removeColumn(colIndex)` - Column management
- `mergeCells(range?)` / `splitCell(row, col)` - Cell merging/splitting
- `setHeaderRow(rowIndex, isHeader)` / `setHeaderRowCount(count)` - Header rows
- `headerRowCount` getter - Count of header rows
- Row loops for data binding (fully implemented)

**Not Implemented (Need to Add):**
- Header column support (`isHeaderColumn` property on columns)
- Setting header column count
- Applying formatting to all header rows/columns at once
- Getting/setting default header styling

### Existing TableCell Capabilities

**Already Implemented:**
- `backgroundColor` property
- `border` property (CellBorder with per-side control)
- `padding` property (CellPadding with per-side control)
- `verticalAlign` property ('top' | 'middle' | 'bottom')
- `fontFamily`, `fontSize`, `color` properties

### Existing Demo UI Patterns

**Pane Pattern (from textbox-section, loop-section, etc.):**
1. HTML: Collapsible section with `style="display: none;"` initially
2. JS: Show/hide functions (`showTablePane()`, `hideTablePane()`)
3. JS: Update functions (`updateTablePane(table)`) that populate controls
4. JS: Event listeners on controls to apply changes
5. JS: Selection change handler that shows/hides pane based on context

**Table Toolbar (already exists in index.html):**
```html
<div class="toolbar-group" id="table-tools" style="display: none;">
    <label>Table:</label>
    <button id="table-add-row">+ Row</button>
    <button id="table-add-col">+ Col</button>
    <button id="table-merge">Merge</button>
    <button id="table-split">Split</button>
    <button id="table-header">Header</button>
    <button id="table-row-loop">Row Loop</button>
</div>
```

## UI Design for Table Pane

### Pane Structure

```
[Table Settings] (collapsible section)
├── Structure
│   ├── Rows: [display] [+ Row Before] [+ Row After] [- Row]
│   └── Columns: [display] [+ Col Before] [+ Col After] [- Col]
├── Cell Selection
│   ├── Selected: "Row 2, Col 1" (or "2x3 cells selected")
│   ├── [Merge Cells] [Split Cell]
│   └── Background: [color picker]
├── Borders
│   ├── Width: [number input]
│   ├── Color: [color picker]
│   ├── Style: [solid/dashed/dotted/none dropdown]
│   └── Apply to: [All/Top/Right/Bottom/Left checkboxes]
├── Headers
│   ├── Header Rows: [number input 0-N]
│   ├── Header Columns: [number input 0-N] (NEW)
│   ├── Header Background: [color picker]
│   └── Header Text Style: [Bold checkbox]
└── Table Defaults
    ├── Default Cell Padding: [number]
    └── Default Border Color: [color picker]
```

### Controls Needed

| Control | ID | Purpose |
|---------|-----|---------|
| Row count display | `table-row-count` | Show current row count |
| Add row before | `table-add-row-before` | Insert row before selected |
| Add row after | `table-add-row-after` | Insert row after selected |
| Delete row | `table-delete-row` | Remove selected row |
| Column count display | `table-col-count` | Show current column count |
| Add column before | `table-add-col-before` | Insert column before selected |
| Add column after | `table-add-col-after` | Insert column after selected |
| Delete column | `table-delete-col` | Remove selected column |
| Cell selection info | `table-cell-selection` | Show selected cell/range |
| Merge cells button | `table-pane-merge` | Merge selected range |
| Split cell button | `table-pane-split` | Split merged cell |
| Cell background | `table-cell-bg-color` | Background color picker |
| Border width | `table-border-width` | Border width input |
| Border color | `table-border-color` | Border color picker |
| Border style | `table-border-style` | Border style select |
| Border side checkboxes | `table-border-top/right/bottom/left` | Which sides to apply |
| Apply borders button | `table-apply-borders` | Apply border settings |
| Header row count | `table-header-row-count` | Number of header rows |
| Header column count | `table-header-col-count` | Number of header columns |
| Header background | `table-header-bg-color` | Header cell background |
| Header bold | `table-header-bold` | Apply bold to headers |
| Apply header styling | `table-apply-header-style` | Apply header formatting |
| Default padding | `table-default-padding` | Default cell padding |
| Default border color | `table-default-border` | Default border color |

## Files to Modify

### Core Library Changes

| File | Changes |
|------|---------|
| `src/lib/objects/table/types.ts` | Add `TableColumnConfig.isHeader` property |
| `src/lib/objects/table/TableObject.ts` | Add header column support methods |
| `src/lib/core/PCEditor.ts` | Add table pane helper methods if needed |

### Demo Application Changes

| File | Changes |
|------|---------|
| `src/demo/index.html` | Add table pane HTML section |
| `src/demo/styles.css` | Add table pane styles |
| `src/demo/demo.ts` | Add table pane functions and event handlers |

## Implementation Phases

### Phase 1: Basic Table Pane Structure (Low Risk)

1. **Add HTML for table pane section** in `index.html`:
   - Create collapsible section similar to textbox-section
   - Add basic structure controls (row/column counts)
   - Add cell selection info display

2. **Add CSS styles** in `styles.css`:
   - Style table pane controls
   - Add button group styling for add/remove controls

3. **Add basic show/hide functions** in `demo.ts`:
   - `showTablePane()` - Display the pane
   - `hideTablePane()` - Hide the pane
   - `updateTablePane(table)` - Populate with table info

4. **Wire up selection events**:
   - Detect when table is selected or focused
   - Show pane with appropriate controls

### Phase 2: Row/Column Operations (Low Risk)

1. **Add row operation buttons and handlers**:
   - "Add Row Before" - Insert row before focused row
   - "Add Row After" - Insert row after focused row
   - "Delete Row" - Remove focused row (with confirmation if needed)

2. **Add column operation buttons and handlers**:
   - "Add Column Before" - Insert column before focused column
   - "Add Column After" - Insert column after focused column
   - "Delete Column" - Remove focused column

3. **Update pane when operations complete**:
   - Refresh row/column counts
   - Re-render canvas

### Phase 3: Cell Styling Controls (Medium Risk)

1. **Add cell selection display**:
   - Show "Row X, Col Y" for single cell
   - Show "NxM cells selected" for range

2. **Add merge/split controls**:
   - Wire to existing `mergeCells()` / `splitCell()` methods
   - Enable/disable based on selection validity

3. **Add background color control**:
   - Color picker for cell background
   - Apply to selected cell(s)

4. **Add border controls**:
   - Width, color, style inputs
   - Checkboxes for which sides to apply
   - "Apply Borders" button to apply settings

### Phase 4: Header Support (Medium Risk)

1. **Extend TableObject for header columns** (NEW):
   ```typescript
   // In TableColumnConfig (types.ts)
   isHeader?: boolean;

   // In TableObject.ts
   get headerColumnCount(): number;
   setHeaderColumn(colIndex: number, isHeader: boolean): void;
   setHeaderColumnCount(count: number): void;
   getHeaderColumnIndices(): number[];
   ```

2. **Add header row count control**:
   - Number input (0 to row count)
   - Wire to `setHeaderRowCount()`

3. **Add header column count control** (NEW):
   - Number input (0 to column count)
   - Wire to `setHeaderColumnCount()`

4. **Add header formatting controls**:
   - Header background color picker
   - Header bold checkbox
   - "Apply to Headers" button

5. **Implement header formatting application**:
   ```typescript
   // New method in TableObject or PCEditor
   applyHeaderFormatting(formatting: {
     backgroundColor?: string;
     bold?: boolean;
   }): void;
   ```

### Phase 5: Table Defaults (Low Risk)

1. **Add default padding control**:
   - Number input
   - Updates `table.defaultCellPadding`

2. **Add default border color control**:
   - Color picker
   - Updates `table.defaultBorderColor`

3. **Add "Apply Defaults to All Cells" button**:
   - Applies current defaults to all existing cells

### Phase 6: Polish and Edge Cases (Low Risk)

1. **Handle multi-selection scenarios**:
   - When multiple cells selected, show common values or "Mixed"
   - Apply changes to all selected cells

2. **Improve UX feedback**:
   - Disable buttons when operation not valid
   - Show tooltips explaining why buttons are disabled
   - Status bar messages for operations

3. **Keyboard shortcuts** (optional):
   - Tab to navigate cells (already works)
   - Consider shortcuts for common operations

## New TableObject Methods Needed

### Header Column Support

```typescript
// types.ts - Extend TableColumnConfig
export interface TableColumnConfig {
  id?: string;
  width: number;
  minWidth?: number;
  isHeader?: boolean;  // NEW
}

// TableObject.ts - New methods
get headerColumns(): TableColumnConfig[];
get headerColumnCount(): number;
setHeaderColumn(colIndex: number, isHeader: boolean): void;
setHeaderColumnCount(count: number): void;
getHeaderColumnIndices(): number[];
```

### Batch Cell Styling

```typescript
// TableObject.ts - New methods for bulk operations
applyCellStyle(
  range: CellRange,
  style: {
    backgroundColor?: string;
    border?: Partial<CellBorder>;
    padding?: number | Partial<CellPadding>;
  }
): void;

applyHeaderStyle(
  style: {
    backgroundColor?: string;
    bold?: boolean;
    fontFamily?: string;
    fontSize?: number;
  }
): void;
```

## Demo Event Handlers to Add

```typescript
// Table pane visibility
function showTablePane(): void;
function hideTablePane(): void;
function updateTablePane(table: TableObject | null): void;

// Row operations
function onTableAddRowBefore(): void;
function onTableAddRowAfter(): void;
function onTableDeleteRow(): void;

// Column operations
function onTableAddColumnBefore(): void;
function onTableAddColumnAfter(): void;
function onTableDeleteColumn(): void;

// Cell styling
function onTableMergeCells(): void;
function onTableSplitCell(): void;
function onTableApplyCellBackground(): void;
function onTableApplyBorders(): void;

// Header configuration
function onTableSetHeaderRowCount(): void;
function onTableSetHeaderColumnCount(): void;
function onTableApplyHeaderStyle(): void;

// Defaults
function onTableApplyDefaults(): void;
```

## Event Listening Changes

In the selection-change handler, add:

```typescript
editor.on('selection-change', (event) => {
  // ... existing code ...

  // Check for table selection or focus
  const selectedTable = editor.getSelectedTable?.();
  const focusedTable = editor.getFocusedTable?.();
  const activeTable = focusedTable || selectedTable;

  if (activeTable) {
    showTablePane();
    updateTablePane(activeTable);
  } else {
    hideTablePane();
  }
});

// Also listen to cell focus changes within table
editor.on('tablecell-cursor-changed', (event) => {
  const focusedTable = editor.getFocusedTable?.();
  if (focusedTable) {
    updateTablePane(focusedTable);
  }
});
```

## Risks and Considerations

1. **Header Column Rendering**: The renderer currently only handles header rows. Need to ensure header columns are rendered with appropriate styling on all pages.

2. **Cell Range Selection UI**: Currently no visual way to select a range of cells in the table. May need to implement Shift+Click selection for ranges.

3. **Undo/Redo**: Operations should be undoable when that system is implemented (FEATURE-0009).

4. **Performance**: Batch operations on large tables should be optimized.

5. **Merged Cell Complexity**: Operations near merged cells need careful handling.

## Estimated Effort

- **New code**: ~600-800 lines
- **Modified files**: 5-6
- **Risk level**: Medium (new UI, header column support)

## Critical Files for Implementation

- `/Users/james/code/pc/pc-editor/src/demo/index.html` - Add HTML for the table pane section with all controls
- `/Users/james/code/pc/pc-editor/src/demo/demo.ts` - Add table pane functions (show/hide/update) and event handlers for all controls
- `/Users/james/code/pc/pc-editor/src/lib/objects/table/TableObject.ts` - Add header column support methods and batch styling methods
- `/Users/james/code/pc/pc-editor/src/lib/objects/table/types.ts` - Extend TableColumnConfig with isHeader property
- `/Users/james/code/pc/pc-editor/src/demo/styles.css` - Add CSS styles for table pane controls and button groups
