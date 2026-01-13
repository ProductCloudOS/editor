# PC Editor

A powerful browser-based WYSIWYG document editor library for creating pixel-perfect documents with data binding and PDF export capabilities.

[![npm version](https://img.shields.io/npm/v/@productcloudos/editor.svg)](https://www.npmjs.com/package/@productcloudos/editor)
[![CI](https://github.com/ProductCloudOS/editor/workflows/CI/badge.svg)](https://github.com/ProductCloudOS/editor/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[Live Demo](https://productcloudos.github.io/editor/)**

## Features

- **Canvas-based rendering** for pixel-perfect positioning
- **Multi-page documents** with automatic content flow
- **Rich text formatting** - bold, italic, colors, fonts, sizes
- **Bullet and numbered lists** with nesting up to 8 levels
- **Tables** with cell merging, borders, styling, and multi-page support
- **Images** with fit modes (cover, contain, stretch, tile)
- **Hyperlinks** with customizable styling
- **Data binding** with substitution fields for dynamic content
- **Repeating sections** for data-driven content generation
- **PDF generation** with full formatting support
- **PDF import** to convert existing PDFs to editable documents
- **Undo/redo** with full transaction support
- **Copy/paste** supporting proprietary format, HTML, plain text, and images
- **Optional rulers** for visual guides
- **TypeScript-first** with full type definitions

## Installation

```bash
npm install @productcloudos/editor
```

## Quick Start

```typescript
import { PCEditor } from '@productcloudos/editor';

// Create editor instance
const container = document.getElementById('editor-container');
const editor = new PCEditor(container, {
  pageSize: 'A4',
  pageOrientation: 'portrait',
  units: 'mm',
  showGrid: true
});

// Wait for editor to be ready
editor.on('ready', () => {
  // Set initial text
  editor.setFlowingText('Hello, World!');
});
```

## Configuration Options

```typescript
const editor = new PCEditor(container, {
  pageSize: 'A4',              // 'A4' | 'Letter' | 'Legal' | 'A3'
  pageOrientation: 'portrait', // 'portrait' | 'landscape'
  units: 'mm',                 // 'mm' | 'in' | 'pt' | 'px'
  showGrid: true,              // Show grid overlay
  showRulers: true,            // Show rulers
  showControlCharacters: false, // Show paragraph marks, page breaks
  defaultFont: 'Arial',
  defaultFontSize: 12,
  theme: 'light'               // 'light' | 'dark'
});
```

## Basic Usage

### Text Operations

```typescript
// Set content
editor.setFlowingText('Document content goes here...');

// Get content
const text = editor.getFlowingText();

// Insert text at cursor
editor.insertText('Inserted text');

// Apply formatting to selection
editor.applyTextFormatting(startIndex, endIndex, {
  fontWeight: 'bold',
  color: '#0066cc',
  fontSize: 14
});

// Set paragraph alignment
editor.setAlignment('center'); // 'left' | 'center' | 'right' | 'justify'
```

### Lists

```typescript
// Toggle bullet list
editor.toggleBulletList();

// Toggle numbered list
editor.toggleNumberedList();

// Indent/outdent (also works with Tab/Shift+Tab)
editor.indentParagraph();
editor.outdentParagraph();
```

### Inserting Objects

```typescript
import { ImageObject, TextBoxObject, TableObject } from '@productcloudos/editor';

// Insert image
const image = new ImageObject({
  id: 'img-1',
  textIndex: 0,
  size: { width: 200, height: 150 },
  src: 'data:image/png;base64,...',
  fit: 'contain'  // 'cover' | 'contain' | 'stretch' | 'tile'
});
editor.insertEmbeddedObject(image, 'block');

// Insert table
const table = new TableObject({
  id: 'table-1',
  textIndex: 0,
  size: { width: 400, height: 200 },
  rows: 3,
  columns: 3
});
editor.insertEmbeddedObject(table, 'block');

// Insert text box
const textBox = new TextBoxObject({
  id: 'textbox-1',
  textIndex: 0,
  size: { width: 150, height: 50 }
});
editor.insertEmbeddedObject(textBox, 'inline');
```

### Data Binding

```typescript
// Insert substitution field
editor.insertSubstitutionField('customerName', {
  displayText: 'Customer Name',
  fieldType: 'text'
});

// Insert page number field (for headers/footers)
editor.insertPageNumberField('numeric'); // or 'roman'

// Apply merge data
editor.applyMergeData({
  customerName: 'John Doe',
  invoiceNumber: 'INV-001',
  items: [
    { name: 'Widget', price: 9.99 },
    { name: 'Gadget', price: 19.99 }
  ]
});
```

### Repeating Sections

```typescript
// Create a repeating section for arrays in merge data
editor.createRepeatingSection(startIndex, endIndex, 'items');
```

### Hyperlinks

```typescript
// Insert hyperlink
editor.insertHyperlink('https://example.com', {
  title: 'Example Website'
});

// Update hyperlink
editor.updateHyperlink(hyperlinkId, {
  url: 'https://new-url.com'
});

// Remove hyperlink
editor.removeHyperlink(hyperlinkId);
```

### PDF Export

```typescript
// Export to PDF
const pdfBlob = await editor.exportPDF({
  applyMergeData: true,
  mergeData: { customerName: 'Jane Doe' }
});

// Download the PDF
const url = URL.createObjectURL(pdfBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'document.pdf';
link.click();
URL.revokeObjectURL(url);
```

### PDF Import

```typescript
// Import from file
const result = await editor.importPDF(file, {
  detectTables: true,
  extractImages: true
});

// Import from URL
const result = await editor.importPDF('https://example.com/document.pdf');

// Check for warnings
if (result.warnings.length > 0) {
  console.log('Import warnings:', result.warnings);
}
```

### Save/Load Documents

```typescript
// Save to JSON string
const json = editor.saveDocument();

// Load from JSON string
editor.loadDocumentFromJSON(json);

// Save to file (triggers download)
editor.saveDocumentToFile('my-document.pceditor.json');

// Load from file
await editor.loadDocumentFromFile(file);
```

### Undo/Redo

```typescript
// Undo last action
editor.undo();

// Redo
editor.redo();

// Check availability
if (editor.canUndo()) { /* ... */ }
if (editor.canRedo()) { /* ... */ }
```

### Copy/Paste

```typescript
// Copy selection
await editor.copy();

// Cut selection
await editor.cut();

// Paste from clipboard
await editor.paste();
```

### View Controls

```typescript
// Zoom
editor.zoomIn();
editor.zoomOut();
editor.setZoom(1.5); // 150%
editor.fitToWidth();
editor.fitToPage();

// Toggle features
editor.setShowGrid(true);
editor.setShowControlCharacters(true);
```

## Events

```typescript
// Editor ready
editor.on('ready', () => { /* ... */ });

// Content changed
editor.on('content-changed', (event) => { /* ... */ });

// Selection changed
editor.on('selection-change', (event) => { /* ... */ });

// Cursor position changed
editor.on('cursor-changed', (event) => { /* ... */ });

// Zoom changed
editor.on('zoom-changed', (event) => { /* ... */ });
```

## TypeScript Support

PC Editor is written in TypeScript and provides full type definitions:

```typescript
import {
  PCEditor,
  EditorOptions,
  DocumentData,
  TextFormattingStyle,
  ImageObject,
  TableObject,
  TextBoxObject
} from '@productcloudos/editor';
```

## Documentation

- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)

## Development

### Setup

```bash
git clone https://github.com/ProductCloudOS/editor.git
cd pc-editor
npm install
```

### Development Server

```bash
npm run dev
```

Opens the demo application at http://localhost:5173

### Building

```bash
npm run build
```

Creates:
- `dist/pc-editor.js` - CommonJS build
- `dist/pc-editor.esm.js` - ES module build
- `dist/pc-editor.min.js` - UMD build (minified)
- `dist/types/` - TypeScript declarations

### Testing

```bash
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT - see [LICENSE](./LICENSE) for details.
