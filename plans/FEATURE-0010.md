# FEATURE-0010: Serialization/Deserialization Implementation Plan

## Status: ✅ COMPLETE

## Overview

This document provides a comprehensive implementation plan for adding full document serialization and deserialization capabilities to PC Editor. The feature enables saving documents to JSON format and loading them back with complete fidelity, preserving all content, formatting, embedded objects, substitution fields, repeating sections, and settings.

## Current State Analysis

### Existing Serialization Support

| Component | Has toData/toJSON | Has fromData/fromJSON | Notes |
|-----------|------------------|----------------------|-------|
| Document | Partial | Via constructor | Missing body FlowingTextContent |
| Page | Minimal | No | Only serializes ID |
| FlowingTextContent | No | No | Core component lacking serialization |
| TextFormattingManager | Partial | Partial | getAllFormatting/setAllFormatting, no JSON |
| ParagraphFormattingManager | Yes | Yes | Complete |
| SubstitutionFieldManager | Yes | Yes | Complete |
| RepeatingSectionManager | Yes | Yes | Complete |
| EmbeddedObjectManager | No | No | Missing entirely |
| ImageObject | Yes | Via factory | Complete |
| TextBoxObject | Yes | Via factory | Complete |
| TableObject | Yes | Yes | Complete including row loops |

### What's Missing

1. `FlowingTextContent.toData()` / `FlowingTextContent.fromData()`
2. `EmbeddedObjectManager` serialization
3. Complete `Page.toData()` including flowingContent
4. Complete `Document.toData()` including full header/footer content with formatting
5. `PCEditor.saveDocument()` / proper load that restores all content
6. Demo save/load UI

## Phase 1: Type Definitions

### File: `/Users/james/code/pc/pc-editor/src/lib/types/index.ts`

Add comprehensive type definitions for serialized data:

```typescript
/**
 * Serialized text formatting run.
 * Represents formatting applied at a specific character index.
 */
export interface TextFormattingRunData {
  index: number;
  formatting: {
    fontFamily: string;
    fontSize: number;
    fontWeight?: string;
    fontStyle?: string;
    color: string;
    backgroundColor?: string;
  };
}

/**
 * Serialized paragraph formatting.
 */
export interface ParagraphFormattingData {
  paragraphStart: number;
  formatting: {
    alignment: 'left' | 'center' | 'right' | 'justify';
  };
}

/**
 * Serialized substitution field.
 */
export interface SubstitutionFieldData {
  id: string;
  textIndex: number;
  fieldName: string;
  fieldType?: 'data' | 'pageNumber' | 'pageCount';
  displayFormat?: string;
  defaultValue?: string;
  formatting?: TextFormattingRunData['formatting'];
}

/**
 * Serialized repeating section.
 */
export interface RepeatingSectionData {
  id: string;
  fieldPath: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Serialized embedded object reference in FlowingTextContent.
 * Uses EmbeddedObjectData from objects module.
 */
export interface EmbeddedObjectReference {
  textIndex: number;
  object: import('../objects').EmbeddedObjectData;
}

/**
 * Complete serialized FlowingTextContent.
 */
export interface FlowingTextContentData {
  text: string;
  formattingRuns?: TextFormattingRunData[];
  paragraphFormatting?: ParagraphFormattingData[];
  substitutionFields?: SubstitutionFieldData[];
  repeatingSections?: RepeatingSectionData[];
  embeddedObjects?: EmbeddedObjectReference[];
}

/**
 * Updated PageData with body content.
 */
export interface PageData {
  id: string;
  bodyContent?: FlowingTextContentData;
}

/**
 * Updated DocumentData with complete structure.
 */
export interface DocumentData {
  version: string;
  settings?: DocumentSettings;
  pages: PageData[];
  headerContent?: FlowingTextContentData;
  footerContent?: FlowingTextContentData;
  metadata?: {
    createdAt?: string;
    modifiedAt?: string;
    title?: string;
    author?: string;
  };
}
```

## Phase 2: FlowingTextContent Serialization

### File: `/Users/james/code/pc/pc-editor/src/lib/text/FlowingTextContent.ts`

Add `toData()` and `fromData()` methods:

