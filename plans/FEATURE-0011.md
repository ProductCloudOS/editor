# FEATURE-0011: Advanced Selection Logic - Implementation Plan

## Status: ✅ COMPLETED

## Overview

Implement modern word processor-style selection behaviors including double-click to select word, triple-click for paragraph, shift+click to extend selection, keyboard-based selection extensions, and drag selection across page boundaries.

## Current Architecture Analysis

### Text State Management
- **TextState** (`src/lib/text/TextState.ts`):
  - Manages `selectionAnchor` for selection tracking
  - Provides `setSelectionAnchor()`, `getSelection()`, `hasSelection()`, `clearSelection()`
  - Has `selectLeft()` and `selectRight()` for shift+arrow selection
  - Cursor position is separate from selection anchor

- **FlowingTextContent** (`src/lib/text/FlowingTextContent.ts`):
  - Facade over TextState, exposes selection methods
  - Implements `Focusable` interface for focus management
  - `handleKeyDown()` handles ArrowLeft/ArrowRight with shift for selection
  - Currently handles vertical arrow selection prep (sets anchor if shift)

### Mouse Event Handling
- **CanvasManager** (`src/lib/rendering/CanvasManager.ts`):
  - `handleMouseDown()` - Sets selection anchor, starts `isSelectingText` mode
  - `handleMouseMove()` - Extends selection by calling `handleRegionClick()`
  - `handleMouseUp()` - Finalizes selection, clears `isSelectingText`
  - `handleClick()` - Detects double-click using `lastClickTime` and `lastClickPosition`
  - `handleDoubleClick()` - Currently only switches sections or enters text box/table editing
  - Tracks `textSelectionStartPageId` for selection origin

### Text Position Calculation
- **TextPositionCalculator** (`src/lib/text/TextPositionCalculator.ts`):
  - `getTextIndexAtX()` - Converts X position to text index
  - `getXPositionForTextIndex()` - Converts text index to X position
  - `findLineAtY()` - Finds line at Y position
  - Handles alignment offsets and substitution fields

- **FlowingTextRenderer** (`src/lib/rendering/FlowingTextRenderer.ts`):
  - `handleRegionClick()` - Unified click handler for all text regions
  - `moveCursorVertical()` - Vertical navigation across pages
  - Uses `flowedPages` map for multi-page content
  - `getFlowedLinesForRegion()` - Gets flowed lines for a specific region and page

### Multi-Page Support
- Body content flows across pages via `flowedPages` Map
- Header/footer are single-page regions
- Each `FlowedPage` has `startIndex` and `endIndex`
- `FlowedLine` has `startIndex` and `endIndex` for text mapping

## Implementation Phases

### Phase 1: Word and Paragraph Detection Utilities

**File: `src/lib/text/TextState.ts`**

Add utility methods for word and paragraph boundaries:

```typescript
/**
 * Find word boundaries at a text position.
 * Words are sequences of alphanumeric characters, not including spaces/punctuation.
 */
getWordBoundaries(position: number): { start: number; end: number } {
  const text = this.content;
  if (text.length === 0) return { start: 0, end: 0 };

  // Clamp position to valid range
  const pos = Math.max(0, Math.min(position, text.length));

  // Handle position at or past end
  if (pos >= text.length) {
    let start = pos;
    while (start > 0 && this.isWordChar(text.charAt(start - 1))) {
      start--;
    }
    return { start, end: text.length };
  }

  // Check if position is on a word character
  const charAtPos = text.charAt(pos);
  if (!this.isWordChar(charAtPos)) {
    return { start: pos, end: pos };
  }

  // Find word start (scan backwards)
  let start = pos;
  while (start > 0 && this.isWordChar(text.charAt(start - 1))) {
    start--;
  }

  // Find word end (scan forwards)
  let end = pos;
  while (end < text.length && this.isWordChar(text.charAt(end))) {
    end++;
  }

  return { start, end };
}

/**
 * Find paragraph boundaries at a text position.
 * Paragraphs are delimited by newline characters.
 */
getParagraphBoundaries(position: number): { start: number; end: number } {
  const text = this.content;
  if (text.length === 0) return { start: 0, end: 0 };

  const pos = Math.max(0, Math.min(position, text.length));

  // Find paragraph start (scan backwards for \n)
  let start = pos;
  while (start > 0 && text.charAt(start - 1) !== '\n') {
    start--;
  }

  // Find paragraph end (scan forwards for \n)
  let end = pos;
  while (end < text.length && text.charAt(end) !== '\n') {
    end++;
  }

  return { start, end };
}

/**
 * Check if character is a word character (alphanumeric or underscore).
 */
private isWordChar(char: string): boolean {
  return /[\w\u00C0-\u024F]/.test(char); // Includes accented characters
}

/**
 * Select the word at the current cursor position.
 */
selectWord(): void {
  const { start, end } = this.getWordBoundaries(this.cursorPosition);
  if (start !== end) {
    this.selectionAnchor = start;
    this.cursorPosition = end;
    this.emitSelectionChange();
  }
}

/**
 * Select the paragraph at the current cursor position.
 */
selectParagraph(): void {
  const { start, end } = this.getParagraphBoundaries(this.cursorPosition);
  this.selectionAnchor = start;
  this.cursorPosition = end;
  this.emitSelectionChange();
}

/**
 * Select all text content.
 */
selectAll(): void {
  if (this.content.length === 0) return;
  this.selectionAnchor = 0;
  this.cursorPosition = this.content.length;
  this.emitSelectionChange();
}
```

