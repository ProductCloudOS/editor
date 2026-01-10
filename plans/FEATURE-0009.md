# FEATURE-0009: Undo/Redo Functionality - Implementation Plan

## Status: NOT STARTED

## Overview

Implement comprehensive Undo/Redo functionality using a **hybrid Command/Memento pattern** that combines command-based operations for simple text operations with snapshot-based state restoration for complex operations.

## Current Architecture Analysis

### State Change Sources

**Text Operations (FlowingTextContent):**
- `insertText()` - Character/string insertion
- `deleteText()` - Character/string deletion
- `applyFormatting()` - Text formatting changes
- `setAlignment()` / `setAlignmentForRange()` - Paragraph alignment

**Substitution Field Operations:**
- `insertSubstitutionField()` / `removeSubstitutionField()`
- `updateSubstitutionFieldConfig()`

**Embedded Object Operations:**
- `insertEmbeddedObject()` / `removeEmbeddedObject()`
- Object resize (via `size` setter)
- TextBoxObject content/style changes
- TableObject cell content, structure, and style changes

**Table-Specific Operations:**
- `insertRow()` / `removeRow()` / `insertColumn()` / `removeColumn()`
- `mergeCells()` / `splitCell()`
- Cell content changes
- `createRowLoop()` / `removeRowLoop()`

**Repeating Section Operations:**
- `createRepeatingSection()` / `removeRepeatingSection()`

**Document Settings:**
- `updateDocumentSettings()` - Margins, page size, orientation

### Existing Event System

The codebase emits events for state changes:
- `content-changed` - FlowingTextContent and TableObject
- `formatting-changed` - TextFormattingManager
- `text-inserted` / `text-deleted` - TextState
- `object-added` / `object-removed` - EmbeddedObjectManager
- `field-added` / `field-removed` - SubstitutionFieldManager
- `settings-changed` - Document

### Existing Serialization

- `FlowingTextContent.toData()` / `fromData()` / `loadFromData()`
- `TableObject.toData()` / `fromData()`
- `TextBoxObject.toData()` / `clone()`
- `Document.toData()`

## Design Decisions

### Pattern Selection: Hybrid Command/Snapshot

| Operation Type | Pattern | Rationale |
|---------------|---------|-----------|
| Single character insert/delete | Command | Very frequent, low overhead |
| Multi-character paste | Command | Efficient storage of delta |
| Text formatting | Command | Store range + formatting delta |
| Object resize | Command | Store size delta |
| Object insert/delete | Snapshot | Complex state restoration |
| Table cell content | Hybrid | Command within cell, snapshot for structure |
| Table structure changes | Snapshot | Complex multi-row/column changes |
| Document settings | Snapshot | Infrequent, simple snapshot |

### Granularity and Coalescing

**Undo Boundaries (when to create new undo entry):**
1. **Time-based:** Characters typed within 500ms should coalesce
2. **Context change:** Section change, object selection, cell focus change
3. **Explicit boundary:** Paste, formatting, structural changes
4. **Cursor movement:** Arrow keys create boundary for typed characters

### History Limits

- **Default history size:** 100 entries
- **Memory warning threshold:** 50MB estimated memory usage

### Selection and Cursor Restoration

Each undo entry captures:
- Cursor position before operation
- Selection state before operation
- Active section (body/header/footer)
- Focused control (table cell, text box)

## Type Definitions

**File: `src/lib/undo/types.ts`**

```typescript
type UndoOperationType =
  | 'text-insert' | 'text-delete' | 'text-format'
  | 'paragraph-format' | 'object-resize' | 'object-insert' | 'object-delete'
  | 'table-structure' | 'table-cell-edit' | 'field-change'
  | 'repeating-section' | 'document-settings' | 'compound';

interface CursorState {
  section: EditingSection;
  cursorPosition: number;
  selection: { start: number; end: number } | null;
  focusedObjectId: string | null;
  tableFocusedCell: { row: number; col: number } | null;
}

interface UndoEntry {
  id: string;
  type: UndoOperationType;
  timestamp: number;
  cursorStateBefore: CursorState;
  cursorStateAfter: CursorState;

  // Command-based operations store deltas
  command?: UndoCommand;

  // Snapshot-based operations store state
  snapshot?: {
    type: 'content' | 'object' | 'document';
    section?: EditingSection;
    objectId?: string;
    data: FlowingTextContentData | EmbeddedObjectData | DocumentData;
  };

  // For coalescing
  coalesceKey?: string;
}

interface UndoCommand {
  execute(): void;
  undo(): void;
  canCoalesceWith?(other: UndoCommand): boolean;
  coalesce?(other: UndoCommand): UndoCommand;
}

interface UndoCoalesceConfig {
  maxTimeGap: number;     // 500ms default
  maxCharacters: number;  // 50 chars before forced boundary
}
```

