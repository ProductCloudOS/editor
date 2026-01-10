# FEATURE-0012: Page Breaks Support - Implementation Plan

## Status: ✅ COMPLETE

## Overview

Implement page break support allowing users to force content to start on a new page. Page breaks can be inserted via keyboard shortcut (Ctrl+Enter) and are displayed as a special control character with visual feedback.

## Current Architecture Analysis

### Text Content Storage
- Text stored in `FlowingTextContent` as a plain string
- Special characters: `\n` (newline/paragraph), `\uFFFC` (object replacement)
- `TextLayout.paginateLines()` splits lines into pages based on available height

### Control Character Rendering
- `FlowingTextRenderer` shows control characters when enabled
- Pilcrow for newlines, middle dot for spaces, arrow for tabs
- Uses `CONTROL_CHAR_COLOR = '#87CEEB'` (light blue)

### Keyboard Handling
- `FlowingTextContent.handleKeyDown()` processes keyboard events
- Enter key inserts `\n` for paragraph breaks
- No Ctrl+Enter handling currently exists

## Design Specification

### 1. Page Break Character

**Character Choice**: `\u000C` (Form Feed)
- Semantically correct (traditional page break character)
- Single character, simple insertion/deletion
- Does not conflict with existing special characters

**Constant Definition**:
```typescript
export const PAGE_BREAK_CHAR = '\u000C';
```

### 2. Visual Representation

**When Control Characters Enabled**:
- Horizontal dashed line spanning content width
- Centered label "Page Break" or symbol
- Color: `#888888` (gray)
- Line extends from left margin to right margin
- Height: ~20px for the indicator

**When Control Characters Disabled**:
- Subtle single-pixel horizontal rule
- Color: `#CCCCCC` (light gray)
- Provides visual feedback without being obtrusive

### 3. Keyboard Shortcut

- **Ctrl+Enter** (Windows/Linux) / **Cmd+Enter** (Mac): Insert page break
- Matches Microsoft Word and other word processors
- Should work in body, header, and footer sections

### 4. FlowedLine Enhancement

Add new property to `FlowedLine` interface:
```typescript
interface FlowedLine {
  // ... existing properties
  endsWithPageBreak?: boolean;  // Line contains a page break character
}
```

### 5. Pagination Logic

In `TextLayout.paginateLines()`:
- Check if line text contains `PAGE_BREAK_CHAR`
- If found, force page break after this line regardless of remaining space
- Page break character should be at the end of a line (like newline)

### 6. PDF Export

- Page breaks should cause actual page breaks in PDF output
- No visual indicator rendered (just the pagination effect)
- `PDFGenerator` processes `FlowedPage` boundaries normally

### 7. Serialization

Page breaks are stored in the text content string itself:
- `text: "Page 1 content\fPage 2 content"` (where `\f` is U+000C)
- No additional metadata needed
- Round-trip preserved automatically

## Implementation Phases

### Phase 1: Data Model Updates

**File: `/Users/james/code/pc/pc-editor/src/lib/text/types.ts`**

1. Add page break constant:
```typescript
/**
 * The Form Feed character used for page breaks.
 */
export const PAGE_BREAK_CHAR = '\u000C';
```

2. Extend `FlowedLine` interface:
```typescript
export interface FlowedLine {
  // ... existing properties
  endsWithPageBreak?: boolean;
}
```

### Phase 2: Text Layout Updates

**File: `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts`**

1. Import `PAGE_BREAK_CHAR`

2. Update `splitIntoLogicalLines()` to also split on page break

3. Create helper to detect page break in logical line processing

4. Update `wrapLogicalLine()` to set `endsWithPageBreak`

5. Update `paginateLines()` to force page break:
```typescript
private paginateLines(lines: FlowedLine[], availableHeight: number): FlowedPage[] {
  // ... existing logic

  // Force page break if line ends with page break character
  if (line.endsWithPageBreak && currentPage.lines.length > 0) {
    pages.push(currentPage);
    currentPage = { lines: [], height: 0, startIndex: line.endIndex + 1, endIndex: 0 };
  }
}
```

### Phase 3: Keyboard Handling