**File: `src/lib/text/FlowingTextContent.ts`**

Expose selection methods:

```typescript
selectWord(): void {
  this.textState.selectWord();
}

selectParagraph(): void {
  this.textState.selectParagraph();
}

selectAll(): void {
  this.textState.selectAll();
}

getWordBoundaries(position: number): { start: number; end: number } {
  return this.textState.getWordBoundaries(position);
}

getParagraphBoundaries(position: number): { start: number; end: number } {
  return this.textState.getParagraphBoundaries(position);
}
```

### Phase 2: Double-Click and Triple-Click Detection

**File: `src/lib/rendering/CanvasManager.ts`**

Add click counting for multi-click detection:

```typescript
// Add class properties
private clickCount: number = 0;
private lastClickTime: number = 0;
private lastClickPosition: Point | null = null;
private static readonly MULTI_CLICK_THRESHOLD = 500; // ms
private static readonly MULTI_CLICK_DISTANCE = 5; // pixels

private handleClick(e: MouseEvent, pageId: string): void {
  const point = this.getMousePosition(e);
  const now = Date.now();

  // Check for multi-click sequence
  let clickCount = 1;
  if (this.lastClickPosition) {
    const timeDiff = now - this.lastClickTime;
    const distance = Math.sqrt(
      Math.pow(point.x - this.lastClickPosition.x, 2) +
      Math.pow(point.y - this.lastClickPosition.y, 2)
    );

    if (timeDiff < CanvasManager.MULTI_CLICK_THRESHOLD &&
        distance < CanvasManager.MULTI_CLICK_DISTANCE) {
      clickCount = (this.clickCount % 3) + 1; // Cycle through 1, 2, 3
    }
  }

  this.clickCount = clickCount;
  this.lastClickTime = now;
  this.lastClickPosition = { ...point };

  switch (clickCount) {
    case 1:
      this.handleSingleClick(point, pageId);
      break;
    case 2:
      this.handleDoubleClick(point, pageId);
      break;
    case 3:
      this.handleTripleClick(point, pageId);
      break;
  }
}

/**
 * Handle triple-click to select paragraph.
 */
private handleTripleClick(point: Point, pageId: string): void {
  if (this.editingTextBox) {
    this.editingTextBox.flowingContent.selectParagraph();
    this.render();
    return;
  }

  if (this._focusedControl instanceof TableObject) {
    const table = this._focusedControl;
    if (table.focusedCell) {
      const cell = table.getCell(table.focusedCell.row, table.focusedCell.col);
      if (cell) {
        cell.flowingContent.selectParagraph();
        this.render();
        return;
      }
    }
  }

  const flowingContent = this.getFlowingContentForActiveSection();
  if (flowingContent) {
    flowingContent.selectParagraph();
    this.emit('text-selection-changed', {
      selection: flowingContent.getSelection(),
      section: this._activeSection
    });
    this.render();
  }
}
```

**Update handleDoubleClick to handle word selection:**

