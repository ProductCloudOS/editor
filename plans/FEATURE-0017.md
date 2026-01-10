# FEATURE-0017: Unit Tests at Editor API Level - Implementation Plan

## Status: IMPLEMENTED

## Overview

Implement comprehensive unit tests at the PCEditor API level to ensure the editor operates as expected. These tests will verify public API behavior, event emissions, state management, and integration between editor components. This is distinct from FEATURE-0018 (low-level unit tests) which focuses on internal implementation details.

## Goals

1. **API Contract Verification**: Ensure all public PCEditor methods behave as documented
2. **State Consistency**: Verify editor state remains consistent across operations
3. **Event Verification**: Confirm correct events are emitted with proper payloads
4. **Error Handling**: Validate appropriate errors are thrown for invalid inputs
5. **Round-Trip Fidelity**: Test serialization/deserialization preserves document state

## Testing Framework Selection

### Recommended: Vitest

| Criteria | Vitest | Jest | Mocha |
|----------|--------|------|-------|
| Vite integration | Native | Plugin | Plugin |
| TypeScript support | Built-in | Config needed | Config needed |
| Speed | Fast | Moderate | Moderate |
| API compatibility | Jest-compatible | N/A | Different |
| Watch mode | Excellent | Good | Good |

**Decision**: Use Vitest for native Vite integration and Jest-compatible API.

### Test Environment: jsdom

Since PCEditor requires DOM APIs (HTMLElement, Canvas), tests will use jsdom environment.

## PCEditor API Categories for Testing

### 1. Initialization & Lifecycle

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `constructor(container, options)` | Create editor instance | High |
| `isReady` | Check if editor is initialized | High |
| `on('ready', callback)` | Ready event emission | High |
| `on('error', callback)` | Error event handling | High |

### 2. Document Management

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `loadDocument(documentData)` | Load document from data | High |
| `getDocument()` | Get document data | High |
| `saveDocument()` | Serialize to JSON string | High |
| `saveDocumentToFile(filename)` | Download document | Medium |
| `loadDocumentFromJSON(jsonString)` | Parse and load JSON | High |
| `loadDocumentFromFile(file)` | Load from File object | Medium |
| `exportPDF(options)` | Generate PDF blob | Medium |

### 3. Text Content Operations

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `insertText(text)` | Insert text at cursor | High |
| `getFlowingText()` | Get text content | High |
| `setFlowingText(text)` | Set text content | High |
| `setCursorPosition(position)` | Move cursor | High |
| `getSelection()` | Get current selection state | High |
| `clearSelection()` | Clear selection | High |

### 4. Text Formatting

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `applyTextFormatting(start, end, formatting)` | Apply formatting to range | High |
| `getFormattingAt(position)` | Get formatting at position | High |
| `getSelectionFormatting()` | Get formatting for selection | High |
| `getUnifiedFormattingAtCursor()` | Get formatting (any context) | High |
| `applyUnifiedFormatting(start, end, formatting)` | Apply formatting (any context) | High |
| `setPendingFormatting(formatting)` | Set pending formatting | Medium |
| `getPendingFormatting()` | Get pending formatting | Medium |
| `hasPendingFormatting()` | Check pending formatting | Medium |
| `clearPendingFormatting()` | Clear pending formatting | Medium |

### 5. Paragraph Alignment

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `setAlignment(alignment)` | Set paragraph alignment | High |
| `setAlignmentForSelection(alignment)` | Set alignment for selection | High |
| `getAlignmentAtCursor()` | Get alignment at cursor | High |
| `setUnifiedAlignment(alignment)` | Set alignment (any context) | High |
| `getUnifiedAlignmentAtCursor()` | Get alignment (any context) | High |

### 6. Embedded Objects

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `insertEmbeddedObject(object, position)` | Insert embedded object | High |
| `removeEmbeddedObject(objectId)` | Remove embedded object | High |
| `selectElement(elementId)` | Select element by ID | High |
| `getSelectedTextBox()` | Get selected text box | Medium |
| `getSelectedTable()` | Get selected table | Medium |
| `getSelectedImage()` | Get selected image | Medium |
| `getFocusedTable()` | Get focused table | Medium |

