# PC Editor TODO List

## Defects

(none)

## New Features
- [ ] FEATURE-0009 Undo/Redo functionality
- [ ] FEATURE-0011 Additional selection logic such as double-click to select a word, shift and mouse down, select all, Click/drag to select across pages, etc
- [ ] FEATURE-0013 Need support for nested bullet points in text
- [ ] FEATURE-0014 Need support for hyperlinks
- [ ] FEATURE-0015 Additional controls in the editor that are optional components of the library but that work with the editor via the editor API only (no bypass).  Start with x and y rulers that can connect to the editor canvas
- [ ] FEATURE-0016 Fix the handling of text immediately before and after block objects as they do not justify or page split properly
- [x] FEATURE-0017 Unit tests at the editor API level to ensure that the editor is operating as expected
- [x] FEATURE-0018 Low level unit tests to achieve 95% code coverage
- [ ] FEATURE-0019 Copy/Paste.  Should support proprietary format that covers all editor capability as well as plain text and rich text.  Also need to support paste of a png image

### Performance & Polish
- [ ] **Optimize rendering performance**
  - Implement dirty rectangle rendering for large documents
  - Canvas caching for static content
  - Viewport-based rendering for very large documents

- [ ] **Add accessibility features**
  - Keyboard navigation for canvas elements
  - Screen reader announcements for state changes
  - High contrast mode support

### Code Quality
- [ ] **Remove debug logging**
  - Clean up console.log statements added during development
  - Implement proper logging framework if needed
  - Add debug mode toggle for development

- [ ] **Type safety improvements**
  - Add stricter TypeScript configuration
  - Remove any types where possible
  - Add comprehensive interface definitions

- [ ] **Error handling**
  - Add try/catch blocks for critical operations
  - User-friendly error messages
  - Graceful degradation for unsupported features

### Performance
- [ ] **Memory management**
  - Proper cleanup of event listeners
  - Canvas context optimization
  - Large document handling improvements

- [ ] **Code organization**
  - Split large files into smaller modules
  - Improve separation of concerns
  - Reduce circular dependencies

## Completed Recently ✅

