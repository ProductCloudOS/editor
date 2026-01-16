import { PCEditor, DocumentData, ImageObject, TextBoxObject, TableObject, EditorSelection, EditingSection, HorizontalRuler, VerticalRuler } from '../lib';

// Import library panes
import {
  FormattingPane,
  TextBoxPane,
  ImagePane,
  TablePane,
  SubstitutionFieldPane,
  RepeatingSectionPane,
  TableRowLoopPane,
  HyperlinkPane,
  DocumentInfoPane,
  DocumentSettingsPane,
  ViewSettingsPane,
  MergeDataPane
} from '../lib/panes';

// Import panes CSS
import '../lib/panes/panes.css';

let editor: PCEditor;
let horizontalRuler: HorizontalRuler | null = null;
let verticalRuler: VerticalRuler | null = null;

// Library pane instances
let formattingPane: FormattingPane | null = null;
let textBoxPane: TextBoxPane | null = null;
let imagePane: ImagePane | null = null;
let tablePane: TablePane | null = null;
let fieldPane: SubstitutionFieldPane | null = null;
let loopPane: RepeatingSectionPane | null = null;
let tableRowLoopPane: TableRowLoopPane | null = null;
let hyperlinkPane: HyperlinkPane | null = null;
let documentInfoPane: DocumentInfoPane | null = null;
let documentSettingsPane: DocumentSettingsPane | null = null;
let viewSettingsPane: ViewSettingsPane | null = null;
let mergeDataPane: MergeDataPane | null = null;

function initializeEditor(): void {
  const container = document.getElementById('editor');
  if (!container) {
    console.error('Editor container not found');
    return;
  }

  editor = new PCEditor(container, {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    units: 'mm',
    showGrid: true,
    showRulers: true
  });

  // Set up logging for all editor events
  setupEditorEventLogging();

  editor.on('ready', () => {
    console.log('[Editor Event] ready');
    // Insert a welcome message with demo content
    insertWelcomeContent();
    loadDocumentSettings();
    initializeRulers();
    initializeLibraryPanes();
    updateStatus('Editor initialized');
  });
}

function setupEditorEventLogging(): void {
  // Selection change - unified event for cursor, text selection, element selection, and repeating section selection
  // NOTE: Library panes handle their own show/hide/update via editor events.
  // This handler now just logs and updates status bar.
  editor.on('selection-change', (event: { selection: EditorSelection }) => {
    const selection = event.selection;

    // Check if a substitution field is selected
    const selectedField = editor.getSelectedField();

    // Handle repeating section selection
    if (selection.type === 'repeating-section') {
      console.log(`[Editor Event] selection-change: repeating section selected: ${selection.sectionId}`);
      const section = editor.getRepeatingSection(selection.sectionId);
      if (section) {
        updateStatus(`Loop "${section.fieldPath}" selected`);
      }
      return;
    }

    // Check if a table is selected or focused (for table toolbar, not pane)
    const selectedTable = editor.getSelectedTable?.() || editor.getFocusedTable?.();
    updateTableTools(selectedTable);

    if (selection.type === 'cursor') {
      console.log(`[Editor Event] selection-change: cursor at position ${selection.position}`);
      if (selectedField) {
        updateStatus(`Field "${selectedField.fieldName}" selected`);
      } else {
        updateStatus(`Cursor at position ${selection.position}`);
      }
    } else if (selection.type === 'text') {
      console.log(`[Editor Event] selection-change: text selection from ${selection.start} to ${selection.end}`);
      if (selectedField) {
        updateStatus(`Field "${selectedField.fieldName}" selected`);
      } else {
        updateStatus(`Text selected: ${selection.end - selection.start} characters`);
      }
    } else {
      console.log('[Editor Event] selection-change: no selection');
    }
  });

  // Error events
  editor.on('error', (event: any) => {
    console.error('[Editor Event] error:', event.error);
    updateStatus(`Error: ${event.error?.message || 'Unknown error'}`, 'error');
  });

  // Document events
  editor.on('document-change', (event: any) => {
    console.log('[Editor Event] document-change', event);
    updateDocumentInfo();
  });

  editor.on('document-loaded', (event: any) => {
    console.log('[Editor Event] document-loaded', event);
  });

  // Undo/Redo state change
  editor.on('undo-state-changed', (event: { canUndo: boolean; canRedo: boolean }) => {
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
    const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement | null;
    if (undoBtn) undoBtn.disabled = !event.canUndo;
    if (redoBtn) redoBtn.disabled = !event.canRedo;
  });

  // Page events
  editor.on('page-added', (event: any) => {
    console.log('[Editor Event] page-added', event);
    updateStatus('New page created');
    updateDocumentInfo();
  });

  editor.on('page-break-created', (event: any) => {
    console.log('[Editor Event] page-break-created', event);
  });

  // Element events
  editor.on('element-added', (event: any) => {
    console.log('[Editor Event] element-added', event);
  });

  editor.on('element-removed', (event: any) => {
    console.log('[Editor Event] element-removed', event);
  });

  editor.on('embedded-object-added', (event: any) => {
    console.log('[Editor Event] embedded-object-added', event);
    updateStatus(`Embedded ${event.object?.objectType || 'object'} added`);
    updateDocumentInfo();
  });

  editor.on('substitution-field-added', (event: any) => {
    console.log('[Editor Event] substitution-field-added', event);
    updateStatus(`Field "${event.field?.fieldName || 'unknown'}" added`);
    updateDocumentInfo();
  });

  // Unified text editing events
  // NOTE: Library panes (FormattingPane, TextBoxPane) handle their own show/hide
  editor.on('text-editing-started', (event: { source: 'body' | 'textbox' | 'tablecell' }) => {
    console.log('[Editor Event] text-editing-started', event);

    switch (event.source) {
      case 'body':
        updateStatus('Editing document body');
        break;
      case 'textbox':
        updateStatus('Editing text box');
        break;
      case 'tablecell':
        updateStatus('Editing table cell');
        break;
    }
  });

  editor.on('text-editing-ended', (event: { source: 'body' | 'textbox' | 'tablecell' | null }) => {
    console.log('[Editor Event] text-editing-ended', event);
  });

  // Legacy text box editing events (for backwards compatibility)
  editor.on('textbox-editing-started', (event: any) => {
    console.log('[Editor Event] textbox-editing-started', event);
  });

  editor.on('textbox-editing-ended', () => {
    console.log('[Editor Event] textbox-editing-ended');
  });

  editor.on('textbox-cursor-changed', () => {
    // Library FormattingPane handles this
    console.log('[Editor Event] textbox-cursor-changed');
  });

  editor.on('tablecell-cursor-changed', () => {
    // Library FormattingPane and TablePane handle this
    console.log('[Editor Event] tablecell-cursor-changed');
  });

  // Text events
  editor.on('text-clicked', (event: any) => {
    console.log('[Editor Event] text-clicked', event);
    updateStatus('Text cursor active - use toolbar to insert content');
  });

  editor.on('cursor-changed', (event: any) => {
    console.log('[Editor Event] cursor-changed', event);
  });

  // Layout events
  editor.on('layout-complete', (event: any) => {
    console.log('[Editor Event] layout-complete', event);
  });

  // Zoom events
  editor.on('zoom-change', (event: any) => {
    console.log('[Editor Event] zoom-change', event);
    updateZoomLevel(event.zoom);
  });

  // Merge data events
  editor.on('merge-data-applied', (event: any) => {
    console.log('[Editor Event] merge-data-applied', event);
  });

  // Repeating section events
  editor.on('repeating-section-added', (event: any) => {
    console.log('[Editor Event] repeating-section-added', event);
    updateStatus('Loop created');
  });

  editor.on('repeating-section-removed', (event: any) => {
    console.log('[Editor Event] repeating-section-removed', event);
    updateStatus('Loop removed');
  });

  // Section focus changed (header/body/footer)
  editor.on('section-focus-changed', (event: { section: EditingSection; previousSection: EditingSection }) => {
    console.log(`[Editor Event] section-focus-changed: ${event.previousSection} -> ${event.section}`);
    updateSectionIndicator(event.section);
    updateStatus(`Editing ${event.section}`);
  });
}

