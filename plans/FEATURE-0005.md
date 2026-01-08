# FEATURE-0005: Page Number Field

**Status: COMPLETE** ✓

## Overview

Add a "page number" field that acts like a substitution field but is replaced by the current page number when the document is rendered to PDF.

**Key difference from regular substitution fields:**
- **Substitution fields**: Replaced by data values during `applyMergeData()` call
- **Page number fields**: Replaced by the actual page number during PDF rendering (and canvas rendering for preview)

This feature is particularly useful in headers and footers for "Page X" or "Page X of Y" notation.

## Proposed Design

### Approach: Extend Substitution Field System

Rather than creating a separate system, extend the existing substitution field architecture:

1. Add a `fieldType` property to distinguish regular fields from page number fields
2. Page number fields display as `{{page}}` in the editor
3. During canvas rendering, page number fields show their calculated page number
4. During PDF generation, they render as the actual page number

### New Types

```typescript
// In src/lib/text/types.ts

export type SubstitutionFieldType = 'data' | 'pageNumber' | 'pageCount';

export interface SubstitutionField {
  id: string;
  textIndex: number;
  fieldName: string;
  fieldType?: SubstitutionFieldType;  // NEW: undefined/'data' = regular field
  displayFormat?: string;              // For pageNumber: e.g., "Page %d"
  defaultValue?: string;
  formatting?: TextFormattingStyle;
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/text/types.ts` | Add `SubstitutionFieldType`, extend `SubstitutionField` interface |
| `src/lib/text/SubstitutionFieldManager.ts` | Update `insert()` for field type, add helper methods |
| `src/lib/text/FlowingTextContent.ts` | Add `insertPageNumberField()` method |
| `src/lib/text/TextMeasurer.ts` | Update `getFieldDisplayText()` for page numbers |
| `src/lib/rendering/FlowingTextRenderer.ts` | Update field rendering with page number support |
| `src/lib/core/PCEditor.ts` | Add `insertPageNumberField()` API, update merge to skip page fields |
| `src/lib/index.ts` | Export new type (if needed) |
| `src/demo/index.html` | Add Page # button |
| `src/demo/demo.ts` | Add event handler for page number insertion |

## Implementation Steps

### Phase 1: Data Model Changes

**Files:** `types.ts`, `SubstitutionFieldManager.ts`

1. Add `SubstitutionFieldType` to types.ts
2. Add optional `fieldType` property to `SubstitutionField` interface
3. Update `SubstitutionFieldManager.insert()` to accept field type
4. Add helper methods: `getPageNumberFields()`, `isPageNumberField()`

### Phase 2: FlowingTextContent API

**File:** `FlowingTextContent.ts`

Add method:
```typescript
insertPageNumberField(format?: string): SubstitutionField {
  // Similar to insertSubstitutionField but with fieldType: 'pageNumber'
}
```

### Phase 3: Rendering Updates

**Files:** `TextMeasurer.ts`, `FlowingTextRenderer.ts`

1. Update `getFieldDisplayText()` to handle page number fields:
   - If page number known: return formatted page number
   - If unknown (e.g., text box): return `{{page}}`

2. Update field rendering:
   - Pass current page index to field rendering
   - Use different background color for page number fields (e.g., light blue)

### Phase 4: PCEditor Public API

**File:** `PCEditor.ts`

Add:
```typescript
insertPageNumberField(format?: string): void
```

Update `substituteFieldsInContent()` to skip page number fields during merge.

### Phase 5: Demo UI

**Files:** `index.html`, `demo.ts`

1. Add "Page #" button next to the Field button
2. Add click handler to insert page number field

## Key Implementation Details

### TextMeasurer.getFieldDisplayText()

```typescript
getFieldDisplayText(field: SubstitutionField, pageNumber?: number): string {
  if (field.fieldType === 'pageNumber') {
    if (pageNumber !== undefined) {
      return field.displayFormat
        ? field.displayFormat.replace('%d', String(pageNumber + 1))
        : String(pageNumber + 1);
    }
    return '{{page}}';
  }
  return `{{field: ${field.fieldName}}}`;
}
```

### Skip Page Fields During Merge

```typescript
private substituteFieldsInContent(flowingContent: FlowingTextContent, data: Record<string, unknown>): number {
  const fieldManager = flowingContent.getSubstitutionFieldManager();

  // Get only data fields (skip page number fields)
  const fields = fieldManager.getFieldsArray()
    .filter(f => !f.fieldType || f.fieldType === 'data')
    .sort((a, b) => b.textIndex - a.textIndex);

  // ... rest of implementation
}
```

## Considerations

1. **Text boxes and table cells**: Content in these doesn't inherently know which page it's on. Page number fields could show `{{page}}` in editor and be resolved during PDF generation.

2. **Page count field**: Consider adding `pageCount` for "Page X of Y" format. This requires knowing total pages before rendering.

3. **PDF Generation dependency**: Full functionality depends on FEATURE-0008 (PDF Generation). Canvas rendering can work independently.

## Estimated Complexity

- **New code**: ~150-250 lines
- **Modified files**: 8-10
- **Risk level**: Low-Medium (extends existing system)
- **Dependencies**: None for basic functionality; FEATURE-0008 for PDF output