```typescript
private handleDoubleClick(point: Point, pageId: string): void {
  const page = this.document.getPage(pageId);
  if (!page) return;

  // Check embedded objects first (existing logic for text box/table entry)
  // ...

  // Double-click in text content - select word
  const flowingContent = this.getFlowingContentForActiveSection();
  if (flowingContent) {
    flowingContent.selectWord();
    this.emit('text-selection-changed', {
      selection: flowingContent.getSelection(),
      section: this._activeSection
    });
    this.render();
  }
}
```

### Phase 3: Shift+Click to Extend Selection

**File: `src/lib/rendering/CanvasManager.ts`**

```typescript
private handleMouseDown(e: MouseEvent, pageId: string): void {
  const point = this.getMousePosition(e);

  // Handle shift+click for selection extension
  if (e.shiftKey) {
    this.handleShiftClick(point, pageId);
    e.preventDefault();
    return;
  }

  // ... rest of existing mousedown logic ...
}

/**
 * Handle shift+click to extend selection from anchor to click point.
 */
private handleShiftClick(point: Point, pageId: string): void {
  if (this.editingTextBox) {
    const pageIndex = this.document.pages.findIndex(p => p.id === pageId);
    const ctx = this.contexts.get(pageId);
    if (ctx && pageIndex >= 0) {
      const flowingContent = this.editingTextBox.flowingContent;
      if (!flowingContent.hasSelectionAnchor()) {
        flowingContent.setSelectionAnchor();
      }
      this.flowingTextRenderer.handleRegionClick(this.editingTextBox, point, pageIndex, ctx);
      this.render();
    }
    return;
  }

  // Handle table cell and body/header/footer similarly...
  const region = this.getRegionForActiveSection();
  const flowingContent = this.getFlowingContentForActiveSection();
  const ctx = this.contexts.get(pageId);
  const pageIndex = this.document.pages.findIndex(p => p.id === pageId);

  if (region && flowingContent && ctx && pageIndex >= 0) {
    if (!flowingContent.hasSelectionAnchor()) {
      flowingContent.setSelectionAnchor();
    }
    this.flowingTextRenderer.handleRegionClick(region, point, pageIndex, ctx);
    this.emit('text-selection-changed', {
      selection: flowingContent.getSelection(),
      section: this._activeSection
    });
    this.render();
  }
}
```

### Phase 4: Select All (Ctrl+A / Cmd+A)

**File: `src/lib/core/PCEditor.ts`**

```typescript
private handleKeyDown(e: KeyboardEvent): void {
  // Handle select all (Ctrl+A / Cmd+A)
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    this.selectAll();
    return;
  }
  // ... rest of existing handling ...
}

/**
 * Select all text in the currently focused content.
 */
selectAll(): void {
  const editingTextBox = this.canvasManager.getEditingTextBox();
  if (editingTextBox) {
    editingTextBox.flowingContent.selectAll();
    this.canvasManager.render();
    return;
  }

  const focusedControl = this.canvasManager.getFocusedControl();
  if (focusedControl instanceof TableObject && focusedControl.focusedCell) {
    const cell = focusedControl.getCell(
      focusedControl.focusedCell.row,
      focusedControl.focusedCell.col
    );
    if (cell) {
      cell.flowingContent.selectAll();
      this.canvasManager.render();
      return;
    }
  }

  const flowingContent = this.getFlowingContentForSection(this._activeEditingSection);
  if (flowingContent) {
    flowingContent.selectAll();
    this.canvasManager.render();
    this.emitSelectionChange();
  }
}
```

### Phase 5: Home/End Key Behavior

**File: `src/lib/text/TextState.ts`**

