# FEATURE-0014: Hyperlink Support - Implementation Plan

## Status: COMPLETE

## Overview

Implement hyperlink support allowing users to create clickable links within text that navigate to URLs. The implementation follows existing patterns from substitution fields and text formatting, while introducing new concepts for handling clickable inline content.

## Design Approach

**Hybrid approach combining:**
1. **Extended TextFormattingStyle** for visual properties (underline, color)
2. **New HyperlinkManager** for URL data (similar to SubstitutionFieldManager)

This is preferred because:
- Hyperlinks span multiple characters but share a single URL
- URLs are metadata, not visual formatting
- Click handling needs to identify the complete hyperlink range
- The SubstitutionFieldManager pattern provides a proven model

## Data Model

**File: `src/lib/text/types.ts`**

```typescript
interface Hyperlink {
  id: string;
  url: string;
  startIndex: number;
  endIndex: number;         // Hyperlinks span a range
  title?: string;           // Optional tooltip text
  formatting?: HyperlinkFormatting;
}

interface HyperlinkFormatting {
  color?: string;           // Default: '#0066cc' (blue)
  hoverColor?: string;      // Default: '#0033cc' (darker blue)
  underline?: boolean;      // Default: true
}

// Extended TextFormattingStyle
interface TextFormattingStyle {
  // ... existing properties ...
  textDecoration?: 'none' | 'underline' | 'line-through';  // NEW
  hyperlinkId?: string;     // NEW - references a Hyperlink.id
}
```

## Implementation Phases

### Phase 1: Core Data Model and Manager

#### Step 1.1: Extend TextFormattingStyle

**File: `src/lib/text/types.ts`**

Add `textDecoration` property to support underline (and future strikethrough).

#### Step 1.2: Create HyperlinkManager

**New File: `src/lib/text/HyperlinkManager.ts`**

```typescript
export class HyperlinkManager extends EventEmitter {
  private hyperlinks: Map<string, Hyperlink> = new Map();
  private nextId: number = 1;

  // Core operations
  insert(url: string, startIndex: number, endIndex: number, options?: HyperlinkOptions): Hyperlink;
  remove(id: string): void;
  update(id: string, updates: Partial<Hyperlink>): void;

  // Query methods
  getHyperlinkAt(textIndex: number): Hyperlink | undefined;
  getHyperlinkById(id: string): Hyperlink | undefined;
  getHyperlinksInRange(start: number, end: number): Hyperlink[];
  getAll(): Hyperlink[];

  // Index management
  shiftHyperlinks(fromIndex: number, delta: number): void;
  handleDeletion(start: number, length: number): void;

  // Serialization
  toJSON(): Hyperlink[];
  fromJSON(data: Hyperlink[]): void;
}
```

#### Step 1.3: Integrate into FlowingTextContent

**File: `src/lib/text/FlowingTextContent.ts`**

- Add `private hyperlinks: HyperlinkManager`
- Wire up event forwarding
- Update deletion/insertion to manage hyperlink indices
- Add public methods:
  - `insertHyperlink(url: string, start?: number, end?: number): Hyperlink`
  - `removeHyperlink(id: string): void`
  - `updateHyperlink(id: string, updates: Partial<Hyperlink>): void`
  - `getHyperlinkAt(textIndex: number): Hyperlink | undefined`

### Phase 2: Rendering

#### Step 2.1: Add Underline Rendering

**File: `src/lib/rendering/FlowingTextRenderer.ts`**

```typescript
// After drawing each character
if (run.formatting.textDecoration === 'underline') {
  const underlineY = position.y + line.baseline + 2;
  ctx.strokeStyle = run.formatting.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - charWidth, underlineY);
  ctx.lineTo(x, underlineY);
  ctx.stroke();
}
```

#### Step 2.2: Apply Hyperlink Styling During Layout

**File: `src/lib/text/TextLayout.ts`**

In `measureSegment`, check if character is within a hyperlink:
```typescript
const hyperlink = hyperlinks.getHyperlinkAt(charIndex);
if (hyperlink) {
  charFormatting = {
    ...charFormatting,
    color: hyperlink.formatting?.color || '#0066cc',
    textDecoration: hyperlink.formatting?.underline !== false ? 'underline' : undefined
  };
}
```

### Phase 3: Click Handling

#### Step 3.1: Register Hyperlink Hit Targets

**File: `src/lib/hit-test/types.ts`**

Add `'hyperlink'` to `HitTargetType` with priority 55.

