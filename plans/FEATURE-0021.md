# FEATURE-0021: Prepare PC Editor as Best Practice Open Source Library

## Status: ✅ COMPLETED

## Implementation Plan

### Executive Summary

This plan outlines the steps to transform PC Editor from a working project into a professionally published open-source npm package. The project already has a solid foundation with:
- Well-structured library code in `/src/lib/`
- Separate demo application in `/src/demo/`
- Dual-format build output (ESM + CJS + UMD)
- TypeScript declarations
- Comprehensive test suite (1837+ tests)
- Existing build infrastructure (Rollup + Vite)

---

## Phase 1: Package Configuration and Metadata (Priority: Critical)

### 1.1 Update package.json for npm Publishing

**Current State:**
- License is "ISC" (should be changed to "MIT" for broader adoption)
- Missing: repository, bugs, homepage URLs
- Missing: exports field (modern Node.js resolution)
- Missing: sideEffects field
- "author" field is empty

**Required Changes:**

```json
{
  "name": "pc-editor",
  "version": "0.1.0",
  "description": "Browser-based WYSIWYG document editor library for PDF generation with data binding",
  "author": "Your Name <email@example.com>",
  "license": "MIT",
  "homepage": "https://github.com/USERNAME/pc-editor#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/USERNAME/pc-editor.git"
  },
  "bugs": {
    "url": "https://github.com/USERNAME/pc-editor/issues"
  },
  "keywords": [
    "wysiwyg",
    "editor",
    "pdf",
    "canvas",
    "typescript",
    "document",
    "layout",
    "data-binding",
    "pdf-generation"
  ],
  "main": "dist/pc-editor.js",
  "module": "dist/pc-editor.esm.js",
  "types": "dist/types/lib/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/types/lib/index.d.ts",
      "import": "./dist/pc-editor.esm.js",
      "require": "./dist/pc-editor.js"
    },
    "./package.json": "./package.json"
  },
  "sideEffects": false,
  "files": [
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

### 1.2 Fix TypeScript Declaration Path

**Issue:** Current `types` field points to `dist/types/index.d.ts` but actual declarations are in `dist/types/lib/index.d.ts`

**Action:** Update to correct path: `"types": "dist/types/lib/index.d.ts"`

---

## Phase 2: License and Legal (Priority: Critical)

### 2.1 Create MIT License File

Create `/LICENSE` file:

```
MIT License

