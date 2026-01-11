# FEATURE-0019: Copy/Paste Implementation Plan

## Status: COMPLETE

## Overview

Implement comprehensive Copy/Paste functionality for the PC Editor supporting:
1. **Proprietary format** - Full fidelity internal format preserving all editor capabilities
2. **Plain text** - Standard text without formatting
3. **Rich text (HTML)** - Formatted text for interoperability
4. **Image paste** - PNG/JPEG image data from clipboard

## Current Architecture Analysis

### Selection and Content Access

**Selection State:**
- `TextState` maintains selection anchor and cursor positions
- `FlowingTextContent.getSelection()` returns `{ start: number; end: number } | null`
- `FlowingTextContent.getSelectedText()` returns plain text content

**Content Sources:**
- Body text: `document.bodyFlowingContent`
- Header/Footer: `document.headerFlowingContent`, `document.footerFlowingContent`
- Text boxes: `TextBoxObject.flowingContent`
- Table cells: `TableCell.flowingContent`

**Embedded Objects in Selection:**
- Objects use OBJECT_REPLACEMENT_CHAR (U+FFFC) at their text indices
- Selection may span multiple objects of different types
- Objects are tracked by `EmbeddedObjectManager.getObjectsInRange(start, end)`

### Existing Serialization

| Component | Serialization Method | Data Type |
|-----------|---------------------|-----------|
| FlowingTextContent | `toData()` / `fromData()` | `FlowingTextContentData` |
| TextFormattingManager | `getAllFormatting()` / `setAllFormatting()` | `Map<number, TextFormattingStyle>` |
| SubstitutionFieldManager | `toJSON()` / `fromJSON()` | Array |
| BaseEmbeddedObject | `toData()` | `EmbeddedObjectData` |
| ImageObject | `toData()` / `clone()` | Includes base64 image data |
| TextBoxObject | `toData()` / `clone()` | Includes nested FlowingTextContent |
| TableObject | `toData()` / `fromData()` | Full table structure with cells |

## Design Decisions

### Clipboard Data Format Strategy

| Format | MIME Type | Use Case |
|--------|-----------|----------|
| Proprietary JSON | `application/x-pceditor-content` | Internal copy/paste with full fidelity |
| Plain Text | `text/plain` | Fallback, external apps |
| HTML | `text/html` | Rich text interop (Word, browsers) |
| Image | `image/png`, `image/jpeg` | Image paste from external sources |

### Proprietary Format Structure

```typescript
interface ClipboardData {
  version: string;
  type: 'text' | 'objects' | 'mixed';
  content: {
    text: string;
    formattingRuns?: TextFormattingRunData[];
    paragraphFormatting?: ParagraphFormattingData[];
    substitutionFields?: SubstitutionFieldData[];
    embeddedObjects?: EmbeddedObjectReference[];
    // Note: Repeating sections are NOT copied (they reference external data)
  };
  metadata?: {
    sourceSection?: 'header' | 'body' | 'footer';
    copiedAt?: string;
  };
}
```

## Type Definitions

**File: `src/lib/clipboard/types.ts`**

```typescript
export const CLIPBOARD_FORMAT_VERSION = '1.0.0';
export const PCEDITOR_MIME_TYPE = 'application/x-pceditor-content';

export type ClipboardContentType = 'text' | 'object' | 'mixed';

export interface PCEditorClipboardData {
  version: string;
  type: ClipboardContentType;
  content: ClipboardContent;
  metadata?: ClipboardMetadata;
}

export interface ClipboardContent {
  text: string;
  formattingRuns?: import('../types').TextFormattingRunData[];
  paragraphFormatting?: import('../types').ParagraphFormattingData[];
  substitutionFields?: import('../types').SubstitutionFieldData[];
  embeddedObjects?: import('../types').EmbeddedObjectReference[];
}

export interface ClipboardMetadata {
  sourceSection?: 'header' | 'body' | 'footer';
  sourceObjectId?: string;
  copiedAt?: string;
}

export interface ClipboardReadResult {
  type: 'pceditor' | 'html' | 'text' | 'image' | 'empty';
  data: PCEditorClipboardData | string | Blob | null;
}
```

## Implementation Phases

### Phase 1: Core Infrastructure

1. Create `src/lib/clipboard/types.ts` with type definitions
2. Create `src/lib/clipboard/ClipboardManager.ts` with skeleton
3. Wire into `PCEditor.ts` with keyboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V)

### Phase 2: Copy Operation

1. Extract selected content (text, formatting, fields, objects)
2. Serialize to proprietary JSON format
3. Generate plain text fallback (replace objects with placeholders)
4. Write all formats to Clipboard API

### Phase 3: HTML Conversion

**File: `src/lib/clipboard/HtmlConverter.ts`**

1. Export: Convert formatting runs to styled HTML spans
2. Import: Parse HTML DOM, extract text and formatting

### Phase 4: Paste Operation

1. Read clipboard with format priority (proprietary > HTML > text > image)
2. Paste proprietary: restore all content with new object IDs
3. Paste HTML: convert to formatted text
4. Paste plain text: insert at cursor (inherit formatting)
5. Paste image: create ImageObject from blob data

### Phase 5: Cut Operation

Cut = Copy + Delete selection (wrapped in undo transaction)

### Phase 6: Special Cases

- Table cell copy/paste
- Object-only selection
- Multi-section content restrictions

### Phase 7: Demo Integration

Add Copy/Cut/Paste buttons to toolbar

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `src/lib/clipboard/types.ts` | CREATE | Clipboard type definitions |
| `src/lib/clipboard/ClipboardManager.ts` | CREATE | Main clipboard manager |
| `src/lib/clipboard/HtmlConverter.ts` | CREATE | HTML import/export |
| `src/lib/clipboard/index.ts` | CREATE | Module exports |
| `src/lib/core/PCEditor.ts` | MODIFY | Add keyboard shortcuts, public API |
| `src/lib/text/FlowingTextContent.ts` | MODIFY | Add `insertTextAt` helper if needed |
| `src/demo/index.html` | MODIFY | Add toolbar buttons |
| `src/demo/demo.ts` | MODIFY | Add button handlers |

## Browser Compatibility Notes

- Clipboard API requires HTTPS or localhost
- Custom MIME types may need fallback (JSON in text/plain with marker)
- Safari has limited Clipboard API support

## Security Considerations

1. Sanitize external HTML to prevent XSS
2. Validate image URLs
3. Limit paste content size
4. Consider compression for large base64 images

## Testing Checklist

- [ ] Copy plain text
- [ ] Copy formatted text (bold, italic, colors)
- [ ] Copy text with substitution fields
- [ ] Copy text with embedded image
- [ ] Copy text with embedded text box
- [ ] Copy text with embedded table
- [ ] Cut operation (copy + delete)
- [ ] Paste proprietary format
- [ ] Paste HTML from external app
- [ ] Paste plain text from external app
- [ ] Paste image from clipboard
- [ ] Undo/redo for paste operations
- [ ] Cross-browser testing
- [ ] Keyboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V)
