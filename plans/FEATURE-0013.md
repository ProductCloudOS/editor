# FEATURE-0013: Nested Bullet Points Support - Implementation Plan

## Status: COMPLETE

## Overview

Add support for bullet points and numbered lists with nesting capability. The implementation extends the existing `ParagraphFormatting` system to include list properties, modifies the text layout engine to handle indentation and bullet markers, and updates the rendering pipeline.

## Current Architecture

### Paragraph Formatting System
- `ParagraphFormattingManager` (`src/lib/text/ParagraphFormatting.ts`) manages per-paragraph formatting
- Uses `Map<number, ParagraphFormatting>` keyed by paragraph start index
- Current `ParagraphFormatting` interface contains only `alignment: TextAlignment`

### Text Layout Flow
1. **FlowingTextContent** - Facade coordinating text state, formatting, layout
2. **TextLayout** - Handles line breaking and page flow
3. **FlowingTextRenderer** - Renders flowed text to canvas

## Data Model Design

### Type Definitions

**File: `src/lib/text/types.ts`**

```typescript
export type BulletStyle = 'disc' | 'circle' | 'square' | 'dash' | 'none';
export type NumberStyle = 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman';
export type ListType = 'bullet' | 'number' | 'none';

export interface ListFormatting {
  listType: ListType;
  bulletStyle?: BulletStyle;      // For bullet lists
  numberStyle?: NumberStyle;      // For numbered lists
  nestingLevel: number;           // 0 = top level, 1 = first indent, etc.
  startNumber?: number;           // For numbered lists, starting number
}

// Extended ParagraphFormatting
export interface ParagraphFormatting {
  alignment: TextAlignment;
  listFormatting?: ListFormatting;  // Optional - undefined means not a list
}

// Constants
export const LIST_INDENT_PER_LEVEL = 24;  // pixels per nesting level
```

### Extended FlowedLine Interface

```typescript
export interface FlowedLine {
  // ... existing properties ...
  listMarker?: {
    text: string;           // The marker to render (bullet char or "1.", "a.", etc.)
    width: number;          // Width of marker + spacing
    indent: number;         // Total left indent for this line
    isFirstLineOfListItem: boolean;  // Only first line shows marker
  };
}
```

## Implementation Phases

### Phase 1: Core Data Model Updates

**File: `src/lib/text/types.ts`**
- Add `BulletStyle`, `NumberStyle`, `ListType` type aliases
- Add `ListFormatting` interface
- Extend `ParagraphFormatting` interface
- Add `listMarker` property to `FlowedLine`

**File: `src/lib/types/index.ts`**
- Extend `ParagraphFormattingData.formatting` for serialization

### Phase 2: ParagraphFormattingManager Updates

**File: `src/lib/text/ParagraphFormatting.ts`**

Add new methods:
```typescript
// Set list formatting for a paragraph
setListFormatting(paragraphStartIndex: number, listFormatting: ListFormatting | undefined): void

// Increase nesting level (indent)
indentParagraph(paragraphStartIndex: number): void

// Decrease nesting level (outdent)
outdentParagraph(paragraphStartIndex: number): void

// Convert paragraph to/from list
toggleList(paragraphStartIndex: number, listType: ListType): void

// Change bullet/number style
setListStyle(paragraphStartIndex: number, style: BulletStyle | NumberStyle): void
```

Update serialization methods for list properties.

### Phase 3: Layout Engine Updates

**File: `src/lib/text/TextLayout.ts`**

Modify `flowText()`:
- Calculate indent based on nesting level
- Pass indent to `wrapLogicalLine()`

Modify `wrapLogicalLine()`:
- Reduce `availableWidth` by total indent amount
- On first line of paragraph, account for marker width
- Set `listMarker` property on first `FlowedLine` of each list paragraph

Add helper methods:
```typescript
// Calculate total indent for a nesting level
private calculateIndent(nestingLevel: number): number {
  return LIST_INDENT_PER_LEVEL * (nestingLevel + 1);
}

// Generate marker text for a list item
private getListMarker(listFormatting: ListFormatting, itemIndex: number): string

// Get bullet character based on style and nesting
private getBulletCharacter(style?: BulletStyle, nestingLevel?: number): string {
  // Default progression: disc -> circle -> square
  const defaultProgression: BulletStyle[] = ['disc', 'circle', 'square'];
  const effectiveStyle = style || defaultProgression[(nestingLevel || 0) % 3];

  switch (effectiveStyle) {
    case 'disc': return '\u2022';    // •
    case 'circle': return '\u25E6';  // ◦
    case 'square': return '\u25AA';  // ▪
    case 'dash': return '\u2013';    // –
    default: return '\u2022';
  }
}

// Format number according to style
private formatNumber(n: number, style?: NumberStyle): string {
  switch (style) {
    case 'lower-alpha': return this.toAlpha(n, false) + '.';
    case 'upper-alpha': return this.toAlpha(n, true) + '.';
    case 'lower-roman': return this.toRoman(n, false) + '.';
    case 'upper-roman': return this.toRoman(n, true) + '.';
    case 'decimal':
    default: return n + '.';
  }
}
```

