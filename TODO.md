# Open Items

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
