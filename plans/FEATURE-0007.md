# FEATURE-0007: Different Positioning of Objects - Implementation Plan

## Status: ✅ COMPLETE

## Overview

Add two new positioning modes for embedded objects in addition to the existing `inline` mode:

1. **Block (Top and Bottom)**: The object appears as a standalone paragraph with implicit newlines before and after
2. **Relative Positioning**: The object can be freely positioned but maintains an anchor point in the text flow. The anchor is shown as a control character when control characters are visible.

## Current Architecture

### ObjectPosition Type (`src/lib/objects/types.ts`)
Currently defined as:
```typescript
export type ObjectPosition = 'inline' | 'float-left' | 'float-right';
```
Note: `float-left` and `float-right` exist but are only partially implemented.

### BaseEmbeddedObject (`src/lib/objects/BaseEmbeddedObject.ts`)
- Stores `_position: ObjectPosition`
- Has `textIndex` for anchor location in text
- Stores `renderedPosition` for hit detection
- No offset storage for relative positioning

### TextLayout (`src/lib/text/TextLayout.ts`)
- Processes embedded objects character-by-character in `measureSegment()`
- Currently only adjusts line height for `inline` objects
- Objects are treated as word boundaries for text wrapping

## Implementation Phases

### Phase 1: Extend Type System

**File: `src/lib/objects/types.ts`**

```typescript
export type ObjectPosition =
  | 'inline'           // Within text flow, affects line height
  | 'block'            // Top and bottom (standalone paragraph)
  | 'relative'         // Free position relative to anchor
  | 'float-left'       // (existing, may deprecate)
  | 'float-right';     // (existing, may deprecate)

export interface RelativeOffset {
  x: number;  // Horizontal offset from anchor line start
  y: number;  // Vertical offset from anchor line top
}

export interface EmbeddedObjectConfig {
  id: string;
  textIndex: number;
  position?: ObjectPosition;
  size: Size;
  relativeOffset?: RelativeOffset;  // New: offset for 'relative' position
}

export interface EmbeddedObjectData {
  id: string;
  objectType: string;
  textIndex: number;
  position: ObjectPosition;
  size: Size;
  data: Record<string, unknown>;
  relativeOffset?: RelativeOffset;  // New: for relative positioning
}
```

### Phase 2: Update BaseEmbeddedObject

**File: `src/lib/objects/BaseEmbeddedObject.ts`**

Add relative offset storage:
```typescript
protected _relativeOffset: RelativeOffset = { x: 0, y: 0 };

get relativeOffset(): RelativeOffset {
  return { ...this._relativeOffset };
}

set relativeOffset(value: RelativeOffset) {
  this._relativeOffset = { ...value };
  this.emit('offset-changed', { offset: { ...value } });
}
```

Update constructor to accept `relativeOffset` from config.

### Phase 3: Update TextLayout for Block Positioning

**File: `src/lib/text/TextLayout.ts`**

Modify `measureSegment()` for block objects:
```typescript
if (object) {
  if (object.position === 'block') {
    // Block objects don't contribute to current line width/height
    // They will be handled specially during pagination
    objects.push({
      object,
      textIndex: charIndex,
      x: 0,
      isBlock: true  // New flag
    });
  } else if (object.position === 'relative') {
    // Relative objects show anchor but don't affect layout
    objects.push({
      object,
      textIndex: charIndex,
      x: width,  // Anchor position
      isAnchor: true  // New flag
    });
  } else {
    // inline: existing behavior
    width += objWidth;
    height = Math.max(height, object.height);
  }
}
```

**File: `src/lib/text/types.ts`**

Extend `FlowedEmbeddedObject`:
```typescript
export interface FlowedEmbeddedObject {
  object: BaseEmbeddedObject;
  textIndex: number;
  x: number;
  isBlock?: boolean;      // Block object flag
  isAnchor?: boolean;     // Anchor-only flag for relative
  anchorLineY?: number;   // Y position of anchor line
}
```

Block objects need to:
1. Force a line break before the object
2. Create a dedicated line for the object
3. Force a line break after the object

### Phase 4: Update Rendering