function setupMenuBar(): void {
  const menuItems = document.querySelectorAll('.menu-item');
  let openMenu: Element | null = null;

  // Handle menu trigger clicks
  menuItems.forEach(item => {
    const trigger = item.querySelector('.menu-trigger');
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.classList.contains('open')) {
        item.classList.remove('open');
        openMenu = null;
      } else {
        menuItems.forEach(m => m.classList.remove('open'));
        item.classList.add('open');
        openMenu = item;
      }
    });

    // Hover to switch menus when one is already open
    item.addEventListener('mouseenter', () => {
      if (openMenu && openMenu !== item) {
        openMenu.classList.remove('open');
        item.classList.add('open');
        openMenu = item;
      }
    });
  });

  // Close menus when clicking outside
  document.addEventListener('click', () => {
    menuItems.forEach(item => item.classList.remove('open'));
    openMenu = null;
  });

  // Close menus when clicking a menu item (action)
  document.querySelectorAll('.menu-dropdown button').forEach(btn => {
    btn.addEventListener('click', () => {
      menuItems.forEach(item => item.classList.remove('open'));
      openMenu = null;
    });
  });

  // Close menus on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close menus
      if (openMenu) {
        menuItems.forEach(item => item.classList.remove('open'));
        openMenu = null;
      }
      // Close field picker modal
      const fieldPicker = document.getElementById('field-picker');
      if (fieldPicker && !fieldPicker.classList.contains('hidden')) {
        hideFieldPicker();
      }
      // Close array picker modal
      const arrayPicker = document.getElementById('array-picker');
      if (arrayPicker && !arrayPicker.classList.contains('hidden')) {
        hideArrayPicker();
      }
    }
  });
}

function setupEventHandlers(): void {
  // Set up menu bar
  setupMenuBar();

  // Document controls
  document.getElementById('load-sample')?.addEventListener('click', loadSampleDocument);
  document.getElementById('clear-doc')?.addEventListener('click', clearDocument);

  // Undo/Redo controls
  const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
  const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement | null;

  undoBtn?.addEventListener('click', () => editor?.undo());
  redoBtn?.addEventListener('click', () => editor?.redo());

  // Clipboard controls
  document.getElementById('cut-btn')?.addEventListener('click', async () => {
    const result = await editor?.cut();
    updateStatus(result ? 'Cut to clipboard' : 'Nothing to cut');
  });
  document.getElementById('copy-btn')?.addEventListener('click', async () => {
    const result = await editor?.copy();
    updateStatus(result ? 'Copied to clipboard' : 'Nothing to copy');
  });
  document.getElementById('paste-btn')?.addEventListener('click', async () => {
    const result = await editor?.paste();
    updateStatus(result ? 'Pasted from clipboard' : 'Nothing to paste');
  });

  // Hyperlink controls
  document.getElementById('add-hyperlink')?.addEventListener('click', addHyperlink);
  document.getElementById('remove-hyperlink')?.addEventListener('click', removeHyperlink);

  // View controls (menu)
  document.getElementById('zoom-in')?.addEventListener('click', () => editor?.zoomIn());
  document.getElementById('zoom-out')?.addEventListener('click', () => editor?.zoomOut());
  document.getElementById('fit-page')?.addEventListener('click', () => editor?.fitToPage());

  // Prevent buttons from stealing focus
  const preventFocusSteal = (e: MouseEvent) => e.preventDefault();

  // Embedded content controls (Insert menu)
  document.getElementById('insert-inline-image')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-inline-image')?.addEventListener('click', insertEmbeddedImage);
  document.getElementById('insert-inline-text')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-inline-text')?.addEventListener('click', insertEmbeddedTextBox);
  document.getElementById('insert-inline-table')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-inline-table')?.addEventListener('click', insertEmbeddedTable);
  document.getElementById('insert-substitution-field')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-substitution-field')?.addEventListener('click', toggleFieldPicker);
  document.getElementById('field-picker-close')?.addEventListener('click', hideFieldPicker);
  document.getElementById('field-picker-overlay')?.addEventListener('click', hideFieldPicker);
  document.getElementById('array-picker-close')?.addEventListener('click', hideArrayPicker);
  document.getElementById('array-picker-overlay')?.addEventListener('click', hideArrayPicker);
  document.getElementById('insert-page-number')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-page-number')?.addEventListener('click', insertPageNumber);
  document.getElementById('create-loop')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('create-loop')?.addEventListener('click', createLoop);
  document.getElementById('insert-page-break')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-page-break')?.addEventListener('click', insertPageBreak);

  // Collapsible sections
  setupCollapsibleSections();

  // Export/Import (File menu)
  document.getElementById('export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('import-pdf')?.addEventListener('click', () => {
    document.getElementById('pdf-file-input')?.click();
  });
  document.getElementById('pdf-file-input')?.addEventListener('change', importPDFHandler);

  // Save/Load (File menu)
  document.getElementById('save-document')?.addEventListener('click', saveDocumentHandler);
  document.getElementById('load-document')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });
  document.getElementById('file-input')?.addEventListener('change', loadDocumentHandler);

  // NOTE: All pane controls (formatting, document settings, merge data, hyperlink, field,
  // loop, textbox, image, table) are now handled by library panes in src/lib/panes/
}