### 7. Substitution Fields

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `insertSubstitutionField(fieldName, config)` | Insert field | High |
| `insertPageNumberField(displayFormat)` | Insert page number | High |
| `insertPageCountField(displayFormat)` | Insert page count | High |
| `getFieldAt(position)` | Get field at position | High |
| `getSelectedField()` | Get selected field | Medium |
| `updateField(textIndex, updates)` | Update field properties | High |

### 8. Repeating Sections

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `createRepeatingSection(start, end, fieldPath)` | Create section | High |
| `getRepeatingSection(id)` | Get section by ID | Medium |
| `getRepeatingSections()` | Get all sections | Medium |
| `updateRepeatingSectionFieldPath(id, fieldPath)` | Update field path | Medium |
| `removeRepeatingSection(id)` | Remove section | High |
| `getParagraphBoundaries()` | Get valid boundaries | Medium |
| `getRepeatingSectionAtBoundary(textIndex)` | Get section at boundary | Medium |

### 9. Data Binding & Merge

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `applyMergeData(data)` | Apply merge data | High |
| `bindData(data)` | Bind data to document | Medium |

### 10. Table Operations

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `tableInsertRow(table, rowIndex, config)` | Insert row | High |
| `tableRemoveRow(table, rowIndex)` | Remove row | High |
| `tableInsertColumn(table, colIndex, width)` | Insert column | High |
| `tableRemoveColumn(table, colIndex)` | Remove column | High |

### 11. Undo/Redo

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `undo()` | Undo last operation | High |
| `redo()` | Redo last undone operation | High |
| `canUndo()` | Check if undo available | High |
| `canRedo()` | Check if redo available | High |
| `clearUndoHistory()` | Clear undo history | Medium |
| `setMaxUndoHistory(count)` | Set history limit | Low |
| `beginCompoundOperation(description)` | Start compound op | Medium |
| `endCompoundOperation(description)` | End compound op | Medium |

### 12. View Controls

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `zoomIn()` | Increase zoom | Low |
| `zoomOut()` | Decrease zoom | Low |
| `setZoom(level)` | Set zoom level | Low |
| `fitToWidth()` | Fit to container width | Low |
| `fitToPage()` | Fit page in view | Low |
| `render()` | Force re-render | Low |

### 13. Layout & Settings

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `updateDocumentSettings(settings)` | Update settings | High |
| `getDocumentSettings()` | Get settings | High |
| `setAutoFlow(enabled)` | Enable/disable auto flow | Medium |
| `reflowDocument()` | Force reflow | Medium |
| `setSnapToGrid(enabled)` | Enable/disable snap | Low |
| `getDocumentMetrics()` | Get document metrics | Low |
| `setShowControlCharacters(show)` | Show/hide control chars | Low |
| `getShowControlCharacters()` | Get control char visibility | Low |
| `setShowGrid(show)` | Show/hide grid | Low |
| `getShowGrid()` | Get grid visibility | Low |
| `setShowMarginLines(show)` | Show/hide margin lines | Low |
| `getShowMarginLines()` | Get margin line visibility | Low |

### 14. Page Management

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `addPage()` | Add new page | Medium |
| `removePage(pageId)` | Remove page | Medium |
| `insertPageBreak()` | Insert page break | High |

### 15. Section Management

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `getActiveSection()` | Get active section | High |
| `setActiveSection(section)` | Set active section | High |
| `getHeaderText()` | Get header text | Medium |
| `setHeaderText(text)` | Set header text | Medium |
| `getFooterText()` | Get footer text | Medium |
| `setFooterText(text)` | Set footer text | Medium |

### 16. Text Editing Context

| Method | Description | Test Priority |
|--------|-------------|---------------|
| `isEditingTextBox()` | Check if editing text box | Medium |
| `isTextEditing()` | Check if editing any text | Medium |
| `getEditingFlowingContent()` | Get editing content | Medium |
| `getEditingTextBox()` | Get editing text box | Medium |
| `enableTextInput()` | Enable keyboard input | Low |
| `disableTextInput()` | Disable keyboard input | Low |

## Test Structure

### Directory Layout