## Implementation Architecture

### UndoManager

**File: `src/lib/undo/UndoManager.ts`**

```typescript
class UndoManager extends EventEmitter {
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private maxHistory: number = 100;
  private isPerformingUndoRedo: boolean = false;
  private pendingCoalesceEntry: UndoEntry | null = null;
  private lastActionTimestamp: number = 0;

  // Core operations
  pushEntry(entry: UndoEntry): void;
  undo(): boolean;
  redo(): boolean;

  // State queries
  canUndo(): boolean;
  canRedo(): boolean;
  getUndoDescription(): string | null;
  getRedoDescription(): string | null;

  // Coalescing
  private shouldCoalesce(newEntry: UndoEntry): boolean;
  private coalesceEntries(existing: UndoEntry, newEntry: UndoEntry): UndoEntry;

  // Batch operations
  beginCompoundOperation(): void;
  endCompoundOperation(): void;

  // Memory management
  estimateMemoryUsage(): number;
  trimHistory(): void;
  clear(): void;
}
```

### UndoRecorder

**File: `src/lib/undo/UndoRecorder.ts`**

Listens to state change events and creates appropriate undo entries:

```typescript
class UndoRecorder {
  private undoManager: UndoManager;
  private document: Document;
  private canvasManager: CanvasManager;

  // Setup listeners on FlowingTextContent and sub-managers
  private setupListeners(): void;

  // Create appropriate undo entry based on operation
  private recordTextInsertion(data: TextInsertionData): void;
  private recordTextDeletion(data: TextDeletionData): void;
  private recordFormattingChange(data: FormattingChangeData): void;
  private recordObjectChange(data: ObjectChangeData): void;
  private recordTableStructureChange(data: TableStructureData): void;

  // Capture current state for snapshots
  private captureFlowingContentState(section: EditingSection): FlowingTextContentData;
  private captureObjectState(objectId: string): EmbeddedObjectData | null;
  private captureCursorState(): CursorState;
}
```

### Command Implementations

**File: `src/lib/undo/commands/`**

```typescript
// TextInsertCommand.ts
class TextInsertCommand implements UndoCommand {
  constructor(
    private flowingContent: FlowingTextContent,
    private position: number,
    private text: string
  );

  execute(): void;
  undo(): void;
  canCoalesceWith(other: UndoCommand): boolean;
  coalesce(other: TextInsertCommand): TextInsertCommand;
}

// TextDeleteCommand.ts
class TextDeleteCommand implements UndoCommand {
  constructor(
    private flowingContent: FlowingTextContent,
    private position: number,
    private deletedText: string,
    private deletedFormatting: Map<number, TextFormattingStyle>
  );
}

// FormatCommand.ts
class FormatCommand implements UndoCommand {
  constructor(
    private flowingContent: FlowingTextContent,
    private start: number,
    private end: number,
    private newFormatting: Partial<TextFormattingStyle>,
    private previousFormatting: Map<number, TextFormattingStyle>
  );
}

// ResizeCommand.ts
class ResizeCommand implements UndoCommand {
  constructor(
    private object: BaseEmbeddedObject,
    private previousSize: Size,
    private newSize: Size
  );
}

// SnapshotCommand.ts (generic snapshot-based undo)
class SnapshotCommand implements UndoCommand {
  constructor(
    private target: FlowingTextContent | BaseEmbeddedObject | Document,
    private beforeSnapshot: any,
    private afterSnapshot: any
  );
}
```

## Implementation Phases