/**
 * Insert welcome content when the demo starts.
 * Demonstrates basic editing features without overwhelming the user.
 */
function insertWelcomeContent(): void {
  if (!editor) return;

  // Set a simple header and footer with page number field
  editor.setHeaderText('PC Editor Demo');
  editor.setFooterText('Page ');

  // Insert page number field in footer
  editor.setActiveSection('footer');
  editor.setCursorPosition(5); // After "Page "
  editor.insertPageNumberField();
  editor.setActiveSection('body');

  // Build welcome content
  editor.setFlowingText('Welcome to PC Editor\n\n');

  // Format the title
  editor.applyFormattingWithFallback(0, 20, { fontWeight: 'bold', fontSize: 24 });

  const getTextLength = () => editor.getFlowingText().length;

  // Introduction
  editor.setFlowingText(editor.getFlowingText() +
    'PC Editor is a document layout engine that supports rich text editing, embedded objects, and data-driven content.\n\n');

  // Getting Started section
  const gettingStartedPos = getTextLength();
  editor.setFlowingText(editor.getFlowingText() + 'Getting Started\n\n');
  editor.applyFormattingWithFallback(gettingStartedPos, gettingStartedPos + 15, { fontWeight: 'bold', fontSize: 16 });

  editor.setFlowingText(editor.getFlowingText() +
    'Click anywhere in this text to position your cursor and start typing. ' +
    'Use the Formatting pane on the left to change text styles, alignment, and colors.\n\n');

  // Features section
  const featuresPos = getTextLength();
  editor.setFlowingText(editor.getFlowingText() + 'Key Features\n\n');
  editor.applyFormattingWithFallback(featuresPos, featuresPos + 12, { fontWeight: 'bold', fontSize: 16 });

  // Insert a sample table to demonstrate tables
  editor.setCursorPosition(getTextLength());
  const featureTable = new TableObject({
    id: `welcome_table_${Date.now()}`,
    textIndex: 0,
    size: { width: 400, height: 120 },
    rows: 4,
    columns: 2,
    columnWidths: [150, 250],
    defaultFontFamily: 'Arial',
    defaultFontSize: 11,
    defaultColor: '#000000',
    defaultCellPadding: 6,
    defaultBorderWidth: 1,
    defaultBorderColor: '#cccccc'
  });

  // Header row
  const headerCell0 = featureTable.getCell(0, 0);
  const headerCell1 = featureTable.getCell(0, 1);
  if (headerCell0) { headerCell0.content = 'Feature'; headerCell0.backgroundColor = '#f0f0f0'; }
  if (headerCell1) { headerCell1.content = 'Description'; headerCell1.backgroundColor = '#f0f0f0'; }
  featureTable.setHeaderRow(0, true);

  // Data rows
  const row1col0 = featureTable.getCell(1, 0);
  const row1col1 = featureTable.getCell(1, 1);
  if (row1col0) row1col0.content = 'Text Formatting';
  if (row1col1) row1col1.content = 'Bold, italic, fonts, colors, alignment';

  const row2col0 = featureTable.getCell(2, 0);
  const row2col1 = featureTable.getCell(2, 1);
  if (row2col0) row2col0.content = 'Tables & Images';
  if (row2col1) row2col1.content = 'Insert via the Insert menu';

  const row3col0 = featureTable.getCell(3, 0);
  const row3col1 = featureTable.getCell(3, 1);
  if (row3col0) row3col0.content = 'Data Merge';
  if (row3col1) row3col1.content = 'Substitution fields with JSON data';

  editor.insertEmbeddedObject(featureTable, 'inline');

  // Sample data section
  editor.setFlowingText(editor.getFlowingText() + '\n\n');
  const sampleDataPos = getTextLength();
  editor.setFlowingText(editor.getFlowingText() + 'Try Data Merge\n\n');
  editor.applyFormattingWithFallback(sampleDataPos, sampleDataPos + 14, { fontWeight: 'bold', fontSize: 16 });

  editor.setFlowingText(editor.getFlowingText() + 'The Merge Data pane contains sample JSON. Insert a substitution field to see it in action: ');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('customerName');
  editor.setFlowingText(editor.getFlowingText() + '\n\n');

  // Closing
  const closingPos = getTextLength();
  editor.setFlowingText(editor.getFlowingText() + 'Use Samples > Load Sample Document for a more complete demonstration.');
  editor.applyFormattingWithFallback(closingPos, closingPos + 71, { fontStyle: 'italic', color: '#666666' });

  editor.render();
}