```typescript
/**
 * Serialize the complete FlowingTextContent state to JSON-compatible data.
 */
toData(): FlowingTextContentData {
  // Serialize text content
  const text = this.textState.getText();

  // Serialize text formatting runs
  const formattingMap = this.formatting.getAllFormatting();
  const formattingRuns: TextFormattingRunData[] = [];
  formattingMap.forEach((style, index) => {
    formattingRuns.push({
      index,
      formatting: { ...style }
    });
  });

  // Serialize paragraph formatting
  const paragraphFormatting = this.paragraphFormatting.toJSON();

  // Serialize substitution fields
  const substitutionFields = this.substitutionFields.toJSON().map(field => ({
    id: field.id,
    textIndex: field.textIndex,
    fieldName: field.fieldName,
    fieldType: field.fieldType,
    displayFormat: field.displayFormat,
    defaultValue: field.defaultValue,
    formatting: field.formatting ? { ...field.formatting } : undefined
  }));

  // Serialize repeating sections
  const repeatingSections = this.repeatingSections.toJSON();

  // Serialize embedded objects
  const embeddedObjects: EmbeddedObjectReference[] = [];
  const objectsMap = this.embeddedObjects.getObjects();
  objectsMap.forEach((object, textIndex) => {
    embeddedObjects.push({
      textIndex,
      object: object.toData()
    });
  });

  return {
    text,
    formattingRuns: formattingRuns.length > 0 ? formattingRuns : undefined,
    paragraphFormatting: paragraphFormatting.length > 0 ? paragraphFormatting : undefined,
    substitutionFields: substitutionFields.length > 0 ? substitutionFields : undefined,
    repeatingSections: repeatingSections.length > 0 ? repeatingSections : undefined,
    embeddedObjects: embeddedObjects.length > 0 ? embeddedObjects : undefined
  };
}

/**
 * Restore FlowingTextContent state from serialized data.
 * Static factory method for creating from data.
 */
static fromData(data: FlowingTextContentData): FlowingTextContent {
  const content = new FlowingTextContent(data.text);

  // Restore text formatting
  if (data.formattingRuns && data.formattingRuns.length > 0) {
    const formattingMap = new Map<number, TextFormattingStyle>();
    for (const run of data.formattingRuns) {
      formattingMap.set(run.index, run.formatting as TextFormattingStyle);
    }
    content.getFormattingManager().setAllFormatting(formattingMap);
  }

  // Restore paragraph formatting
  if (data.paragraphFormatting && data.paragraphFormatting.length > 0) {
    content.getParagraphFormattingManager().fromJSON(data.paragraphFormatting);
  }

  // Restore substitution fields
  if (data.substitutionFields && data.substitutionFields.length > 0) {
    content.getSubstitutionFieldManager().fromJSON(data.substitutionFields);
  }

  // Restore repeating sections
  if (data.repeatingSections && data.repeatingSections.length > 0) {
    content.getRepeatingSectionManager().fromJSON(data.repeatingSections);
  }

  // Restore embedded objects using factory
  if (data.embeddedObjects && data.embeddedObjects.length > 0) {
    for (const ref of data.embeddedObjects) {
      const object = EmbeddedObjectFactory.create(ref.object);
      content.getEmbeddedObjectManager().insert(object, ref.textIndex);
    }
  }

  return content;
}

/**
 * Load state from serialized data into this instance.
 * Instance method for updating existing FlowingTextContent.
 */
loadFromData(data: FlowingTextContentData): void {
  // Clear existing state
  this.clear();

  // Set text content
  this.textState.setText(data.text);

  // Restore text formatting
  if (data.formattingRuns && data.formattingRuns.length > 0) {
    const formattingMap = new Map<number, TextFormattingStyle>();
    for (const run of data.formattingRuns) {
      formattingMap.set(run.index, run.formatting as TextFormattingStyle);
    }
    this.formatting.setAllFormatting(formattingMap);
  }

  // Restore paragraph formatting
  if (data.paragraphFormatting && data.paragraphFormatting.length > 0) {
    this.paragraphFormatting.fromJSON(data.paragraphFormatting);
  }

  // Restore substitution fields
  if (data.substitutionFields && data.substitutionFields.length > 0) {
    this.substitutionFields.fromJSON(data.substitutionFields);
  }

  // Restore repeating sections
  if (data.repeatingSections && data.repeatingSections.length > 0) {
    this.repeatingSections.fromJSON(data.repeatingSections);
  }

  // Restore embedded objects
  if (data.embeddedObjects && data.embeddedObjects.length > 0) {
    for (const ref of data.embeddedObjects) {
      const object = EmbeddedObjectFactory.create(ref.object);
      this.embeddedObjects.insert(object, ref.textIndex);
    }
  }
}
```

