import { PCEditor, DocumentData, ImageObject, TextBoxObject, TableObject, EditorSelection, SubstitutionField, RepeatingSection, EditingSection, TextAlignment } from '../lib';
import { sampleDocument } from './sample-data';

let editor: PCEditor;
let currentSelectedField: SubstitutionField | null = null;
let currentSelectedSection: RepeatingSection | null = null;
let currentSelectedTextBox: TextBoxObject | null = null;
let currentSelectedTable: TableObject | null = null;

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

    // Check if a table is selected or focused
    const selectedTable = editor.getSelectedTable?.() || editor.getFocusedTable?.();
    updateTableTools(selectedTable);

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
    } else if (selection.type === 'elements') {
      console.log(`[Editor Event] selection-change: elements selected: ${selection.elementIds.join(', ')}`);
      // Check if one of the selected elements is a text box
      const embeddedTextBox = getSelectedEmbeddedTextBox(selection.elementIds);
      if (embeddedTextBox && embeddedTextBox.editing) {
        // Text box is being edited - keep formatting pane visible and update it
        showFormattingPane();
        updateFormattingPane();
        updateStatus('Editing text box');
      } else {
        // Not editing a text box - hide formatting pane
        hideFormattingPane();
        if (embeddedTextBox) {
          updateTextBoxPane(embeddedTextBox);
          updateStatus(`Text box selected: ${embeddedTextBox.id}`);
        } else {
          updateStatus(`Elements selected: ${selection.elementIds.length}`);
        }
      }
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
  });

  editor.on('document-loaded', (event: any) => {
    console.log('[Editor Event] document-loaded', event);
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
    hideLoopPane();
  });

  // Section focus changed (header/body/footer)
  editor.on('section-focus-changed', (event: { section: EditingSection; previousSection: EditingSection }) => {
    console.log(`[Editor Event] section-focus-changed: ${event.previousSection} -> ${event.section}`);
    updateSectionIndicator(event.section);
    updateStatus(`Editing ${event.section}`);
  });
}

function setupEventHandlers(): void {
  // Document controls
  document.getElementById('load-sample')?.addEventListener('click', loadSampleDocument);
  document.getElementById('clear-doc')?.addEventListener('click', clearDocument);

  // View controls (toolbar)
  document.getElementById('zoom-in')?.addEventListener('click', () => editor?.zoomIn());
  document.getElementById('zoom-out')?.addEventListener('click', () => editor?.zoomOut());
  document.getElementById('fit-page')?.addEventListener('click', () => editor?.fitToPage());
  document.getElementById('toggle-control-chars')?.addEventListener('click', toggleControlCharacters);

  // View controls (sidebar pane)
  document.getElementById('toggle-control-chars-btn')?.addEventListener('click', toggleControlCharacters);
  document.getElementById('toggle-margin-lines-btn')?.addEventListener('click', toggleMarginLines);
  document.getElementById('toggle-grid-btn')?.addEventListener('click', toggleGrid);

  // Flowing text controls
  document.getElementById('clear-text')?.addEventListener('click', clearFlowingText);
  document.getElementById('add-sample-text')?.addEventListener('click', addSampleFlowingText);

  // Prevent buttons from stealing focus - define early so it's available for all sections
  const preventFocusSteal = (e: MouseEvent) => e.preventDefault();

  // Save editing context before focus is stolen (for dropdowns/color pickers that need focus)
  const saveSelectionBeforeFocusSteal = () => {
    editor?.saveEditingContext();
  };

  // Embedded content controls
  document.getElementById('insert-inline-image')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-inline-image')?.addEventListener('click', () => insertEmbeddedImage('inline'));
  document.getElementById('insert-inline-text')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-inline-text')?.addEventListener('click', () => insertEmbeddedTextBox('inline'));
  document.getElementById('insert-inline-table')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-inline-table')?.addEventListener('click', () => insertEmbeddedTable('inline'));
  document.getElementById('insert-substitution-field')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-substitution-field')?.addEventListener('click', toggleFieldPicker);
  document.getElementById('insert-float-left')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-float-left')?.addEventListener('click', () => insertEmbeddedImage('float-left'));
  document.getElementById('insert-float-right')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('insert-float-right')?.addEventListener('click', () => insertEmbeddedImage('float-right'));

  // Table tools
  document.getElementById('table-add-row')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-add-row')?.addEventListener('click', tableAddRow);
  document.getElementById('table-add-col')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-add-col')?.addEventListener('click', tableAddColumn);
  document.getElementById('table-merge')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-merge')?.addEventListener('click', tableMergeCells);
  document.getElementById('table-split')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-split')?.addEventListener('click', tableSplitCell);
  document.getElementById('table-header')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('table-header')?.addEventListener('click', tableToggleHeader);

  // Document settings controls
  document.getElementById('apply-margins')?.addEventListener('click', applyMargins);
  document.getElementById('page-size-select')?.addEventListener('change', updatePageSettings);
  document.getElementById('page-orientation-select')?.addEventListener('change', updatePageSettings);

  // Collapsible sections
  setupCollapsibleSections();

  // Merge data
  document.getElementById('apply-merge')?.addEventListener('click', applyMergeData);

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

  // Field controls
  document.getElementById('apply-field-changes')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-field-changes')?.addEventListener('click', applyFieldChanges);

  // Loop controls
  document.getElementById('create-loop')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('create-loop')?.addEventListener('click', createLoop);
  document.getElementById('apply-loop-changes')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-loop-changes')?.addEventListener('click', applyLoopChanges);
  document.getElementById('delete-loop')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('delete-loop')?.addEventListener('click', deleteLoop);

  // Text box controls
  document.getElementById('apply-textbox-changes')?.addEventListener('mousedown', preventFocusSteal);
  document.getElementById('apply-textbox-changes')?.addEventListener('click', applyTextBoxChanges);
}