function loadSampleDocument(): void {
  if (!editor) return;

  // Start with a clean document
  const emptyDoc: DocumentData = {
    version: '1.0.0',
    settings: {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      margins: { top: 25, right: 20, bottom: 25, left: 20 },
      units: 'mm'
    },
    pages: [{ id: 'page_1' }]
  };

  editor.loadDocument(emptyDoc);

  // Set header and footer with page number field
  editor.setHeaderText('Sample Document - PC Editor Demo');
  editor.setFooterText('Page ');
  editor.setActiveSection('footer');
  editor.setCursorPosition(5); // After "Page "
  editor.insertPageNumberField();
  editor.insertText(' | Generated with PC Editor');
  editor.setActiveSection('body');

  // Helper to get current text length
  const getTextLength = () => editor.getFlowingText().length;

  // Build body content piece by piece with real substitution fields
  // Start with the invoice header
  editor.setFlowingText('Invoice #INV-2024-001\n\nCustomer: ');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('customerName');

  // Add date line
  editor.setCursorPosition(getTextLength());
  editor.setFlowingText(editor.getFlowingText() + '\nDate: ');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('date');

  // Add intro text
  editor.setCursorPosition(getTextLength());
  editor.setFlowingText(editor.getFlowingText() + '\n\nThank you for your order. Please find the details below.\n\n');

  // Insert an embedded image
  editor.setCursorPosition(getTextLength());
  const imageObject = new ImageObject({
    id: `sample_image_${Date.now()}`,
    textIndex: 0,
    size: { width: 100, height: 75 },
    src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9Ijc1IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNzUiIGZpbGw9IiNlOGY0ZjgiIHN0cm9rZT0iIzMzOTlmZiIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPGNpcmNsZSBjeD0iMzAiIGN5PSIyNSIgcj0iMTIiIGZpbGw9IiNmZmQ3MDAiLz4KICA8cG9seWdvbiBwb2ludHM9IjIwLDY1IDQwLDM1IDYwLDUwIDgwLDMwIDkwLDY1IiBmaWxsPSIjNGNhZjUwIi8+CiAgPHRleHQgeD0iNTAiIHk9IjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgZmlsbD0iIzY2NiI+U2FtcGxlIEltYWdlPC90ZXh0Pgo8L3N2Zz4=',
    alt: 'Sample Image',
    fit: 'contain'
  });
  editor.insertEmbeddedObject(imageObject, 'inline');

  // Add Order Summary section
  editor.setFlowingText(editor.getFlowingText() + '\n\nOrder Summary\nThe following items were included in your order:\n\n');

  // Mark start of repeating section, add template content with fields
  const loopStartIndex = getTextLength();
  editor.setFlowingText(editor.getFlowingText() + 'Item: ');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('items.item');
  editor.setFlowingText(editor.getFlowingText() + '\nAmount: $');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('items.amount');
  editor.setFlowingText(editor.getFlowingText() + '\n');
  const loopEndIndex = getTextLength();

  // Create the repeating section
  editor.createRepeatingSection(loopStartIndex, loopEndIndex, 'items');

  // Add summary table
  editor.setFlowingText(editor.getFlowingText() + '\n');
  editor.setCursorPosition(getTextLength());
  const tableObject = new TableObject({
    id: `sample_table_${Date.now()}`,
    textIndex: 0,
    size: { width: 250, height: 80 },
    rows: 2,
    columns: 2,
    columnWidths: [125, 125],
    defaultFontFamily: 'Arial',
    defaultFontSize: 10,
    defaultColor: '#000000',
    defaultCellPadding: 4,
    defaultBorderWidth: 1,
    defaultBorderColor: '#cccccc'
  });

  // Add content to table cells
  const cell00 = tableObject.getCell(0, 0);
  const cell01 = tableObject.getCell(0, 1);
  const cell10 = tableObject.getCell(1, 0);
  const cell11 = tableObject.getCell(1, 1);
  if (cell00) { cell00.content = 'Subtotal'; cell00.backgroundColor = '#f5f5f5'; }
  if (cell01) { cell01.content = '$135.00'; }
  if (cell10) { cell10.content = 'Tax (10%)'; cell10.backgroundColor = '#f5f5f5'; }
  if (cell11) { cell11.content = '$15.00'; }
  editor.insertEmbeddedObject(tableObject, 'inline');

  // Add shipping address section with nested fields
  editor.setFlowingText(editor.getFlowingText() + '\n\nShipping Address\n');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('contact.address.street');
  editor.setFlowingText(editor.getFlowingText() + '\n');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('contact.address.city');
  editor.setFlowingText(editor.getFlowingText() + ', ');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('contact.address.postcode');

  // Add contact field
  editor.setFlowingText(editor.getFlowingText() + '\n\nContact: ');
  editor.setCursorPosition(getTextLength());
  editor.insertSubstitutionField('contact.mobile');

  // Add terms and conditions section
  editor.setFlowingText(editor.getFlowingText() + '\n\nTerms and Conditions\n\n' +
    'Payment is due within 30 days of invoice date. Late payments may incur additional charges.\n\n' +
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\n' +
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\n' +
    'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.\n\n' +
    'Additional Notes\n\n' +
    'This section contains additional information about your order. Please review carefully and contact us if you have any questions.\n\n' +
    'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.\n\n' +
    'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.\n\n' +
    'Thank you for your business!');

  // Add a table with row loop at the end
  editor.setFlowingText(editor.getFlowingText() + '\n\nItems Table (Row Loop)\n');
  editor.setCursorPosition(getTextLength());

  // First insert a simple table to verify insertion works
  const itemsTable = new TableObject({
    id: `items_table_${Date.now()}`,
    textIndex: 0,
    size: { width: 300, height: 80 },
    rows: 2,
    columns: 2,
    columnWidths: [200, 100],
    defaultFontFamily: 'Arial',
    defaultFontSize: 10,
    defaultColor: '#000000',
    defaultCellPadding: 6,
    defaultBorderWidth: 1,
    defaultBorderColor: '#999999'
  });

  // Set up header row (simple content first)
  const itemsHeaderCell0 = itemsTable.getCell(0, 0);
  const itemsHeaderCell1 = itemsTable.getCell(0, 1);
  if (itemsHeaderCell0) {
    itemsHeaderCell0.content = 'Item';
    itemsHeaderCell0.backgroundColor = '#e0e0e0';
  }
  if (itemsHeaderCell1) {
    itemsHeaderCell1.content = 'Amount';
    itemsHeaderCell1.backgroundColor = '#e0e0e0';
  }
  itemsTable.setHeaderRow(0, true);

  // Set up data row with substitution fields
  const itemsDataCell0 = itemsTable.getCell(1, 0);
  const itemsDataCell1 = itemsTable.getCell(1, 1);
  if (itemsDataCell0) {
    itemsDataCell0.flowingContent.insertSubstitutionField('items.item');
  }
  if (itemsDataCell1) {
    itemsDataCell1.flowingContent.insertText('$');
    itemsDataCell1.flowingContent.setCursorPosition(1);
    itemsDataCell1.flowingContent.insertSubstitutionField('items.amount');
  }

  // Insert the table first, then add the row loop
  editor.insertEmbeddedObject(itemsTable, 'inline');

  // Create a row loop on row 1 (the data row) after insertion
  itemsTable.createRowLoop(1, 1, 'items');

  // Apply formatting to headings
  const text = editor.getFlowingText();

  // Make "Invoice #INV-2024-001" bold and larger (first 21 chars)
  editor.applyFormattingWithFallback(0, 21, { fontWeight: 'bold', fontSize: 18 });

  // Find and format section headings
  const orderSummaryPos = text.indexOf('Order Summary');
  if (orderSummaryPos >= 0) {
    editor.applyFormattingWithFallback(orderSummaryPos, orderSummaryPos + 13, { fontWeight: 'bold', fontSize: 14 });
  }

  const shippingPos = text.indexOf('Shipping Address');
  if (shippingPos >= 0) {
    editor.applyFormattingWithFallback(shippingPos, shippingPos + 16, { fontWeight: 'bold', fontSize: 14 });
  }

  const termsPos = text.indexOf('Terms and Conditions');
  if (termsPos >= 0) {
    editor.applyFormattingWithFallback(termsPos, termsPos + 20, { fontWeight: 'bold', fontSize: 14 });
  }

  const notesPos = text.indexOf('Additional Notes');
  if (notesPos >= 0) {
    editor.applyFormattingWithFallback(notesPos, notesPos + 16, { fontWeight: 'bold', fontSize: 14 });
  }

  const itemsTablePos = text.indexOf('Items Table (Row Loop)');
  if (itemsTablePos >= 0) {
    editor.applyFormattingWithFallback(itemsTablePos, itemsTablePos + 22, { fontWeight: 'bold', fontSize: 14 });
  }

  // Make "Thank you for your business!" italic
  const thankYouPos = text.indexOf('Thank you for your business!');
  if (thankYouPos >= 0) {
    editor.applyFormattingWithFallback(thankYouPos, thankYouPos + 28, { fontStyle: 'italic' });
  }

  editor.render();
  loadDocumentSettings();
  updateStatus('Sample document loaded with real substitution fields and repeating section');
}


