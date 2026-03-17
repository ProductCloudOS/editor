# Open Items

* T45 Embedded objects, like images, text boxes and tables do not work properly in the header and footer.  Click events do not work properly, using relative positioning doesn't allow for movement, etc

# Closed Items

* T01 When a text box is double clicked it isn't edited
* T02 When an image is added and a PDF is created the image does not show
* T03 The generated files are too large.  It appears that the format for every character is exported.  It should be that the format is only added when sonecutive characters are not the same format
* T04 All of the formatting panes should have a zero width column on the right that expands to fill open space so that as the format expands horizontally the columns continue to fit their appropriate width
* T05 In Document Settings pane the following changes need to be made:
  * Margin controls should be in five columns (label, edit, label, edit, stretch)
  * Labels should be right aligned and have a colon appended
  * The Apply Margins button should be removed.  Margin should be applied when one of the edit controls lose focus
* T06 Logging should be abled to be turned on or off when the editor control is enabled.  If disabled only errors are logged to console.  If turned on then other log messages indicating what is happening should be enabled
* T07 Add logging for all internal editor API calls that show if logging is on
* T08 Define an optimal width for the format panes (the same width for all panes) and make this the minimum width
* T09 Modify combo dropdown fields in the format panes so they don't expand horizontally infinitely.  Give them a reasonable max width that allows strecth beyond the minimum pane width but not too much
* T10 For the Document Settings pane, labels should be right aligned with a colon suffix and value items should be left aligned with appropriate padding between labels and values.  Also there should be a stretch column on the right so the columns take only needed space
* T11 In the view menu of the demo app add a menu item to toggle console logging on and off (default should be off in the editor but the demo app should turn it on by default)
* T12 Add a menu item to the demo app view menu to should open a modal.  When the modal is opened the following should happen:
  * The current document should be exported and the byte count of the resulting JSON file should be displayed in the modal as "First export size"
  * This exported JSON should then imported into the editor
  * An export from the editor should be done again and the byte count of the resulting JSON file should be displayed in the modal as "Second export size"
  * Also should a difference count (ie. how many bytes different are the first and second exports)
* T13 WHen a table is added to a document and the document is exported the exported file is much larger then needed.  It is possible that the text inside a table has too many formatting objects applied.  The exported size of table (and a text box) needs to be minimised
* T14 It was previously possible to add a repeating section to rows in a table but that no longer seems possible
* T15 For the Document Info pane, labels should be right aligned with a colon suffix and value items should be left aligned with appropriate padding between labels and values.  Also there should be a stretch column on the right so the columns take only needed space
* T16 In the demo app, turning off logging for the editor should also turn of logging for the demo app
* T17 Demo app logs should be clearly identified so that they are not confused with logs from the editor itself. Logs from the editor should be consistently prefixed for identification purposes
* T18 The table formatting pane needs to have the ability to merge cells when multiple cells are selected and to demerge cells if a single merged cell is selected
* T19 On a browser on a windows machine the mouse cursor goes blank for some reaspon when hovering over the editor canvas.  Doesn't happen on a mac
* T20 On a two page document with multiple tables, selecting a table on the second page selects the table on the first page if the coords overlap.  The table on the second page is fine until the coords overlap in which case the table on the first page is erroneously selected
* T21 If the bullet format is applied to text and then removed then the button in the format pane stays enabled
* T22 The create row loop section of the table pane should be removed
* T23 In the demo app, make the minimum size of the resizable left pane the same width as the minimum size of the pane
* T24 In the demo app, when the left pane is resized showed the width in the status bar at the bottom
* T25 WHen editing text in a table or text box and the bullet/indent buttons are clicked the formatting is applied to the paragraph containing the embedded object rather than the text flow within the text box or table cell
* T26 Rearrange the colour picking controls in the format pane.  It should be "Text:" followed by the text colour picker on one row and "Highlight:"" followed by the highlight colour picker and the clear button on the next row.  The labels should be right aligned in a common column
* T27 The editor needs to be able to support other fonts.  The external application should be able to load fonts into the editor via the editor API.  The API should also allow for the retrieval of available fonts with the built in fonts being the default list
* T28 New fonts should be able to be embedded in any exported PDFs that use them
* T29 The demo app should load some additional open google fonts on load
* T30 In the text box pane:
  * All labels should have the colon as a suffix
  * The type label and control should be on the same row
  * The background colour label and control should be on the same row
  * The border style label and control should be on the same row
  * The padding label and control should be on the same row
  * There shouold be no apply button.  All controls should change the format immediately when the control loses focus
* T31 When a block of text is selected (either in the text flow, text box or table cell), and a paragraph format is applied (like indent, bullets, or alignment), the format should be applied to all of the paragraphgs included in the selection (even if only partially included)
* T32 All of the labels that have a control after them, in all of the panes, should have a colon as a suffix
* T33 The padding setting in the text box pane for the text box control doesn't seem to do anything
* T34 In the format pane put the font family and font size controls on the same row as their labels.  Also the two labels should be in the same column and right aligned
* T35 The buttons in the View pane do not wrap at the minimum width
* T36 The demo app should not allow the left pane to be sized less than the min width
* T37 For the demo round trip test add an additional test that does a checksum of the two export versions to make sure the actual content is the same.  The modal should show only if the checksum matches or differs
* T38 Adding a repeating section in a table sometimes fails.  if I select some cells in a table and choose the repeating section menu item nothing happens (no logs).  if, however, I have already added a repeating section the repeating section is added to the table
* T39 The marker of a repeating section on table rows should match the look and feel of a repeating section across text flow content (should say loop and be selectable)
* T40 If a repeating section is not selected the repeating section pane still appears
* T41 the repeating section pane should match the colour of the other panes
* T42 When a repeating section is applied to a table it only gets applied to a single row.  It should be applied to all rows in the cell selection range
* T43 The repeating section display for table rows is different to the repeating sections for text blocks.  Specifically:
  * The colour is slightly different
  * The Loop label is a different size and is filled instead of outlined
  * The loop label is not selectable so the repeating section pane is never shown
* T44 Need to implement a conditional section.  A conditional section is like a repeating section except that instead of being conditional on an array field in the data that the section loops through it has a boolean predicate.  On merge, if the predicate is true then the content is shown, else it is not shown.  Conditional sections should also:
  * Have a format pane like repeating sections that is only shown if needed
  * Should be Orange instead of purple in colour
  * Should be applicable to text flow content and table rows like repeating sections
  * SHould not be able to cross repeating sections but can occur inside repeating sections or have repeating sections inside a conditional section
  * The predicate should be a free form text field but needs it's own executable syntax suitable for executing on the merge data
  * The execution context of a conditional section should align to repeating sections.  Fields should be referred to in the schema with dot notation (field1.field2.field2).  if field 2 is an array then the first element is assumed unless in a repeating section 