Copyright (c) 2024 [Author Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Phase 3: GitHub Workflows (Priority: High)

### 3.1 CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  type-check:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run type-check

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: false

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Check dist folder
        run: |
          ls -la dist/
          test -f dist/pc-editor.js
          test -f dist/pc-editor.esm.js
          test -f dist/types/lib/index.d.ts
```

### 3.2 npm Publish Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 3.3 Demo Deployment Workflow (Optional - GitHub Pages)

Create `.github/workflows/deploy-demo.yml`:

```yaml
name: Deploy Demo

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build:demo
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dev-dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

---

## Phase 4: README Documentation (Priority: High)

### 4.1 Comprehensive README Structure

Replace current README with professional documentation:

```markdown
# PC Editor

A powerful browser-based WYSIWYG document editor library for creating pixel-perfect documents with data binding and PDF export capabilities.

[![npm version](https://img.shields.io/npm/v/pc-editor.svg)](https://www.npmjs.com/package/pc-editor)
[![CI](https://github.com/USERNAME/pc-editor/workflows/CI/badge.svg)](https://github.com/USERNAME/pc-editor/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Canvas-based rendering for pixel-perfect positioning
- Multi-page document support with automatic content flow
- Text formatting (bold, italic, colors, fonts)
- Bullet and numbered lists with nesting
- Tables with cell merging, borders, and styling
- Images with fit modes (cover, contain, stretch, tile)
- Hyperlinks
- Data binding with substitution fields
- Repeating sections for data-driven content
- PDF generation
- Undo/redo support
- Copy/paste (proprietary format, HTML, plain text, images)
- TypeScript-first with full type definitions

## Installation

\`\`\`bash
npm install pc-editor
\`\`\`

## Quick Start

\`\`\`typescript
import { PCEditor } from 'pc-editor';

// Create editor
const editor = new PCEditor(document.getElementById('editor-container'), {
  pageSize: 'A4',
  pageOrientation: 'portrait',
  units: 'mm',
  showGrid: true
});

// Wait for ready
editor.on('ready', () => {
  // Set initial text
  editor.setFlowingText('Hello, World!');
});
\`\`\`

## Documentation

- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Configuration Options](./docs/configuration.md)
- [Working with Text](./docs/text.md)
- [Tables](./docs/tables.md)
- [Images](./docs/images.md)
- [Data Binding](./docs/data-binding.md)
- [PDF Export](./docs/pdf-export.md)
- [Events](./docs/events.md)

## Basic Usage

### Creating an Editor

\`\`\`typescript
const editor = new PCEditor(container, {
  pageSize: 'A4',            // 'A4' | 'Letter' | 'Legal' | 'A3' | 'Custom'
  pageOrientation: 'portrait', // 'portrait' | 'landscape'
  units: 'mm',               // 'mm' | 'in' | 'pt' | 'px'
  showGrid: true,
  showRulers: true,
  defaultFont: 'Arial',
  defaultFontSize: 12
});
\`\`\`

### Text Operations

\`\`\`typescript
// Set content
editor.setFlowingText('Document content goes here...');

// Apply formatting to selection
const selection = editor.getUnifiedSelection();
if (selection) {
  editor.applyUnifiedFormatting(selection.start, selection.end, {
    fontWeight: 'bold',
    color: '#0066cc'
  });
}

// Set paragraph alignment
editor.setAlignment('center');
\`\`\`

### Inserting Objects

\`\`\`typescript
import { ImageObject, TextBoxObject, TableObject } from 'pc-editor';

// Insert image
const image = new ImageObject({
  source: 'data:image/png;base64,...',
  width: 100,
  height: 100,
  fitMode: 'contain'
});
editor.insertEmbeddedObject(image, 'inline');

// Insert table
const table = new TableObject({ columns: 3, rows: 3 });
editor.insertEmbeddedObject(table, 'block');
\`\`\`

### Data Binding

\`\`\`typescript
// Insert substitution field
editor.insertSubstitutionField('customerName');

// Apply merge data
editor.applyMergeData({
  customerName: 'John Doe',
  invoiceNumber: 'INV-001'
});
\`\`\`

### PDF Export

\`\`\`typescript
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
\`\`\`

### Save/Load Documents

\`\`\`typescript
// Save
const json = editor.saveDocument();

// Load
editor.loadDocumentFromJSON(json);

// File operations
editor.saveDocumentToFile('my-document.pceditor.json');
await editor.loadDocumentFromFile(file);
\`\`\`

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## License

MIT - see [LICENSE](./LICENSE) for details.
```

---

## Phase 5: API Documentation (Priority: Medium)

### 5.1 Documentation Directory Structure

Create `/docs/` directory with:

```
docs/
  api-reference.md      # Full API documentation
  getting-started.md    # Quick start guide
  configuration.md      # All editor options
  text.md              # Text formatting, lists, alignment
  tables.md            # Table creation and manipulation
  images.md            # Image handling
  data-binding.md      # Substitution fields, repeating sections
  pdf-export.md        # PDF generation
  events.md            # Event reference
  typescript.md        # TypeScript integration
  migration.md         # Version migration guides
```

### 5.2 API Reference Content Outline

The API documentation should cover all public methods from PCEditor:

**Core API:**
- `constructor(container, options)`
- `on(event, handler)` / `off(event, handler)`
- `isReady`
- `render()`
- `destroy()`

**Document Operations:**
- `loadDocument(data)` / `saveDocument()`
- `loadDocumentFromJSON(json)` / `saveDocumentToFile(filename)`
- `loadDocumentFromFile(file)`
- `getDocumentMetrics()`
- `updateDocumentSettings(settings)`

**Text Operations:**
- `setFlowingText(text)` / `getFlowingText()`
- `insertText(text)`
- `setCursorPosition(position)` / `getCursorPosition()`
- `applyTextFormatting(start, end, formatting)`
- `getFormattingAt(position)` / `getSelectionFormatting()`
- `setAlignment(alignment)` / `getAlignmentAtCursor()`

**List Operations:**
- `toggleBulletList()` / `toggleNumberedList()`
- `indentParagraph()` / `outdentParagraph()`
- `getListFormatting()`

**Object Operations:**
- `insertEmbeddedObject(object, position)`
- `removeEmbeddedObject(objectId)`
- `getSelectedTextBox()` / `getSelectedImage()` / `getSelectedTable()`

**Data Binding:**
- `insertSubstitutionField(fieldName, config)`
- `insertPageNumberField(displayFormat)`
- `insertPageCountField(displayFormat)`
- `applyMergeData(data)`
- `createRepeatingSection(start, end, fieldPath)`

**Hyperlinks:**
- `insertHyperlink(url, options)`
- `updateHyperlink(id, update)`
- `removeHyperlink(id)`
- `getHyperlinkAt(position)`

**Undo/Redo:**
- `undo()` / `redo()`
- `canUndo()` / `canRedo()`
- `clearUndoHistory()`

**Clipboard:**
- `copy()` / `cut()` / `paste()`

**View Controls:**
- `zoomIn()` / `zoomOut()` / `setZoom(level)` / `getZoomLevel()`
- `fitToWidth()` / `fitToPage()`
- `setShowGrid(show)` / `setShowControlCharacters(show)`

**PDF Export:**
- `exportPDF(options)`

---

## Phase 6: Project Structure Refinements (Priority: Medium)

### 6.1 Current Structure (Already Good)

```
pc-editor/
├── src/
│   ├── lib/           # Library source (published)
│   │   ├── core/      # PCEditor, Document, Page
│   │   ├── text/      # Text handling
│   │   ├── objects/   # Embedded objects
│   │   ├── rendering/ # Canvas and PDF
│   │   ├── clipboard/ # Copy/paste
│   │   ├── controls/  # Optional rulers
│   │   ├── undo/      # Undo/redo system
│   │   └── index.ts   # Public exports
│   ├── demo/          # Demo application (not published)
│   └── test/          # Test files (not published)
├── dist/              # Build output (published)
└── docs/              # Documentation (published)
```

### 6.2 Recommended Additions

- Add `/examples/` directory with standalone examples
- Add `CHANGELOG.md` for version history
- Add `CONTRIBUTING.md` for contribution guidelines
- Add `.npmignore` if finer control needed (already have `files` in package.json)

---

## Phase 7: Additional Files (Priority: Medium)

### 7.1 CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - YYYY-MM-DD

### Added
- Initial public release
- Canvas-based document rendering
- Multi-page support with automatic text flow
- Text formatting (bold, italic, colors, fonts)
- Bullet and numbered lists with nesting
- Tables with cell merging and styling
- Image support with fit modes
- Hyperlinks
- Data binding with substitution fields
- Repeating sections
- PDF export
- Undo/redo system
- Copy/paste support
- Optional ruler controls
```

### 7.2 CONTRIBUTING.md

```markdown
# Contributing to PC Editor

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`
4. Run tests: `npm test`

## Code Style

- Use TypeScript
- Follow existing patterns
- Add tests for new features
- Update documentation

## Pull Request Process

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Reporting Issues

Please use GitHub Issues with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
```

### 7.3 .github/ISSUE_TEMPLATE/

Create issue templates for bugs and features.

---

## Phase 8: Build and Script Updates (Priority: Medium)

### 8.1 Add Helpful npm Scripts

```json
{
  "scripts": {
    "dev": "vite serve src/demo",
    "build": "npm run build:lib && npm run build:types",
    "build:lib": "rollup -c",
    "build:types": "tsc --project tsconfig.lib.json --declaration --emitDeclarationOnly --outDir dist/types",
    "build:demo": "vite build src/demo --outDir ../../dev-dist",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "lint": "eslint src",
    "lint:fix": "eslint src --fix",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui",
    "clean": "rm -rf dist dev-dist coverage",
    "prepublishOnly": "npm run clean && npm run build && npm test",
    "version": "npm run build && git add -A dist",
    "docs:serve": "npx serve docs"
  }
}
```

---

## Phase 9: Testing Considerations (Priority: Low)

### 9.1 Current Test Coverage

The project already has excellent test coverage:
- 1837+ tests across 34+ test files
- API-level tests in `/src/test/api/`
- Unit tests in `/src/test/unit/`
- Many components at 95-100% coverage

### 9.2 Additional Tests for Publishing

Consider adding:
- Integration tests for import/export
- Bundle size tests
- TypeScript compilation tests (ensure types work in projects)

---

## Implementation Priority Order

1. **Critical (Do First):**
   - Update `package.json` with correct metadata and `exports` field
   - Create `LICENSE` file with MIT license
   - Fix `types` path in package.json

2. **High (Do Second):**
   - Create `.github/workflows/ci.yml`
   - Create `.github/workflows/publish.yml`
   - Rewrite `README.md` with comprehensive documentation

3. **Medium (Do Third):**
   - Create `/docs/` directory with API documentation
   - Create `CHANGELOG.md`
   - Create `CONTRIBUTING.md`
   - Optionally set up demo deployment workflow

4. **Low (Do Last):**
   - Add examples directory
   - Add issue templates
   - Consider badges for README

---

## Pre-Publish Checklist

Before running `npm publish`:

- [ ] Version number updated in package.json
- [ ] CHANGELOG.md updated with changes
- [ ] README.md is accurate
- [ ] LICENSE file exists
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Type declarations are correct
- [ ] No secrets in codebase
- [ ] Repository URLs correct in package.json
- [ ] Keywords are relevant
- [ ] npm account has 2FA enabled
- [ ] NPM_TOKEN secret added to GitHub repository

---

## Files to Modify/Create

| File | Action | Priority |
|------|--------|----------|
| `package.json` | Update metadata, exports, types path | Critical |
| `LICENSE` | Create MIT license | Critical |
| `.github/workflows/ci.yml` | Create CI workflow | High |
| `.github/workflows/publish.yml` | Create publish workflow | High |
| `README.md` | Complete rewrite | High |
| `docs/` directory | Create documentation files | Medium |
| `CHANGELOG.md` | Create | Medium |
| `CONTRIBUTING.md` | Create | Medium |
| `.github/workflows/deploy-demo.yml` | Create (optional) | Low |
| `.github/ISSUE_TEMPLATE/` | Create templates | Low |