## Phase 3: Page and Document Serialization

### File: `/Users/james/code/pc/pc-editor/src/lib/core/Page.ts`

Update `toData()` to include body content:

```typescript
toData(): PageData {
  return {
    id: this._id,
    bodyContent: this._flowingContent.toData()
  };
}

/**
 * Load page content from serialized data.
 */
loadFromData(data: PageData): void {
  if (data.bodyContent) {
    this._flowingContent.loadFromData(data.bodyContent);
  }
}
```

### File: `/Users/james/code/pc/pc-editor/src/lib/core/Document.ts`

Update `toData()` for complete serialization:

```typescript
toData(): DocumentData {
  return {
    version: this._version,
    settings: { ...this._settings },
    pages: this._pages.map(page => page.toData()),
    headerContent: this._headerFlowingContent.toData(),
    footerContent: this._footerFlowingContent.toData(),
    metadata: {
      modifiedAt: new Date().toISOString()
    }
  };
}
```

Update constructor to handle complete deserialization:

```typescript
constructor(data?: DocumentData) {
  super();

  this._headerFlowingContent = new FlowingTextContent();
  this._footerFlowingContent = new FlowingTextContent();
  this.setupHeaderFooterListeners();

  if (data) {
    this._version = data.version || this._version;
    this._settings = data.settings || this.getDefaultSettings();

    // Load pages with their content
    data.pages.forEach(pageData => {
      const page = new Page(pageData, this._settings);
      if (pageData.bodyContent) {
        page.loadFromData(pageData);
      }
      this.addPage(page);
    });

    // Load header content
    if (data.headerContent) {
      this._headerFlowingContent.loadFromData(data.headerContent);
    }

    // Load footer content
    if (data.footerContent) {
      this._footerFlowingContent.loadFromData(data.footerContent);
    }
  } else {
    this._settings = this.getDefaultSettings();
    this.addPage(new Page(this.createEmptyPageData(), this._settings));
  }
}
```

## Phase 4: PCEditor API

### File: `/Users/james/code/pc/pc-editor/src/lib/core/PCEditor.ts`

Add save/load methods with JSON serialization:

```typescript
/**
 * Save the current document state to a JSON string.
 * @returns JSON string representation of the document
 */
saveDocument(): string {
  if (!this._isReady) {
    throw new Error('Editor is not ready');
  }

  const documentData = this.document.toData();
  return JSON.stringify(documentData, null, 2);
}

/**
 * Save the current document state to a downloadable file.
 * @param filename Optional filename (defaults to 'document.pceditor.json')
 */
saveDocumentToFile(filename: string = 'document.pceditor.json'): void {
  const jsonString = this.saveDocument();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  this.emit('document-saved', { filename });
}

/**
 * Load a document from a JSON string.
 * @param jsonString JSON string representation of the document
 */
loadDocumentFromJSON(jsonString: string): void {
  if (!this._isReady) {
    throw new Error('Editor is not ready');
  }

  try {
    const documentData = JSON.parse(jsonString) as DocumentData;
    this.validateDocumentData(documentData);
    this.loadDocument(documentData);
    this.emit('document-loaded-from-json', { version: documentData.version });
  } catch (error) {
    this.emit('error', { error, context: 'load-document' });
    throw error;
  }
}

/**
 * Load a document from a File object.
 * @param file File object to load
 * @returns Promise that resolves when loading is complete
 */
async loadDocumentFromFile(file: File): Promise<void> {
  if (!this._isReady) {
    throw new Error('Editor is not ready');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const jsonString = event.target?.result as string;
        this.loadDocumentFromJSON(jsonString);
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      const error = new Error('Failed to read file');
      this.emit('error', { error, context: 'file-read' });
      reject(error);
    };

    reader.readAsText(file);
  });
}

/**
 * Validate document data structure before loading.
 * @throws Error if validation fails
 */
private validateDocumentData(data: unknown): asserts data is DocumentData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid document data: expected object');
  }

  const doc = data as Record<string, unknown>;

  if (typeof doc.version !== 'string') {
    throw new Error('Invalid document data: missing or invalid version');
  }

  if (!Array.isArray(doc.pages)) {
    throw new Error('Invalid document data: missing or invalid pages array');
  }

  // Validate each page has an ID
  for (const page of doc.pages) {
    if (!page || typeof page !== 'object' || typeof (page as any).id !== 'string') {
      throw new Error('Invalid document data: page missing id');
    }
  }

  // Version compatibility check
  const [major] = doc.version.split('.').map(Number);
  if (major > 1) {
    console.warn(`Document version ${doc.version} may not be fully compatible with this editor`);
  }
}
```