Extend `LayoutContext`:
```typescript
export interface LayoutContext {
  // ... existing properties ...
  listItemCounters: Map<number, number>;  // Track numbering per nesting level
}
```

### Phase 4: Rendering Updates

**File: `src/lib/rendering/FlowingTextRenderer.ts`**

Modify `renderFlowedLine()`:
```typescript
private renderFlowedLine(...): void {
  const effectiveIndent = line.listMarker?.indent || 0;
  const alignmentOffset = this.getAlignmentOffset(line, maxWidth - effectiveIndent);

  // Apply indent
  let x = position.x + effectiveIndent + alignmentOffset;

  // Render list marker if first line of list item
  if (line.listMarker?.isFirstLineOfListItem && line.listMarker.text) {
    this.renderListMarker(line.listMarker, ctx, position, effectiveIndent);
  }

  // Continue with text rendering...
}

private renderListMarker(
  marker: FlowedLine['listMarker'],
  ctx: CanvasRenderingContext2D,
  linePosition: Point,
  totalIndent: number
): void {
  const markerX = linePosition.x + totalIndent - marker.width;
  const markerY = linePosition.y + line.baseline;
  ctx.fillStyle = '#000000';
  ctx.fillText(marker.text, markerX, markerY);
}
```

**File: `src/lib/rendering/PDFGenerator.ts`**

Apply same indent logic and marker rendering for PDF output.

### Phase 5: Keyboard Handling

**File: `src/lib/text/FlowingTextContent.ts`**

Modify Tab key handling:
```typescript
case 'Tab':
  e.preventDefault();
  const currentFormatting = this.paragraphFormatting.getFormattingForParagraph(paragraphStart);

  if (currentFormatting.listFormatting) {
    if (e.shiftKey) {
      this.outdentCurrentParagraph();
    } else {
      this.indentCurrentParagraph();
    }
  } else {
    this.deleteSelection();
    this.insertText('\t');
  }
  return true;
```

Add new methods:
```typescript
indentCurrentParagraph(): void
outdentCurrentParagraph(): void
toggleList(listType: ListType): void
setListStyle(style: BulletStyle | NumberStyle): void
```

### Phase 6: PCEditor API

**File: `src/lib/core/PCEditor.ts`**

Add public methods:
```typescript
toggleBulletList(): void
toggleNumberedList(): void
indentListItem(): void
outdentListItem(): void
getListFormatting(): ListFormatting | undefined
```

### Phase 7: Demo Integration

**Files: `src/demo/index.html`, `src/demo/demo.ts`**

Add toolbar buttons:
- Bullet list toggle
- Numbered list toggle
- Increase indent
- Decrease indent

## Special Considerations

### Numbered List Counter Management
- Reset at start of new list
- Continue across consecutive list items at same nesting level
- Track separately for each nesting level

### Enter Key Behavior in Lists
- Create new paragraph inheriting list formatting
- If current paragraph is empty, remove list formatting

### Backspace at Start of List Item
- If indented, decrease nesting level (outdent)
- If at top level, convert to normal paragraph

### Text Wrapping with Indentation
- Wrapped lines don't show marker
- Indented to align with text (hanging indent)

### Multi-level Default Bullet Styles
- Level 0: disc (filled circle)
- Level 1: circle (hollow circle)
- Level 2: square (filled square)
- Level 3+: cycles back to disc

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/text/types.ts` | Add list types, extend ParagraphFormatting, FlowedLine |
| `src/lib/types/index.ts` | Update serialization types |
| `src/lib/text/ParagraphFormatting.ts` | Add list management methods |
| `src/lib/text/TextLayout.ts` | Handle indentation and marker generation |
| `src/lib/rendering/FlowingTextRenderer.ts` | Render markers and indentation |
| `src/lib/rendering/PDFGenerator.ts` | PDF export for lists |
| `src/lib/text/FlowingTextContent.ts` | Tab key handling, list methods |
| `src/lib/core/PCEditor.ts` | Public API methods |
| `src/demo/index.html` | Toolbar buttons |
| `src/demo/demo.ts` | Event handlers |

## Testing Checklist

- [ ] Create bullet list
- [ ] Create numbered list
- [ ] Indent list item (Tab)
- [ ] Outdent list item (Shift+Tab)
- [ ] Different bullet styles display correctly
- [ ] Different number styles display correctly (1., a., i., etc.)
- [ ] Multi-level nesting works
- [ ] Text wrapping within list items (hanging indent)
- [ ] Enter creates new list item
- [ ] Enter on empty item exits list
- [ ] Backspace at start outdents/exits list
- [ ] Serialization preserves list formatting
- [ ] PDF export renders lists correctly