function clearDocument(): void {
  if (!editor) return;

  const emptyDoc: DocumentData = {
    version: '1.0.0',
    settings: {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      units: 'mm'
    },
    pages: [{
      id: 'page_1'
    }]
  };

  editor.loadDocument(emptyDoc);
  loadDocumentSettings();
  updateStatus('Document cleared');
}

// NOTE: toggleControlCharacters, toggleMarginLines, toggleGrid removed - now handled by ViewSettingsPane

function initializeRulers(): void {
  if (!editor) return;

  const horizontalContainer = document.getElementById('horizontal-ruler');
  const verticalContainer = document.getElementById('vertical-ruler');

  if (horizontalContainer) {
    horizontalRuler = new HorizontalRuler({ units: 'mm' });
    horizontalRuler.attach({
      editor,
      container: horizontalContainer
    });
  }

  if (verticalContainer) {
    verticalRuler = new VerticalRuler({ units: 'mm' });
    verticalRuler.attach({
      editor,
      container: verticalContainer
    });
  }

  // Set initial button state to active since rulers are shown by default
  const button = document.getElementById('toggle-rulers-btn');
  if (button) {
    button.classList.add('active');
  }

  // Force update after layout is complete
  requestAnimationFrame(() => {
    horizontalRuler?.update();
    verticalRuler?.update();
  });
}

/**
 * Initialize library panes - attach them to their respective containers.
 * The panes will auto-update based on editor events.
 */
function initializeLibraryPanes(): void {
  if (!editor) return;

  // Formatting pane - attaches to the formatting section content area
  const formattingContainer = document.getElementById('formatting-section');
  if (formattingContainer) {
    formattingPane = new FormattingPane('formatting', {
      onApply: (success) => {
        if (success) updateStatus('Formatting applied');
      }
    });
    formattingPane.attach({ editor, container: formattingContainer });
  }

  // Text box pane
  const textboxContainer = document.getElementById('textbox-properties');
  const textboxSection = document.getElementById('textbox-section');
  if (textboxContainer) {
    textBoxPane = new TextBoxPane('textbox', {
      onApply: (success) => {
        if (success) updateStatus('Text box updated');
      }
    });
    textBoxPane.attach({ editor, container: textboxContainer, sectionElement: textboxSection || undefined });
  }

  // Image pane
  const imageContainer = document.getElementById('image-properties');
  const imageSection = document.getElementById('image-section');
  if (imageContainer) {
    imagePane = new ImagePane('image', {
      onApply: (success) => {
        if (success) updateStatus('Image updated');
      }
    });
    imagePane.attach({ editor, container: imageContainer, sectionElement: imageSection || undefined });
  }

  // Table pane
  const tableContainer = document.getElementById('table-properties');
  const tableSection = document.getElementById('table-section');
  if (tableContainer) {
    tablePane = new TablePane('table', {
      onApply: (success) => {
        if (success) updateStatus('Table updated');
      }
    });
    tablePane.attach({ editor, container: tableContainer, sectionElement: tableSection || undefined });
  }

  // Substitution field pane
  const fieldContainer = document.getElementById('field-properties');
  const fieldSection = document.getElementById('field-section');
  if (fieldContainer) {
    fieldPane = new SubstitutionFieldPane('field', {
      onApply: (success) => {
        if (success) updateStatus('Field updated');
      }
    });
    fieldPane.attach({ editor, container: fieldContainer, sectionElement: fieldSection || undefined });
  }

  // Repeating section pane
  const loopContainer = document.getElementById('loop-properties');
  const loopSection = document.getElementById('loop-section');
  if (loopContainer) {
    loopPane = new RepeatingSectionPane('loop', {
      onApply: (success) => {
        if (success) updateStatus('Loop updated');
      }
    });
    loopPane.attach({ editor, container: loopContainer, sectionElement: loopSection || undefined });
  }

  // Table row loop pane
  const tableRowLoopContainer = document.getElementById('table-row-loop-properties');
  const tableRowLoopSection = document.getElementById('table-row-loop-section');
  if (tableRowLoopContainer) {
    tableRowLoopPane = new TableRowLoopPane('table-row-loop', {
      onApply: (success) => {
        if (success) updateStatus('Table row loop updated');
      }
    });
    tableRowLoopPane.attach({ editor, container: tableRowLoopContainer, sectionElement: tableRowLoopSection || undefined });
  }

  // Hyperlink pane
  const hyperlinkContainer = document.getElementById('hyperlink-properties');
  const hyperlinkSection = document.getElementById('hyperlink-section');
  if (hyperlinkContainer) {
    hyperlinkPane = new HyperlinkPane('hyperlink', {
      onApply: (success) => {
        if (success) updateStatus('Hyperlink updated');
      }
    });
    hyperlinkPane.attach({ editor, container: hyperlinkContainer, sectionElement: hyperlinkSection || undefined });
  }

  // Document info pane (read-only)
  const docInfoContainer = document.getElementById('doc-info-section');
  if (docInfoContainer) {
    documentInfoPane = new DocumentInfoPane('doc-info');
    documentInfoPane.attach({ editor, container: docInfoContainer });
  }

  // Document settings pane
  const docSettingsContainer = document.getElementById('document-settings');
  if (docSettingsContainer) {
    documentSettingsPane = new DocumentSettingsPane('doc-settings', {
      onApply: (success) => {
        if (success) {
          updateStatus('Document settings updated');
          loadDocumentSettings(); // Refresh the inputs
        }
      }
    });
    documentSettingsPane.attach({ editor, container: docSettingsContainer });
  }

  // View settings pane - with rulers toggle
  const viewSettingsContainer = document.getElementById('view-settings');
  if (viewSettingsContainer) {
    // Hide the separate rulers toggle button - ViewSettingsPane will handle it
    const separateRulersBtn = document.querySelector('.view-toggles');
    if (separateRulersBtn) {
      (separateRulersBtn as HTMLElement).style.display = 'none';
    }

    viewSettingsPane = new ViewSettingsPane('view-settings', {
      onToggleRulers: () => {
        toggleRulers();
      },
      rulersVisible: true
    });
    viewSettingsPane.attach({ editor, container: viewSettingsContainer });
  }

  // Merge data pane with sample data
  const mergeDataContainer = document.getElementById('merge-data-section');
  if (mergeDataContainer) {
    mergeDataPane = new MergeDataPane('merge-data', {
      initialData: {
        customerName: 'Jane Smith',
        date: '2024-01-15',
        items: [
          { item: 'Widget Pro', amount: '49.99' },
          { item: 'Gadget Plus', amount: '79.99' },
          { item: 'Service Fee', amount: '5.00' }
        ],
        contact: {
          mobile: '+1 (555) 123-4567',
          address: {
            street: '123 Main Street',
            city: 'San Francisco',
            postcode: 'CA 94102'
          }
        }
      },
      onApply: (success, error) => {
        if (success) {
          updateStatus('Merge data applied');
        } else if (error) {
          updateStatus(`Merge error: ${error.message}`, 'error');
        }
      }
    });
    mergeDataPane.attach({ editor, container: mergeDataContainer });
  }

  console.log('[Demo] Library panes initialized');
}