**File: `/Users/james/code/pc/pc-editor/src/lib/text/FlowingTextContent.ts`**

1. Import `PAGE_BREAK_CHAR`

2. Update `handleKeyDown()` to intercept Ctrl+Enter:
```typescript
// Handle Ctrl+Enter (or Cmd+Enter on Mac) for page break
if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
  e.preventDefault();
  this.deleteSelection();
  this.insertPageBreak();
  return true;
}
```

3. Add `insertPageBreak()` method:
```typescript
insertPageBreak(): void {
  this.insertText(PAGE_BREAK_CHAR);
}
```

### Phase 4: Rendering Updates

**File: `/Users/james/code/pc/pc-editor/src/lib/rendering/FlowingTextRenderer.ts`**

1. Add constants for page break rendering:
```typescript
const PAGE_BREAK_COLOR = '#888888';
const PAGE_BREAK_LABEL = 'Page Break';
const PAGE_BREAK_HEIGHT = 20;
```

2. Update `renderFlowedLine()` to render page break indicator

3. Add `renderPageBreakIndicator()` method for dashed line and label

### Phase 5: PDF Export Updates

**File: `/Users/james/code/pc/pc-editor/src/lib/rendering/PDFGenerator.ts`**

Filter page break character from text output (pagination handles the actual break):
```typescript
} else if (code === 12) {  // Form Feed
  continue;  // Skip - pagination handles this
}
```

### Phase 6: PCEditor API

**File: `/Users/james/code/pc/pc-editor/src/lib/core/PCEditor.ts`**

Add public method:
```typescript
insertPageBreak(): void {
  if (!this._isReady) throw new Error('Editor is not ready');
  const activeContent = this.getActiveFlowingContent();
  if (activeContent) {
    activeContent.insertPageBreak();
    this.canvasManager.render();
    this.emit('page-break-inserted', { position: activeContent.getCursorPosition() });
  }
}
```

### Phase 7: Demo Integration (Optional)

Add button for inserting page breaks in demo app.

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/text/types.ts` | Add `PAGE_BREAK_CHAR` constant, extend `FlowedLine` interface |
| `src/lib/text/TextLayout.ts` | Update pagination to handle page breaks |
| `src/lib/text/FlowingTextContent.ts` | Add keyboard shortcut handling, `insertPageBreak()` method |
| `src/lib/rendering/FlowingTextRenderer.ts` | Add page break indicator rendering |
| `src/lib/rendering/PDFGenerator.ts` | Filter page break character from text output |
| `src/lib/core/PCEditor.ts` | Add public `insertPageBreak()` API |
| `src/demo/demo.ts` | Add button handler (optional) |
| `src/demo/index.html` | Add page break button (optional) |

## Testing Checklist

- [ ] Ctrl+Enter inserts page break in body content
- [ ] Page break forces new page even with remaining space
- [ ] Page break indicator shows when control characters enabled
- [ ] Subtle indicator shows when control characters disabled
- [ ] Multiple consecutive page breaks create empty pages
- [ ] Backspace/Delete removes page break character
- [ ] Copy/paste preserves page breaks
- [ ] Serialization preserves page breaks (automatic via text string)
- [ ] PDF export creates actual page breaks
- [ ] Page numbers update correctly across page breaks

## Edge Cases

1. **Page break in header/footer**: Should work but limited practical use
2. **Page break immediately after another**: Creates empty page
3. **Page break at document end**: Creates trailing empty page
4. **Page break in text box**: Should be disabled (text boxes don't span pages)
5. **Page break in table cell**: Should be disabled (tables handle own pagination)

## Critical Files for Implementation

- `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts` - Core pagination logic
- `/Users/james/code/pc/pc-editor/src/lib/text/FlowingTextContent.ts` - Keyboard handling
- `/Users/james/code/pc/pc-editor/src/lib/rendering/FlowingTextRenderer.ts` - Visual rendering
- `/Users/james/code/pc/pc-editor/src/lib/text/types.ts` - Type definitions
- `/Users/james/code/pc/pc-editor/src/lib/core/PCEditor.ts` - Public API