function loadSampleDocument(): void {
  if (!editor) return;

  editor.loadDocument(sampleDocument);
  updateStatus('Sample document loaded');
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
      id: 'page_1',
      header: { height: 0, elements: [] },
      content: { elements: [] },
      footer: { height: 0, elements: [] }
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

  // Update toolbar button state
  const toolbarButton = document.getElementById('toggle-control-chars');
  if (toolbarButton) {
    toolbarButton.classList.toggle('active', !currentState);
  }

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

function clearFlowingText(): void {
  if (!editor) return;

  editor.setFlowingText('');
  updateStatus('Flowing text cleared');
}

function addSampleFlowingText(): void {
  if (!editor) return;

  const sampleText = `Sample Document

This is a sample document with flowing text. The text will automatically wrap and flow to new pages as needed.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.`;

  editor.setFlowingText(sampleText);
  updateStatus('Sample flowing text added');
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

function insertEmbeddedImage(position: 'inline' | 'float-left' | 'float-right'): void {
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

    editor.insertEmbeddedObject(imageObject, position);
    updateStatus(`Inserted ${position} image`);
    editor.enableTextInput();
  } catch (error) {
    updateStatus('Failed to insert image', 'error');
    console.error('Image insertion error:', error);
  }
}

function insertEmbeddedTextBox(position: 'inline' | 'float-left' | 'float-right'): void {
  if (!editor) return;

  try {
    const textBoxObject = new TextBoxObject({
      id: `textbox_${Date.now()}`,
      textIndex: 0,
      size: { width: 200, height: 48 },
      content: 'Text Box',
      fontFamily: 'Arial',
      fontSize: 12,
      color: '#000000'
    });

    editor.insertEmbeddedObject(textBoxObject, position);
    updateStatus(`Inserted ${position} text box`);
    editor.enableTextInput();
  } catch (error) {
    updateStatus('Failed to insert text box', 'error');
    console.error('Text box insertion error:', error);
  }
}

function insertEmbeddedTable(position: 'inline' | 'float-left' | 'float-right'): void {
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

    // Add some sample content to cells
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cell = tableObject.getCell(row, col);
        if (cell) {
          if (row === 0) {
            cell.content = `Header ${col + 1}`;
            cell.backgroundColor = '#f0f0f0';
          } else {
            cell.content = `Cell ${row},${col + 1}`;
          }
        }
      }
    }

    // Set the first row as a header row (will repeat on page breaks)
    tableObject.setHeaderRow(0, true);

    editor.insertEmbeddedObject(tableObject, position);
    updateStatus(`Inserted ${position} table`);
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

  // Add click-outside listener to close
  setTimeout(() => {
    document.addEventListener('click', handleFieldPickerClickOutside);
  }, 0);
}