## Phase 5: Demo Integration

### File: `/Users/james/code/pc/pc-editor/src/demo/demo.ts`

Add save/load buttons and handlers:

```typescript
// Add to setupEventHandlers()
document.getElementById('save-document')?.addEventListener('click', saveDocument);
document.getElementById('load-document')?.addEventListener('click', () => {
  document.getElementById('file-input')?.click();
});
document.getElementById('file-input')?.addEventListener('change', loadDocumentFromFile);

// Add new functions
function saveDocument(): void {
  if (!editor) return;

  try {
    editor.saveDocumentToFile('my-document.pceditor.json');
    updateStatus('Document saved');
  } catch (error) {
    console.error('Failed to save document:', error);
    updateStatus('Failed to save document', 'error');
  }
}

async function loadDocumentFromFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file || !editor) {
    return;
  }

  try {
    await editor.loadDocumentFromFile(file);
    updateStatus('Document loaded');
    loadDocumentSettings(); // Refresh settings panel
    updateDocumentInfo();
  } catch (error) {
    console.error('Failed to load document:', error);
    updateStatus('Failed to load document: ' + (error as Error).message, 'error');
  }

  // Reset the input so the same file can be loaded again
  input.value = '';
}
```

### File: `/Users/james/code/pc/pc-editor/src/demo/index.html`

Add UI elements for save/load:

```html
<!-- Add in toolbar section -->
<div class="button-group">
  <button id="save-document" class="toolbar-btn" title="Save Document">Save</button>
  <button id="load-document" class="toolbar-btn" title="Load Document">Load</button>
  <input type="file" id="file-input" accept=".json,.pceditor.json" style="display: none;">
</div>
```

## JSON Schema Design

The complete document format follows this structure:

```json
{
  "version": "1.0.0",
  "settings": {
    "pageSize": "A4",
    "pageOrientation": "portrait",
    "margins": { "top": 25, "right": 20, "bottom": 25, "left": 20 },
    "units": "mm"
  },
  "pages": [
    {
      "id": "page_1",
      "bodyContent": {
        "text": "Sample text with \ufffc embedded object",
        "formattingRuns": [
          { "index": 0, "formatting": { "fontFamily": "Arial", "fontSize": 14, "color": "#000000" } }
        ],
        "paragraphFormatting": [
          { "paragraphStart": 0, "formatting": { "alignment": "left" } }
        ],
        "substitutionFields": [
          { "id": "field-1", "textIndex": 10, "fieldName": "customerName", "fieldType": "data" }
        ],
        "repeatingSections": [
          { "id": "section-1", "fieldPath": "items", "startIndex": 50, "endIndex": 100 }
        ],
        "embeddedObjects": [
          {
            "textIndex": 18,
            "object": {
              "id": "img-1",
              "objectType": "image",
              "textIndex": 18,
              "position": "inline",
              "size": { "width": 100, "height": 75 },
              "data": { "src": "data:image/png;base64,...", "fit": "contain" }
            }
          }
        ]
      }
    }
  ],
  "headerContent": {
    "text": "Header text",
    "substitutionFields": [
      { "id": "field-page", "textIndex": 5, "fieldName": "page", "fieldType": "pageNumber" }
    ]
  },
  "footerContent": {
    "text": "Footer text"
  },
  "metadata": {
    "createdAt": "2024-01-15T10:30:00Z",
    "modifiedAt": "2024-01-15T14:45:00Z",
    "title": "My Document"
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/types/index.ts` | Add new type definitions for serialized data |
| `src/lib/text/FlowingTextContent.ts` | Add toData/fromData methods |
| `src/lib/core/Page.ts` | Update toData, add loadFromData |
| `src/lib/core/Document.ts` | Update toData, update constructor |
| `src/lib/core/PCEditor.ts` | Add save/load API methods |
| `src/lib/index.ts` | Export new types |
| `src/demo/demo.ts` | Add save/load handlers |
| `src/demo/index.html` | Add save/load buttons |

