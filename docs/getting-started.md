# Getting Started with PC Editor

This guide will help you set up PC Editor in your project and create your first document.

## Installation

Install PC Editor via npm:

```bash
npm install pc-editor
```

Or with yarn:

```bash
yarn add pc-editor
```

## Basic Setup

### 1. Create a Container Element

PC Editor needs an HTML container element to render into:

```html
<div id="editor-container" style="width: 100%; height: 600px;"></div>
```

### 2. Initialize the Editor

```typescript
import { PCEditor } from 'pc-editor';

const container = document.getElementById('editor-container');
const editor = new PCEditor(container, {
  pageSize: 'A4',
  pageOrientation: 'portrait',
  units: 'mm',
  showGrid: true
});

// Wait for the editor to be ready
editor.on('ready', () => {
  console.log('Editor is ready!');
});
```

### 3. Add Content

```typescript
editor.on('ready', () => {
  // Set text content
  editor.setFlowingText('Welcome to PC Editor!\n\nStart typing your document...');
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pageSize` | `'A4' \| 'Letter' \| 'Legal' \| 'A3'` | `'A4'` | Document page size |
| `pageOrientation` | `'portrait' \| 'landscape'` | `'portrait'` | Page orientation |
| `units` | `'mm' \| 'in' \| 'pt' \| 'px'` | `'mm'` | Measurement units |
| `showGrid` | `boolean` | `false` | Show grid overlay |
| `showRulers` | `boolean` | `false` | Show rulers |
| `showControlCharacters` | `boolean` | `false` | Show paragraph marks |
| `defaultFont` | `string` | `'Arial'` | Default font family |
| `defaultFontSize` | `number` | `12` | Default font size |
| `theme` | `'light' \| 'dark'` | `'light'` | Editor theme |

## Working with Text

### Setting Content

```typescript
// Replace all content
editor.setFlowingText('Your document content here...');

// Insert at cursor position
editor.insertText('Inserted text');
```

### Text Formatting

```typescript
// Apply bold to selection
editor.applyTextFormatting(startIndex, endIndex, {
  fontWeight: 'bold'
});

// Apply multiple styles
editor.applyTextFormatting(startIndex, endIndex, {
  fontWeight: 'bold',
  fontStyle: 'italic',
  color: '#0066cc',
  fontSize: 16
});
```

### Paragraph Alignment

```typescript
editor.setAlignment('center'); // 'left' | 'center' | 'right' | 'justify'
```

### Lists

```typescript
// Toggle bullet list
editor.toggleBulletList();

// Toggle numbered list
editor.toggleNumberedList();

// Indent list item (also works with Tab key)
editor.indentParagraph();

// Outdent list item (also works with Shift+Tab)
editor.outdentParagraph();
```

## Inserting Objects

### Images

```typescript
import { ImageObject } from 'pc-editor';

const image = new ImageObject({
  id: 'img-1',
  textIndex: 0,
  size: { width: 200, height: 150 },
  src: 'data:image/png;base64,...',
  fit: 'contain'
});

editor.insertEmbeddedObject(image, 'block');
```

### Tables

```typescript
import { TableObject } from 'pc-editor';

const table = new TableObject({
  id: 'table-1',
  textIndex: 0,
  size: { width: 400, height: 200 },
  rows: 3,
  columns: 3
});

editor.insertEmbeddedObject(table, 'block');
```

## Saving and Loading

### Save Document

```typescript
// Get JSON string
const json = editor.saveDocument();

// Download as file
editor.saveDocumentToFile('my-document.pceditor.json');
```

### Load Document

```typescript
// From JSON string
editor.loadDocumentFromJSON(json);

// From file
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  await editor.loadDocumentFromFile(file);
});
```

## PDF Export

```typescript
const pdfBlob = await editor.exportPDF({
  applyMergeData: true,
  mergeData: { customerName: 'John Doe' }
});

// Download the PDF
const url = URL.createObjectURL(pdfBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'document.pdf';
link.click();
URL.revokeObjectURL(url);
```

## Event Handling

```typescript
// Content changed
editor.on('content-changed', (event) => {
  console.log('Content modified');
});

// Selection changed
editor.on('selection-change', (event) => {
  console.log('Selection:', event.selection);
});

// Cursor position changed
editor.on('cursor-changed', (event) => {
  console.log('Cursor at:', event.position);
});
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle bold |
| `Ctrl+I` | Toggle italic |
| `Ctrl+U` | Toggle underline |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy |
| `Ctrl+X` | Cut |
| `Ctrl+V` | Paste |
| `Tab` | Indent list item |
| `Shift+Tab` | Outdent list item |
| `Enter` | New paragraph |
| `Shift+Enter` | Line break |

## Next Steps

- [API Reference](./api-reference.md) - Complete API documentation
- [Configuration](./configuration.md) - All configuration options
- [Data Binding](./data-binding.md) - Dynamic content with merge fields
- [Tables](./tables.md) - Working with tables
