# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-07-12

Architectural release. The layout, rendering, hit-testing, and interaction
state subsystems were rebuilt around a single immutable layout structure
(see docs/refactor-v2.md). The persisted document JSON format is unchanged
in both directions.

### Fixed

- Clicking a point on page 2+ no longer selects an object at the same
  in-page coordinates on an earlier page (hit-testing is page-qualified
  end to end; stale per-page state is invalidated on every relayout).
- Text can be added after a table that spans a page boundary: the caret
  binds after the table, clicking a continuation page no longer jumps to
  the document start, and the continuation page is no longer deleted out
  from under the table.
- Tables can span three or more pages (the old layout model could not
  represent this).
- Exported PDFs now include the continuation-page slices of page-spanning
  tables, and text after such tables is positioned to match the canvas;
  both are drawn from the same layout structure as the screen.
- Typing in a table cell is recorded by undo/redo (the cell registration
  path was never wired).
- A text selection left in one section is no longer painted at its old
  offsets when another section is active.

### Changed

- Layout is a pure pass producing an immutable per-page fragment tree;
  the canvas painter and PDF generator both consume it. Pages are added
  and removed synchronously inside the render cycle from the tree's
  derived page count — the event/timeout machinery this replaces
  (text-overflow round-trip, deferred renders, empty-page checks and
  their suppress flags) is deleted.
- Selection and active-section state are derived from the model on demand
  instead of being mirrored by event listeners. A freshly initialised or
  loaded editor reports the caret at position 0 rather than a 'none'
  selection, and getSelectionFormatting() returns the caret's formatting.
- addPage()/removePage() are legacy page-list mutations: the page count is
  re-derived from content on the next render cycle, so an added empty page
  is reconciled away (use insertPageBreak()) and removing a
  content-required page is undone.

### Removed (BREAKING)

- The package no longer exports internal machinery (text model, layout,
  regions, clipboard, PDF-import pipeline classes, EventEmitter,
  Document/Page, and associated types). The supported surface is:
  PCEditor; the options/events/selection/document-format types; the
  embedded-object classes and their config types; content-facing types
  used in PCEditor signatures; the ruler controls; all property-editor
  panes; PDF-import option/result/error types; font-registration types.

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