```
src/
└── test/
    ├── setup.ts                    # Test setup and mocks
    ├── helpers/
    │   ├── createEditor.ts         # Editor factory helper
    │   ├── mockCanvas.ts           # Canvas context mocks
    │   └── documentFixtures.ts     # Sample document data
    └── api/
        ├── initialization.test.ts
        ├── document-management.test.ts
        ├── text-operations.test.ts
        ├── text-formatting.test.ts
        ├── paragraph-alignment.test.ts
        ├── embedded-objects.test.ts
        ├── substitution-fields.test.ts
        ├── repeating-sections.test.ts
        ├── merge-data.test.ts
        ├── table-operations.test.ts
        ├── undo-redo.test.ts
        ├── view-controls.test.ts
        ├── document-settings.test.ts
        ├── page-management.test.ts
        ├── section-management.test.ts
        └── events.test.ts
```

### Test Helper: createEditor

```typescript
// src/test/helpers/createEditor.ts
import { PCEditor, EditorOptions } from '../../lib';

export async function createEditor(
  options?: EditorOptions
): Promise<{ editor: PCEditor; container: HTMLElement }> {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);

  const editor = new PCEditor(container, options);

  // Wait for ready event
  await new Promise<void>((resolve) => {
    if (editor.isReady) {
      resolve();
    } else {
      editor.on('ready', () => resolve());
    }
  });

  return { editor, container };
}

export function cleanupEditor(container: HTMLElement): void {
  document.body.removeChild(container);
}
```

### Canvas Mock Strategy

```typescript
// src/test/helpers/mockCanvas.ts
export function setupCanvasMock(): void {
  // Mock canvas context
  HTMLCanvasElement.prototype.getContext = function(contextId: string) {
    if (contextId === '2d') {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        measureText: vi.fn(() => ({ width: 10 })),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        clip: vi.fn(),
        rect: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        // Add canvas property references
        canvas: {
          width: 800,
          height: 600
        }
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  };
}
```

## Sample Test Cases

### Initialization Tests

```typescript
// src/test/api/initialization.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, cleanupEditor } from '../helpers/createEditor';
import { PCEditor } from '../../lib';

describe('PCEditor Initialization', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  afterEach(() => {
    if (container) cleanupEditor(container);
  });

  it('should create editor with default options', async () => {
    ({ editor, container } = await createEditor());
    expect(editor.isReady).toBe(true);
  });

  it('should emit ready event when initialized', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);

    const readyPromise = new Promise<void>((resolve) => {
      const ed = new PCEditor(container);
      ed.on('ready', () => resolve());
    });

    await expect(readyPromise).resolves.toBeUndefined();
  });

  it('should throw error when container is null', () => {
    expect(() => new PCEditor(null as any)).toThrow('Container element is required');
  });

  it('should apply custom options', async () => {
    ({ editor, container } = await createEditor({
      pageSize: 'Letter',
      pageOrientation: 'landscape',
      showGrid: false
    }));

    const settings = editor.getDocumentSettings();
    expect(settings.pageSize).toBe('Letter');
    expect(settings.pageOrientation).toBe('landscape');
  });
});
```

### Text Operations Tests

```typescript
// src/test/api/text-operations.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, cleanupEditor } from '../helpers/createEditor';
import { PCEditor } from '../../lib';

describe('PCEditor Text Operations', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    ({ editor, container } = await createEditor());
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('setFlowingText / getFlowingText', () => {
    it('should set and get text content', () => {
      editor.setFlowingText('Hello, World!');
      expect(editor.getFlowingText()).toBe('Hello, World!');
    });

    it('should handle empty text', () => {
      editor.setFlowingText('');
      expect(editor.getFlowingText()).toBe('');
    });

    it('should handle multi-line text', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      editor.setFlowingText(text);
      expect(editor.getFlowingText()).toBe(text);
    });
  });

  describe('insertText', () => {
    it('should insert text at cursor position', () => {
      editor.setFlowingText('Hello World');
      editor.setCursorPosition(5);
      editor.insertText(',');
      expect(editor.getFlowingText()).toBe('Hello, World');
    });

    it('should insert at beginning when cursor at 0', () => {
      editor.setFlowingText('World');
      editor.setCursorPosition(0);
      editor.insertText('Hello ');
      expect(editor.getFlowingText()).toBe('Hello World');
    });
  });

  describe('setCursorPosition', () => {
    it('should set cursor position', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(3);
      const selection = editor.getSelection();
      expect(selection.type).toBe('cursor');
      if (selection.type === 'cursor') {
        expect(selection.position).toBe(3);
      }
    });
  });
});
```