```typescript
moveCursorToLineStart(): void {
  let pos = this.cursorPosition;
  while (pos > 0 && this.content.charAt(pos - 1) !== '\n') {
    pos--;
  }
  this.setCursorPosition(pos);
}

moveCursorToLineEnd(): void {
  let pos = this.cursorPosition;
  while (pos < this.content.length && this.content.charAt(pos) !== '\n') {
    pos++;
  }
  this.setCursorPosition(pos);
}

moveCursorToDocumentStart(): void {
  this.setCursorPosition(0);
}

moveCursorToDocumentEnd(): void {
  this.setCursorPosition(this.content.length);
}

selectToLineStart(): void {
  if (this.selectionAnchor === null) {
    this.selectionAnchor = this.cursorPosition;
  }
  this.moveCursorToLineStart();
  this.emitSelectionChange();
}

selectToLineEnd(): void {
  if (this.selectionAnchor === null) {
    this.selectionAnchor = this.cursorPosition;
  }
  this.moveCursorToLineEnd();
  this.emitSelectionChange();
}

selectToDocumentStart(): void {
  if (this.selectionAnchor === null) {
    this.selectionAnchor = this.cursorPosition;
  }
  this.moveCursorToDocumentStart();
  this.emitSelectionChange();
}

selectToDocumentEnd(): void {
  if (this.selectionAnchor === null) {
    this.selectionAnchor = this.cursorPosition;
  }
  this.moveCursorToDocumentEnd();
  this.emitSelectionChange();
}
```

**File: `src/lib/text/FlowingTextContent.ts`**

Update `handleKeyDown()`:

```typescript
case 'Home':
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey) {
      this.selectToDocumentStart();
    } else {
      this.clearSelection();
      this.moveCursorToDocumentStart();
    }
  } else {
    if (e.shiftKey) {
      this.selectToLineStart();
    } else {
      this.clearSelection();
      this.moveCursorToLineStart();
    }
  }
  this.resetCursorBlink();
  return true;

case 'End':
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey) {
      this.selectToDocumentEnd();
    } else {
      this.clearSelection();
      this.moveCursorToDocumentEnd();
    }
  } else {
    if (e.shiftKey) {
      this.selectToLineEnd();
    } else {
      this.clearSelection();
      this.moveCursorToLineEnd();
    }
  }
  this.resetCursorBlink();
  return true;
```

### Phase 6: Cross-Page Drag Selection

The current implementation already supports cross-page selection during mouse move via `handleRegionClick()`. Verify it works correctly when dragging from one page to another.

The key insight is that `handleRegionClick()` in `FlowingTextRenderer` already:
1. Finds the correct page's flowed lines
2. Maps click position to text index
3. Sets cursor position (which extends selection when anchor is set)

### Phase 7: Shift+Arrow Key Selection

**File: `src/lib/core/PCEditor.ts`**

Update `handleVerticalNavigation()`:

```typescript
private handleVerticalNavigation(e: KeyboardEvent, focusedControl: Focusable): void {
  const direction = e.key === 'ArrowUp' ? -1 : 1;

  const flowingContent = this.getFlowingContentForSection(this._activeEditingSection);
  if (!flowingContent) return;

  if (e.shiftKey) {
    if (!flowingContent.hasSelectionAnchor()) {
      flowingContent.setSelectionAnchor();
    }
  } else {
    flowingContent.clearSelection();
  }

  const newTextIndex = this.canvasManager.moveCursorVertical(direction);
  if (newTextIndex !== null) {
    flowingContent.setCursorPosition(newTextIndex);
    flowingContent.resetCursorBlink();

    if (e.shiftKey) {
      this.emit('text-selection-changed', {
        selection: flowingContent.getSelection(),
        section: this._activeEditingSection
      });
    }
  }
  this.canvasManager.render();
}
```

### Phase 8: Word-by-Word Navigation (Ctrl+Arrow)

**File: `src/lib/text/TextState.ts`**

```typescript
moveCursorWordLeft(): void {
  if (this.cursorPosition === 0) return;

  let pos = this.cursorPosition - 1;

  // Skip any whitespace/punctuation
  while (pos > 0 && !this.isWordChar(this.content.charAt(pos))) {
    pos--;
  }

  // Skip to start of word
  while (pos > 0 && this.isWordChar(this.content.charAt(pos - 1))) {
    pos--;
  }

  this.setCursorPosition(pos);
}

moveCursorWordRight(): void {
  if (this.cursorPosition >= this.content.length) return;

  let pos = this.cursorPosition;

  // Skip current word if on one
  while (pos < this.content.length && this.isWordChar(this.content.charAt(pos))) {
    pos++;
  }

  // Skip whitespace/punctuation
  while (pos < this.content.length && !this.isWordChar(this.content.charAt(pos))) {
    pos++;
  }

  this.setCursorPosition(pos);
}

selectWordLeft(): void {
  if (this.selectionAnchor === null) {
    this.selectionAnchor = this.cursorPosition;
  }
  this.moveCursorWordLeft();
  this.emitSelectionChange();
}

selectWordRight(): void {
  if (this.selectionAnchor === null) {
    this.selectionAnchor = this.cursorPosition;
  }
  this.moveCursorWordRight();
  this.emitSelectionChange();
}
```

