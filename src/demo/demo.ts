import { PCEditor, DocumentData, ImageObject, TextBoxObject, TableObject, EditorSelection, SubstitutionField, RepeatingSection, EditingSection, TextAlignment, HorizontalRuler, VerticalRuler } from '../lib';

let editor: PCEditor;
let currentSelectedField: SubstitutionField | null = null;
let currentSelectedSection: RepeatingSection | null = null;
let currentSelectedTextBox: TextBoxObject | null = null;
let currentSelectedTable: TableObject | null = null;
let currentSelectedImage: ImageObject | null = null;
let currentSelectedRowLoop: { table: TableObject; loopId: string } | null = null;
let horizontalRuler: HorizontalRuler | null = null;
let verticalRuler: VerticalRuler | null = null;

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
    updateStatus('Editor initialized');
  });
}

function setupEditorEventLogging(): void {
  // Selection change - unified event for cursor, text selection, element selection, and repeating section selection
  editor.on('selection-change', (event: { selection: EditorSelection }) => {
    const selection = event.selection;

    // Check if a substitution field is selected
    const selectedField = editor.getSelectedField();
    updateFieldPane(selectedField);

    // Handle repeating section selection
    if (selection.type === 'repeating-section') {
      console.log(`[Editor Event] selection-change: repeating section selected: ${selection.sectionId}`);
      const section = editor.getRepeatingSection(selection.sectionId);
      if (section) {
        updateLoopPane(section);
        updateStatus(`Loop "${section.fieldPath}" selected`);
      }
      hideTextBoxPane();
      hideImagePane();
      hideFormattingPane();
      return; // Don't hide loop pane or continue processing
    }

    // Hide loop pane for non-section selections
    hideLoopPane();

    // Check if a text box is selected (embedded object)
    const selectedTextBox = editor.getSelectedTextBox?.();
    if (selectedTextBox && !selectedTextBox.editing) {
      updateTextBoxPane(selectedTextBox);
    } else {
      hideTextBoxPane();
    }

    // Check if an image is selected (embedded object)
    const selectedImage = editor.getSelectedImage?.();
    if (selectedImage) {
      updateImagePane(selectedImage);
    } else {
      hideImagePane();
    }

    // Check if a table is selected or focused
    const selectedTable = editor.getSelectedTable?.() || editor.getFocusedTable?.();
    updateTableTools(selectedTable);
    updateTablePane(selectedTable);

    if (selection.type === 'cursor') {
      console.log(`[Editor Event] selection-change: cursor at position ${selection.position}`);
      if (selectedField) {
        updateStatus(`Field "${selectedField.fieldName}" selected`);
      } else {
        updateStatus(`Cursor at position ${selection.position}`);
      }
      // Show and update formatting pane for text cursor
      showFormattingPane();
      updateFormattingPane();
    } else if (selection.type === 'text') {
      console.log(`[Editor Event] selection-change: text selection from ${selection.start} to ${selection.end}`);
      if (selectedField) {
        updateStatus(`Field "${selectedField.fieldName}" selected`);
      } else {
        updateStatus(`Text selected: ${selection.end - selection.start} characters`);
      }
      // Show and update formatting pane for text selection
      showFormattingPane();
      updateFormattingPane();
    } else {
      console.log('[Editor Event] selection-change: no selection');
      // Hide formatting pane when nothing is selected
      hideFormattingPane();
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
    // Update list buttons in case list formatting changed (e.g., via Shift+Tab)
    updateListButtons();
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
  editor.on('text-editing-started', (event: { source: 'body' | 'textbox' | 'tablecell' }) => {
    console.log('[Editor Event] text-editing-started', event);
    // Show formatting pane when editing any text
    hideTextBoxPane();
    showFormattingPane();
    updateFormattingPane();

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
    // Hide formatting pane when not editing text
    hideFormattingPane();
  });

  // Legacy text box editing events (for backwards compatibility)
  editor.on('textbox-editing-started', (event: any) => {
    console.log('[Editor Event] textbox-editing-started', event);
  });

  editor.on('textbox-editing-ended', () => {
    console.log('[Editor Event] textbox-editing-ended');
  });

  editor.on('textbox-cursor-changed', () => {
    // Update formatting pane when cursor moves within text box
    updateFormattingPane();
  });

  editor.on('tablecell-cursor-changed', () => {
    // Update formatting pane when cursor moves within table cell
    updateFormattingPane();
    // Update table pane with current cell info
    const focusedTable = editor.getFocusedTable?.();
    if (focusedTable) {
      updateTablePane(focusedTable);
    }
  });

  // Text events
  editor.on('text-clicked', (event: any) => {
    console.log('[Editor Event] text-clicked', event);
    updateStatus('Text cursor active - use toolbar to insert content');
  });

  editor.on('cursor-changed', (event: any) => {
    console.log('[Editor Event] cursor-changed', event);
    // Update list buttons when cursor moves to reflect current paragraph's formatting
    updateListButtons();
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
    hideLoopPane();
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

  // View controls (menu)
  document.getElementById('zoom-in')?.addEventListener('click', () => editor?.zoomIn());
  document.getElementById('zoom-out')?.addEventListener('click', () => editor?.zoomOut());
  document.getElementById('fit-page')?.addEventListener('click', () => editor?.fitToPage());

  // View controls (sidebar pane)
  document.getElementById('toggle-control-chars-btn')?.addEventListener('click', toggleControlCharacters);
  document.getElementById('toggle-margin-lines-btn')?.addEventListener('click', toggleMarginLines);
  document.getElementById('toggle-grid-btn')?.addEventListener('click', toggleGrid);
  document.getElementById('toggle-rulers-btn')?.addEventListener('click', toggleRulers);

  // Prevent buttons from stealing focus - define early so it's available for all sections
  const preventFocusSteal = (e: MouseEvent) => e.preventDefault();

  // Save editing context before focus is stolen (for dropdowns/color pickers that need focus)
  const saveSelectionBeforeFocusSteal = () => {
    editor?.saveEditingContext();
  };

  // Embedded content controls
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

  // Table row loop section controls
  document.getElementById('apply-table-row-loop')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-table-row-loop')?.addEventListener('click', applyTableRowLoop);
  document.getElementById('delete-table-row-loop')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('delete-table-row-loop')?.addEventListener('click', deleteTableRowLoop);

  // Document settings controls
  document.getElementById('apply-margins')?.addEventListener('click', applyMargins);
  document.getElementById('page-size-select')?.addEventListener('change', updatePageSettings);
  document.getElementById('page-orientation-select')?.addEventListener('change', updatePageSettings);

  // Collapsible sections
  setupCollapsibleSections();

  // Merge data
  document.getElementById('apply-merge')?.addEventListener('click', applyMergeData);

  // Export
  document.getElementById('export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('import-pdf')?.addEventListener('click', () => {
    document.getElementById('pdf-file-input')?.click();
  });
  document.getElementById('pdf-file-input')?.addEventListener('change', importPDFHandler);

  // Save/Load
  document.getElementById('save-document')?.addEventListener('click', saveDocumentHandler);
  document.getElementById('load-document')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });
  document.getElementById('file-input')?.addEventListener('change', loadDocumentHandler);

  // Formatting controls
  document.getElementById('format-bold')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('format-bold')?.addEventListener('click', toggleBold);
  document.getElementById('format-italic')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('format-italic')?.addEventListener('click', toggleItalic);
  // For controls that need focus (dropdowns, color pickers), save selection on mousedown
  document.getElementById('format-font-family')?.addEventListener('mousedown', saveSelectionBeforeFocusSteal);
  document.getElementById('format-font-family')?.addEventListener('change', applyFontFamily);
  document.getElementById('format-font-size')?.addEventListener('mousedown', saveSelectionBeforeFocusSteal);
  document.getElementById('format-font-size')?.addEventListener('change', applyFontSize);
  document.getElementById('format-color')?.addEventListener('mousedown', saveSelectionBeforeFocusSteal);
  document.getElementById('format-color')?.addEventListener('input', applyTextColor);
  document.getElementById('format-highlight')?.addEventListener('mousedown', saveSelectionBeforeFocusSteal);
  document.getElementById('format-highlight')?.addEventListener('input', applyHighlight);
  document.getElementById('clear-highlight')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('clear-highlight')?.addEventListener('click', clearHighlight);

  // Alignment controls
  document.getElementById('align-left')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('align-left')?.addEventListener('click', () => setAlignment('left'));
  document.getElementById('align-center')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('align-center')?.addEventListener('click', () => setAlignment('center'));
  document.getElementById('align-right')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('align-right')?.addEventListener('click', () => setAlignment('right'));
  document.getElementById('align-justify')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('align-justify')?.addEventListener('click', () => setAlignment('justify'));

  // List controls
  document.getElementById('toggle-bullet-list')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('toggle-bullet-list')?.addEventListener('click', toggleBulletList);
  document.getElementById('toggle-number-list')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('toggle-number-list')?.addEventListener('click', toggleNumberedList);
  document.getElementById('indent-list')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('indent-list')?.addEventListener('click', indentParagraph);
  document.getElementById('outdent-list')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('outdent-list')?.addEventListener('click', outdentParagraph);

  // Hyperlink controls
  document.getElementById('insert-hyperlink')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-hyperlink')?.addEventListener('click', insertOrEditHyperlink);
  document.getElementById('remove-hyperlink')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('remove-hyperlink')?.addEventListener('click', removeHyperlink);
  document.getElementById('apply-hyperlink-changes')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-hyperlink-changes')?.addEventListener('click', applyHyperlinkChanges);
  document.getElementById('remove-hyperlink-btn')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('remove-hyperlink-btn')?.addEventListener('click', removeHyperlink);

  // Field controls
  document.getElementById('apply-field-changes')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-field-changes')?.addEventListener('click', applyFieldChanges);
  document.getElementById('field-value-type')?.addEventListener('change', updateFieldFormatGroups);

  // Loop controls
  document.getElementById('create-loop')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('create-loop')?.addEventListener('click', createLoop);
  document.getElementById('insert-page-break')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-page-break')?.addEventListener('click', insertPageBreak);
  document.getElementById('apply-loop-changes')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-loop-changes')?.addEventListener('click', applyLoopChanges);
  document.getElementById('delete-loop')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('delete-loop')?.addEventListener('click', deleteLoop);

  // Text box controls
  document.getElementById('apply-textbox-changes')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-textbox-changes')?.addEventListener('click', applyTextBoxChanges);
  document.getElementById('textbox-position')?.addEventListener('change', (e) => {
    const offsetGroup = document.getElementById('textbox-offset-group');
    if (offsetGroup) {
      offsetGroup.style.display = (e.target as HTMLSelectElement).value === 'relative' ? 'block' : 'none';
    }
  });

  // Image pane controls
  document.getElementById('apply-image-changes')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-image-changes')?.addEventListener('click', applyImageChanges);
  document.getElementById('image-position')?.addEventListener('change', (e) => {
    const offsetGroup = document.getElementById('image-offset-group');
    if (offsetGroup) {
      offsetGroup.style.display = (e.target as HTMLSelectElement).value === 'relative' ? 'block' : 'none';
    }
  });
  document.getElementById('change-image-btn')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('change-image-btn')?.addEventListener('click', () => {
    document.getElementById('image-file-picker')?.click();
  });
  document.getElementById('image-file-picker')?.addEventListener('change', handleImageFileChange);

  // Table pane controls
  document.getElementById('table-pane-add-row-before')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-pane-add-row-before')?.addEventListener('click', tablePaneAddRowBefore);
  document.getElementById('table-pane-add-row-after')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-pane-add-row-after')?.addEventListener('click', tablePaneAddRowAfter);
  document.getElementById('table-pane-delete-row')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-pane-delete-row')?.addEventListener('click', tablePaneDeleteRow);
  document.getElementById('table-pane-add-col-before')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-pane-add-col-before')?.addEventListener('click', tablePaneAddColBefore);
  document.getElementById('table-pane-add-col-after')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-pane-add-col-after')?.addEventListener('click', tablePaneAddColAfter);
  document.getElementById('table-pane-delete-col')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-pane-delete-col')?.addEventListener('click', tablePaneDeleteCol);
  document.getElementById('table-pane-merge')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-pane-merge')?.addEventListener('click', tablePaneMergeCells);
  document.getElementById('table-pane-split')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-pane-split')?.addEventListener('click', tablePaneSplitCell);
  document.getElementById('table-apply-cell-bg')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-apply-cell-bg')?.addEventListener('click', tablePaneApplyCellBackground);
  document.getElementById('table-apply-borders')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-apply-borders')?.addEventListener('click', tablePaneApplyBorders);
  document.getElementById('table-apply-headers')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-apply-headers')?.addEventListener('click', tablePaneApplyHeaders);
  document.getElementById('table-apply-header-style')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-apply-header-style')?.addEventListener('click', tablePaneApplyHeaderStyle);
  document.getElementById('table-apply-defaults')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-apply-defaults')?.addEventListener('click', tablePaneApplyDefaults);
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

function toggleControlCharacters(): void {
  if (!editor) return;

  const currentState = editor.getShowControlCharacters();
  editor.setShowControlCharacters(!currentState);

  // Update sidebar button state
  const sidebarButton = document.getElementById('toggle-control-chars-btn');
  if (sidebarButton) {
    sidebarButton.classList.toggle('active', !currentState);
  }

  updateStatus(`Control characters ${!currentState ? 'shown' : 'hidden'}`);
}

function toggleMarginLines(): void {
  if (!editor) return;

  const currentState = editor.getShowMarginLines();
  editor.setShowMarginLines(!currentState);

  // Update button state
  const button = document.getElementById('toggle-margin-lines-btn');
  if (button) {
    button.classList.toggle('active', !currentState);
  }

  updateStatus(`Margin lines ${!currentState ? 'shown' : 'hidden'}`);
}

function toggleGrid(): void {
  if (!editor) return;

  const currentState = editor.getShowGrid();
  editor.setShowGrid(!currentState);

  // Update button state
  const button = document.getElementById('toggle-grid-btn');
  if (button) {
    button.classList.toggle('active', !currentState);
  }

  updateStatus(`Grid ${!currentState ? 'shown' : 'hidden'}`);
}

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

function toggleRulers(): void {
  const rulersVisible = horizontalRuler?.isVisible ?? false;

  if (rulersVisible) {
    horizontalRuler?.hide();
    verticalRuler?.hide();
  } else {
    horizontalRuler?.show();
    verticalRuler?.show();
  }

  // Update button state
  const button = document.getElementById('toggle-rulers-btn');
  if (button) {
    button.classList.toggle('active', !rulersVisible);
  }

  // Also hide/show ruler containers and corner
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

function applyMargins(): void {
  if (!editor) return;

  const topInput = document.getElementById('margin-top') as HTMLInputElement;
  const rightInput = document.getElementById('margin-right') as HTMLInputElement;
  const bottomInput = document.getElementById('margin-bottom') as HTMLInputElement;
  const leftInput = document.getElementById('margin-left') as HTMLInputElement;

  if (!topInput || !rightInput || !bottomInput || !leftInput) return;

  const margins = {
    top: parseFloat(topInput.value),
    right: parseFloat(rightInput.value),
    bottom: parseFloat(bottomInput.value),
    left: parseFloat(leftInput.value)
  };

  try {
    editor.updateDocumentSettings({ margins });
    updateStatus('Margins updated');
  } catch (error) {
    updateStatus('Failed to update margins', 'error');
    console.error('Margin update error:', error);
  }
}

function updatePageSettings(): void {
  if (!editor) return;

  const pageSizeSelect = document.getElementById('page-size-select') as HTMLSelectElement;
  const pageOrientationSelect = document.getElementById('page-orientation-select') as HTMLSelectElement;

  if (!pageSizeSelect || !pageOrientationSelect) return;

  const settings = {
    pageSize: pageSizeSelect.value,
    pageOrientation: pageOrientationSelect.value
  };

  try {
    editor.updateDocumentSettings(settings);
    updateStatus(`Page: ${settings.pageSize} ${settings.pageOrientation}`);
    updateDocumentInfo();
  } catch (error) {
    updateStatus('Failed to update page settings', 'error');
    console.error('Page settings update error:', error);
  }
}

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
 * Get the current merge data from the textarea.
 */
function getMergeData(): Record<string, unknown> | null {
  const textarea = document.getElementById('merge-data-input') as HTMLTextAreaElement;
  if (!textarea) return null;

  try {
    return JSON.parse(textarea.value);
  } catch {
    return null;
  }
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
      updateLoopPane(section);
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

// ============================================
// Formatting Functions
// ============================================

/**
 * Update the formatting pane UI to reflect the current selection's formatting.
 */
function updateFormattingPane(): void {
  if (!editor) return;

  // Get formatting from whatever text is being edited (body, textbox, or table cell)
  const formatting = editor.getUnifiedFormattingAtCursor();
  if (!formatting) return;

  // Update Bold button
  const boldBtn = document.getElementById('format-bold');
  if (boldBtn) {
    if (formatting.fontWeight === 'bold') {
      boldBtn.classList.add('active');
    } else {
      boldBtn.classList.remove('active');
    }
  }

  // Update Italic button
  const italicBtn = document.getElementById('format-italic');
  if (italicBtn) {
    if (formatting.fontStyle === 'italic') {
      italicBtn.classList.add('active');
    } else {
      italicBtn.classList.remove('active');
    }
  }

  // Update Font Family dropdown
  const fontFamilySelect = document.getElementById('format-font-family') as HTMLSelectElement;
  if (fontFamilySelect && formatting.fontFamily) {
    fontFamilySelect.value = formatting.fontFamily;
  }

  // Update Font Size dropdown
  const fontSizeSelect = document.getElementById('format-font-size') as HTMLSelectElement;
  if (fontSizeSelect && formatting.fontSize) {
    fontSizeSelect.value = formatting.fontSize.toString();
  }

  // Update Color picker
  const colorInput = document.getElementById('format-color') as HTMLInputElement;
  if (colorInput && formatting.color) {
    colorInput.value = formatting.color;
  }

  // Update Highlight picker
  const highlightInput = document.getElementById('format-highlight') as HTMLInputElement;
  if (highlightInput && formatting.backgroundColor) {
    highlightInput.value = formatting.backgroundColor;
  }

  // Update Alignment buttons
  const alignment = editor.getUnifiedAlignmentAtCursor();
  updateAlignmentButtons(alignment);

  // Update List buttons
  updateListButtons();

  // Update Hyperlink pane
  updateHyperlinkPane();
}

function getSelection(): { start: number; end: number } | null {
  if (!editor) return null;

  // Use unified selection API with fallback to saved context
  // This handles cases where focus was stolen by dropdowns
  return editor.getSavedOrCurrentSelection();
}

function applyFormattingToSelection(formatting: Record<string, any>): void {
  const selection = getSelection();

  try {
    if (selection) {
      // Apply formatting to the selected range
      editor.applyFormattingWithFallback(selection.start, selection.end, formatting);
      updateStatus('Formatting applied');
    } else {
      // No selection - set pending formatting for next character typed
      editor.setPendingFormatting(formatting);
      updateStatus('Formatting set for next character');
    }
    // Clear the saved context now that we've used it
    editor.clearSavedEditingContext();
    // Update the formatting pane to reflect the new formatting
    updateFormattingPane();
    // Restore focus to the editor so selection is preserved
    editor.enableTextInput();
  } catch (error) {
    // If no text is being edited, show error
    updateStatus('Click in text to apply formatting', 'error');
    console.error('Formatting error:', error);
  }
}

function toggleBold(): void {
  const btn = document.getElementById('format-bold');
  const isActive = btn?.classList.contains('active');

  applyFormattingToSelection({
    fontWeight: isActive ? 'normal' : 'bold'
  });
}

function toggleItalic(): void {
  const btn = document.getElementById('format-italic');
  const isActive = btn?.classList.contains('active');

  applyFormattingToSelection({
    fontStyle: isActive ? 'normal' : 'italic'
  });
}

function applyFontFamily(): void {
  const select = document.getElementById('format-font-family') as HTMLSelectElement;
  if (!select) return;

  applyFormattingToSelection({
    fontFamily: select.value
  });
}

function applyFontSize(): void {
  const select = document.getElementById('format-font-size') as HTMLSelectElement;
  if (!select) return;

  applyFormattingToSelection({
    fontSize: parseInt(select.value, 10)
  });
}

function applyTextColor(): void {
  const input = document.getElementById('format-color') as HTMLInputElement;
  if (!input) return;

  applyFormattingToSelection({
    color: input.value
  });
}

function applyHighlight(): void {
  const input = document.getElementById('format-highlight') as HTMLInputElement;
  if (!input) return;

  applyFormattingToSelection({
    backgroundColor: input.value
  });
}

function clearHighlight(): void {
  applyFormattingToSelection({
    backgroundColor: undefined
  });
}

// ============================================
// Alignment Functions
// ============================================

/**
 * Set the alignment for the current paragraph or selection.
 */
function setAlignment(alignment: TextAlignment): void {
  if (!editor) return;

  try {
    // Use unified alignment API - works for body, textbox, and table cells
    editor.setUnifiedAlignment(alignment);
    updateAlignmentButtons(alignment);
    updateStatus(`Alignment: ${alignment}`);
  } catch (error) {
    updateStatus('Failed to set alignment', 'error');
    console.error('Alignment error:', error);
  }
}

/**
 * Update the alignment buttons to show the active alignment.
 */
function updateAlignmentButtons(alignment: TextAlignment): void {
  const alignments: TextAlignment[] = ['left', 'center', 'right', 'justify'];

  for (const a of alignments) {
    const btn = document.getElementById(`align-${a}`);
    if (btn) {
      if (a === alignment) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }
}

// ============================================
// List Functions
// ============================================

/**
 * Toggle bullet list for the current paragraph.
 */
function toggleBulletList(): void {
  if (!editor) return;
  try {
    editor.toggleBulletList();
    updateListButtons();
    updateStatus('Toggled bullet list');
  } catch (error) {
    updateStatus('Failed to toggle bullet list', 'error');
    console.error('Bullet list error:', error);
  }
}

/**
 * Toggle numbered list for the current paragraph.
 */
function toggleNumberedList(): void {
  if (!editor) return;
  try {
    editor.toggleNumberedList();
    updateListButtons();
    updateStatus('Toggled numbered list');
  } catch (error) {
    updateStatus('Failed to toggle numbered list', 'error');
    console.error('Numbered list error:', error);
  }
}

/**
 * Indent the current paragraph.
 */
function indentParagraph(): void {
  if (!editor) return;
  try {
    editor.indentParagraph();
    updateListButtons();
    updateStatus('Increased indent');
  } catch (error) {
    updateStatus('Failed to indent', 'error');
    console.error('Indent error:', error);
  }
}

/**
 * Outdent the current paragraph.
 */
function outdentParagraph(): void {
  if (!editor) return;
  try {
    editor.outdentParagraph();
    updateListButtons();
    updateStatus('Decreased indent');
  } catch (error) {
    updateStatus('Failed to outdent', 'error');
    console.error('Outdent error:', error);
  }
}

/**
 * Update the list buttons to show active state.
 */
function updateListButtons(): void {
  if (!editor) return;

  const listFormatting = editor.getListFormatting();
  const bulletBtn = document.getElementById('toggle-bullet-list');
  const numberBtn = document.getElementById('toggle-number-list');

  if (bulletBtn) {
    bulletBtn.classList.toggle('active', listFormatting?.listType === 'bullet');
  }
  if (numberBtn) {
    numberBtn.classList.toggle('active', listFormatting?.listType === 'number');
  }
}

// ============================================
// Hyperlink Functions
// ============================================

// Track the currently selected hyperlink for the properties pane
let currentSelectedHyperlink: { id: string; url: string; title?: string; startIndex: number; endIndex: number } | null = null;

/**
 * Insert a new hyperlink or edit an existing one at the cursor.
 */
function insertOrEditHyperlink(): void {
  if (!editor) return;

  try {
    // Check if we're at an existing hyperlink
    const cursorPos = editor.getCursorPosition();
    const existingLink = editor.getHyperlinkAt(cursorPos);

    console.log('[insertOrEditHyperlink] cursorPos:', cursorPos, 'existingLink:', existingLink);

    if (existingLink) {
      // Edit existing hyperlink - show properties pane
      showHyperlinkPane(existingLink);
      updateStatus('Editing hyperlink');
    } else {
      // Insert new hyperlink - requires text selection
      // First try the event-tracked selection, then fall back to direct query
      const selection = editor.getSelection();
      const textSelection = editor.getTextSelection();
      console.log('[insertOrEditHyperlink] selection:', selection, 'textSelection:', textSelection);

      // Check if there's a valid text selection
      const hasTextSelection = (selection?.type === 'text' && selection.start !== selection.end) ||
                               (textSelection !== null && textSelection.start !== textSelection.end);

      if (!hasTextSelection) {
        updateStatus('Select text first to insert a hyperlink', 'error');
        return;
      }

      // Prompt for URL
      const url = prompt('Enter URL:', 'https://');
      if (!url) return;

      const hyperlink = editor.insertHyperlink(url);
      if (hyperlink) {
        showHyperlinkPane(hyperlink);
        updateStatus('Hyperlink inserted');
      }
    }
  } catch (error) {
    updateStatus('Failed to insert hyperlink', 'error');
    console.error('Hyperlink error:', error);
  }
}

/**
 * Remove the hyperlink at the cursor.
 */
function removeHyperlink(): void {
  if (!editor) return;

  try {
    // Check for hyperlink at cursor or from current selection
    const cursorPos = editor.getCursorPosition();
    const hyperlink = currentSelectedHyperlink || editor.getHyperlinkAt(cursorPos);

    if (hyperlink) {
      editor.removeHyperlink(hyperlink.id);
      currentSelectedHyperlink = null;
      hideHyperlinkPane();
      updateStatus('Hyperlink removed');
    } else {
      updateStatus('No hyperlink at cursor', 'error');
    }
  } catch (error) {
    updateStatus('Failed to remove hyperlink', 'error');
    console.error('Remove hyperlink error:', error);
  }
}

/**
 * Apply changes from the hyperlink properties pane.
 */
function applyHyperlinkChanges(): void {
  if (!editor || !currentSelectedHyperlink) return;

  try {
    const urlInput = document.getElementById('hyperlink-url-input') as HTMLInputElement;
    const titleInput = document.getElementById('hyperlink-title-input') as HTMLInputElement;

    if (!urlInput) return;

    const url = urlInput.value.trim();
    const title = titleInput?.value.trim() || undefined;

    if (!url) {
      updateStatus('URL is required', 'error');
      return;
    }

    editor.updateHyperlink(currentSelectedHyperlink.id, { url, title });
    currentSelectedHyperlink.url = url;
    currentSelectedHyperlink.title = title;

    updateStatus('Hyperlink updated');
  } catch (error) {
    updateStatus('Failed to update hyperlink', 'error');
    console.error('Update hyperlink error:', error);
  }
}

/**
 * Show the hyperlink properties pane.
 */
function showHyperlinkPane(hyperlink: { id: string; url: string; title?: string; startIndex: number; endIndex: number }): void {
  const section = document.getElementById('hyperlink-section');
  const urlInput = document.getElementById('hyperlink-url-input') as HTMLInputElement;
  const titleInput = document.getElementById('hyperlink-title-input') as HTMLInputElement;
  const rangeHint = document.getElementById('hyperlink-range-hint');

  if (!section) return;

  currentSelectedHyperlink = hyperlink;
  section.style.display = 'block';

  if (urlInput) {
    urlInput.value = hyperlink.url;
  }
  if (titleInput) {
    titleInput.value = hyperlink.title || '';
  }
  if (rangeHint) {
    rangeHint.textContent = `Link spans characters ${hyperlink.startIndex} to ${hyperlink.endIndex}`;
  }
}

/**
 * Hide the hyperlink properties pane.
 */
function hideHyperlinkPane(): void {
  const section = document.getElementById('hyperlink-section');
  if (section) {
    section.style.display = 'none';
  }
  currentSelectedHyperlink = null;
}

/**
 * Update hyperlink pane based on cursor position.
 */
function updateHyperlinkPane(): void {
  if (!editor) return;

  const cursorPos = editor.getCursorPosition();
  const hyperlink = editor.getHyperlinkAt(cursorPos);

  if (hyperlink) {
    showHyperlinkPane(hyperlink);
  } else {
    hideHyperlinkPane();
  }
}

// ============================================
// Field Pane Functions
// ============================================

/**
 * Update the field pane to show/hide based on whether a field is selected.
 */
function updateFieldPane(field: SubstitutionField | null): void {
  const fieldSection = document.getElementById('field-section');
  const fieldNameInput = document.getElementById('field-name-input') as HTMLInputElement;
  const fieldDefaultInput = document.getElementById('field-default-input') as HTMLInputElement;
  const fieldPositionHint = document.getElementById('field-position-hint');
  const fieldValueType = document.getElementById('field-value-type') as HTMLSelectElement;
  const fieldNumberFormat = document.getElementById('field-number-format') as HTMLSelectElement;
  const fieldCurrencyFormat = document.getElementById('field-currency-format') as HTMLSelectElement;
  const fieldDateFormat = document.getElementById('field-date-format') as HTMLSelectElement;

  if (!fieldSection) return;

  if (field) {
    // Show the field pane and populate with field data
    fieldSection.style.display = 'block';
    currentSelectedField = field;

    if (fieldNameInput) {
      fieldNameInput.value = field.fieldName;
    }
    if (fieldDefaultInput) {
      fieldDefaultInput.value = field.defaultValue || '';
    }
    if (fieldPositionHint) {
      fieldPositionHint.textContent = `Field at position ${field.textIndex}`;
    }

    // Populate format options
    if (fieldValueType) {
      fieldValueType.value = field.formatConfig?.valueType || '';
    }
    if (fieldNumberFormat && field.formatConfig?.numberFormat) {
      fieldNumberFormat.value = field.formatConfig.numberFormat;
    }
    if (fieldCurrencyFormat && field.formatConfig?.currencyFormat) {
      fieldCurrencyFormat.value = field.formatConfig.currencyFormat;
    }
    if (fieldDateFormat && field.formatConfig?.dateFormat) {
      fieldDateFormat.value = field.formatConfig.dateFormat;
    }

    // Update visibility of format groups
    updateFieldFormatGroups();

    console.log(`[Field Pane] Showing field: ${field.fieldName} at position ${field.textIndex}`);
  } else {
    // Hide the field pane
    fieldSection.style.display = 'none';
    currentSelectedField = null;
  }
}

/**
 * Update visibility of format-specific option groups based on value type.
 */
function updateFieldFormatGroups(): void {
  const valueType = (document.getElementById('field-value-type') as HTMLSelectElement)?.value;
  const numberGroup = document.getElementById('number-format-group');
  const currencyGroup = document.getElementById('currency-format-group');
  const dateGroup = document.getElementById('date-format-group');

  if (numberGroup) numberGroup.style.display = valueType === 'number' ? 'block' : 'none';
  if (currencyGroup) currencyGroup.style.display = valueType === 'currency' ? 'block' : 'none';
  if (dateGroup) dateGroup.style.display = valueType === 'date' ? 'block' : 'none';
}

/**
 * Apply changes to the currently selected field.
 */
function applyFieldChanges(): void {
  if (!editor || !currentSelectedField) {
    updateStatus('No field selected', 'error');
    return;
  }

  const fieldNameInput = document.getElementById('field-name-input') as HTMLInputElement;
  const fieldDefaultInput = document.getElementById('field-default-input') as HTMLInputElement;
  const fieldValueType = document.getElementById('field-value-type') as HTMLSelectElement;
  const fieldNumberFormat = document.getElementById('field-number-format') as HTMLSelectElement;
  const fieldCurrencyFormat = document.getElementById('field-currency-format') as HTMLSelectElement;
  const fieldDateFormat = document.getElementById('field-date-format') as HTMLSelectElement;

  if (!fieldNameInput) return;

  const newFieldName = fieldNameInput.value.trim();
  if (!newFieldName) {
    updateStatus('Field name cannot be empty', 'error');
    return;
  }

  const updates: {
    fieldName?: string;
    defaultValue?: string;
    formatConfig?: {
      valueType?: 'string' | 'number' | 'currency' | 'date' | 'markdown';
      numberFormat?: string;
      currencyFormat?: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'custom';
      dateFormat?: string;
    };
  } = {};

  if (newFieldName !== currentSelectedField.fieldName) {
    updates.fieldName = newFieldName;
  }

  const newDefaultValue = fieldDefaultInput?.value || undefined;
  if (newDefaultValue !== currentSelectedField.defaultValue) {
    updates.defaultValue = newDefaultValue;
  }

  // Build format config based on value type
  const valueType = fieldValueType?.value as 'number' | 'currency' | 'date' | '';
  if (valueType) {
    const formatConfig: NonNullable<typeof updates.formatConfig> = {
      valueType: valueType as 'number' | 'currency' | 'date'
    };

    if (valueType === 'number' && fieldNumberFormat?.value) {
      formatConfig.numberFormat = fieldNumberFormat.value;
    } else if (valueType === 'currency' && fieldCurrencyFormat?.value) {
      formatConfig.currencyFormat = fieldCurrencyFormat.value as 'USD' | 'EUR' | 'GBP' | 'JPY';
    } else if (valueType === 'date' && fieldDateFormat?.value) {
      formatConfig.dateFormat = fieldDateFormat.value;
    }

    updates.formatConfig = formatConfig;
  } else if (currentSelectedField.formatConfig) {
    // Clear format config if value type was cleared
    updates.formatConfig = undefined;
  }

  if (Object.keys(updates).length === 0) {
    updateStatus('No changes to apply');
    return;
  }

  const success = editor.updateField(currentSelectedField.textIndex, updates);

  if (success) {
    updateStatus(`Field updated to "${newFieldName}"`);
    // Update the current field reference
    currentSelectedField = editor.getFieldAt(currentSelectedField.textIndex);
  } else {
    updateStatus('Failed to update field', 'error');
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

function applyMergeData(): void {
  if (!editor) return;

  const textarea = document.getElementById('merge-data-input') as HTMLTextAreaElement;
  if (!textarea) return;

  try {
    const mergeData = JSON.parse(textarea.value);

    // Apply the merge data to substitute all fields
    editor.applyMergeData(mergeData);
    updateStatus('Merge data applied');
  } catch (error) {
    if (error instanceof SyntaxError) {
      updateStatus('Invalid JSON in merge data', 'error');
    } else {
      updateStatus('Failed to apply merge data', 'error');
    }
    console.error('Merge data error:', error);
  }
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

/**
 * Update the loop pane to show the selected section.
 */
function updateLoopPane(section: RepeatingSection | null): void {
  const loopSection = document.getElementById('loop-section');
  const fieldPathInput = document.getElementById('loop-field-path') as HTMLInputElement;
  const positionHint = document.getElementById('loop-position-hint');

  if (!loopSection) return;

  if (section) {
    // Show the loop pane and populate with section data
    loopSection.style.display = 'block';
    currentSelectedSection = section;

    if (fieldPathInput) {
      fieldPathInput.value = section.fieldPath;
    }
    if (positionHint) {
      positionHint.textContent = `Loop from position ${section.startIndex} to ${section.endIndex}`;
    }

    // Hide field pane if it's visible
    const fieldSection = document.getElementById('field-section');
    if (fieldSection) {
      fieldSection.style.display = 'none';
      currentSelectedField = null;
    }

    console.log(`[Loop Pane] Showing loop: ${section.fieldPath} (${section.startIndex} - ${section.endIndex})`);
  } else {
    hideLoopPane();
  }
}

/**
 * Hide the loop pane.
 */
function hideLoopPane(): void {
  const loopSection = document.getElementById('loop-section');
  if (loopSection) {
    loopSection.style.display = 'none';
  }
  currentSelectedSection = null;
}

/**
 * Apply changes to the currently selected loop.
 */
function applyLoopChanges(): void {
  if (!editor || !currentSelectedSection) {
    updateStatus('No loop selected', 'error');
    return;
  }

  const fieldPathInput = document.getElementById('loop-field-path') as HTMLInputElement;
  if (!fieldPathInput) return;

  const newFieldPath = fieldPathInput.value.trim();
  if (!newFieldPath) {
    updateStatus('Field path cannot be empty', 'error');
    return;
  }

  if (newFieldPath === currentSelectedSection.fieldPath) {
    updateStatus('No changes to apply');
    return;
  }

  const success = editor.updateRepeatingSectionFieldPath(currentSelectedSection.id, newFieldPath);

  if (success) {
    updateStatus(`Loop updated to "${newFieldPath}"`);
    // Update the current section reference
    currentSelectedSection = editor.getRepeatingSection(currentSelectedSection.id);
    if (currentSelectedSection) {
      updateLoopPane(currentSelectedSection);
    }
  } else {
    updateStatus('Failed to update loop', 'error');
  }
}

/**
 * Delete the currently selected loop.
 */
function deleteLoop(): void {
  if (!editor || !currentSelectedSection) {
    updateStatus('No loop selected', 'error');
    return;
  }

  const success = editor.removeRepeatingSection(currentSelectedSection.id);

  if (success) {
    hideLoopPane();
    updateStatus('Loop deleted');
  } else {
    updateStatus('Failed to delete loop', 'error');
  }
}

/**
 * Update the text box pane when a text box is selected.
 */
function updateTextBoxPane(textBox: TextBoxObject | null): void {
  const textboxSection = document.getElementById('textbox-section');
  const positionSelect = document.getElementById('textbox-position') as HTMLSelectElement;
  const offsetGroup = document.getElementById('textbox-offset-group');
  const offsetXInput = document.getElementById('textbox-offset-x') as HTMLInputElement;
  const offsetYInput = document.getElementById('textbox-offset-y') as HTMLInputElement;
  const bgColorInput = document.getElementById('textbox-bg-color') as HTMLInputElement;
  const borderWidthInput = document.getElementById('textbox-border-width') as HTMLInputElement;
  const borderColorInput = document.getElementById('textbox-border-color') as HTMLInputElement;
  const borderStyleSelect = document.getElementById('textbox-border-style') as HTMLSelectElement;
  const paddingInput = document.getElementById('textbox-padding') as HTMLInputElement;

  if (!textboxSection) return;

  if (textBox) {
    // Show the text box pane and populate with text box data
    textboxSection.style.display = 'block';
    currentSelectedTextBox = textBox;

    // Populate position controls
    if (positionSelect) positionSelect.value = textBox.position || 'inline';
    if (offsetGroup) {
      offsetGroup.style.display = textBox.position === 'relative' ? 'block' : 'none';
    }
    if (offsetXInput) offsetXInput.value = String(textBox.relativeOffset?.x ?? 0);
    if (offsetYInput) offsetYInput.value = String(textBox.relativeOffset?.y ?? 0);

    // Populate other controls
    if (bgColorInput) bgColorInput.value = textBox.backgroundColor || '#ffffff';
    if (borderWidthInput) borderWidthInput.value = String(textBox.border?.top?.width ?? 1);
    if (borderColorInput) borderColorInput.value = textBox.border?.top?.color ?? '#cccccc';
    if (borderStyleSelect) borderStyleSelect.value = textBox.border?.top?.style ?? 'solid';
    if (paddingInput) paddingInput.value = String(textBox.padding ?? 4);

    console.log(`[TextBox Pane] Showing text box: ${textBox.id}`);
  } else {
    hideTextBoxPane();
  }
}

/**
 * Hide the text box pane.
 */
function hideTextBoxPane(): void {
  const textboxSection = document.getElementById('textbox-section');

  if (textboxSection) {
    textboxSection.style.display = 'none';
  }

  currentSelectedTextBox = null;
}

/**
 * Show the formatting pane.
 */
function showFormattingPane(): void {
  const formattingPane = document.getElementById('formatting-pane');
  if (formattingPane) {
    formattingPane.style.display = 'block';
  }
}

/**
 * Hide the formatting pane.
 */
function hideFormattingPane(): void {
  const formattingPane = document.getElementById('formatting-pane');
  if (formattingPane) {
    formattingPane.style.display = 'none';
  }
}

/**
 * Apply changes to the currently selected text box.
 */
function applyTextBoxChanges(): void {
  if (!editor || !currentSelectedTextBox) {
    updateStatus('No text box selected', 'error');
    return;
  }

  const positionSelect = document.getElementById('textbox-position') as HTMLSelectElement;
  const offsetXInput = document.getElementById('textbox-offset-x') as HTMLInputElement;
  const offsetYInput = document.getElementById('textbox-offset-y') as HTMLInputElement;
  const bgColorInput = document.getElementById('textbox-bg-color') as HTMLInputElement;
  const borderWidthInput = document.getElementById('textbox-border-width') as HTMLInputElement;
  const borderColorInput = document.getElementById('textbox-border-color') as HTMLInputElement;
  const borderStyleSelect = document.getElementById('textbox-border-style') as HTMLSelectElement;
  const paddingInput = document.getElementById('textbox-padding') as HTMLInputElement;

  // Apply position changes
  if (positionSelect) {
    currentSelectedTextBox.position = positionSelect.value as 'inline' | 'block' | 'relative';
  }

  // Apply offset for relative positioning
  if (positionSelect?.value === 'relative' && offsetXInput && offsetYInput) {
    currentSelectedTextBox.relativeOffset = {
      x: parseInt(offsetXInput.value) || 0,
      y: parseInt(offsetYInput.value) || 0
    };
  }

  // Apply changes to the text box
  if (bgColorInput) {
    currentSelectedTextBox.backgroundColor = bgColorInput.value;
  }

  if (borderWidthInput || borderColorInput || borderStyleSelect) {
    const width = borderWidthInput ? parseInt(borderWidthInput.value) : 1;
    const color = borderColorInput ? borderColorInput.value : '#cccccc';
    const style = (borderStyleSelect ? borderStyleSelect.value : 'solid') as 'solid' | 'dashed' | 'dotted' | 'none';

    // Apply to all sides
    const borderSide = { width, color, style };
    currentSelectedTextBox.border = {
      top: { ...borderSide },
      right: { ...borderSide },
      bottom: { ...borderSide },
      left: { ...borderSide }
    };
  }

  if (paddingInput) {
    currentSelectedTextBox.padding = parseInt(paddingInput.value);
  }

  // Re-render
  editor.render();
  updateStatus('Text box updated');
}

// ============================================
// Image Pane Functions
// ============================================

/**
 * Update the image pane when an image is selected.
 */
function updateImagePane(image: ImageObject | null): void {
  const imageSection = document.getElementById('image-section');
  const positionSelect = document.getElementById('image-position') as HTMLSelectElement;
  const offsetGroup = document.getElementById('image-offset-group');
  const offsetXInput = document.getElementById('image-offset-x') as HTMLInputElement;
  const offsetYInput = document.getElementById('image-offset-y') as HTMLInputElement;
  const fitModeSelect = document.getElementById('image-fit-mode') as HTMLSelectElement;
  const resizeModeSelect = document.getElementById('image-resize-mode') as HTMLSelectElement;
  const altTextInput = document.getElementById('image-alt-text') as HTMLInputElement;

  if (!imageSection) return;

  if (image) {
    // Show the image pane and populate with image data
    imageSection.style.display = 'block';
    currentSelectedImage = image;

    // Populate position controls
    if (positionSelect) positionSelect.value = image.position || 'inline';
    if (offsetGroup) {
      offsetGroup.style.display = image.position === 'relative' ? 'block' : 'none';
    }
    if (offsetXInput) offsetXInput.value = String(image.relativeOffset?.x ?? 0);
    if (offsetYInput) offsetYInput.value = String(image.relativeOffset?.y ?? 0);

    // Populate other controls
    if (fitModeSelect) fitModeSelect.value = image.fit || 'contain';
    if (resizeModeSelect) resizeModeSelect.value = image.resizeMode || 'locked-aspect-ratio';
    if (altTextInput) altTextInput.value = image.alt || '';

    console.log(`[Image Pane] Showing image: ${image.id}`);
  } else {
    hideImagePane();
  }
}

/**
 * Hide the image pane.
 */
function hideImagePane(): void {
  const imageSection = document.getElementById('image-section');

  if (imageSection) {
    imageSection.style.display = 'none';
  }

  currentSelectedImage = null;
}

/**
 * Apply changes to the currently selected image.
 */
function applyImageChanges(): void {
  if (!editor || !currentSelectedImage) {
    updateStatus('No image selected', 'error');
    return;
  }

  const positionSelect = document.getElementById('image-position') as HTMLSelectElement;
  const offsetXInput = document.getElementById('image-offset-x') as HTMLInputElement;
  const offsetYInput = document.getElementById('image-offset-y') as HTMLInputElement;
  const fitModeSelect = document.getElementById('image-fit-mode') as HTMLSelectElement;
  const resizeModeSelect = document.getElementById('image-resize-mode') as HTMLSelectElement;
  const altTextInput = document.getElementById('image-alt-text') as HTMLInputElement;

  // Apply position changes
  if (positionSelect) {
    currentSelectedImage.position = positionSelect.value as 'inline' | 'block' | 'relative';
  }

  // Apply offset for relative positioning
  if (positionSelect?.value === 'relative' && offsetXInput && offsetYInput) {
    currentSelectedImage.relativeOffset = {
      x: parseInt(offsetXInput.value) || 0,
      y: parseInt(offsetYInput.value) || 0
    };
  }

  // Apply changes to the image
  if (fitModeSelect) {
    currentSelectedImage.fit = fitModeSelect.value as 'contain' | 'cover' | 'fill' | 'none' | 'tile';
  }

  if (resizeModeSelect) {
    currentSelectedImage.resizeMode = resizeModeSelect.value as 'free' | 'locked-aspect-ratio';
  }

  if (altTextInput) {
    currentSelectedImage.alt = altTextInput.value;
  }

  // Re-render
  editor.render();
  updateStatus('Image updated');
}

/**
 * Handle image file selection from the file picker.
 */
function handleImageFileChange(event: Event): void {
  if (!editor || !currentSelectedImage) {
    updateStatus('No image selected', 'error');
    return;
  }

  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  // Read the file as a data URL
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    if (dataUrl && currentSelectedImage) {
      // Use reasonable max dimensions for auto-sizing
      // (roughly 80% of A4 content width and 50% of content height)
      currentSelectedImage.setSource(dataUrl, {
        maxWidth: 400,
        maxHeight: 400
      });

      editor.render();
      updateStatus('Image source changed');
    }
  };
  reader.onerror = () => {
    updateStatus('Failed to read image file', 'error');
  };
  reader.readAsDataURL(file);

  // Clear the input for future selections
  input.value = '';
}

// ============================================
// Table Tools Functions
// ============================================

/**
 * Update the current selected table reference.
 */
function updateTableTools(table: TableObject | null): void {
  currentSelectedTable = table;
}

/**
 * Add a row to the current table.
 */
function tableAddRow(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  const insertIndex = focusedCell ? focusedCell.row + 1 : currentSelectedTable.rowCount;

  editor.tableInsertRow(currentSelectedTable, insertIndex);
  updateStatus(`Added row at index ${insertIndex}`);
}

/**
 * Add a column to the current table.
 */
function tableAddColumn(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  const insertIndex = focusedCell ? focusedCell.col + 1 : currentSelectedTable.columnCount;

  editor.tableInsertColumn(currentSelectedTable, insertIndex);
  updateStatus(`Added column at index ${insertIndex}`);
}

/**
 * Merge selected cells in the current table.
 */
function tableMergeCells(): void {
  if (!currentSelectedTable || !editor) return;

  // If no range selected, try to create one from focused cell
  const focusedCell = currentSelectedTable.focusedCell;
  if (!currentSelectedTable.selectedRange && focusedCell) {
    // For now, just show instructions - need cell range selection UI
    updateStatus('Select a range of cells first (click and drag)');
    return;
  }

  // Table operations are automatically tracked for undo via ObjectMutationObserver
  const result = currentSelectedTable.mergeCells();
  if (result.success) {
    updateStatus('Cells merged');
  } else {
    updateStatus(`Merge failed: ${result.error}`, 'error');
  }
}

/**
 * Split the currently focused merged cell.
 */
function tableSplitCell(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  if (!focusedCell) {
    updateStatus('Select a merged cell to split');
    return;
  }

  // Table operations are automatically tracked for undo via ObjectMutationObserver
  const result = currentSelectedTable.splitCell(focusedCell.row, focusedCell.col);
  if (result.success) {
    updateStatus('Cell split');
  } else {
    updateStatus(`Split failed: ${result.error}`, 'error');
  }
}

/**
 * Toggle header status on the current row.
 */
function tableToggleHeader(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  if (!focusedCell) {
    updateStatus('Select a row to toggle header');
    return;
  }

  const row = currentSelectedTable.rows[focusedCell.row];
  if (row) {
    row.isHeader = !row.isHeader;

    // Update visual styling for header rows
    for (const cell of row.cells) {
      if (row.isHeader) {
        cell.backgroundColor = '#f0f0f0';
      } else {
        cell.backgroundColor = '#ffffff';
      }
    }

    editor.render();
    updateStatus(row.isHeader ? 'Row marked as header' : 'Row unmarked as header');
  }
}

/**
 * Create a row loop from the selected cell range.
 */
function tableCreateRowLoop(): void {
  if (!currentSelectedTable || !editor) return;

  // Get the selected range or focused cell
  const range = currentSelectedTable.selectedRange;
  const focusedCell = currentSelectedTable.focusedCell;

  if (!range && !focusedCell) {
    updateStatus('Select rows in the table first');
    return;
  }

  // Determine the row range
  let startRow: number;
  let endRow: number;

  if (range) {
    startRow = range.start.row;
    endRow = range.end.row;
  } else if (focusedCell) {
    // Use just the focused row
    startRow = focusedCell.row;
    endRow = focusedCell.row;
  } else {
    return;
  }

  // Prompt for field path
  const fieldPath = prompt('Enter the array field path (e.g., "items"):', 'items');
  if (!fieldPath) {
    updateStatus('Row loop creation cancelled');
    return;
  }

  // Create the row loop
  const loop = currentSelectedTable.createRowLoop(startRow, endRow, fieldPath);
  if (loop) {
    currentSelectedRowLoop = { table: currentSelectedTable, loopId: loop.id };
    showTableRowLoopSection(loop);
    editor.render();
    updateStatus(`Row loop created for rows ${startRow}-${endRow} with field path "${fieldPath}"`);
  } else {
    updateStatus('Failed to create row loop (check for overlaps or header rows)', 'error');
  }
}

/**
 * Apply changes to the current row loop's field path.
 */
function applyTableRowLoop(): void {
  if (!currentSelectedRowLoop || !editor) return;

  const fieldPathInput = document.getElementById('table-row-loop-field-path') as HTMLInputElement;
  const newFieldPath = fieldPathInput?.value?.trim();

  if (!newFieldPath) {
    updateStatus('Field path cannot be empty', 'error');
    return;
  }

  const success = currentSelectedRowLoop.table.updateRowLoopFieldPath(currentSelectedRowLoop.loopId, newFieldPath);
  if (success) {
    editor.render();
    updateStatus(`Row loop field path updated to "${newFieldPath}"`);
  } else {
    updateStatus('Failed to update row loop', 'error');
  }
}

/**
 * Delete the current row loop.
 */
function deleteTableRowLoop(): void {
  if (!currentSelectedRowLoop || !editor) return;

  const success = currentSelectedRowLoop.table.removeRowLoop(currentSelectedRowLoop.loopId);
  if (success) {
    hideTableRowLoopSection();
    currentSelectedRowLoop = null;
    editor.render();
    updateStatus('Row loop deleted');
  } else {
    updateStatus('Failed to delete row loop', 'error');
  }
}

/**
 * Show the table row loop section in the sidebar.
 */
function showTableRowLoopSection(loop: { id: string; fieldPath: string; startRowIndex: number; endRowIndex: number }): void {
  const section = document.getElementById('table-row-loop-section');
  if (section) {
    section.style.display = 'block';
  }

  const fieldPathInput = document.getElementById('table-row-loop-field-path') as HTMLInputElement;
  if (fieldPathInput) {
    fieldPathInput.value = loop.fieldPath;
  }

  const rangeHint = document.getElementById('table-row-loop-range-hint');
  if (rangeHint) {
    rangeHint.textContent = `Rows ${loop.startRowIndex} - ${loop.endRowIndex}`;
  }
}

/**
 * Hide the table row loop section in the sidebar.
 */
function hideTableRowLoopSection(): void {
  const section = document.getElementById('table-row-loop-section');
  if (section) {
    section.style.display = 'none';
  }
}

// ============================================
// Table Pane Functions
// ============================================

/**
 * Update the table pane when a table is selected or focused.
 */
function updateTablePane(table: TableObject | null): void {
  const tableSection = document.getElementById('table-section');
  if (!tableSection) return;

  if (table) {
    tableSection.style.display = 'block';
    currentSelectedTable = table;

    // Update structure info
    const rowCountEl = document.getElementById('table-row-count');
    const colCountEl = document.getElementById('table-col-count');
    if (rowCountEl) rowCountEl.textContent = String(table.rowCount);
    if (colCountEl) colCountEl.textContent = String(table.columnCount);

    // Update cell selection info
    updateTableCellSelectionInfo(table);

    // Update header counts
    const headerRowInput = document.getElementById('table-header-row-count') as HTMLInputElement;
    const headerColInput = document.getElementById('table-header-col-count') as HTMLInputElement;
    if (headerRowInput) headerRowInput.value = String(table.headerRowCount);
    if (headerColInput) headerColInput.value = String(table.headerColumnCount);

    // Update defaults
    const paddingInput = document.getElementById('table-default-padding') as HTMLInputElement;
    const borderColorInput = document.getElementById('table-default-border-color') as HTMLInputElement;
    if (paddingInput) paddingInput.value = String(table.defaultCellPadding);
    if (borderColorInput) borderColorInput.value = table.defaultBorderColor;

    // Update cell-specific formatting if a cell is selected
    const focusedCell = table.focusedCell;
    if (focusedCell) {
      const cell = table.getCell(focusedCell.row, focusedCell.col);
      if (cell) {
        // Update background color
        const cellBgInput = document.getElementById('table-cell-bg-color') as HTMLInputElement;
        if (cellBgInput) cellBgInput.value = cell.backgroundColor || '#ffffff';

        // Update border controls from cell's current borders
        const border = cell.border;
        const topCheck = document.getElementById('table-border-top') as HTMLInputElement;
        const rightCheck = document.getElementById('table-border-right') as HTMLInputElement;
        const bottomCheck = document.getElementById('table-border-bottom') as HTMLInputElement;
        const leftCheck = document.getElementById('table-border-left') as HTMLInputElement;
        const widthInput = document.getElementById('table-border-width') as HTMLInputElement;
        const colorInput = document.getElementById('table-border-color') as HTMLInputElement;
        const styleSelect = document.getElementById('table-border-style') as HTMLSelectElement;

        // Check which borders are active (not 'none')
        if (topCheck) topCheck.checked = border.top.style !== 'none';
        if (rightCheck) rightCheck.checked = border.right.style !== 'none';
        if (bottomCheck) bottomCheck.checked = border.bottom.style !== 'none';
        if (leftCheck) leftCheck.checked = border.left.style !== 'none';

        // Use the first active border's settings for width/color/style
        const activeBorder = border.top.style !== 'none' ? border.top :
                            border.right.style !== 'none' ? border.right :
                            border.bottom.style !== 'none' ? border.bottom :
                            border.left.style !== 'none' ? border.left : null;
        if (activeBorder) {
          if (widthInput) widthInput.value = String(activeBorder.width);
          if (colorInput) colorInput.value = activeBorder.color;
          if (styleSelect) styleSelect.value = activeBorder.style;
        }
      }
    }
  } else {
    hideTablePane();
  }
}

/**
 * Update the cell selection info display.
 */
function updateTableCellSelectionInfo(table: TableObject): void {
  const infoEl = document.getElementById('table-cell-selection-info');
  if (!infoEl) return;

  const focusedCell = table.focusedCell;
  const selectedRange = table.selectedRange;

  if (selectedRange) {
    const rows = selectedRange.end.row - selectedRange.start.row + 1;
    const cols = selectedRange.end.col - selectedRange.start.col + 1;
    infoEl.textContent = `${rows}x${cols} cells selected`;
  } else if (focusedCell) {
    infoEl.textContent = `Row ${focusedCell.row + 1}, Col ${focusedCell.col + 1}`;
  } else {
    infoEl.textContent = 'No cell selected';
  }
}

/**
 * Hide the table pane.
 */
function hideTablePane(): void {
  const tableSection = document.getElementById('table-section');
  if (tableSection) {
    tableSection.style.display = 'none';
  }
}

// Table pane action handlers

/**
 * Get the current header styling from the pane controls.
 */
function getHeaderStyling(): { bgColor: string; bold: boolean } {
  const bgColorInput = document.getElementById('table-header-bg-color') as HTMLInputElement;
  const boldCheck = document.getElementById('table-header-bold') as HTMLInputElement;
  return {
    bgColor: bgColorInput?.value || '#f0f0f0',
    bold: boldCheck?.checked ?? true
  };
}

/**
 * Apply header styling to a cell.
 */
function applyHeaderStylingToCell(cell: import('../lib').TableCell, styling: { bgColor: string; bold: boolean }): void {
  cell.backgroundColor = styling.bgColor;
  if (styling.bold) {
    const text = cell.flowingContent.getText();
    if (text.length > 0) {
      cell.flowingContent.applyFormatting(0, text.length, { fontWeight: 'bold' });
    }
  }
}

/**
 * Copy cell styling (background, border, padding) from source to target.
 */
function copyCellStyling(source: import('../lib').TableCell, target: import('../lib').TableCell): void {
  target.backgroundColor = source.backgroundColor;
  target.padding = { ...source.padding };
  target.border = {
    top: { ...source.border.top },
    right: { ...source.border.right },
    bottom: { ...source.border.bottom },
    left: { ...source.border.left }
  };
}

/**
 * Apply styling to new cells in a row based on header status or source row.
 */
function styleNewRowCells(table: TableObject, rowIndex: number, sourceRowIndex?: number): void {
  const row = table.rows[rowIndex];
  if (!row) return;

  const styling = getHeaderStyling();
  const headerColIndices = table.getHeaderColumnIndices();

  // If we have a source row, copy styling from corresponding cells
  if (sourceRowIndex !== undefined && sourceRowIndex >= 0 && sourceRowIndex < table.rows.length) {
    const sourceRow = table.rows[sourceRowIndex];
    for (let colIdx = 0; colIdx < row.cells.length && colIdx < sourceRow.cells.length; colIdx++) {
      const sourceCell = sourceRow.getCell(colIdx);
      const targetCell = row.getCell(colIdx);
      if (sourceCell && targetCell) {
        copyCellStyling(sourceCell, targetCell);
      }
    }
  } else if (row.isHeader) {
    // If this is a header row with no source, apply header styling
    for (const cell of row.cells) {
      applyHeaderStylingToCell(cell, styling);
    }
  } else {
    // Otherwise, only style cells in header columns
    for (const colIdx of headerColIndices) {
      const cell = row.getCell(colIdx);
      if (cell) {
        applyHeaderStylingToCell(cell, styling);
      }
    }
  }
}

/**
 * Apply styling to new cells in a column based on header status or source column.
 */
function styleNewColumnCells(table: TableObject, colIndex: number, sourceColIndex?: number): void {
  const col = table.columns[colIndex];
  if (!col) return;

  const styling = getHeaderStyling();

  for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
    const row = table.rows[rowIdx];
    const targetCell = row.getCell(colIndex);
    if (!targetCell) continue;

    // If we have a source column, copy styling from corresponding cell
    if (sourceColIndex !== undefined && sourceColIndex >= 0 && sourceColIndex < table.columns.length) {
      const sourceCell = row.getCell(sourceColIndex);
      if (sourceCell) {
        copyCellStyling(sourceCell, targetCell);
        continue;
      }
    }

    // Otherwise, style if this is a header column or if the row is a header row
    if (col.isHeader || row.isHeader) {
      applyHeaderStylingToCell(targetCell, styling);
    }
  }
}

function tablePaneAddRowBefore(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  let insertIndex = focusedCell ? focusedCell.row : 0;

  // Ensure we don't insert before header rows - find first non-header row
  const headerRowCount = currentSelectedTable.headerRowCount;
  if (insertIndex < headerRowCount) {
    insertIndex = headerRowCount;
  }

  // Source row is the current row (which shifts down after insert)
  const sourceRowIndex = focusedCell ? insertIndex + 1 : undefined;

  // Table operations are automatically tracked for undo via ObjectMutationObserver
  currentSelectedTable.insertRow(insertIndex);
  styleNewRowCells(currentSelectedTable, insertIndex, sourceRowIndex);
  updateTablePane(currentSelectedTable);
  updateStatus(`Added row before index ${insertIndex}`);
}

function tablePaneAddRowAfter(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  const insertIndex = focusedCell ? focusedCell.row + 1 : currentSelectedTable.rowCount;

  // Source row is the current row, but don't use header rows as styling sources
  let sourceRowIndex: number | undefined;
  if (focusedCell) {
    const sourceRow = currentSelectedTable.rows[focusedCell.row];
    if (sourceRow && !sourceRow.isHeader) {
      sourceRowIndex = focusedCell.row;
    }
  }

  // Table operations are automatically tracked for undo via ObjectMutationObserver
  currentSelectedTable.insertRow(insertIndex);
  styleNewRowCells(currentSelectedTable, insertIndex, sourceRowIndex);
  updateTablePane(currentSelectedTable);
  updateStatus(`Added row after index ${insertIndex - 1}`);
}

function tablePaneDeleteRow(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  if (!focusedCell) {
    updateStatus('Select a cell in the row to delete');
    return;
  }

  if (currentSelectedTable.rowCount <= 1) {
    updateStatus('Cannot delete the last row');
    return;
  }

  // Prevent deleting header rows
  const row = currentSelectedTable.rows[focusedCell.row];
  if (row?.isHeader) {
    updateStatus('Cannot delete header rows');
    return;
  }

  editor.tableRemoveRow(currentSelectedTable, focusedCell.row);
  updateTablePane(currentSelectedTable);
  updateStatus(`Deleted row ${focusedCell.row + 1}`);
}

function tablePaneAddColBefore(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  let insertIndex = focusedCell ? focusedCell.col : 0;

  // Ensure we don't insert before header columns - find first non-header column
  const headerColCount = currentSelectedTable.headerColumnCount;
  if (insertIndex < headerColCount) {
    insertIndex = headerColCount;
  }

  // Source column is the current column (which shifts right after insert)
  const sourceColIndex = focusedCell ? insertIndex + 1 : undefined;

  // Table operations are automatically tracked for undo via ObjectMutationObserver
  currentSelectedTable.insertColumn(insertIndex);
  styleNewColumnCells(currentSelectedTable, insertIndex, sourceColIndex);
  updateTablePane(currentSelectedTable);
  updateStatus(`Added column before index ${insertIndex}`);
}

function tablePaneAddColAfter(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  const insertIndex = focusedCell ? focusedCell.col + 1 : currentSelectedTable.columnCount;
  // Source column is the current column (before the new column)
  const sourceColIndex = focusedCell ? focusedCell.col : undefined;

  // Table operations are automatically tracked for undo via ObjectMutationObserver
  currentSelectedTable.insertColumn(insertIndex);
  styleNewColumnCells(currentSelectedTable, insertIndex, sourceColIndex);
  updateTablePane(currentSelectedTable);
  updateStatus(`Added column after index ${insertIndex - 1}`);
}

function tablePaneDeleteCol(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  if (!focusedCell) {
    updateStatus('Select a cell in the column to delete');
    return;
  }

  if (currentSelectedTable.columnCount <= 1) {
    updateStatus('Cannot delete the last column');
    return;
  }

  // Prevent deleting header columns
  const col = currentSelectedTable.columns[focusedCell.col];
  if (col?.isHeader) {
    updateStatus('Cannot delete header columns');
    return;
  }

  editor.tableRemoveColumn(currentSelectedTable, focusedCell.col);
  updateTablePane(currentSelectedTable);
  updateStatus(`Deleted column ${focusedCell.col + 1}`);
}

function tablePaneMergeCells(): void {
  if (!currentSelectedTable || !editor) return;

  // Table operations are automatically tracked for undo via ObjectMutationObserver
  const result = currentSelectedTable.mergeCells();
  if (result.success) {
    updateTablePane(currentSelectedTable);
    updateStatus('Cells merged');
  } else {
    updateStatus(`Merge failed: ${result.error}`, 'error');
  }
}

function tablePaneSplitCell(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  if (!focusedCell) {
    updateStatus('Select a merged cell to split');
    return;
  }

  // Table operations are automatically tracked for undo via ObjectMutationObserver
  const result = currentSelectedTable.splitCell(focusedCell.row, focusedCell.col);
  if (result.success) {
    updateTablePane(currentSelectedTable);
    updateStatus('Cell split');
  } else {
    updateStatus(`Split failed: ${result.error}`, 'error');
  }
}

function tablePaneApplyCellBackground(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  const selectedRange = currentSelectedTable.selectedRange;
  const colorInput = document.getElementById('table-cell-bg-color') as HTMLInputElement;
  const color = colorInput?.value || '#ffffff';

  if (selectedRange) {
    // Apply to all cells in range
    for (let r = selectedRange.start.row; r <= selectedRange.end.row; r++) {
      for (let c = selectedRange.start.col; c <= selectedRange.end.col; c++) {
        const cell = currentSelectedTable.getCell(r, c);
        if (cell) cell.backgroundColor = color;
      }
    }
    updateStatus('Background applied to selected cells');
  } else if (focusedCell) {
    const cell = currentSelectedTable.getCell(focusedCell.row, focusedCell.col);
    if (cell) cell.backgroundColor = color;
    updateStatus('Background applied to cell');
  } else {
    updateStatus('Select a cell first');
    return;
  }

  editor.render();
}

function tablePaneApplyBorders(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  const selectedRange = currentSelectedTable.selectedRange;

  const widthInput = document.getElementById('table-border-width') as HTMLInputElement;
  const colorInput = document.getElementById('table-border-color') as HTMLInputElement;
  const styleSelect = document.getElementById('table-border-style') as HTMLSelectElement;
  const topCheck = document.getElementById('table-border-top') as HTMLInputElement;
  const rightCheck = document.getElementById('table-border-right') as HTMLInputElement;
  const bottomCheck = document.getElementById('table-border-bottom') as HTMLInputElement;
  const leftCheck = document.getElementById('table-border-left') as HTMLInputElement;

  const borderSide = {
    width: parseInt(widthInput?.value || '1'),
    color: colorInput?.value || '#000000',
    style: (styleSelect?.value || 'solid') as 'solid' | 'dashed' | 'dotted' | 'none'
  };

  const noBorder = { width: 0, color: 'transparent', style: 'none' as const };

  const applyToCell = (cell: import('../lib').TableCell) => {
    const border = cell.border;
    // Apply border or remove it based on checkbox state
    border.top = topCheck?.checked ? { ...borderSide } : { ...noBorder };
    border.right = rightCheck?.checked ? { ...borderSide } : { ...noBorder };
    border.bottom = bottomCheck?.checked ? { ...borderSide } : { ...noBorder };
    border.left = leftCheck?.checked ? { ...borderSide } : { ...noBorder };
    cell.border = border;
  };

  if (selectedRange) {
    for (let r = selectedRange.start.row; r <= selectedRange.end.row; r++) {
      for (let c = selectedRange.start.col; c <= selectedRange.end.col; c++) {
        const cell = currentSelectedTable.getCell(r, c);
        if (cell) applyToCell(cell);
      }
    }
    updateStatus('Borders applied to selected cells');
  } else if (focusedCell) {
    const cell = currentSelectedTable.getCell(focusedCell.row, focusedCell.col);
    if (cell) applyToCell(cell);
    updateStatus('Borders applied to cell');
  } else {
    updateStatus('Select a cell first');
    return;
  }

  editor.render();
}

function tablePaneApplyHeaders(): void {
  if (!currentSelectedTable || !editor) return;

  const headerRowInput = document.getElementById('table-header-row-count') as HTMLInputElement;
  const headerColInput = document.getElementById('table-header-col-count') as HTMLInputElement;

  const headerRowCount = parseInt(headerRowInput?.value || '0');
  const headerColCount = parseInt(headerColInput?.value || '0');

  // Get the current header styling settings
  const styling = getHeaderStyling();

  // Apply header row/column counts
  currentSelectedTable.setHeaderRowCount(headerRowCount);
  currentSelectedTable.setHeaderColumnCount(headerColCount);

  // Apply styling to all header cells (both rows and columns)
  for (let rowIdx = 0; rowIdx < currentSelectedTable.rows.length; rowIdx++) {
    const row = currentSelectedTable.rows[rowIdx];
    for (let colIdx = 0; colIdx < row.cells.length; colIdx++) {
      const cell = row.getCell(colIdx);
      if (!cell) continue;

      const isHeader = currentSelectedTable.isHeaderCell(rowIdx, colIdx);
      if (isHeader) {
        // Apply header styling
        applyHeaderStylingToCell(cell, styling);
      } else {
        // Reset to normal styling (white background, normal weight)
        cell.backgroundColor = '#ffffff';
        const text = cell.flowingContent.getText();
        if (text.length > 0) {
          cell.flowingContent.applyFormatting(0, text.length, { fontWeight: 'normal' });
        }
      }
    }
  }

  editor.render();
  updateStatus(`Set ${headerRowCount} header rows and ${headerColCount} header columns`);
}

function tablePaneApplyHeaderStyle(): void {
  if (!currentSelectedTable || !editor) return;

  const bgColorInput = document.getElementById('table-header-bg-color') as HTMLInputElement;
  const boldCheck = document.getElementById('table-header-bold') as HTMLInputElement;

  const bgColor = bgColorInput?.value || '#f0f0f0';
  const bold = boldCheck?.checked ?? true;

  // Apply to header rows
  for (const row of currentSelectedTable.rows) {
    if (row.isHeader) {
      for (const cell of row.cells) {
        cell.backgroundColor = bgColor;
        if (bold) {
          // Apply bold formatting to all text in the cell
          const text = cell.flowingContent.getText();
          if (text.length > 0) {
            cell.flowingContent.applyFormatting(0, text.length, { fontWeight: 'bold' });
          }
        }
      }
    }
  }

  // Apply to header columns
  const headerColIndices = currentSelectedTable.getHeaderColumnIndices();
  for (const colIdx of headerColIndices) {
    for (const row of currentSelectedTable.rows) {
      if (!row.isHeader) {  // Skip header rows (already styled above)
        const cell = row.getCell(colIdx);
        if (cell) {
          cell.backgroundColor = bgColor;
          if (bold) {
            const text = cell.flowingContent.getText();
            if (text.length > 0) {
              cell.flowingContent.applyFormatting(0, text.length, { fontWeight: 'bold' });
            }
          }
        }
      }
    }
  }

  editor.render();
  updateStatus('Header styling applied');
}

function tablePaneApplyDefaults(): void {
  if (!currentSelectedTable || !editor) return;

  const paddingInput = document.getElementById('table-default-padding') as HTMLInputElement;
  const borderColorInput = document.getElementById('table-default-border-color') as HTMLInputElement;

  const padding = parseInt(paddingInput?.value || '4');
  const borderColor = borderColorInput?.value || '#000000';

  currentSelectedTable.defaultCellPadding = padding;
  currentSelectedTable.defaultBorderColor = borderColor;

  // Apply to all existing cells and mark them for reflow
  for (const row of currentSelectedTable.rows) {
    for (const cell of row.cells) {
      cell.padding = { top: padding, right: padding, bottom: padding, left: padding };
      const border = cell.border;
      border.top.color = borderColor;
      border.right.color = borderColor;
      border.bottom.color = borderColor;
      border.left.color = borderColor;
      cell.border = border;
      // Mark cell for reflow since padding affects text layout
      cell.markReflowDirty();
    }
  }

  // Mark table layout as dirty so it recalculates size
  currentSelectedTable.markLayoutDirty();

  editor.render();
  updateStatus('Table defaults applied to all cells');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeEditor();
  setupEventHandlers();
});
