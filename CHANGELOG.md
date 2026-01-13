# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-01-13

### Added

- **Core Editor**
  - Canvas-based WYSIWYG document editor
  - Multi-page document support with automatic page creation
  - Configurable page sizes (A4, Letter, Legal, A3) and orientations
  - Zoom controls (zoom in/out, fit to page, fit to width)
  - Grid overlay for design assistance
  - Undo/redo with full transaction support

- **Text System**
  - Flowing text content with automatic wrapping across pages
  - Rich text formatting (bold, italic, underline, strikethrough)
  - Font family, size, and color customization
  - Paragraph alignment (left, center, right, justify)
  - Line height and paragraph spacing controls
  - Bullet and numbered lists with nesting up to 8 levels
  - Tab and shift+tab for list indentation

- **Tables**
  - Table insertion with configurable rows and columns
  - Cell merging (horizontal and vertical)
  - Cell borders and background colors
  - Multi-page table support with automatic row splitting
  - Table properties panel for editing

- **Images**
  - Image insertion from files or URLs
  - Fit modes: cover, contain, stretch, tile
  - Resize handles for interactive sizing

- **Text Boxes**
  - Inline and block text box insertion
  - Independent text formatting within boxes

- **Hyperlinks**
  - Hyperlink insertion with URL and title
  - Customizable link styling
  - Click handling for navigation

- **Data Binding**
  - Substitution fields for dynamic content
  - Page number fields (numeric and roman numerals)
  - Repeating sections for array data
  - Merge data application

- **PDF Export**
  - Full document export to PDF
  - Text formatting preservation
  - Image embedding
  - Table rendering
  - Hyperlink support

- **PDF Import**
  - Import existing PDFs to editable documents
  - Text extraction with formatting detection
  - Table detection (optional)
  - Image extraction (optional)

- **Copy/Paste**
  - Proprietary format for full fidelity
  - HTML format support
  - Plain text fallback
  - Image paste support

- **Document Serialization**
  - JSON-based document format
  - Save/load to files
  - Full round-trip fidelity

- **TypeScript Support**
  - Full type definitions
  - Strict type checking
  - Exported types for consumers

### Developer Experience

- ESM and CommonJS builds
- UMD build for script tag usage
- Comprehensive API documentation
- Demo application for testing

[Unreleased]: https://github.com/nickmitchko/pc-editor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nickmitchko/pc-editor/releases/tag/v0.1.0