- ✅ FEATURE-0018 Low-Level Unit Tests - Implemented comprehensive unit test suite achieving significant code coverage. Added 1537 tests across 34 test files covering: EventEmitter, TextState, TextFormatting, ParagraphFormatting, EmbeddedObjectManager, SubstitutionFieldManager, TextLayout, TransactionManager, BaseEmbeddedObject, FocusTracker, Page, Document, DataBinder, TextBoxObject, ImageObject, MutationUndo, TextMutationObserver, EmbeddedObjectFactory, HitTestManager, ContentDiscovery, ObjectMutationObserver, TableCell, TableRow, and FlowingTextContent. Many core components at 100% coverage.
- ✅ FEATURE-0017 Unit Tests at Editor API Level - Implemented comprehensive unit test suite using Vitest with jsdom. Added 300 tests across 10 test files covering: initialization, document management (save/load), text operations, text formatting, substitution fields, embedded objects, table operations, undo/redo, document settings, and events. Includes canvas mocking, test helpers, and document fixtures for testing.
- ✅ BUG-0025 Table Page Splitting - Fixed page splitting when first row intersects page border. Tables now move entirely to next page if no data rows can fit (headers don't count since they repeat). Added getFirstDataRowHeight() method and updated pagination logic to check if at least one data row fits before splitting.
- ✅ BUG-0024 Substitution Field Formatting - Substitution fields now inherit text formatting from cursor position when inserted. Added formatting to SubstitutionFieldConfig and updated insertSubstitutionField() to pass cursor formatting.
- ✅ BUG-0023 Serialization Format Optimization - Formatting runs now only output when format changes, reducing document size. Updated toData() to detect format changes and fromData()/loadFromData() to expand runs to ranges.
- ✅ BUG-0022 PDF Export Document Restoration - PDF export now saves document state before merge and restores it after generation using finally block, keeping original document intact in editor.
- ✅ FEATURE-0007 Different Positioning of Objects - Added block and relative positioning modes for embedded objects. Block objects appear as standalone paragraphs with dedicated lines. Relative objects can be freely positioned with offset from anchor point in text flow (anchor symbol ⚓ shown when control characters visible). Tables only support block positioning. Added position dropdowns to Image Settings and Text Box panes. Relative objects can be dragged to update offset. Move cursor on hover, selection-change events after drag, arrow key deselection of selected objects.
- ✅ FEATURE-0006 Enhanced Image Object - Added ImageResizeMode type ('free' | 'locked-aspect-ratio') and 'tile' fit mode. ImageObject now supports resizeMode property, tiled rendering, and setSource() method for changing images. Added getSelectedImage() to PCEditor. Demo has Image Settings pane with fit mode, resize mode, alt text, and file picker for changing images. PDF export now embeds actual images (JPG/PNG) from base64 data URLs with proper fit mode handling.
- ✅ FEATURE-0012 Page Breaks Support - Implemented Ctrl+Enter to insert page breaks. Visual indicator shows dashed line with "Page Break" label when control characters visible, or subtle single-pixel rule otherwise. Pagination logic forces page break when `endsWithPageBreak` is set. PDF export filters page break character. Demo has "Page Break" button in Structure toolbar.
- ✅ FEATURE-0010 Serialization/Deserialization - Implemented complete document save/load functionality. Added FlowingTextContent.toData()/fromData()/loadFromData() methods for serializing all content including text, formatting, substitution fields, repeating sections, and embedded objects. Updated Document.toData() to include full content serialization. Added PCEditor.saveDocument(), saveDocumentToFile(), loadDocumentFromJSON(), loadDocumentFromFile() API methods. Demo has Save/Load buttons in toolbar. File format is .pceditor.json with full round-trip fidelity.
- ✅ FEATURE-0008 PDF Generation - Implemented PDF export that renders document content identically to canvas without UI elements (cursor, selection, control characters, grid, resize handles, loop indicators). Supports text with formatting, tables with multi-page support and header repetition, text boxes with borders, substitution fields. Demo applies merge data before export. Uses pdf-lib with standard fonts (Helvetica, Times, Courier).
- ✅ BUG-0021 Multi-Page Table Text Click - Fixed click detection in handleMouseDown/handleClick to use slice position and height for tables via getRenderedSlice(pageIndex), preventing clicks on text after table slice from selecting the table.
- ✅ BUG-0018 Multi-Page Table Edit Mode - Fixed double-click handling and cell click detection for tables crossing page boundaries by storing slice info (yOffset, headerHeight) and using correct coordinate transformation for continuation pages.
- ✅ BUG-0020 Object Page Wrapping - Fixed pagination logic in TextLayout.ts to only treat tables as splittable; images and text boxes now wrap to next page when they don't fit.
- ✅ BUG-0019 Table Continuation with Trailing Content - Added `renderTableContinuationsAtPosition` method in FlowingTextRenderer to render table continuations before text content on subsequent pages.
- ✅ BUG-0016 Object Deselection After Resize - Added `wasResizing` flag in CanvasManager to skip click handler after resize completes, preventing object deselection.
- ✅ BUG-0017 Table Resize Handle Appearance - Fixed resize handle colors in FlowingTextRenderer to match text box handles (filled blue with white stroke).
- ✅ FEATURE-0004 Multi-Page Tables - Tables now properly span multiple pages with header rows replicated at the top of each continuation page. Fixed layout timing to ensure row heights are calculated before page split decisions. Added merged cell handling at page boundaries to keep spanned regions together. Added `renderedPageIndex` to TableCell for multi-page hit detection.
- ✅ FEATURE-0003 Table Pane - Added a table pane on the right sidebar that appears when a table is selected. Supports column/row addition/deletion, cell merging/splitting, cell background color, border styling, header row/column configuration with count settings, and header styling. Added header column support to TableObject. Bug fixes: header count changes now reapply formatting, border removal works correctly, padding changes resize table, new cells copy formatting from current cell, adding rows/columns extends merged cell spans, merged cells use full span width for text wrapping, table pane updates cell formatting on selection change.
- ✅ BUG-0015 Page 2 Cursor/Selection - Fixed cursor position calculation, text index lookup, cursor visibility check, flowed lines retrieval to all use correct page index; added renderedPageIndex to embedded objects for correct hit detection
- ✅ FEATURE-0005 Page Number Field - Added page number and page count fields that display actual values in headers/footers across all pages
- ✅ FEATURE-0002 Support the ability to add a loop to rows in a table. Table row loops are expanded during merge just like text repeating sections.
- ✅ FEATURE-0001 Remove the 'regular' elements from the project entirely, including all support for them in the demo app
- ✅ BUG-0019 Multi-Page Loop Indicators - Fixed vertical connector lines and horizontal continuation lines rendering across page boundaries. Simplified overlap detection and fixed sections retrieval to use first page's flowingContent for all pages.
- ✅ BUG-0018 Pending Formatting - Implemented pending formatting for cursor-only state. Formatting applied with no selection now affects next typed characters. Inherits from surrounding text when no pending formatting exists.
- ✅ BUG-0021 Header/Body Logic Unification - Unified header/footer rendering to use renderRegion, added section detection to handleClick, fixed cursor-changed event to update active section
- ✅ BUG-0020 Field Selection in Header - Fixed by unifying header rendering through renderRegion which correctly gets cursor position from region's FlowingTextContent
- ✅ BUG-0017 Header Field/Object Deselection - Fixed by adding section detection in handleClick and updating active section before processing clicks
- ✅ BUG-0016 Escape Returns Focus - Added focus return to parent FlowingTextContent when Escape exits editing or clears selection
- ✅ BUG-0003 Header Text Box Resize - Fixed getResizeHandleAt and resize handling to check all flowing content sources (body, header, footer)
- ✅ BUG-0014 Table Resize - Changed set size override to only adjust last column/row instead of proportional distribution
- ✅ BUG-0015 Internal Divider Resize - Modified TableResizeHandler to adjust both adjacent columns/rows inversely, keeping total table size constant
- ✅ BUG-0013 Merge Data in Tables/Text Boxes - Added substituteFieldsInEmbeddedObjects() to process fields in embedded objects
- ✅ BUG-0011 Selection Blocking Object Click - Moved element/embedded object checks before text selection early-return in handleClick
- ✅ BUG-0012 Table Cell Formatting Pane Update - Added tablecell-cursor-changed event for clicks and keyboard navigation
- ✅ BUG-0007 Field Insertion in Table Cells - Updated insertSubstitutionField/insertEmbeddedObject to use getEditingFlowingContent()
- ✅ BUG-0008 Table Cell Font Formatting - Added content-changed event emission to applyFormatting() to trigger table cell reflow
- ✅ BUG-0010 Table Cell Drag Selection Sensitivity - Added minimum drag distance threshold before cell range selection activates
- ✅ BUG-0009 Table Cell Selection Clearing - Added clearSelection() call when navigating between table cells
- ✅ BUG-0004 Table Cell Text Selection - Added text selection mode for click and drag within focused table cells
- ✅ BUG-0005 Table Cell Shift+Arrow Selection - Added shift key handling to table cell vertical navigation for text selection
- ✅ BUG-0006 Text Box Formatting Pane - Fixed selection-change handler to keep formatting pane visible when a text box is being edited
- ✅ BUG-0001 Selection Clearing on Editor blur - Added cursor suspend/resume and focus event handler to preserve selection when editor loses browser focus
- ✅ BUG-0002 Table Last Row/Column Resize - Added size setter override to TableObject to redistribute size proportionally among all columns/rows
- ✅ Fixed broken selection system affecting all elements
- ✅ Restored resize handle visibility for regular elements  
- ✅ Fixed inline element click detection and event handling
- ✅ Resolved multiple text reflows clearing inline selection state
- ✅ Implemented form-based margin controls (removed dragging)
- ✅ Added comprehensive inline element system within text flow
- ✅ Fixed cursor position alignment with actual text position
- ✅ Implemented automatic page creation/removal for text overflow
- ✅ Added newline support for Enter key in flowing text
- ✅ Built complete multi-page document system with text reflow