function toggleRulers(): void {
  const rulersVisible = horizontalRuler?.isVisible ?? false;

  if (rulersVisible) {
    horizontalRuler?.hide();
    verticalRuler?.hide();
  } else {
    horizontalRuler?.show();
    verticalRuler?.show();
  }

  // Hide/show ruler containers and corner
  const horizontalContainer = document.getElementById('horizontal-ruler');
  const verticalContainer = document.getElementById('vertical-ruler');
  const corner = document.querySelector('.ruler-corner') as HTMLElement;

  if (horizontalContainer) {
    horizontalContainer.style.display = rulersVisible ? 'none' : 'block';
  }
  if (verticalContainer) {
    verticalContainer.style.display = rulersVisible ? 'none' : 'block';
  }
  if (corner) {
    corner.style.display = rulersVisible ? 'none' : 'block';
  }

  updateStatus(`Rulers ${!rulersVisible ? 'shown' : 'hidden'}`);
}

function updateDocumentInfo(): void {
  if (!editor) return;

  const doc = editor.getDocument();
  const pageCount = document.getElementById('page-count');
  const pageSize = document.getElementById('page-size');
  const pageOrientation = document.getElementById('page-orientation');

  if (pageCount) pageCount.textContent = doc.pages.length.toString();
  if (pageSize && doc.settings) pageSize.textContent = doc.settings.pageSize;
  if (pageOrientation && doc.settings) {
    pageOrientation.textContent = doc.settings.pageOrientation.charAt(0).toUpperCase() +
                                  doc.settings.pageOrientation.slice(1);
  }
}

function updateZoomLevel(zoom: number): void {
  const zoomDisplay = document.getElementById('zoom-level');
  if (zoomDisplay) {
    zoomDisplay.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
  }
}

function updateSectionIndicator(section: EditingSection): void {
  const indicator = document.getElementById('section-indicator');
  if (indicator) {
    const sectionNames: Record<EditingSection, string> = {
      'header': 'Header',
      'body': 'Body',
      'footer': 'Footer'
    };
    indicator.textContent = `Section: ${sectionNames[section]}`;
    indicator.className = `section-indicator section-${section}`;
  }
}

function updateStatus(message: string, type: 'info' | 'error' = 'info'): void {
  const statusElement = document.getElementById('status-message');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.color = type === 'error' ? '#e74c3c' : 'inherit';
  }
}

// NOTE: applyMargins, updatePageSettings removed - now handled by DocumentSettingsPane

function loadDocumentSettings(): void {
  if (!editor) return;

  try {
    const settings = editor.getDocumentSettings();

    const topInput = document.getElementById('margin-top') as HTMLInputElement;
    const rightInput = document.getElementById('margin-right') as HTMLInputElement;
    const bottomInput = document.getElementById('margin-bottom') as HTMLInputElement;
    const leftInput = document.getElementById('margin-left') as HTMLInputElement;

    if (topInput) topInput.value = settings.margins.top.toString();
    if (rightInput) rightInput.value = settings.margins.right.toString();
    if (bottomInput) bottomInput.value = settings.margins.bottom.toString();
    if (leftInput) leftInput.value = settings.margins.left.toString();

    const pageSizeSelect = document.getElementById('page-size-select') as HTMLSelectElement;
    const pageOrientationSelect = document.getElementById('page-orientation-select') as HTMLSelectElement;

    if (pageSizeSelect) pageSizeSelect.value = settings.pageSize;
    if (pageOrientationSelect) pageOrientationSelect.value = settings.pageOrientation;
  } catch (error) {
    console.error('Failed to load document settings:', error);
  }
}

function insertEmbeddedImage(): void {
  if (!editor) return;

  try {
    const imageObject = new ImageObject({
      id: `image_${Date.now()}`,
      textIndex: 0,
      size: { width: 80, height: 60 },
      src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZTNmMmZkIiBzdHJva2U9IiMwMDY2Y2MiIHN0cm9rZS13aWR0aD0iMSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjMDA2NmNjIj5JbWFnZTwvdGV4dD4KPC9zdmc+',
      alt: 'Embedded Image',
      fit: 'contain'
    });

    editor.insertEmbeddedObject(imageObject, 'inline');
    updateStatus('Inserted image');
    editor.enableTextInput();
  } catch (error) {
    updateStatus('Failed to insert image', 'error');
    console.error('Image insertion error:', error);
  }
}

function insertEmbeddedTextBox(): void {
  if (!editor) return;

  try {
    const textBoxObject = new TextBoxObject({
      id: `textbox_${Date.now()}`,
      textIndex: 0,
      size: { width: 200, height: 48 },
      content: '',
      fontFamily: 'Arial',
      fontSize: 12,
      color: '#000000'
    });

    editor.insertEmbeddedObject(textBoxObject, 'inline');
    updateStatus('Inserted text box');
    editor.enableTextInput();
  } catch (error) {
    updateStatus('Failed to insert text box', 'error');
    console.error('Text box insertion error:', error);
  }
}

function insertPageNumber(): void {
  if (!editor) return;

  try {
    editor.insertPageNumberField();
    updateStatus('Inserted page number field');
    editor.enableTextInput();
  } catch (error) {
    updateStatus('Failed to insert page number field', 'error');
    console.error('Page number insertion error:', error);
  }
}

