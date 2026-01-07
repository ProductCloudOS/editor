# PC Editor

A browser-based WYSIWYG editor library for creating pixel-perfect documents with data binding and PDF export capabilities.

## Features

- 🎨 Canvas-based rendering for pixel-perfect positioning
- 📄 Multi-page document support with automatic content flow
- 🔧 Framework-agnostic vanilla TypeScript implementation
- 📊 JSON data binding with placeholders
- 📑 PDF generation using pdf-lib
- 🖼️ Support for text, images, and custom elements
- 🔍 Zoom controls and grid alignment
- 💾 Serializable document format

## Installation

```bash
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

This will open the test harness application where you can interact with the editor.

## Building the Library

Build the library for distribution:

```bash
npm run build
```

This creates:
- `dist/pc-editor.js` - CommonJS build
- `dist/pc-editor.esm.js` - ES module build
- `dist/pc-editor.min.js` - UMD build (minified)
- `dist/types/` - TypeScript declarations

## Usage

```typescript
import { PCEditor } from 'pc-editor';

// Initialize the editor
const editor = new PCEditor(document.getElementById('editor-container'), {
  pageSize: 'A4',
  units: 'mm',
  showGrid: true
});

// Load a document
editor.loadDocument({
  version: '1.0.0',
  pages: [{
    id: 'page_1',
    header: { elements: [] },
    content: { elements: [] },
    footer: { elements: [] }
  }]
});

// Bind data
editor.bindData({
  customerName: 'John Doe',
  invoiceNumber: 'INV-2024-001'
});

// Export to PDF
const pdfBlob = await editor.exportPDF();
```

## API Reference

### PCEditor

The main editor class.

#### Constructor
```typescript
new PCEditor(container: HTMLElement, options?: EditorOptions)
```

#### Methods
- `loadDocument(document: DocumentData): void` - Load a document
- `getDocument(): DocumentData` - Get current document data
- `bindData(data: DataBindingContext): void` - Bind data to placeholders
- `exportPDF(options?: PDFExportOptions): Promise<Blob>` - Export as PDF
- `addElement(element: ElementData, pageId?: string): void` - Add element
- `removeElement(elementId: string): void` - Remove element
- `on(event: string, handler: Function): void` - Add event listener

#### Events
- `ready` - Editor initialized
- `document-change` - Document modified
- `selection-change` - Selection changed
- `error` - Error occurred

## Development Roadmap

### Completed
- ✅ Project setup and build configuration
- ✅ Core library architecture
- ✅ Basic document structure
- ✅ Event system
- ✅ Test harness application

### In Progress
- 🚧 Canvas rendering system
- 🚧 Element implementations (Text, Image, Placeholder)
- 🚧 Layout engine with multi-page flow
- 🚧 Data binding system
- 🚧 PDF generation

### Planned
- 📋 Undo/redo functionality
- 📋 Copy/paste support
- 📋 Advanced text formatting
- 📋 Table elements
- 📋 Shape drawing tools
- 📋 Template system

## License

ISC