### Document Serialization Tests

```typescript
// src/test/api/document-management.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, cleanupEditor } from '../helpers/createEditor';
import { PCEditor } from '../../lib';

describe('PCEditor Document Management', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    ({ editor, container } = await createEditor());
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('saveDocument / loadDocumentFromJSON', () => {
    it('should round-trip text content', () => {
      editor.setFlowingText('Test content');
      const json = editor.saveDocument();

      editor.setFlowingText('');
      editor.loadDocumentFromJSON(json);

      expect(editor.getFlowingText()).toBe('Test content');
    });

    it('should round-trip document settings', () => {
      editor.updateDocumentSettings({
        margins: { top: 30, right: 25, bottom: 30, left: 25 }
      });
      const json = editor.saveDocument();

      editor.loadDocumentFromJSON(json);

      const settings = editor.getDocumentSettings();
      expect(settings.margins.top).toBe(30);
      expect(settings.margins.right).toBe(25);
    });

    it('should throw on invalid JSON', () => {
      expect(() => editor.loadDocumentFromJSON('not json')).toThrow();
    });

    it('should throw on missing version', () => {
      expect(() => editor.loadDocumentFromJSON('{"pages":[]}')).toThrow('missing or invalid version');
    });
  });
});
```

### Substitution Field Tests

```typescript
// src/test/api/substitution-fields.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, cleanupEditor } from '../helpers/createEditor';
import { PCEditor } from '../../lib';

describe('PCEditor Substitution Fields', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    ({ editor, container } = await createEditor());
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('insertSubstitutionField', () => {
    it('should insert a field at cursor position', () => {
      editor.setFlowingText('Hello ');
      editor.setCursorPosition(6);
      editor.insertSubstitutionField('name');

      const field = editor.getFieldAt(6);
      expect(field).not.toBeNull();
      expect(field?.fieldName).toBe('name');
    });

    it('should emit substitution-field-added event', async () => {
      const eventPromise = new Promise<any>((resolve) => {
        editor.on('substitution-field-added', resolve);
      });

      editor.insertSubstitutionField('customerName');

      const event = await eventPromise;
      expect(event.field.fieldName).toBe('customerName');
    });
  });

  describe('insertPageNumberField', () => {
    it('should insert page number field', () => {
      editor.insertPageNumberField();
      const field = editor.getFieldAt(0);
      expect(field?.fieldType).toBe('pageNumber');
    });
  });

  describe('updateField', () => {
    it('should update field properties', () => {
      editor.insertSubstitutionField('oldName');
      const success = editor.updateField(0, { fieldName: 'newName' });

      expect(success).toBe(true);
      const field = editor.getFieldAt(0);
      expect(field?.fieldName).toBe('newName');
    });
  });
});
```

### Merge Data Tests

```typescript
// src/test/api/merge-data.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, cleanupEditor } from '../helpers/createEditor';
import { PCEditor } from '../../lib';

describe('PCEditor Merge Data', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    ({ editor, container } = await createEditor());
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('applyMergeData', () => {
    it('should replace simple field with value', () => {
      editor.setFlowingText('Hello ');
      editor.setCursorPosition(6);
      editor.insertSubstitutionField('name');

      editor.applyMergeData({ name: 'World' });

      expect(editor.getFlowingText()).toBe('Hello World');
    });

    it('should replace nested field paths', () => {
      editor.insertSubstitutionField('contact.email');

      editor.applyMergeData({
        contact: { email: 'test@example.com' }
      });

      expect(editor.getFlowingText()).toBe('test@example.com');
    });

    it('should use default value when field not in data', () => {
      editor.insertSubstitutionField('missing', { defaultValue: 'N/A' });

      editor.applyMergeData({});

      expect(editor.getFlowingText()).toBe('N/A');
    });

    it('should emit merge-data-applied event', async () => {
      const eventPromise = new Promise<any>((resolve) => {
        editor.on('merge-data-applied', resolve);
      });

      editor.insertSubstitutionField('test');
      editor.applyMergeData({ test: 'value' });

      const event = await eventPromise;
      expect(event.data.test).toBe('value');
    });
  });
});
```

### Undo/Redo Tests