function insertEmbeddedTable(): void {
  if (!editor) return;

  try {
    // Create a 3x3 table with sample content
    const tableObject = new TableObject({
      id: `table_${Date.now()}`,
      textIndex: 0,
      size: { width: 300, height: 100 }, // Initial size, will be recalculated
      rows: 3,
      columns: 3,
      columnWidths: [100, 100, 100],
      defaultFontFamily: 'Arial',
      defaultFontSize: 12,
      defaultColor: '#000000',
      defaultCellPadding: 4,
      defaultBorderWidth: 1,
      defaultBorderColor: '#000000'
    });

    // Set up the first row as a header row with header styling (but no default text)
    for (let col = 0; col < 3; col++) {
      const cell = tableObject.getCell(0, col);
      if (cell) {
        cell.backgroundColor = '#f0f0f0';
      }
    }
    tableObject.setHeaderRow(0, true);

    editor.insertEmbeddedObject(tableObject, 'inline');
    updateStatus('Inserted table');
    editor.enableTextInput();
  } catch (error) {
    updateStatus('Failed to insert table', 'error');
    console.error('Table insertion error:', error);
  }
}

/**
 * Extract all field paths from merge data object.
 * Handles nested objects and arrays (arrays show path without index, since 0th is default).
 */
function extractFieldPaths(obj: unknown, prefix: string = ''): string[] {
  const paths: string[] = [];

  if (obj === null || obj === undefined) {
    return paths;
  }

  if (Array.isArray(obj)) {
    // For arrays, recurse into the first element to get nested paths
    if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
      paths.push(...extractFieldPaths(obj[0], prefix));
    }
    return paths;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        paths.push(path);
      } else if (Array.isArray(value)) {
        // For arrays, add the path and recurse into first element for nested paths
        if (value.length > 0) {
          if (typeof value[0] === 'object' && value[0] !== null) {
            // Array of objects - recurse to get nested paths
            paths.push(...extractFieldPaths(value[0], path));
          } else {
            // Array of primitives - just add the path
            paths.push(path);
          }
        } else {
          paths.push(path);
        }
      } else if (typeof value === 'object') {
        // Nested object - recurse
        paths.push(...extractFieldPaths(value, path));
      } else {
        // Primitive value - add the path
        paths.push(path);
      }
    }
  }

  return paths;
}

/**
 * Extract only array field paths from the merge data object.
 * Only returns top-level arrays in the current context.
 */
function extractArrayPaths(obj: unknown, prefix: string = ''): string[] {
  const paths: string[] = [];

  if (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj)) {
    return paths;
  }

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      // Found an array - add it
      paths.push(path);
    } else if (typeof value === 'object' && value !== null) {
      // Nested object - recurse to find nested arrays
      paths.push(...extractArrayPaths(value, path));
    }
  }

  return paths;
}

/**
 * Get the current merge data from the MergeDataPane.
 */
function getMergeData(): Record<string, unknown> | null {
  return mergeDataPane?.getData() ?? null;
}

/**
 * Show the field picker dropdown with available field paths.
 */
function showFieldPicker(): void {
  const picker = document.getElementById('field-picker');
  const overlay = document.getElementById('field-picker-overlay');
  const list = document.getElementById('field-picker-list');
  if (!picker || !list) return;

  // Get field paths from merge data
  const mergeData = getMergeData();
  const paths = mergeData ? extractFieldPaths(mergeData) : [];

  // Clear and populate the list
  list.innerHTML = '';

  if (paths.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.className = 'field-picker-item';
    emptyItem.textContent = '(no fields available)';
    emptyItem.style.color = '#999';
    emptyItem.style.fontStyle = 'italic';
    list.appendChild(emptyItem);
  } else {
    for (const path of paths) {
      const item = document.createElement('button');
      item.className = 'field-picker-item';
      item.textContent = path;
      item.addEventListener('click', () => {
        insertFieldWithName(path);
        hideFieldPicker();
      });
      list.appendChild(item);
    }
  }

  picker.classList.remove('hidden');
  overlay?.classList.remove('hidden');
}

/**
 * Hide the field picker modal.
 */
function hideFieldPicker(): void {
  const picker = document.getElementById('field-picker');
  const overlay = document.getElementById('field-picker-overlay');
  if (picker) {
    picker.classList.add('hidden');
  }
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// Store pending loop boundaries for the array picker
let pendingLoopStart: number | null = null;
let pendingLoopEnd: number | null = null;

/**
 * Show the array picker modal with available array field paths.
 */
function showArrayPicker(startBoundary: number, endBoundary: number): void {
  const picker = document.getElementById('array-picker');
  const overlay = document.getElementById('array-picker-overlay');
  const list = document.getElementById('array-picker-list');
  if (!picker || !list) return;

  // Store boundaries for when user selects an array
  pendingLoopStart = startBoundary;
  pendingLoopEnd = endBoundary;

  // Get array paths from merge data
  const mergeData = getMergeData();
  const paths = mergeData ? extractArrayPaths(mergeData) : [];

  // Clear and populate the list
  list.innerHTML = '';

  if (paths.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.className = 'field-picker-item';
    emptyItem.textContent = '(no array fields available)';
    emptyItem.style.color = '#999';
    emptyItem.style.fontStyle = 'italic';
    list.appendChild(emptyItem);
  } else {
    for (const path of paths) {
      const item = document.createElement('button');
      item.className = 'field-picker-item';
      item.textContent = path;
      item.addEventListener('click', () => {
        createLoopWithPath(path);
        hideArrayPicker();
      });
      list.appendChild(item);
    }
  }

  picker.classList.remove('hidden');
  overlay?.classList.remove('hidden');
}

/**
 * Hide the array picker modal.
 */
function hideArrayPicker(): void {
  const picker = document.getElementById('array-picker');
  const overlay = document.getElementById('array-picker-overlay');
  if (picker) {
    picker.classList.add('hidden');
  }
  if (overlay) {
    overlay.classList.add('hidden');
  }
  pendingLoopStart = null;
  pendingLoopEnd = null;
}

/**
 * Create a loop with the specified field path using stored boundaries.
 */
function createLoopWithPath(fieldPath: string): void {
  if (!editor || pendingLoopStart === null || pendingLoopEnd === null) return;

  try {
    const section = editor.createRepeatingSection(pendingLoopStart, pendingLoopEnd, fieldPath.trim());
    if (section) {
      // Use library pane to show the section
      loopPane?.showSection(section);
      updateStatus(`Loop created for "${fieldPath.trim()}"`);
    } else {
      updateStatus('Failed to create loop - check boundaries', 'error');
    }
  } catch (error) {
    updateStatus('Failed to create loop', 'error');
    console.error('Loop creation error:', error);
  }
}

/**
 * Insert a substitution field with the given name.
 */
function insertFieldWithName(fieldName: string): void {
  if (!editor) return;

  try {
    editor.insertSubstitutionField(fieldName, {
      defaultValue: `[${fieldName}]`
    });
    updateStatus(`Inserted field "${fieldName}"`);
    editor.enableTextInput();
  } catch (error) {
    updateStatus('Failed to insert field', 'error');
    console.error('Field insertion error:', error);
  }
}

/**
 * Toggle the field picker dropdown.
 */
function toggleFieldPicker(): void {
  const picker = document.getElementById('field-picker');
  if (picker?.classList.contains('hidden')) {
    showFieldPicker();
  } else {
    hideFieldPicker();
  }
}

function setupCollapsibleSections(): void {
  const headers = document.querySelectorAll('.collapsible-header');

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.getAttribute('data-target');
      if (!targetId) return;

      const content = document.getElementById(targetId);
      if (!content) return;

      // Toggle expanded class on header
      header.classList.toggle('expanded');

      // Toggle collapsed class on content
      content.classList.toggle('collapsed');
    });
  });
}