#### Step 3.2: Register During Rendering

**File: `src/lib/rendering/FlowingTextRenderer.ts`**

Register hyperlink bounds with HitTestManager during line rendering.

#### Step 3.3: Handle Clicks

**File: `src/lib/rendering/CanvasManager.ts`**

```typescript
const hitTarget = this.flowingTextRenderer.hitTestManager.queryAtPoint(pageIndex, point);
if (hitTarget?.data.type === 'hyperlink') {
  const url = (hitTarget.data as HyperlinkData).url;
  if (this.isValidUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return;
}
```

#### Step 3.4: Hover State

- Change cursor to `pointer` on hyperlink hover
- Optionally change color to `hoverColor`
- Re-render to show visual feedback

### Phase 4: User Interaction

#### Step 4.1: Keyboard Shortcut (Ctrl+K)

**File: `src/lib/text/FlowingTextContent.ts`**

```typescript
if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
  e.preventDefault();
  this.emit('open-hyperlink-dialog');
  return true;
}
```

#### Step 4.2: PCEditor API

**File: `src/lib/core/PCEditor.ts`**

```typescript
insertHyperlink(url: string, title?: string): void;
removeHyperlink(): void;
getHyperlinkAtCursor(): Hyperlink | undefined;
// Event: 'open-hyperlink-dialog'
```

### Phase 5: Serialization

#### Step 5.1: Extend FlowingTextContentData

**File: `src/lib/types/index.ts`**

```typescript
export interface FlowingTextContentData {
  // ... existing properties ...
  hyperlinks?: HyperlinkData[];
}

export interface HyperlinkData {
  id: string;
  url: string;
  startIndex: number;
  endIndex: number;
  title?: string;
  formatting?: {
    color?: string;
    hoverColor?: string;
    underline?: boolean;
  };
}
```

#### Step 5.2: Update Serialization Methods

**File: `src/lib/text/FlowingTextContent.ts`**

Update `toData()`, `fromData()`, and `loadFromData()` to handle hyperlinks.

### Phase 6: PDF Export

**File: `src/lib/rendering/PDFGenerator.ts`**

Add PDF link annotations using pdf-lib:
```typescript
private renderHyperlinkAnnotation(
  pdfPage: PDFPage,
  hyperlink: Hyperlink,
  bounds: Rect,
  pageHeight: number
): void {
  // Use pdf-lib annotation API to create clickable links
}
```

### Phase 7: Demo Integration

**Files: `src/demo/index.html`, `src/demo/demo.ts`**

- Toolbar button for "Insert Link"
- Dialog/modal for entering URL
- Handle 'open-hyperlink-dialog' event
- Show link properties when cursor is in hyperlink

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/text/types.ts` | Add Hyperlink interface, textDecoration to TextFormattingStyle |
| `src/lib/text/HyperlinkManager.ts` | NEW: Hyperlink management |
| `src/lib/text/FlowingTextContent.ts` | Integrate HyperlinkManager, add API |
| `src/lib/text/TextLayout.ts` | Apply hyperlink styling during layout |
| `src/lib/rendering/FlowingTextRenderer.ts` | Underline rendering, hit target registration |
| `src/lib/rendering/CanvasManager.ts` | Click handling, hover state |
| `src/lib/hit-test/types.ts` | Add hyperlink hit target type |
| `src/lib/types/index.ts` | Serialization types |
| `src/lib/core/PCEditor.ts` | Public API, Ctrl+K handling |
| `src/lib/rendering/PDFGenerator.ts` | PDF link annotations |
| `src/demo/index.html` | Link button, dialog |
| `src/demo/demo.ts` | Event handlers |

## Potential Challenges

1. **Multi-line Hyperlinks**: Need per-line hit target segments
2. **Hyperlinks Crossing Pages**: PDF annotation coordination across pages
3. **Hyperlink + Formatting**: Bold/italic within hyperlinks should work
4. **URL Validation**: Support `http://`, `https://`, `mailto:`
5. **Editing Within Hyperlinks**: Range should expand/shrink appropriately

## Testing Checklist

- [ ] Create hyperlink via selection
- [ ] Create hyperlink via Ctrl+K
- [ ] Click opens link in new tab
- [ ] Cursor changes to pointer on hover
- [ ] Visual feedback (underline, color)
- [ ] Multi-line hyperlinks work
- [ ] Edit text within hyperlink
- [ ] Remove hyperlink
- [ ] Serialization preserves hyperlinks
- [ ] PDF export creates clickable links