```typescript
// src/test/api/undo-redo.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor, cleanupEditor } from '../helpers/createEditor';
import { PCEditor } from '../../lib';

describe('PCEditor Undo/Redo', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    ({ editor, container } = await createEditor());
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('undo', () => {
    it('should undo text insertion', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(5);
      editor.insertText(' World');

      expect(editor.getFlowingText()).toBe('Hello World');

      editor.undo();

      expect(editor.getFlowingText()).toBe('Hello');
    });

    it('should report canUndo correctly', () => {
      expect(editor.canUndo()).toBe(false);

      editor.setFlowingText('Test');
      // Note: setFlowingText may or may not be undoable depending on implementation
      // This test should be adjusted based on actual behavior
    });
  });

  describe('redo', () => {
    it('should redo undone operation', () => {
      editor.setFlowingText('Hello');
      editor.setCursorPosition(5);
      editor.insertText(' World');

      editor.undo();
      expect(editor.getFlowingText()).toBe('Hello');

      editor.redo();
      expect(editor.getFlowingText()).toBe('Hello World');
    });

    it('should clear redo stack on new operation', () => {
      editor.setFlowingText('A');
      editor.insertText('B');

      editor.undo();
      expect(editor.canRedo()).toBe(true);

      editor.insertText('C');
      expect(editor.canRedo()).toBe(false);
    });
  });

  describe('compound operations', () => {
    it('should group operations into single undo', () => {
      editor.setFlowingText('');

      editor.beginCompoundOperation('Insert multiple');
      editor.insertText('A');
      editor.insertText('B');
      editor.insertText('C');
      editor.endCompoundOperation();

      expect(editor.getFlowingText()).toBe('ABC');

      editor.undo();

      expect(editor.getFlowingText()).toBe('');
    });
  });
});
```

### Event Emission Tests

```typescript
// src/test/api/events.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEditor, cleanupEditor } from '../helpers/createEditor';
import { PCEditor } from '../../lib';

describe('PCEditor Events', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    ({ editor, container } = await createEditor());
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('document-change', () => {
    it('should emit on text change', async () => {
      const handler = vi.fn();
      editor.on('document-change', handler);

      editor.setFlowingText('New content');

      // Allow for async event emission
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('selection-change', () => {
    it('should emit on selection change', async () => {
      const handler = vi.fn();
      editor.on('selection-change', handler);

      editor.setFlowingText('Hello World');
      editor.setCursorPosition(5);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('document-settings-changed', () => {
    it('should emit on settings update', async () => {
      const handler = vi.fn();
      editor.on('document-settings-changed', handler);

      editor.updateDocumentSettings({ margins: { top: 50 } });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            margins: expect.objectContaining({ top: 50 })
          })
        })
      );
    });
  });
});
```

## Implementation Phases

### Phase 1: Test Infrastructure Setup

1. **Install dependencies**
   ```bash
   npm install -D vitest @vitest/coverage-v8 jsdom @types/jsdom
   ```

2. **Configure Vitest** in `vite.config.ts`
   ```typescript
   export default defineConfig({
     test: {
       environment: 'jsdom',
       setupFiles: ['./src/test/setup.ts'],
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html']
       }
     }
   });
   ```

3. **Create test setup file** (`src/test/setup.ts`)
   - Canvas mocks
   - DOM setup
   - Global test utilities

4. **Create test helpers**
   - `createEditor.ts` - Editor factory
   - `mockCanvas.ts` - Canvas context mocks
   - `documentFixtures.ts` - Sample documents

### Phase 2: Core API Tests

5. **Initialization tests** - Constructor, ready state, options
6. **Document management tests** - Save/load, serialization
7. **Text operations tests** - Insert, get, set, cursor

### Phase 3: Formatting & Structure Tests

8. **Text formatting tests** - Apply, get, pending formatting
9. **Paragraph alignment tests** - Set, get alignment
10. **Substitution field tests** - Insert, update, get

### Phase 4: Complex Feature Tests

11. **Embedded object tests** - Insert, remove, select
12. **Table operation tests** - Row/column operations
13. **Repeating section tests** - Create, update, remove
14. **Merge data tests** - Field substitution, loops

### Phase 5: Integration Tests

15. **Undo/redo tests** - Single, compound operations
16. **Event emission tests** - All documented events
17. **Round-trip tests** - Full document serialization