/**
 * Export the document to PDF.
 * Gets merge data from the textarea if valid JSON.
 */
async function exportPDF(): Promise<void> {
  if (!editor) return;

  try {
    updateStatus('Generating PDF...');

    // Get merge data from textarea (if valid)
    const textarea = document.getElementById('merge-data-input') as HTMLTextAreaElement;
    let mergeData: Record<string, unknown> | undefined;

    if (textarea?.value) {
      try {
        mergeData = JSON.parse(textarea.value);
      } catch {
        // Invalid JSON - proceed without merge data
      }
    }

    // Export with merge data applied
    const pdfBlob = await editor.exportPDF({
      applyMergeData: !!mergeData,
      mergeData
    });

    // Download the PDF
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'document.pdf';
    link.click();
    URL.revokeObjectURL(url);

    updateStatus('PDF exported successfully');
  } catch (error) {
    updateStatus('PDF export failed', 'error');
    console.error('PDF export error:', error);
  }
}

// ============================================
// Save/Load Functions
// ============================================

/**
 * Save the current document to a file.
 */
function saveDocumentHandler(): void {
  if (!editor) return;

  try {
    editor.saveDocumentToFile('my-document.pceditor.json');
    updateStatus('Document saved');
  } catch (error) {
    console.error('Failed to save document:', error);
    updateStatus('Failed to save document', 'error');
  }
}

/**
 * Load a document from a file.
 */
async function loadDocumentHandler(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file || !editor) {
    return;
  }

  try {
    updateStatus('Loading document...');
    await editor.loadDocumentFromFile(file);
    updateStatus('Document loaded');
    loadDocumentSettings(); // Refresh settings panel
  } catch (error) {
    console.error('Failed to load document:', error);
    updateStatus('Failed to load document: ' + (error as Error).message, 'error');
  }

  // Reset the input so the same file can be loaded again
  input.value = '';
}

/**
 * Import a PDF file.
 */
async function importPDFHandler(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file || !editor) {
    return;
  }

  try {
    updateStatus('Importing PDF...');
    const result = await editor.importPDF(file, {
      detectTables: true,
      extractImages: true
    }, (progress) => {
      updateStatus(`${progress.message} (${progress.progress}%)`);
    });

    updateStatus(`PDF imported: ${result.metadata?.pageCount || 0} page(s)`);
    loadDocumentSettings(); // Refresh settings panel

    // Show warnings if any
    if (result.warnings.length > 0) {
      console.warn('PDF import warnings:', result.warnings);
      alert('PDF imported with warnings:\n\n' + result.warnings.join('\n'));
    }
  } catch (error) {
    console.error('Failed to import PDF:', error);
    updateStatus('Failed to import PDF: ' + (error as Error).message, 'error');
    alert('Failed to import PDF: ' + (error as Error).message);
  }

  // Reset the input so the same file can be imported again
  input.value = '';
}

// ============================================
// Page Break Functions
// ============================================

/**
 * Insert a page break at the current cursor position.
 * Only works in body content.
 */
function insertPageBreak(): void {
  if (!editor) return;

  try {
    editor.insertPageBreak();
    updateStatus('Page break inserted');
  } catch (e) {
    // If not in body content, show a helpful message
    updateStatus('Click in the body content first', 'error');
  }
}

// Hyperlink Functions
// ============================================

function addHyperlink(): void {
  if (!editor) return;

  // Check if there's a text selection
  const selection = editor.getSelection();
  if (selection.type !== 'text' || selection.start === selection.end) {
    updateStatus('Select text first to create a hyperlink', 'error');
    return;
  }

  // Prompt for URL
  const url = prompt('Enter URL:', 'https://');
  if (!url || url === 'https://') {
    return;
  }

  try {
    editor.insertHyperlink(url);
    updateStatus('Hyperlink added');
  } catch (error) {
    updateStatus('Failed to add hyperlink', 'error');
    console.error('Hyperlink error:', error);
  }
}

function removeHyperlink(): void {
  if (!editor) return;

  // Check if cursor is in a hyperlink
  const cursorPos = editor.getCursorPosition();
  const hyperlink = editor.getHyperlinkAt(cursorPos);

  if (!hyperlink) {
    updateStatus('Place cursor in a hyperlink first', 'error');
    return;
  }

  try {
    editor.removeHyperlink(hyperlink.id);
    updateStatus('Hyperlink removed');
  } catch (error) {
    updateStatus('Failed to remove hyperlink', 'error');
    console.error('Remove hyperlink error:', error);
  }
}

// Loop Pane Functions
// ============================================

/**
 * Create a repeating section (loop) from the current text selection.
 * The selection must span complete paragraphs.
 */
function createLoop(): void {
  if (!editor) return;

  const selection = editor.getSelection();
  if (selection.type !== 'text') {
    updateStatus('Select text first to create a loop', 'error');
    return;
  }

  // Get paragraph boundaries
  const boundaries = editor.getParagraphBoundaries();

  // Find the paragraph boundary at or before the selection start
  let startBoundary = 0;
  for (const boundary of boundaries) {
    if (boundary <= selection.start) {
      startBoundary = boundary;
    } else {
      break;
    }
  }

  // Find the paragraph boundary at or after the selection end
  let endBoundary = boundaries[boundaries.length - 1] || selection.end;
  for (const boundary of boundaries) {
    if (boundary >= selection.end) {
      endBoundary = boundary;
      break;
    }
  }

  // Ensure we have at least one paragraph
  if (endBoundary <= startBoundary) {
    updateStatus('Selection must include at least one paragraph', 'error');
    return;
  }

  // Show the array picker modal
  showArrayPicker(startBoundary, endBoundary);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeEditor();
  setupEventHandlers();
});