**File: `src/lib/text/FlowingTextContent.ts`**

Update `handleKeyDown()`:

```typescript
case 'ArrowLeft':
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey) {
      this.selectWordLeft();
    } else {
      this.clearSelection();
      this.moveCursorWordLeft();
    }
  } else if (e.shiftKey) {
    this.selectLeft();
  } else {
    this.clearSelection();
    this.moveCursorLeft();
  }
  this.resetCursorBlink();
  return true;

case 'ArrowRight':
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey) {
      this.selectWordRight();
    } else {
      this.clearSelection();
      this.moveCursorWordRight();
    }
  } else if (e.shiftKey) {
    this.selectRight();
  } else {
    this.clearSelection();
    this.moveCursorRight();
  }
  this.resetCursorBlink();
  return true;
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/text/TextState.ts` | Add word/paragraph boundary detection, selectWord, selectParagraph, selectAll, Home/End movement, word navigation |
| `src/lib/text/FlowingTextContent.ts` | Expose new methods, update handleKeyDown for Home/End/Ctrl+Arrow |
| `src/lib/rendering/CanvasManager.ts` | Multi-click detection, handleTripleClick, handleShiftClick, update handleDoubleClick |
| `src/lib/core/PCEditor.ts` | Add Ctrl+A handling, selectAll method, update vertical navigation for shift |

## Testing Checklist

### Double-Click Word Selection
- [ ] Double-click on a word selects the entire word
- [ ] Double-click on whitespace does not select
- [ ] Double-click works in body, header, footer
- [ ] Double-click enters text box and selects word
- [ ] Double-click enters table cell and selects word

### Triple-Click Paragraph Selection
- [ ] Triple-click selects entire paragraph
- [ ] Paragraph boundaries are newline characters
- [ ] Works in body, header, footer, text boxes, table cells

### Shift+Click Selection Extension
- [ ] Shift+click extends selection from cursor to click point
- [ ] Works when starting selection from scratch
- [ ] Works to extend existing selection
- [ ] Works across lines
- [ ] Works in text boxes and table cells

### Select All (Ctrl+A)
- [ ] Selects all text in focused content
- [ ] Works in body, header, footer
- [ ] Works in text box editing mode
- [ ] Works in table cell editing mode

### Home/End Keys
- [ ] Home moves to line start
- [ ] End moves to line end
- [ ] Ctrl+Home moves to document start
- [ ] Ctrl+End moves to document end
- [ ] Shift+Home selects to line start
- [ ] Shift+End selects to line end
- [ ] Ctrl+Shift+Home selects to document start
- [ ] Ctrl+Shift+End selects to document end

### Ctrl+Arrow Word Navigation
- [ ] Ctrl+Left moves to previous word start
- [ ] Ctrl+Right moves to next word end
- [ ] Ctrl+Shift+Left selects word left
- [ ] Ctrl+Shift+Right selects word right
- [ ] Skips punctuation and whitespace correctly

### Cross-Page Selection
- [ ] Click and drag selects across page boundaries
- [ ] Selection highlighting renders correctly on multiple pages
- [ ] Shift+click works across pages
- [ ] Shift+Up/Down arrow extends selection across pages

### Edge Cases
- [ ] Selection at document boundaries
- [ ] Selection with embedded objects (skip fields)
- [ ] Selection with substitution fields
- [ ] Selection in empty content
- [ ] Selection in single-character content

## Implementation Order

1. **Phase 1**: Word/paragraph detection utilities in TextState
2. **Phase 2**: Double-click and triple-click detection in CanvasManager
3. **Phase 3**: Shift+click handling in CanvasManager
4. **Phase 4**: Select all in PCEditor
5. **Phase 5**: Home/End key behavior
6. **Phase 6**: Verify/fix cross-page drag selection
7. **Phase 7**: Shift+arrow key selection (mostly exists, verify vertical)
8. **Phase 8**: Ctrl+arrow word navigation
