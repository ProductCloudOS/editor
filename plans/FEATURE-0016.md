# FEATURE-0016: Fix Block Object Text Handling - Implementation Plan

## Status: COMPLETE

## Problem Analysis

### Issue 1: Text Before Block Objects is Incorrectly Justified

**Location:** `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts` lines 230-234

When text appears before a block object on the same logical line (paragraph), the line containing that text is finalized with `isLastLineOfParagraph = false` (line 232):

```typescript
// Line 230-234
if (currentLine.text.length > 0) {
  const line = this.finalizeLineBuilder(currentLine, alignment, false, effectiveWidth);
  pushLineWithMarker(line, lines.length === 0);
}
```

This causes the text line BEFORE the block object to be justified (have `extraWordSpacing` calculated), even though it should be treated as if it ends the paragraph since block objects act as paragraph breaks.

**Current Behavior:**
- Content: "Some text here [BLOCK_OBJECT] more text"
- "Some text here" gets justified (word spacing added)
- But visually, the block object creates a break

**Expected Behavior:**
- "Some text here" should NOT be justified (no extra word spacing)
- It should be treated as the last line before a paragraph break

### Issue 2: Text After Block Objects Starts with Wrong Index

**Location:** `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts` line 241

After creating the block object line, the next line builder starts at `segment.startIndex + 1`:

```typescript
// Line 241
currentLine = this.createLineBuilder(segment.startIndex + 1, formatting);
```

This starts the line builder at the character AFTER the block object's replacement character. However, the subsequent text segments continue to be processed from where they were. The issue is that there's no special handling to ensure the line AFTER a block object is also not incorrectly treated.

### Issue 3: Page Splitting Does Not Consider Block Object Context

**Location:** `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts` lines 811-858

The pagination logic has a comment acknowledging block objects can break from preceding text:

```typescript
// Lines 853-858
} else if (isBlockObjectLine && currentPage.lines.length > 0) {
  // Block objects act as paragraph breaks - allow page break before them
  // even if they would fit, if doing so would better balance pages.
  // For now, we just ensure they CAN break from preceding content.
  // The actual break happens above when height is exceeded.
}
```

However, this block only allows breaks but does not implement any special logic. The issue is:

1. **Orphan text before block object:** When a page break occurs, a single line of text before a block object might be left alone on one page while the block object starts the next page. This is acceptable.

2. **Widow text after block object:** When a block object is the last item on a page, and text follows on the next page, the first line after the block object might appear orphaned.

3. **Block object at page start:** There's no logic to keep the line BEFORE a block object on the same page as the block object when possible.

### Issue 4: Block Object Line Has No `extraWordSpacing` Handling

**Location:** `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts` lines 291-310

The `createBlockObjectLine` method creates a line for the block object but does not set any justification-related properties. This is correct since block objects should never be justified, but it means any runs within the block line segment will inherit wrong text widths if they contain the replacement character.

## Root Cause Summary

The fundamental issue is that the `wrapLogicalLine` method treats content before and after block objects as part of the same paragraph for justification purposes. When `finalizeLineBuilder` is called with `isLastLineOfParagraph = false` for the line before a block object, justification is incorrectly applied.

Block objects should be treated as **implicit paragraph breaks** for the purposes of:
1. Text justification (lines before block should be "last line" and not justified)
2. Page splitting (can break before block objects more liberally)

## Proposed Solution

### Approach: Treat Block Objects as Paragraph Terminators

Modify the text layout algorithm to recognize that block objects act as paragraph terminators for justification purposes. This requires:

1. **Mark lines before block objects as "last line of paragraph"** when finalizing them
2. **Mark lines after block objects as "first line of paragraph"** (no special handling needed, handled by existing logic)
3. **Update pagination logic** to allow page breaks before block objects without orphan/widow restrictions

## Implementation Steps

### Step 1: Fix Justification for Lines Before Block Objects

**File:** `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts`

Modify the block object handling in `wrapLogicalLine`:

**Current (lines 229-234):**
```typescript
if (blockObject) {
  // Finalize current line if it has content
  if (currentLine.text.length > 0) {
    const line = this.finalizeLineBuilder(currentLine, alignment, false, effectiveWidth);
    pushLineWithMarker(line, lines.length === 0);
  }
```

**Proposed:**
```typescript
if (blockObject) {
  // Finalize current line if it has content
  // Block objects act as paragraph terminators, so treat preceding line as last line
  // (no justify spacing applied)
  if (currentLine.text.length > 0) {
    const line = this.finalizeLineBuilder(currentLine, alignment, true, effectiveWidth);
    pushLineWithMarker(line, lines.length === 0);
  }
```

Change `false` to `true` for `isLastLineOfParagraph` parameter. This ensures lines immediately before block objects are NOT justified.

### Step 2: Ensure Lines After Block Objects Are Properly Started

**File:** `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts`

The current code at line 241 already creates a new line builder starting after the block object. However, we should verify that subsequent segments continue correctly.

No changes needed here - the existing logic handles this correctly since each new line builder starts fresh.

### Step 3: Add Page Break Flag for Block Object Lines

**File:** `/Users/james/code/pc/pc-editor/src/lib/text/types.ts`

Add a new optional property to `FlowedLine`:

```typescript
export interface FlowedLine {
  // ... existing properties
  isBlockObjectLine?: boolean;  // True if line contains only a block-positioned object
  allowPageBreakBefore?: boolean;  // True if page can break before this line
}
```

**File:** `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts`

Update `createBlockObjectLine`:

