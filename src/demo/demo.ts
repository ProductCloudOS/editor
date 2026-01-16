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
    // Add some initial flowing text to demonstrate the feature
    editor.setFlowingText('Welcome to PC Editor!\n\nThis is a document layout engine with flowing text support. Click in the text to position your cursor, then use the toolbar buttons to insert embedded content.\n\nTry inserting an image, text box, or substitution field at the cursor position. You can also use Float Left/Right to position images alongside text.\n\nThe text will automatically reflow around embedded content and across multiple pages as needed.');
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
  document.getElementById('load-tmd-sample')?.addEventListener('click', loadTMDSample);
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

  // Set header and footer
  editor.setHeaderText('Sample Document - PC Editor Demo');
  editor.setFooterText('Page 1 | Generated with PC Editor');

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

function loadTMDSample(): void {
  if (!editor) return;

  // Start with a clean document
  const emptyDoc: DocumentData = {
    version: '1.0.0',
    settings: {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      units: 'mm'
    },
    pages: [{ id: 'page_1' }]
  };

  editor.loadDocument(emptyDoc);

  // Set footer (appears on all pages)
  editor.setFooterText('LG.003.002 v4.2');

  // Helper to get current text length
  const getTextLength = () => editor.getFlowingText().length;

  // ===== PAGE 1 =====

  // Title
  editor.setFlowingText('Target Market Determination: NOW Finance Secured Personal Loan\n\n');

  // Format title - bold and large
  editor.applyFormattingWithFallback(0, 61, { fontWeight: 'bold', fontSize: 16 });

  // Insert metadata table (Issuer, Start Date, Product)
  const metadataTable = new TableObject({
    id: `tmd_metadata_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 120 },
    rows: 3,
    columns: 2,
    columnWidths: [90, 440],
    defaultFontFamily: 'Arial',
    defaultFontSize: 10,
    defaultColor: '#000000',
    defaultCellPadding: 6,
    defaultBorderWidth: 0,
    defaultBorderColor: '#ffffff'
  });

  // Row 0: Issuer
  const issuerLabelCell = metadataTable.getCell(0, 0);
  const issuerValueCell = metadataTable.getCell(0, 1);
  if (issuerLabelCell) {
    issuerLabelCell.content = 'Issuer:';
    issuerLabelCell.flowingContent.applyFormatting(0, 7, { fontWeight: 'bold' });
  }
  if (issuerValueCell) {
    issuerValueCell.content = 'Now Finance Group Pty Ltd as agent for NF Finco 2 Pty Ltd (NOW Finance)\nACN 164 213 030 Australian Credit Licence number 425142.';
    issuerValueCell.flowingContent.applyFormatting(52, 63, { fontWeight: 'bold' });
  }

  // Row 1: Start Date
  const startDateLabelCell = metadataTable.getCell(1, 0);
  const startDateValueCell = metadataTable.getCell(1, 1);
  if (startDateLabelCell) {
    startDateLabelCell.content = 'Start Date:';
    startDateLabelCell.flowingContent.applyFormatting(0, 11, { fontWeight: 'bold' });
  }
  if (startDateValueCell) {
    startDateValueCell.content = '18 November 2025';
  }

  // Row 2: Product
  const productLabelCell = metadataTable.getCell(2, 0);
  const productValueCell = metadataTable.getCell(2, 1);
  if (productLabelCell) {
    productLabelCell.content = 'Product:';
    productLabelCell.flowingContent.applyFormatting(0, 8, { fontWeight: 'bold' });
  }
  if (productValueCell) {
    productValueCell.content = 'NOW Finance Secured Personal Loan\nNOW Finance\'s Secured Personal Loan (the Loan) allows individuals to borrow funds for a number of personal, domestic or household purposes secured against a vehicle, watercraft or caravan. The Loan offers a fixed interest rate and requires individuals to make regular repayments over a fixed term.';
    productValueCell.flowingContent.applyFormatting(0, 33, { fontWeight: 'bold' });
  }

  editor.setCursorPosition(getTextLength());
  editor.insertEmbeddedObject(metadataTable, 'inline');

  // "Purpose of this Document" section header
  editor.setFlowingText(editor.getFlowingText() + '\n');
  editor.setCursorPosition(getTextLength());

  const purposeHeaderBox = new TextBoxObject({
    id: `tmd_purpose_header_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 22 },
    backgroundColor: '#d9d9d9',
    border: {
      top: { width: 0, color: '#d9d9d9', style: 'solid' },
      right: { width: 0, color: '#d9d9d9', style: 'solid' },
      bottom: { width: 0, color: '#d9d9d9', style: 'solid' },
      left: { width: 0, color: '#d9d9d9', style: 'solid' }
    },
    padding: 4
  });
  purposeHeaderBox.flowingContent.insertText('Purpose of this Document');
  purposeHeaderBox.flowingContent.applyFormatting(0, 24, { fontWeight: 'bold', fontSize: 11 });
  editor.insertEmbeddedObject(purposeHeaderBox, 'inline');

  // Purpose paragraph
  editor.setFlowingText(editor.getFlowingText() + '\n\nThis target market determination (TMD) seeks to provide consumers, distributors and staff with an understanding of the class of consumers (target market) for which this product has been designed, having regard to the likely objectives, financial situation and needs of the target market.\n\nThis document should not be treated as a full summary of the product\'s terms and conditions or all of the product\'s features. This document is not a customer disclosure document and does not provide financial advice.\n\nConsumers should refer to the Credit Guide, Credit Schedule and the other documents setting out the terms and conditions of the product when making a decision about this product. These documents are provided to a consumer prior to the provision of credit. A copy of these documents can otherwise be requested by contacting us at: customerservice@nowfinance.com.au\n\n');

  // Format "TMD" as bold
  const tmdText = editor.getFlowingText();
  const tmdPos = tmdText.indexOf('(TMD)');
  if (tmdPos >= 0) {
    editor.applyFormattingWithFallback(tmdPos, tmdPos + 5, { fontWeight: 'bold' });
  }

  // "Target Market and Key Attributes" section header
  editor.setCursorPosition(getTextLength());
  const targetMarketHeaderBox = new TextBoxObject({
    id: `tmd_target_header_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 22 },
    backgroundColor: '#d9d9d9',
    border: {
      top: { width: 0, color: '#d9d9d9', style: 'solid' },
      right: { width: 0, color: '#d9d9d9', style: 'solid' },
      bottom: { width: 0, color: '#d9d9d9', style: 'solid' },
      left: { width: 0, color: '#d9d9d9', style: 'solid' }
    },
    padding: 4
  });
  targetMarketHeaderBox.flowingContent.insertText('Target Market and Key Attributes');
  targetMarketHeaderBox.flowingContent.applyFormatting(0, 33, { fontWeight: 'bold', fontSize: 11 });
  editor.insertEmbeddedObject(targetMarketHeaderBox, 'inline');

  // Target Market intro text with bullet list
  editor.setFlowingText(editor.getFlowingText() + '\n\nThe Loan is designed for the class of consumers who:\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  wish to borrow a large sum of credit from a non-bank lender and are able to provide an asset as security for the Loan;\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  meet the eligibility requirements for the Loan (Eligibility Requirements), including:\n');
  editor.setFlowingText(editor.getFlowingText() + '        o  being of 18+ years of age;\n');
  editor.setFlowingText(editor.getFlowingText() + '        o  holding Australian citizenship or permanent residency;\n');
  editor.setFlowingText(editor.getFlowingText() + '        o  currently employed (full time/ part time/ casual) and not on probation;\n');
  editor.setFlowingText(editor.getFlowingText() + '        o  no unpaid defaults;\n');
  editor.setFlowingText(editor.getFlowingText() + '        o  Centrelink is not the primary form of income;\n');
  editor.setFlowingText(editor.getFlowingText() + '        o  not a current or prior bankrupt or party to a court judgement; and\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  have the likely needs, objectives and financial situation described below (Target Market).\n\n');

  // Format "Eligibility Requirements" and "Target Market" as bold
  const currentText = editor.getFlowingText();
  const eligPos = currentText.indexOf('(Eligibility Requirements)');
  if (eligPos >= 0) {
    editor.applyFormattingWithFallback(eligPos, eligPos + 26, { fontWeight: 'bold' });
  }
  const targetMarketPos = currentText.lastIndexOf('(Target Market)');
  if (targetMarketPos >= 0) {
    editor.applyFormattingWithFallback(targetMarketPos, targetMarketPos + 15, { fontWeight: 'bold' });
  }

  // ===== MAIN TARGET MARKET TABLE (Pages 2-3) =====
  editor.setCursorPosition(getTextLength());

  const mainTable = new TableObject({
    id: `tmd_main_table_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 700 },
    rows: 10,
    columns: 2,
    columnWidths: [175, 355],
    defaultFontFamily: 'Arial',
    defaultFontSize: 10,
    defaultColor: '#000000',
    defaultCellPadding: 6,
    defaultBorderWidth: 1,
    defaultBorderColor: '#000000'
  });

  // Row 0: Header row (italic)
  const headerCell0 = mainTable.getCell(0, 0);
  const headerCell1 = mainTable.getCell(0, 1);
  if (headerCell0) {
    headerCell0.content = 'The NOW Finance Secured Personal Loan has been designed for customers with the following likely needs, objectives and financial situation:';
    headerCell0.flowingContent.applyFormatting(0, headerCell0.content.length, { fontStyle: 'italic', fontWeight: 'bold' });
  }
  if (headerCell1) {
    headerCell1.content = 'Key Attributes of the NOW Finance Secured Personal Loan that make the product consistent with the likely objectives, financial situation and needs of consumers in the target market.';
    headerCell1.flowingContent.applyFormatting(0, headerCell1.content.length, { fontStyle: 'italic', fontWeight: 'bold' });
  }
  // Mark row 0 as a header row so it repeats on page breaks
  mainTable.setHeaderRow(0, true);

  // Row 1: Objectives section header
  const objHeaderCell0 = mainTable.getCell(1, 0);
  const objHeaderCell1 = mainTable.getCell(1, 1);
  if (objHeaderCell0) {
    objHeaderCell0.content = 'Objectives';
    objHeaderCell0.flowingContent.applyFormatting(0, 10, { fontStyle: 'italic' });
    objHeaderCell0.backgroundColor = '#f2f2f2';
  }
  if (objHeaderCell1) {
    objHeaderCell1.backgroundColor = '#f2f2f2';
  }

  // Row 2: Objectives content
  const objCell0 = mainTable.getCell(2, 0);
  const objCell1 = mainTable.getCell(2, 1);
  if (objCell0) {
    objCell0.content = '\u2022  Obtain a large lump sum which can be used for a wide range of personal, domestic, or household purposes including but not limited to:\n    \u25AA  Vehicle, watercraft or caravan purchases;\n    \u25AA  Home renovations;\n    \u25AA  Household furnishings;\n    \u25AA  Debt consolidation;\n    \u25AA  Travel;\n    \u25AA  Medical expenses; and\n    \u25AA  Wedding expenses.';
  }
  if (objCell1) {
    objCell1.content = '\u2022  A NOW Finance Secured Personal Loan provides:\n    o  a single lump sum of credit (in other words it is not revolving credit);\n    o  a minimum sum of $15,000 and a maximum sum of $100,000, which is a sufficiently large sum for these types of personal, domestic or household purposes.\n    o  it can be used for a wide range of personal, domestic, or household purposes.';
  }

  // Row 3: Needs section header
  const needsHeaderCell0 = mainTable.getCell(3, 0);
  const needsHeaderCell1 = mainTable.getCell(3, 1);
  if (needsHeaderCell0) {
    needsHeaderCell0.content = 'Needs';
    needsHeaderCell0.flowingContent.applyFormatting(0, 5, { fontStyle: 'italic' });
    needsHeaderCell0.backgroundColor = '#f2f2f2';
  }
  if (needsHeaderCell1) {
    needsHeaderCell1.backgroundColor = '#f2f2f2';
  }

  // Row 4: First needs item
  const needs1Cell0 = mainTable.getCell(4, 0);
  const needs1Cell1 = mainTable.getCell(4, 1);
  if (needs1Cell0) {
    needs1Cell0.content = '\u2022  Spread / smooth the repayments over an extended period of time without a balloon payment at the end.';
  }
  if (needs1Cell1) {
    needs1Cell1.content = '\u2022  A NOW Finance Secured Person Loan provides:\n    o  a term between 1.5 years to 7 years which is an extended period of time;\n    o  weekly or fortnightly payments to smooth/spread the repayments; and\n    o  repayments of principal and interest so that it is paid off by the end of the term.';
  }

  // Row 5: Second needs item (certainty)
  const needs2Cell0 = mainTable.getCell(5, 0);
  const needs2Cell1 = mainTable.getCell(5, 1);
  if (needs2Cell0) {
    needs2Cell0.content = '\u2022  Need certainty of repayment amounts.';
  }
  if (needs2Cell1) {
    needs2Cell1.content = '\u2022  A NOW Finance Secured Person Loan provides:\n    o  a fixed interest rate which allows repayment amounts to be the same and therefore certain;\n    o  no Loan fees, including upfront fees, periodic fees or event-based fees.';
  }

  // Row 6: Third needs item (flexibility)
  const needs3Cell0 = mainTable.getCell(6, 0);
  const needs3Cell1 = mainTable.getCell(6, 1);
  if (needs3Cell0) {
    needs3Cell0.content = '\u2022  Need flexibility to make extra repayments or pay out the Loan early.';
  }
  if (needs3Cell1) {
    needs3Cell1.content = '\u2022  A NOW Finance Secured Person Loan provides:\n    o  No extra repayment charges: customers can make early repayments during the Loan without any fees.\n    o  No early repayment charges: customers can pay out their Loan at any time without any fees or charges.';
    // Bold the "No extra repayment charges" and "No early repayment charges"
    const noExtraPos = needs3Cell1.content.indexOf('No extra repayment charges');
    const noEarlyPos = needs3Cell1.content.indexOf('No early repayment charges');
    if (noExtraPos >= 0) {
      needs3Cell1.flowingContent.applyFormatting(noExtraPos, noExtraPos + 26, { fontWeight: 'bold' });
    }
    if (noEarlyPos >= 0) {
      needs3Cell1.flowingContent.applyFormatting(noEarlyPos, noEarlyPos + 26, { fontWeight: 'bold' });
    }
  }

  // Row 7: Financial situation header
  const finHeaderCell0 = mainTable.getCell(7, 0);
  const finHeaderCell1 = mainTable.getCell(7, 1);
  if (finHeaderCell0) {
    finHeaderCell0.content = 'Financial situation';
    finHeaderCell0.flowingContent.applyFormatting(0, 19, { fontStyle: 'italic' });
    finHeaderCell0.backgroundColor = '#f2f2f2';
  }
  if (finHeaderCell1) {
    finHeaderCell1.backgroundColor = '#f2f2f2';
  }

  // Row 8: First financial situation item
  const fin1Cell0 = mainTable.getCell(8, 0);
  const fin1Cell1 = mainTable.getCell(8, 1);
  if (fin1Cell0) {
    fin1Cell0.content = '\u2022  Owns (or will acquire with the funds) a vehicle, watercraft or caravan to provide as security for the Loan.';
  }
  if (fin1Cell1) {
    fin1Cell1.content = '\u2022  Security: a customer is required to provide security for the Loaned amount.';
    const securityPos = fin1Cell1.content.indexOf('Security');
    if (securityPos >= 0) {
      fin1Cell1.flowingContent.applyFormatting(securityPos, securityPos + 8, { fontWeight: 'bold' });
    }
  }

  // Row 9: Second financial situation item
  const fin2Cell0 = mainTable.getCell(9, 0);
  const fin2Cell1 = mainTable.getCell(9, 1);
  if (fin2Cell0) {
    fin2Cell0.content = '\u2022  Have the financial capacity to service the Loan.';
  }
  if (fin2Cell1) {
    fin2Cell1.content = '\u2022  NOW Finance analyses and assesses the suitability and affordability of the Loan to the consumer\'s needs and objectives when assessing an application for the Loan and conducts a credit assessment to confirm whether the consumer would have the financial capacity to service the ongoing financial obligations under the Loan.';
  }

  editor.insertEmbeddedObject(mainTable, 'inline');

  // ===== EXCLUDED CUSTOMERS SECTION =====
  editor.setFlowingText(editor.getFlowingText() + '\n');
  editor.setCursorPosition(getTextLength());

  const excludedHeaderBox = new TextBoxObject({
    id: `tmd_excluded_header_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 22 },
    backgroundColor: '#d9d9d9',
    border: {
      top: { width: 0, color: '#d9d9d9', style: 'solid' },
      right: { width: 0, color: '#d9d9d9', style: 'solid' },
      bottom: { width: 0, color: '#d9d9d9', style: 'solid' },
      left: { width: 0, color: '#d9d9d9', style: 'solid' }
    },
    padding: 4
  });
  excludedHeaderBox.flowingContent.insertText('Excluded customers');
  excludedHeaderBox.flowingContent.applyFormatting(0, 18, { fontWeight: 'bold', fontSize: 11 });
  editor.insertEmbeddedObject(excludedHeaderBox, 'inline');

  editor.setFlowingText(editor.getFlowingText() + '\n\nThe NOW Finance Secured Personal Loan is not designed for individuals who:\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  do not satisfy each of the Eligibility Requirements;\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  do not have consistent income;\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  want the interest rate to increase/decrease over the life of the Loan;\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  want to be able to redraw any additional repayments made on the Loan;\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  do not have a suitable asset to provide as security for the Loan;\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  are seeking a Loan amount of less than $15,000 or more than $100,000; and/or\n');
  editor.setFlowingText(editor.getFlowingText() + '  \u2022  require an ongoing line of credit that can be redrawn up to the limit.\n\n');

  // ===== DISTRIBUTION SECTION =====
  editor.setCursorPosition(getTextLength());

  const distHeaderBox = new TextBoxObject({
    id: `tmd_dist_header_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 22 },
    backgroundColor: '#d9d9d9',
    border: {
      top: { width: 0, color: '#d9d9d9', style: 'solid' },
      right: { width: 0, color: '#d9d9d9', style: 'solid' },
      bottom: { width: 0, color: '#d9d9d9', style: 'solid' },
      left: { width: 0, color: '#d9d9d9', style: 'solid' }
    },
    padding: 4
  });
  distHeaderBox.flowingContent.insertText('Distribution of the NOW Finance Secured Personal Loan');
  distHeaderBox.flowingContent.applyFormatting(0, 53, { fontWeight: 'bold', fontSize: 11 });
  editor.insertEmbeddedObject(distHeaderBox, 'inline');

  editor.setFlowingText(editor.getFlowingText() + '\n\nNOW Finance has the following distribution channels and applies the following conditions and restrictions to the distribution of the NOW Finance Secured Personal Loan through the channels so that this product is likely to be provided to customers who are in the target market.\n\n');

  // Distribution table
  editor.setCursorPosition(getTextLength());

  const distTable = new TableObject({
    id: `tmd_dist_table_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 500 },
    rows: 2,
    columns: 2,
    columnWidths: [120, 410],
    defaultFontFamily: 'Arial',
    defaultFontSize: 10,
    defaultColor: '#000000',
    defaultCellPadding: 6,
    defaultBorderWidth: 1,
    defaultBorderColor: '#000000'
  });

  // Distribution Channels row
  const distChannelsLabel = distTable.getCell(0, 0);
  const distChannelsValue = distTable.getCell(0, 1);
  if (distChannelsLabel) {
    distChannelsLabel.content = 'Distribution Channels:';
    distChannelsLabel.flowingContent.applyFormatting(0, 22, { fontWeight: 'bold' });
  }
  if (distChannelsValue) {
    distChannelsValue.content = 'Direct Channels\n\u2022  The NOW Finance website; and\n\u2022  The NOW Finance call centre.\n\nThird Party Distributions Channels\nAuthorised third party distributors such as:\n\u2022  finance brokers and aggregators;\n\u2022  partner websites (including comparison websites); and\n\u2022  authorised referrers.\n(Distributors)';
    distChannelsValue.flowingContent.applyFormatting(0, 15, { fontWeight: 'bold' });
    const thirdPartyPos = distChannelsValue.content.indexOf('Third Party Distributions Channels');
    if (thirdPartyPos >= 0) {
      distChannelsValue.flowingContent.applyFormatting(thirdPartyPos, thirdPartyPos + 34, { fontWeight: 'bold' });
    }
    const distributorsPos = distChannelsValue.content.indexOf('(Distributors)');
    if (distributorsPos >= 0) {
      distChannelsValue.flowingContent.applyFormatting(distributorsPos, distributorsPos + 14, { fontWeight: 'bold' });
    }
  }

  // Distribution Conditions row
  const distCondLabel = distTable.getCell(1, 0);
  const distCondValue = distTable.getCell(1, 1);
  if (distCondLabel) {
    distCondLabel.content = 'Distribution Conditions:';
    distCondLabel.flowingContent.applyFormatting(0, 24, { fontWeight: 'bold' });
  }
  if (distCondValue) {
    distCondValue.content = 'The NOW Finance Secured Personal Loan can only be distributed in accordance with the distribution conditions below.\n\nDirect Channels\n\u2022  NOW Finance website: Consumers click through a website journey which collects information on the consumer\'s objectives, needs and financial situation for assessment by NOW Finance. A Loan cannot be provided to a consumer until this information is collected and verified.\n\u2022  NOW Finance call centre: Call centre staff are trained and follow a call script which asks questions of a consumer to collect information on their objectives, needs and financial situation for assessment by NOW Finance. A Loan cannot be provided to a consumer until this information is collected and verified.\n\u2022  NOW Finance assesses each application against the Eligibility Requirements and conducts a credit assessment check to confirm that the consumer has an appropriate borrowing capacity to service the Loan, in accordance with NOW Finance\'s responsible lending guidelines and product and process requirements.\n\u2022  Consumers who access the Loan via direct channels are provided with information and disclosures that make it more likely that the consumer will be able to assess whether the Loan is suitable for their objectives, needs and financial situation.\n\nThird Party Distributors\n\u2022  All Distributors must have entered into a written agreement with NOW Finance which controls what they can and cannot do in distributing the product including in relation to marketing materials.\n\u2022  For partner websites and referrers, they are not permitted to market the product other than through NOW Finance approved marketing material, most only display product information on their websites and must refer the customer lead through to NOW Finance\'s direct channels above which then follow the conditions above.\n\u2022  All Distributors (excluding partner websites and referrers) must hold an Australian Credit Licence or be an authorised Credit Representative and be accredited by NOW Finance. This means that they are regulated (or subject to regulatory requirements), have their own requirements to comply with regulatory requirements, are of good standing and insured. This allows these distributors to do more than simply provide product information, they can also market and have unscripted conversations with customers.\n\u2022  All Distributors (excluding partner websites and referrers) must be trained by NOW Finance on the product features and attributes, eligibility requirements, target market and distribution to inform their conversations with customers and so they can discharge their regulatory obligations. This training is also on the Eligibility Requirements for the Loan.\n\u2022  To comply with their own regulatory obligations, all Distributors (excluding partner websites and referrers) ask questions to assess the individual customer\'s specific objectives, needs and financial situation and if they meet the eligibility criteria.\n\nIn all circumstances, a Loan cannot be provided to a consumer until NOW Finance has collected and verified required consumer information. As part of this process, NOW Finance will assess the suitability of the consumer and confirm whether the Loan will meet the consumers objectives and requirements.';
    // Bold section headers
    const directChannelsPos = distCondValue.content.indexOf('Direct Channels');
    if (directChannelsPos >= 0) {
      distCondValue.flowingContent.applyFormatting(directChannelsPos, directChannelsPos + 15, { fontWeight: 'bold' });
    }
    const thirdPartyDistPos = distCondValue.content.indexOf('Third Party Distributors');
    if (thirdPartyDistPos >= 0) {
      distCondValue.flowingContent.applyFormatting(thirdPartyDistPos, thirdPartyDistPos + 24, { fontWeight: 'bold' });
    }
    // Bold specific terms
    const nowWebsitePos = distCondValue.content.indexOf('NOW Finance website:');
    if (nowWebsitePos >= 0) {
      distCondValue.flowingContent.applyFormatting(nowWebsitePos, nowWebsitePos + 20, { fontWeight: 'bold' });
    }
    const nowCallCentrePos = distCondValue.content.indexOf('NOW Finance call centre:');
    if (nowCallCentrePos >= 0) {
      distCondValue.flowingContent.applyFormatting(nowCallCentrePos, nowCallCentrePos + 24, { fontWeight: 'bold' });
    }
  }

  editor.insertEmbeddedObject(distTable, 'inline');

  // ===== REVIEW OF TMD SECTION =====
  editor.setFlowingText(editor.getFlowingText() + '\n');
  editor.setCursorPosition(getTextLength());

  const reviewHeaderBox = new TextBoxObject({
    id: `tmd_review_header_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 22 },
    backgroundColor: '#d9d9d9',
    border: {
      top: { width: 0, color: '#d9d9d9', style: 'solid' },
      right: { width: 0, color: '#d9d9d9', style: 'solid' },
      bottom: { width: 0, color: '#d9d9d9', style: 'solid' },
      left: { width: 0, color: '#d9d9d9', style: 'solid' }
    },
    padding: 4
  });
  reviewHeaderBox.flowingContent.insertText('Review of TMD');
  reviewHeaderBox.flowingContent.applyFormatting(0, 13, { fontWeight: 'bold', fontSize: 11 });
  editor.insertEmbeddedObject(reviewHeaderBox, 'inline');

  editor.setFlowingText(editor.getFlowingText() + '\n\nNOW Finance will review this TMD periodically to ensure it remains appropriate.\n\n');

  // Review table
  editor.setCursorPosition(getTextLength());

  const reviewTable = new TableObject({
    id: `tmd_review_table_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 200 },
    rows: 2,
    columns: 2,
    columnWidths: [120, 410],
    defaultFontFamily: 'Arial',
    defaultFontSize: 10,
    defaultColor: '#000000',
    defaultCellPadding: 6,
    defaultBorderWidth: 1,
    defaultBorderColor: '#000000'
  });

  // Review Period row
  const reviewPeriodLabel = reviewTable.getCell(0, 0);
  const reviewPeriodValue = reviewTable.getCell(0, 1);
  if (reviewPeriodLabel) {
    reviewPeriodLabel.content = 'Review Period';
    reviewPeriodLabel.flowingContent.applyFormatting(0, 13, { fontWeight: 'bold' });
  }
  if (reviewPeriodValue) {
    reviewPeriodValue.content = 'Initial Review: Within 12 months of the date of this TMD.\n\nOngoing Review: Within 12 months of the date of the previous review.';
    reviewPeriodValue.flowingContent.applyFormatting(0, 15, { fontWeight: 'bold' });
    const ongoingPos = reviewPeriodValue.content.indexOf('Ongoing Review:');
    if (ongoingPos >= 0) {
      reviewPeriodValue.flowingContent.applyFormatting(ongoingPos, ongoingPos + 15, { fontWeight: 'bold' });
    }
  }

  // Review Triggers row
  const reviewTriggersLabel = reviewTable.getCell(1, 0);
  const reviewTriggersValue = reviewTable.getCell(1, 1);
  if (reviewTriggersLabel) {
    reviewTriggersLabel.content = 'Review Triggers';
    reviewTriggersLabel.flowingContent.applyFormatting(0, 15, { fontWeight: 'bold' });
  }
  if (reviewTriggersValue) {
    reviewTriggersValue.content = 'NOW Finance will also review this TMD if one or more of the following events occur:\n\u2022  Material changes to the NOW Finance Secured Personal Loan terms and conditions;\n\u2022  Occurrence of a significant dealing (where the NOW Finance Secured Personal Loan is not consistent with this TMD);\n\u2022  If the distribution conditions are found to be inadequate;\n\u2022  If there is an external event such as adverse media coverage or regulatory attention;\n\u2022  If there is a significant change in metrics, including but not limited to, complaints, default rates and application rates.';
  }

  editor.insertEmbeddedObject(reviewTable, 'inline');

  // ===== INFORMATION REPORTING SECTION =====
  editor.setFlowingText(editor.getFlowingText() + '\n');
  editor.setCursorPosition(getTextLength());

  const infoHeaderBox = new TextBoxObject({
    id: `tmd_info_header_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 22 },
    backgroundColor: '#d9d9d9',
    border: {
      top: { width: 0, color: '#d9d9d9', style: 'solid' },
      right: { width: 0, color: '#d9d9d9', style: 'solid' },
      bottom: { width: 0, color: '#d9d9d9', style: 'solid' },
      left: { width: 0, color: '#d9d9d9', style: 'solid' }
    },
    padding: 4
  });
  infoHeaderBox.flowingContent.insertText('Information Reporting');
  infoHeaderBox.flowingContent.applyFormatting(0, 21, { fontWeight: 'bold', fontSize: 11 });
  editor.insertEmbeddedObject(infoHeaderBox, 'inline');

  editor.setFlowingText(editor.getFlowingText() + '\n\nDistributors or any \'regulated person\' who engages in relation distribution conduct must provide Now Finance the following information:\n\n');

  // Information Reporting table (3 columns)
  editor.setCursorPosition(getTextLength());

  const infoTable = new TableObject({
    id: `tmd_info_table_${Date.now()}`,
    textIndex: 0,
    size: { width: 530, height: 250 },
    rows: 3,
    columns: 3,
    columnWidths: [100, 215, 215],
    defaultFontFamily: 'Arial',
    defaultFontSize: 10,
    defaultColor: '#000000',
    defaultCellPadding: 6,
    defaultBorderWidth: 1,
    defaultBorderColor: '#000000'
  });

  // Header row
  const infoHeader0 = infoTable.getCell(0, 0);
  const infoHeader1 = infoTable.getCell(0, 1);
  const infoHeader2 = infoTable.getCell(0, 2);
  if (infoHeader0) {
    infoHeader0.content = 'Category';
    infoHeader0.flowingContent.applyFormatting(0, 8, { fontStyle: 'italic', fontWeight: 'bold' });
    infoHeader0.backgroundColor = '#f2f2f2';
  }
  if (infoHeader1) {
    infoHeader1.content = 'Information to be provided';
    infoHeader1.flowingContent.applyFormatting(0, 26, { fontStyle: 'italic', fontWeight: 'bold' });
    infoHeader1.backgroundColor = '#f2f2f2';
  }
  if (infoHeader2) {
    infoHeader2.content = 'How and When to Report';
    infoHeader2.flowingContent.applyFormatting(0, 22, { fontStyle: 'italic', fontWeight: 'bold' });
    infoHeader2.backgroundColor = '#f2f2f2';
  }
  infoTable.setHeaderRow(0, true);

  // Complaints row
  const complaints0 = infoTable.getCell(1, 0);
  const complaints1 = infoTable.getCell(1, 1);
  const complaints2 = infoTable.getCell(1, 2);
  if (complaints0) {
    complaints0.content = 'Complaints';
    complaints0.flowingContent.applyFormatting(0, 10, { fontWeight: 'bold' });
  }
  if (complaints1) {
    complaints1.content = 'Any complaints made in relation to the NOW Finance Secured Personal Loan including:\n\u2022  the number of complaints received during the reporting period and;\n\u2022  written details of any complaints in the form as instructed by Now Finance.';
  }
  if (complaints2) {
    complaints2.content = 'When to report:\nWithin 10 days following the end of every six months.\n\nHow to report:\nReports should be made to: Head of Dispute Resolution by email at: disputeresolution@nowfinance.com.au';
    complaints2.flowingContent.applyFormatting(0, 15, { fontWeight: 'bold' });
    const howToReportPos = complaints2.content.indexOf('How to report:');
    if (howToReportPos >= 0) {
      complaints2.flowingContent.applyFormatting(howToReportPos, howToReportPos + 14, { fontWeight: 'bold' });
    }
  }

  // Significant dealings row
  const dealings0 = infoTable.getCell(2, 0);
  const dealings1 = infoTable.getCell(2, 1);
  const dealings2 = infoTable.getCell(2, 2);
  if (dealings0) {
    dealings0.content = 'Significant dealings';
    dealings0.flowingContent.applyFormatting(0, 20, { fontWeight: 'bold' });
  }
  if (dealings1) {
    dealings1.content = 'Any significant dealing in relation to the NOW Finance Secured Personal Loan and this TMD';
  }
  if (dealings2) {
    dealings2.content = 'When to report:\nAs soon as possible but no later than 10 days after the person becomes aware of the significant dealing.\n\nHow to report:\nReports should be made to the General Counsel by email at: legal@nowfinance.com.au';
    dealings2.flowingContent.applyFormatting(0, 15, { fontWeight: 'bold' });
    const howToReportPos2 = dealings2.content.indexOf('How to report:');
    if (howToReportPos2 >= 0) {
      dealings2.flowingContent.applyFormatting(howToReportPos2, howToReportPos2 + 14, { fontWeight: 'bold' });
    }
  }

  editor.insertEmbeddedObject(infoTable, 'inline');

  // Last Review date
  editor.setFlowingText(editor.getFlowingText() + '\n\nLast Review: November 2025');

  editor.render();
  loadDocumentSettings();
  updateStatus('TMD Sample document loaded');
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
