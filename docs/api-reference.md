# API Reference

Complete API documentation for PC Editor.

## PCEditor Class

The main editor class that provides the public API.

### Constructor

```typescript
new PCEditor(container: HTMLElement, options?: EditorOptions)
```

**Parameters:**
- `container` - HTML element to render the editor into
- `options` - Optional configuration options

**Example:**
```typescript
const editor = new PCEditor(document.getElementById('editor'), {
  pageSize: 'A4',
  pageOrientation: 'portrait'
});
```

---

## Core Methods

### on(event, handler)

Subscribe to an editor event.

```typescript
editor.on(event: string, handler: Function): void
```

**Events:**
- `ready` - Editor initialization complete
- `content-changed` - Document content modified
- `selection-change` - Selection changed
- `cursor-changed` - Cursor position changed
- `zoom-changed` - Zoom level changed

### off(event, handler)

Unsubscribe from an editor event.

```typescript
editor.off(event: string, handler: Function): void
```

### isReady

Check if the editor is fully initialized.

```typescript
editor.isReady: boolean
```

### render()

Force a re-render of the editor.

```typescript
editor.render(): void
```

### destroy()

Clean up and destroy the editor instance.

```typescript
editor.destroy(): void
```

---

## Document Operations

### saveDocument()

Serialize the document to a JSON string.

```typescript
editor.saveDocument(): string
```

### loadDocumentFromJSON(json)

Load a document from a JSON string.

```typescript
editor.loadDocumentFromJSON(json: string): void
```

### saveDocumentToFile(filename)

Trigger a download of the document as a file.

```typescript
editor.saveDocumentToFile(filename: string): void
```

### loadDocumentFromFile(file)

Load a document from a File object.

```typescript
editor.loadDocumentFromFile(file: File): Promise<void>
```

### updateDocumentSettings(settings)

Update document settings like margins and page size.

```typescript
editor.updateDocumentSettings(settings: Partial<DocumentSettings>): void
```

**Example:**
```typescript
editor.updateDocumentSettings({
  margins: { top: 25, right: 20, bottom: 25, left: 20 },
  pageSize: 'Letter',
  pageOrientation: 'landscape'
});
```

---

## Text Operations

### setFlowingText(text)

Set the entire document text content.

```typescript
editor.setFlowingText(text: string): void
```

### getFlowingText()

Get the document text content as a string.

```typescript
editor.getFlowingText(): string
```

### insertText(text)

Insert text at the current cursor position.

```typescript
editor.insertText(text: string): void
```

### applyTextFormatting(start, end, formatting)

Apply formatting to a range of text.

```typescript
editor.applyTextFormatting(
  start: number,
  end: number,
  formatting: TextFormattingStyle
): void
```

**TextFormattingStyle properties:**
- `fontFamily?: string`
- `fontSize?: number`
- `fontWeight?: 'normal' | 'bold'`
- `fontStyle?: 'normal' | 'italic'`
- `textDecoration?: 'none' | 'underline' | 'line-through'`
- `color?: string`
- `backgroundColor?: string`

### setAlignment(alignment)

Set paragraph alignment at the cursor position.

```typescript
editor.setAlignment(alignment: 'left' | 'center' | 'right' | 'justify'): void
```

### getAlignmentAtCursor()

Get the alignment of the paragraph at the cursor.

```typescript
editor.getAlignmentAtCursor(): 'left' | 'center' | 'right' | 'justify'
```

---

## Selection

### getUnifiedSelection()

Get the current selection range.

```typescript
editor.getUnifiedSelection(): { start: number, end: number } | null
```

### setCursorPosition(position)

Set the cursor position.

```typescript
editor.setCursorPosition(position: number): void
```

### getCursorPosition()

Get the current cursor position.

```typescript
editor.getCursorPosition(): number
```

---

## List Operations

### toggleBulletList()

Toggle bullet list formatting for the current paragraph.

```typescript
editor.toggleBulletList(): void
```

### toggleNumberedList()

Toggle numbered list formatting for the current paragraph.

```typescript
editor.toggleNumberedList(): void
```

### indentParagraph()

Increase the indent level of the current paragraph.

```typescript
editor.indentParagraph(): void
```

### outdentParagraph()

Decrease the indent level of the current paragraph.

```typescript
editor.outdentParagraph(): void
```

---

## Embedded Objects

### insertEmbeddedObject(object, position)

Insert an embedded object (image, table, text box).

```typescript
editor.insertEmbeddedObject(
  object: EmbeddedObject,
  position: 'inline' | 'block'
): void
```

**Example:**
```typescript
import { ImageObject } from '@productcloudos/editor';

const image = new ImageObject({
  id: 'img-1',
  textIndex: 0,
  size: { width: 200, height: 150 },
  src: 'data:image/png;base64,...',
  fit: 'contain'
});

editor.insertEmbeddedObject(image, 'block');
```

### removeEmbeddedObject(objectId)

Remove an embedded object by ID.

```typescript
editor.removeEmbeddedObject(objectId: string): void
```

### getSelectedTable()

Get the currently selected table object.

```typescript
editor.getSelectedTable(): TableObject | null
```

### getSelectedImage()

Get the currently selected image object.

```typescript
editor.getSelectedImage(): ImageObject | null
```

### getSelectedTextBox()

Get the currently selected text box object.

```typescript
editor.getSelectedTextBox(): TextBoxObject | null
```

---

## Data Binding

### insertSubstitutionField(fieldName, config)

Insert a substitution field placeholder.

```typescript
editor.insertSubstitutionField(
  fieldName: string,
  config?: SubstitutionFieldConfig
): void
```