```typescript
private createBlockObjectLine(
  blockObject: FlowedEmbeddedObject,
  segment: { text: string; startIndex: number; runs: TextRun[]; substitutionFields: FlowedSubstitutionField[] },
  alignment: TextAlignment
): FlowedLine {
  const object = blockObject.object;
  return {
    text: segment.text,
    width: object.width,
    height: object.height,
    baseline: object.height,
    runs: segment.runs,
    substitutionFields: segment.substitutionFields,
    embeddedObjects: [blockObject],
    startIndex: segment.startIndex,
    endIndex: segment.startIndex + segment.text.length,
    alignment,
    isBlockObjectLine: true,
    allowPageBreakBefore: true  // Allow page break before block objects
  };
}
```

### Step 4: Update Pagination Logic

**File:** `/Users/james/code/pc/pc-editor/src/lib/text/TextLayout.ts`

The pagination logic should use the `allowPageBreakBefore` flag to decide when to break pages. Currently the block at lines 853-858 does nothing. We can enhance it:

```typescript
// Check if adding this line would exceed page height
if (currentPage.height + line.height > availableHeight && currentPage.lines.length > 0) {
  // ... existing table splitting logic ...

  if (!hasSplittableObject) {
    // Finalize current page
    currentPage.endIndex = currentPage.lines[currentPage.lines.length - 1].endIndex;
    pages.push(currentPage);

    // Start new page
    currentPage = {
      lines: [],
      height: 0,
      startIndex: line.startIndex,
      endIndex: 0
    };
  }
} else if (line.allowPageBreakBefore && currentPage.lines.length > 0) {
  // Block objects allow page breaks before them even when they fit
  // This helps avoid orphaned text before block objects
  // Optional: implement orphan/widow detection here
  // For now, we don't force breaks, just allow them when height is exceeded
}
```

### Step 5: Update PDF Generator for Consistency

**File:** `/Users/james/code/pc/pc-editor/src/lib/rendering/PDFGenerator.ts`

The PDF generator at lines 300-304 handles `extraWordSpacing` for justified text. Since we're now correctly NOT setting `extraWordSpacing` on lines before block objects, no changes should be needed. However, verify that the rendering handles block object lines correctly.

### Step 6: Add Unit Tests

**File:** `/Users/james/code/pc/pc-editor/src/test/unit/text/TextLayout.test.ts`

Add new test cases:

```typescript
describe('block object text handling', () => {
  it('should not justify line before block object', () => {
    // Setup with justify alignment and a block object
    context.availableWidth = 200;
    context.paragraphFormatting.setAlignment(0, 'justify');

    // Create mock block object
    const blockObj = new MockEmbeddedObject('block1', 100, 50);
    blockObj.position = 'block';
    context.embeddedObjects.insert(blockObj, 10);

    const text = 'Short text\uFFFCmore text after';
    context.content = text;

    const pages = layout.flowText(text, context);

    // Find the line before the block object
    // It should NOT have extraWordSpacing
    const lineBeforeBlock = pages[0].lines[0];
    expect(lineBeforeBlock.extraWordSpacing).toBeUndefined();
  });

  it('should allow page break before block object', () => {
    context.availableHeight = 100;

    // Create a tall block object
    const blockObj = new MockEmbeddedObject('block1', 100, 80);
    blockObj.position = 'block';
    context.embeddedObjects.insert(blockObj, 10);

    const text = 'Line1\nLine2\uFFFCLine3';
    context.content = text;

    const pages = layout.flowText(text, context);

    // Block object should be able to start on new page
    // Verify pagination handles this correctly
  });
});
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/text/TextLayout.ts` | Fix `isLastLineOfParagraph` parameter when finalizing lines before block objects (line 232) |
| `src/lib/text/TextLayout.ts` | Add `allowPageBreakBefore` to block object lines (createBlockObjectLine method) |
| `src/lib/text/types.ts` | Add `allowPageBreakBefore?: boolean` to `FlowedLine` interface |
| `src/test/unit/text/TextLayout.test.ts` | Add unit tests for block object text handling |
| `src/lib/rendering/PDFGenerator.ts` | Verify correct handling (likely no changes needed) |
| `src/lib/rendering/FlowingTextRenderer.ts` | Verify correct handling (likely no changes needed) |

## Testing Considerations

### Manual Testing Scenarios

1. **Justify mode with block object:**
   - Create text with justify alignment
   - Insert a block-positioned table or text box in the middle of a paragraph
   - Verify text before the block is NOT justified
   - Verify text after the block is justified normally (except last line)

2. **Page break near block object:**
   - Create multi-page document
   - Place block object near page boundary
   - Verify no orphaned single lines before block object
   - Verify block object can be moved to new page cleanly

3. **Multiple block objects:**
   - Insert multiple block objects in sequence
   - Verify each has correct text handling before/after

4. **PDF export:**
   - Export document with block objects and justify alignment
   - Verify PDF matches canvas rendering

### Unit Test Coverage

- Line before block object has no `extraWordSpacing` when alignment is justify
- Line after block object can have `extraWordSpacing` if wrapped and not last line
- Block object line itself has no `extraWordSpacing`
- Pagination allows page break before block objects
- Existing paragraph justification tests still pass

## Potential Edge Cases

1. **Block object at start of paragraph:** No preceding text, just the block object. Should work as-is.

2. **Block object at end of paragraph:** No following text. The paragraph ends with newline. Should work as-is.

3. **Multiple block objects in a row:** Each treated as separate paragraph. Should work with proposed changes.

4. **Block object with empty text before:** Only whitespace before block object. Should handle correctly.

5. **Block object in header/footer:** Same logic applies, verify in header/footer rendering paths.