/**
 * Hide the field picker dropdown.
 */
function hideFieldPicker(): void {
  const picker = document.getElementById('field-picker');
  if (picker) {
    picker.classList.add('hidden');
  }
  document.removeEventListener('click', handleFieldPickerClickOutside);
}

/**
 * Handle clicks outside the field picker to close it.
 */
function handleFieldPickerClickOutside(e: MouseEvent): void {
  const picker = document.getElementById('field-picker');
  const button = document.getElementById('insert-substitution-field');

  if (picker && !picker.contains(e.target as Node) && e.target !== button) {
    hideFieldPicker();
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

    console.log(`[Field Pane] Showing field: ${field.fieldName} at position ${field.textIndex}`);
  } else {
    // Hide the field pane
    fieldSection.style.display = 'none';
    currentSelectedField = null;
  }
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

  if (!fieldNameInput) return;

  const newFieldName = fieldNameInput.value.trim();
  if (!newFieldName) {
    updateStatus('Field name cannot be empty', 'error');
    return;
  }

  const updates: { fieldName?: string; defaultValue?: string } = {};

  if (newFieldName !== currentSelectedField.fieldName) {
    updates.fieldName = newFieldName;
  }

  const newDefaultValue = fieldDefaultInput?.value || undefined;
  if (newDefaultValue !== currentSelectedField.defaultValue) {
    updates.defaultValue = newDefaultValue;
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

// ============================================
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

  // Prompt for field path (in a real app, this would be a dialog)
  const fieldPath = prompt('Enter the array field path to loop over (e.g., "items"):');
  if (!fieldPath) {
    updateStatus('Loop creation cancelled');
    return;
  }

  try {
    const section = editor.createRepeatingSection(startBoundary, endBoundary, fieldPath.trim());
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
 * Get a selected text box from the element IDs if one is selected.
 */
function getSelectedEmbeddedTextBox(elementIds: string[]): TextBoxObject | null {
  if (!editor) return null;

  // Use the editor's getSelectedTextBox method
  const selectedTextBox = editor.getSelectedTextBox();
  if (selectedTextBox && elementIds.includes(selectedTextBox.id)) {
    return selectedTextBox;
  }
  return null;
}

/**
 * Update the text box pane when a text box is selected.
 */
function updateTextBoxPane(textBox: TextBoxObject | null): void {
  const textboxSection = document.getElementById('textbox-section');
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

    // Populate controls
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

  const bgColorInput = document.getElementById('textbox-bg-color') as HTMLInputElement;
  const borderWidthInput = document.getElementById('textbox-border-width') as HTMLInputElement;
  const borderColorInput = document.getElementById('textbox-border-color') as HTMLInputElement;
  const borderStyleSelect = document.getElementById('textbox-border-style') as HTMLSelectElement;
  const paddingInput = document.getElementById('textbox-padding') as HTMLInputElement;

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
// Table Tools Functions
// ============================================

/**
 * Update the table tools visibility based on selected/focused table.
 */
function updateTableTools(table: TableObject | null): void {
  const tableTools = document.getElementById('table-tools');
  if (!tableTools) return;

  currentSelectedTable = table;

  if (table) {
    tableTools.style.display = '';
  } else {
    tableTools.style.display = 'none';
  }
}

/**
 * Add a row to the current table.
 */
function tableAddRow(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  const insertIndex = focusedCell ? focusedCell.row + 1 : currentSelectedTable.rowCount;

  currentSelectedTable.insertRow(insertIndex);
  editor.render();
  updateStatus(`Added row at index ${insertIndex}`);
}

/**
 * Add a column to the current table.
 */
function tableAddColumn(): void {
  if (!currentSelectedTable || !editor) return;

  const focusedCell = currentSelectedTable.focusedCell;
  const insertIndex = focusedCell ? focusedCell.col + 1 : currentSelectedTable.columnCount;

  currentSelectedTable.insertColumn(insertIndex);
  editor.render();
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

  const result = currentSelectedTable.mergeCells();
  if (result.success) {
    editor.render();
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

  const result = currentSelectedTable.splitCell(focusedCell.row, focusedCell.col);
  if (result.success) {
    editor.render();
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeEditor();
  setupEventHandlers();
});