### Phase 6: Edge Cases & Error Handling

18. **Error condition tests** - Invalid inputs, state errors
19. **Edge case tests** - Empty documents, boundary conditions
20. **Performance tests** - Large document handling

## NPM Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:api": "vitest run src/test/api"
  }
}
```

## Coverage Goals

| Category | Target Coverage |
|----------|-----------------|
| PCEditor public methods | 100% |
| Event emissions | 100% |
| Error paths | 90% |
| Edge cases | 80% |

## Files to Create

| File | Description |
|------|-------------|
| `src/test/setup.ts` | Test setup and mocks |
| `src/test/helpers/createEditor.ts` | Editor factory helper |
| `src/test/helpers/mockCanvas.ts` | Canvas context mocks |
| `src/test/helpers/documentFixtures.ts` | Sample document data |
| `src/test/api/initialization.test.ts` | Initialization tests |
| `src/test/api/document-management.test.ts` | Document save/load tests |
| `src/test/api/text-operations.test.ts` | Text manipulation tests |
| `src/test/api/text-formatting.test.ts` | Formatting tests |
| `src/test/api/paragraph-alignment.test.ts` | Alignment tests |
| `src/test/api/embedded-objects.test.ts` | Embedded object tests |
| `src/test/api/substitution-fields.test.ts` | Field tests |
| `src/test/api/repeating-sections.test.ts` | Section tests |
| `src/test/api/merge-data.test.ts` | Merge data tests |
| `src/test/api/table-operations.test.ts` | Table tests |
| `src/test/api/undo-redo.test.ts` | Undo/redo tests |
| `src/test/api/view-controls.test.ts` | View control tests |
| `src/test/api/document-settings.test.ts` | Settings tests |
| `src/test/api/page-management.test.ts` | Page tests |
| `src/test/api/section-management.test.ts` | Header/footer tests |
| `src/test/api/events.test.ts` | Event emission tests |

## Files to Modify

| File | Changes |
|------|---------|
| `vite.config.ts` | Add Vitest configuration |
| `package.json` | Add test scripts and dependencies |
| `tsconfig.json` | Include test directory |

## Testing Checklist

### Initialization
- [ ] Create editor with default options
- [ ] Create editor with custom options
- [ ] Ready event emitted
- [ ] Error on null container
- [ ] Error handling for initialization failures

### Document Management
- [ ] Load document from data
- [ ] Get document data
- [ ] Save to JSON string
- [ ] Load from JSON string
- [ ] Round-trip preserves all content
- [ ] Validation rejects invalid data
- [ ] Document-loaded event emitted

### Text Operations
- [ ] Set text content
- [ ] Get text content
- [ ] Insert text at cursor
- [ ] Set cursor position
- [ ] Handle empty text
- [ ] Handle multi-line text
- [ ] Handle Unicode characters

### Text Formatting
- [ ] Apply formatting to range
- [ ] Get formatting at position
- [ ] Get selection formatting
- [ ] Pending formatting works
- [ ] Format preserved through serialization

### Substitution Fields
- [ ] Insert data field
- [ ] Insert page number field
- [ ] Insert page count field
- [ ] Get field at position
- [ ] Update field properties
- [ ] Field events emitted

### Merge Data
- [ ] Simple field substitution
- [ ] Nested field paths
- [ ] Array indexing
- [ ] Default values used
- [ ] Repeating section expansion
- [ ] Table row loop expansion
- [ ] Merge event emitted

### Undo/Redo
- [ ] Undo text insertion
- [ ] Undo formatting change
- [ ] Redo works after undo
- [ ] Compound operations group
- [ ] canUndo/canRedo accurate
- [ ] Clear history works

### Events
- [ ] ready event
- [ ] document-change event
- [ ] selection-change event
- [ ] document-settings-changed event
- [ ] substitution-field-added event
- [ ] merge-data-applied event
- [ ] undo-state-changed event

## Relationship to FEATURE-0018

FEATURE-0017 (this plan) focuses on **API-level tests** that verify:
- Public method contracts
- Event emissions
- Integration between components
- User-facing behavior

FEATURE-0018 focuses on **low-level unit tests** that verify:
- Internal class implementations
- Private method logic
- Individual component behavior
- Edge cases in algorithms

Together, these features aim to achieve 95%+ code coverage.