**File: `src/lib/rendering/FlowingTextRenderer.ts`**

Add anchor symbol constant:
```typescript
const ANCHOR_SYMBOL = '⚓';  // Unicode U+2693
```

Update `renderEmbeddedObject()`:
```typescript
case 'block':
  // Center the object horizontally (or align based on paragraph alignment)
  elementX = lineStartX + (maxWidth - object.width) / 2;
  break;

case 'relative':
  // Position relative to anchor line start
  const offset = object.relativeOffset;
  elementX = lineStartX + offset.x;
  elementY = position.y + offset.y;
  break;
```

Add anchor character rendering when `showControlCharacters` is true:
```typescript
if (embeddedObj && embeddedObj.isAnchor && this.showControlCharacters) {
  ctx.fillStyle = CONTROL_CHAR_COLOR;
  ctx.font = this.getFontString(run.formatting);
  ctx.fillText(ANCHOR_SYMBOL, x, position.y + line.baseline);
}
```

### Phase 5: Update Serialization

**Files: `src/lib/objects/ImageObject.ts`, `TextBoxObject.ts`, `TableObject.ts`**

Add `relativeOffset` to `toData()`:
```typescript
toData(): EmbeddedObjectData {
  return {
    // ... existing properties
    relativeOffset: this._position === 'relative'
      ? { ...this._relativeOffset }
      : undefined,
  };
}
```

**File: `src/lib/objects/EmbeddedObjectFactory.ts`**

Handle `relativeOffset` in object creation from data.

### Phase 6: Update PDF Generation

**File: `src/lib/rendering/PDFGenerator.ts`**

Mirror the changes from FlowingTextRenderer:
- Block objects: render centered/aligned as standalone elements
- Relative objects: render at calculated offset from anchor line
- Skip anchor markers in PDF output

### Phase 7: UI Integration

**File: `src/demo/demo.ts`**

Add UI controls to select object position mode:
- Radio buttons or dropdown for position type
- For 'relative' mode: show offset input fields or enable dragging

Enable dragging for relative-positioned objects:
- When dragging, update `relativeOffset` instead of absolute position
- Calculate offset relative to the anchor line position

### Phase 8: Hit Testing Updates

**File: `src/lib/hit-test/HitTestManager.ts`**

- Relative objects need hit areas registered at actual rendered position (anchor + offset)
- Add click handler for anchor symbol to select associated object

## Design Decisions

1. **Anchor Character**: Using Unicode anchor (⚓) - visually distinct but compact
2. **Block Object Line Height**: Line containing block object has height = object height + padding
3. **Relative Offset Origin**: Offset is relative to TOP-LEFT of anchor line
4. **Layering**: Relative-positioned objects render AFTER text (appear on top)
5. **Page Boundaries**: If offset places object beyond page boundary, clip or wrap to next page

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/objects/types.ts` | Add `RelativeOffset`, extend `ObjectPosition` |
| `src/lib/objects/BaseEmbeddedObject.ts` | Add relativeOffset storage |
| `src/lib/text/types.ts` | Extend `FlowedEmbeddedObject` |
| `src/lib/text/TextLayout.ts` | Handle block and relative modes in layout |
| `src/lib/rendering/FlowingTextRenderer.ts` | Render new modes and anchor symbols |
| `src/lib/rendering/PDFGenerator.ts` | PDF export for new positioning modes |
| `src/lib/objects/ImageObject.ts` | Serialization updates |
| `src/lib/objects/TextBoxObject.ts` | Serialization updates |
| `src/lib/objects/EmbeddedObjectFactory.ts` | Handle new properties |
| `src/demo/demo.ts` | UI for position mode selection |

## Testing Checklist

- [ ] Block position: object appears as standalone paragraph
- [ ] Block position: text flows above and below
- [ ] Block position: handles page breaks correctly
- [ ] Relative position: object moves when anchor line moves
- [ ] Relative position: offset preserved through reflow
- [ ] Relative position: anchor symbol appears with control characters
- [ ] Relative position: object can overlap other content
- [ ] Serialization preserves position mode and offset
- [ ] PDF export renders correctly
- [ ] No anchor symbols in PDF output