**Config options:**
- `displayText?: string` - Text shown in editor
- `fieldType?: 'text' | 'number' | 'date' | 'currency'`
- `format?: string` - Format string for the field

### insertPageNumberField(format)

Insert a page number field.

```typescript
editor.insertPageNumberField(format?: 'numeric' | 'roman'): void
```

### insertPageCountField(format)

Insert a total page count field.

```typescript
editor.insertPageCountField(format?: 'numeric' | 'roman'): void
```

### applyMergeData(data)

Apply merge data to substitution fields.

```typescript
editor.applyMergeData(data: Record<string, unknown>): void
```

**Example:**
```typescript
editor.applyMergeData({
  customerName: 'John Doe',
  invoiceNumber: 'INV-001',
  items: [
    { name: 'Widget', price: 9.99 },
    { name: 'Gadget', price: 19.99 }
  ]
});
```

### createRepeatingSection(start, end, fieldPath)

Create a repeating section for array data.

```typescript
editor.createRepeatingSection(
  start: number,
  end: number,
  fieldPath: string
): void
```

---

## Hyperlinks

### insertHyperlink(url, options)

Insert a hyperlink at the cursor position.

```typescript
editor.insertHyperlink(url: string, options?: HyperlinkOptions): void
```

**Options:**
- `title?: string` - Link title/tooltip
- `text?: string` - Display text (defaults to URL)

### updateHyperlink(id, update)

Update an existing hyperlink.

```typescript
editor.updateHyperlink(id: string, update: Partial<Hyperlink>): void
```

### removeHyperlink(id)

Remove a hyperlink.

```typescript
editor.removeHyperlink(id: string): void
```

### getHyperlinkAt(position)

Get the hyperlink at a text position.

```typescript
editor.getHyperlinkAt(position: number): Hyperlink | null
```

---

## Undo/Redo

### undo()

Undo the last action.

```typescript
editor.undo(): void
```

### redo()

Redo the last undone action.

```typescript
editor.redo(): void
```

### canUndo()

Check if undo is available.

```typescript
editor.canUndo(): boolean
```

### canRedo()

Check if redo is available.

```typescript
editor.canRedo(): boolean
```

### clearUndoHistory()

Clear the undo/redo history.

```typescript
editor.clearUndoHistory(): void
```

---

## Clipboard

### copy()

Copy the current selection to clipboard.

```typescript
editor.copy(): Promise<void>
```

### cut()

Cut the current selection to clipboard.

```typescript
editor.cut(): Promise<void>
```

### paste()

Paste from clipboard at cursor position.

```typescript
editor.paste(): Promise<void>
```

---

## View Controls

### zoomIn()

Increase zoom level.

```typescript
editor.zoomIn(): void
```

### zoomOut()

Decrease zoom level.

```typescript
editor.zoomOut(): void
```

### setZoom(level)

Set a specific zoom level.

```typescript
editor.setZoom(level: number): void
```

**Example:**
```typescript
editor.setZoom(1.5); // 150%
editor.setZoom(0.75); // 75%
```

### getZoomLevel()

Get the current zoom level.

```typescript
editor.getZoomLevel(): number
```

### fitToWidth()

Fit the document to the container width.

```typescript
editor.fitToWidth(): void
```

### fitToPage()

Fit the entire page in the view.

```typescript
editor.fitToPage(): void
```

### setShowGrid(show)

Toggle grid overlay visibility.

```typescript
editor.setShowGrid(show: boolean): void
```

### setShowControlCharacters(show)

Toggle control character visibility.

```typescript
editor.setShowControlCharacters(show: boolean): void
```

---

## PDF Export

### exportPDF(options)

Export the document to PDF.

```typescript
editor.exportPDF(options?: PDFExportOptions): Promise<Blob>
```

**Options:**
- `applyMergeData?: boolean` - Apply merge data before export
- `mergeData?: Record<string, unknown>` - Data to merge

**Example:**
```typescript
const pdfBlob = await editor.exportPDF({
  applyMergeData: true,
  mergeData: { customerName: 'Jane Doe' }
});

// Download
const url = URL.createObjectURL(pdfBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'document.pdf';
link.click();
URL.revokeObjectURL(url);
```

---

## PDF Import

### importPDF(source, options, onProgress)

Import a PDF document.

```typescript
editor.importPDF(
  source: File | ArrayBuffer | string,
  options?: PDFImportOptions,
  onProgress?: (progress: PDFImportProgress) => void
): Promise<PDFImportResult>
```

**Options:**
- `detectTables?: boolean` - Attempt to detect tables
- `extractImages?: boolean` - Extract embedded images

**Example:**
```typescript
const result = await editor.importPDF(file, {
  detectTables: true,
  extractImages: true
});

if (result.warnings.length > 0) {
  console.log('Import warnings:', result.warnings);
}
```

---

## Types

### EditorOptions

```typescript
interface EditorOptions {
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'A3';
  pageOrientation?: 'portrait' | 'landscape';
  units?: 'mm' | 'in' | 'pt' | 'px';
  showGrid?: boolean;
  showRulers?: boolean;
  showControlCharacters?: boolean;
  defaultFont?: string;
  defaultFontSize?: number;
  theme?: 'light' | 'dark';
}
```

### TextFormattingStyle

```typescript
interface TextFormattingStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  color?: string;
  backgroundColor?: string;
}
```

### DocumentSettings

```typescript
interface DocumentSettings {
  pageSize: 'A4' | 'Letter' | 'Legal' | 'A3';
  pageOrientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}
```
