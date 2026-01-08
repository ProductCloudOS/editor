# PC Editor TODO List

## Defects

(No open defects)

## New Features

- [ ] FEATURE-0001 Remove the 'regular' elements from the project entirely, including all support for them in the demo app
- [ ] FEATURE-0002 Support the ability to add a loop to rows in a table.  Only rows and not columns needs to be supported.  A loop in a table should replicate the rows during a merge just like text is replicated normally
- [ ] FEATURE-0003 Add a table pane on the right that appears when a table is selected that supports: column/row addition, column/row deletion, cell merging, cell background, borders, header row or column, how many header rows/columns different format for headers vs normal  
- [ ] FEATURE-0004 Tables need to span multiple pages and have the headers replicate at the top of each page that the table crosses over
- [ ] FEATURE-0005 Add a 'page number' field.  This will act list a substitution field but, instead of being replaced by text when data is merged, it should be replaced by the page number when the document is rendered to PDF
- [ ] FEATURE-0006 Implement the image object properly.  When an image is created it should have the image data passed in, in an appropriate format, when it is created.  The client (in our case the demo) is responsible for getting the data in the first place.  A formatting pane (like the text box pane) supporting how the image resizes (freely, locked aspect ration, tiled) and giving the option to change the image should also be created
- [ ] FEATURE-0007 Different positioning of objects
- [ ] FEATURE-0008 Implement the PDF Generation function such that it looks identical to the canvas but without control characters, selection marks, cursors, grids, loops or any other operational render.  Also, the demo app should automatically apply data merge prior to creating the PDF.  This should be in the control of the client application though and not the editor
- [ ] FEATURE-0009 Undo/Redo functionality
- [ ] FEATURE-0010 Serialisation/Deserialise of document contents

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