### Phase 1: Foundation

1. **Create type definitions** (`src/lib/undo/types.ts`)
2. **Create UndoManager** (`src/lib/undo/UndoManager.ts`)
3. **Create base command classes** (`src/lib/undo/commands/`)
4. **Export module** (`src/lib/undo/index.ts`)

### Phase 2: Recording System

5. **Create UndoRecorder** (`src/lib/undo/UndoRecorder.ts`)
6. **Add pre-operation hooks to FlowingTextContent**
   - Emit `before-text-insert`, `before-text-delete`, etc.

### Phase 3: Integration

7. **Integrate into PCEditor**
   - Replace existing stub undo()/redo() methods
   - Add canUndo()/canRedo() queries
   - Clear history on document load

8. **Handle keyboard shortcuts**
   - Ctrl+Z for undo
   - Ctrl+Y / Ctrl+Shift+Z for redo

### Phase 4: Advanced Features

9. **Table structure undo** (snapshot-based)
10. **Compound operations** for paste, find-replace, etc.
11. **Demo integration** - Undo/Redo buttons

### Phase 5: Polish

12. **Memory management** - History trimming
13. **Testing** - Unit and integration tests

## File Structure

```
src/lib/undo/
  index.ts              # Module exports
  types.ts              # Type definitions
  UndoManager.ts        # Core undo/redo stack manager
  UndoRecorder.ts       # Event listener and entry creator
  commands/
    index.ts            # Command exports
    TextInsertCommand.ts
    TextDeleteCommand.ts
    FormatCommand.ts
    AlignmentCommand.ts
    ResizeCommand.ts
    SnapshotCommand.ts
    CompoundCommand.ts
```

## Event Flow

```
User Action (typing 'a')
    |
    v
FlowingTextContent.insertText('a')
    |
    +---> Emit 'before-text-insert' (with state capture)
    |          |
    |          v
    |     UndoRecorder.recordTextInsertion()
    |          |
    |          +---> Check coalescing
    |          +---> Create TextInsertCommand or coalesce
    |          +---> Push to UndoManager
    |
    +---> Perform insertion
    +---> Emit 'content-changed'
```

## PCEditor API

```typescript
// Undo/Redo operations
undo(): void;
redo(): void;
canUndo(): boolean;
canRedo(): boolean;

// History management
clearUndoHistory(): void;
setMaxUndoHistory(count: number): void;

// Events
on('undo-state-changed', (data: { canUndo: boolean; canRedo: boolean }) => void);
on('undo-performed', () => void);
on('redo-performed', () => void);
```

## Edge Cases

1. **Document loading:** Clear undo history when loading a new document
2. **Selection across objects:** Handle undo when selection spans text and inline elements
3. **Concurrent edits in table cells:** Each cell tracks its own editing session
4. **Paste operations:** Create single undo entry for multi-character paste
5. **Drag operations:** Object resize should undo as single operation
6. **Find and replace:** Multiple replacements as single compound operation

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/undo/` (new directory) | All undo/redo implementation |
| `src/lib/core/PCEditor.ts` | Replace stub methods, integrate UndoManager |
| `src/lib/text/FlowingTextContent.ts` | Add pre-operation event hooks |
| `src/lib/text/TextState.ts` | May need enhanced events |
| `src/demo/index.html` | Add Undo/Redo buttons |
| `src/demo/demo.ts` | Add button handlers, keyboard shortcuts |

## Testing Checklist

- [ ] Undo single character insertion
- [ ] Undo multi-character paste
- [ ] Undo text deletion (backspace, delete, selection delete)
- [ ] Undo formatting changes
- [ ] Undo paragraph alignment changes
- [ ] Undo object insertion/deletion
- [ ] Undo object resize
- [ ] Undo table structure changes (row/column add/remove)
- [ ] Undo table cell merge/split
- [ ] Coalescing works for rapid typing
- [ ] Redo works after undo
- [ ] Redo stack clears on new action after undo
- [ ] Cursor position restored on undo/redo
- [ ] Selection restored on undo/redo
- [ ] History cleared on document load
- [ ] Ctrl+Z / Ctrl+Y keyboard shortcuts work