## Implementation Order

### Step 1: Type Definitions
1. Add all new interfaces to `/Users/james/code/pc/pc-editor/src/lib/types/index.ts`

### Step 2: FlowingTextContent Serialization
1. Add `toData()` method to FlowingTextContent
2. Add static `fromData()` factory method
3. Add instance `loadFromData()` method
4. Add necessary imports (EmbeddedObjectFactory)

### Step 3: Page Updates
1. Update `Page.toData()` to include bodyContent
2. Add `Page.loadFromData()` method

### Step 4: Document Updates
1. Update `Document.toData()` for complete serialization
2. Update `Document` constructor to handle full deserialization

### Step 5: PCEditor API
1. Add `saveDocument()` method
2. Add `saveDocumentToFile()` method
3. Add `loadDocumentFromJSON()` method
4. Add `loadDocumentFromFile()` method
5. Add `validateDocumentData()` private method
6. Add new events: `document-saved`, `document-loaded-from-json`

### Step 6: Demo Integration
1. Add save/load buttons to HTML
2. Add file input element
3. Add event handlers
4. Update status messages

### Step 7: Exports
1. Update `/Users/james/code/pc/pc-editor/src/lib/index.ts` with new exports

### Step 8: Testing
1. Test saving document with all content types
2. Test loading saved document
3. Test round-trip fidelity
4. Test error handling for invalid files
5. Test version compatibility warnings

## Error Handling Strategy

1. **Invalid JSON**: Catch JSON.parse errors and emit meaningful error
2. **Missing required fields**: Validate structure before loading
3. **Version mismatch**: Log warning but attempt to load
4. **Unknown object types**: Use `EmbeddedObjectFactory.tryCreate()` to skip unknown objects with warning
5. **File read errors**: Catch FileReader errors and emit error event

## Backward Compatibility

The current `DocumentData` interface is extended rather than replaced:
- `PageData.bodyContent` is optional for backward compatibility
- `headerContent`/`footerContent` already exist as `FlowingTextContentData`
- New fields are optional and have sensible defaults

## Testing Checklist

- [ ] Save empty document
- [ ] Save document with plain text only
- [ ] Save document with formatted text
- [ ] Save document with substitution fields
- [ ] Save document with embedded images
- [ ] Save document with embedded text boxes (with their own formatting)
- [ ] Save document with embedded tables (with row loops)
- [ ] Save document with repeating sections
- [ ] Save document with header/footer content
- [ ] Save document with page number fields in header/footer
- [ ] Load all above cases and verify fidelity
- [ ] Test invalid file handling
- [ ] Test large document performance

## Critical Files for Implementation

- `/Users/james/code/pc/pc-editor/src/lib/text/FlowingTextContent.ts` - Add toData/fromData methods, core serialization logic
- `/Users/james/code/pc/pc-editor/src/lib/types/index.ts` - Add new type definitions for serialized data structures
- `/Users/james/code/pc/pc-editor/src/lib/core/Document.ts` - Update toData to include all content, fix constructor deserialization
- `/Users/james/code/pc/pc-editor/src/lib/core/PCEditor.ts` - Add saveDocument/loadDocument API methods
- `/Users/james/code/pc/pc-editor/src/demo/demo.ts` - Add save/load button handlers and file handling
