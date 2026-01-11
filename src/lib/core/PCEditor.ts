import {
  EditorOptions,
  DocumentData,
  DataBindingContext,
  PDFExportOptions,
  PageDimensions,
  EditorSelection,
  EditingSection
} from '../types';
import { Document } from './Document';
import { Page } from './Page';
import { EventEmitter } from '../events/EventEmitter';
import { CanvasManager } from '../rendering/CanvasManager';
import { DataBinder } from '../data/DataBinder';
import { PDFGenerator } from '../rendering/PDFGenerator';
import { LayoutEngine } from '../layout/LayoutEngine';
import { BaseEmbeddedObject, ObjectPosition, TextBoxObject, TableObject, ImageObject, TableRowConfig, EmbeddedObjectFactory, EmbeddedObjectData } from '../objects';
import { SubstitutionFieldConfig, TextFormattingStyle, SubstitutionField, RepeatingSection, FlowingTextContent, TextAlignment, Focusable } from '../text';
import {
  TransactionManager,
  TextMutationObserver,
  ObjectMutationObserver,
  ContentDiscovery,
  FocusTracker,
  MutationUndo,
  ContentSourceId,
  ObjectSourceId
} from '../undo';
import { ClipboardManager, type PCEditorClipboardData, type ClipboardContent } from '../clipboard';

export class PCEditor extends EventEmitter {
  private container: HTMLElement;
  private options: Required<Omit<EditorOptions, 'customPageSize'>> & { customPageSize?: PageDimensions };
  private document: Document;
  private canvasManager!: CanvasManager;
  private dataBinder: DataBinder;
  private pdfGenerator: PDFGenerator;
  private layoutEngine!: LayoutEngine;
  // Transaction-based undo system
  private transactionManager!: TransactionManager;
  private textMutationObserver!: TextMutationObserver;
  private objectMutationObserver!: ObjectMutationObserver;
  private _contentDiscovery!: ContentDiscovery; // Kept alive for event listeners
  private mutationUndo!: MutationUndo;
  private _isReady: boolean = false;
  private keyboardListenerActive: boolean = false;
  private currentSelection: EditorSelection = { type: 'none' };
  private _activeEditingSection: EditingSection = 'body';
  private _wasTextEditing: boolean = false;
  private _textEditingSource: 'body' | 'textbox' | 'tablecell' | null = null;
  private clipboardManager: ClipboardManager;

  constructor(container: HTMLElement, options?: EditorOptions) {
    super();

    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.options = this.mergeOptions(options);
    this.document = new Document();

    // Apply constructor options to document settings
    this.document.updateSettings({
      pageSize: this.options.pageSize,
      pageOrientation: this.options.pageOrientation,
      units: this.options.units
    });

    this.dataBinder = new DataBinder();
    this.pdfGenerator = new PDFGenerator();
    this.clipboardManager = new ClipboardManager();

    this.initialize();
  }

  private mergeOptions(options?: EditorOptions): Required<Omit<EditorOptions, 'customPageSize'>> & { customPageSize?: PageDimensions } {
    return {
      pageSize: options?.pageSize || 'A4',
      pageOrientation: options?.pageOrientation || 'portrait',
      customPageSize: options?.customPageSize,
      units: options?.units || 'mm',
      gridSize: options?.gridSize || 10,
      showGrid: options?.showGrid ?? true,
      showRulers: options?.showRulers ?? true,
      showControlCharacters: options?.showControlCharacters ?? false,
      defaultFont: options?.defaultFont || 'Arial',
      defaultFontSize: options?.defaultFontSize || 12,
      theme: options?.theme || 'light'
    };
  }

  private async initialize(): Promise<void> {
    try {
      this.setupContainer();
      this.canvasManager = new CanvasManager(this.container, this.document, this.options);
      this.layoutEngine = new LayoutEngine(this.document, {
        autoFlow: true,
        snapToGrid: this.options.showGrid,
        gridSize: this.options.gridSize
      });

      await this.canvasManager.initialize();
      this.setupEventListeners();
      this.setupKeyboardListeners();
      this.setupTransactionUndo();
      this._isReady = true;
      this.emit('ready');
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      this.emit('error', { error });
    }
  }

  private setupContainer(): void {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    
    if (this.options.theme === 'dark') {
      this.container.classList.add('pc-editor-dark');
    } else {
      this.container.classList.add('pc-editor-light');
    }
  }

  private setupEventListeners(): void {
    this.document.on('change', () => {
      this.emit('document-change', { document: this.document.toData() });
      if (this.canvasManager) {
        this.canvasManager.render();
      }
    });

    this.document.on('settings-changed', () => {
      // When settings change (like margins), we need to check if pages need to be added/removed
      if (this.canvasManager) {
        this.canvasManager.render();
        // Defer the page check to allow reflow to complete
        setTimeout(() => {
          this.canvasManager.checkForEmptyPages();
        }, 50);
      }
    });

    this.canvasManager.on('selection-change', (_data: any) => {
      // Embedded object selection changed - emit the change
      this.emitSelectionChange();
    });

    this.canvasManager.on('element-added', (data: any) => {
      this.emit('element-added', data);
    });

    this.canvasManager.on('element-removed', (data: any) => {
      this.emit('element-removed', data);
    });

    // Layout engine events
    this.layoutEngine.on('page-added', (data: any) => {
      this.canvasManager.setDocument(this.document);
      this.emit('page-added', data);
    });

    this.layoutEngine.on('page-break-created', (data: any) => {
      this.canvasManager.setDocument(this.document);
      this.emit('page-break-created', data);
    });

    this.layoutEngine.on('layout-complete', (data: any) => {
      this.canvasManager.render();
      this.emit('layout-complete', data);
    });
    
    // Flowing text events
    this.canvasManager.on('text-clicked', (data: any) => {
      this.enableTextInput();
      this.emit('text-clicked', data);
    });

    // Text box editing events
    this.canvasManager.on('textbox-editing-started', (data: any) => {
      // Enable keyboard input but don't show main cursor (it's hidden for text box editing)
      this.keyboardListenerActive = true;
      this.container.focus();
      this.emit('textbox-editing-started', data);
    });

    this.canvasManager.on('textbox-editing-ended', () => {
      // Keyboard input will be re-enabled when user clicks on text again
      this.keyboardListenerActive = false;
      this.emit('textbox-editing-ended', {});
    });
    
    this.canvasManager.on('cursor-changed', (data: any) => {
      // Cursor position changed (no selection, just cursor)
      // Only update to cursor mode if there's no active text selection
      // (text-selection-changed will handle selection state updates)
      if (data.textIndex !== undefined) {
        // Check if there's an active text selection - if so, don't overwrite it
        const flowingContent = this.canvasManager.getFlowingContentForActiveSection();
        const hasSelection = flowingContent?.hasSelection() ?? false;

        if (!hasSelection) {
          // Update active editing section if provided in the event
          const section = data.section || this._activeEditingSection;
          if (section !== this._activeEditingSection) {
            this._activeEditingSection = section;
          }
          this.currentSelection = {
            type: 'cursor',
            position: data.textIndex,
            section
          };
          this.emitSelectionChange();
        }
      }
      this.emit('cursor-changed', data);
    });

    this.canvasManager.on('text-selection-changed', (data: any) => {
      // Text selection changed
      if (data.selection && data.selection.start !== data.selection.end) {
        // Update active editing section if provided in the event
        const section = data.section || this._activeEditingSection;
        if (section !== this._activeEditingSection) {
          this._activeEditingSection = section;
        }
        this.currentSelection = {
          type: 'text',
          start: data.selection.start,
          end: data.selection.end,
          section
        };
        this.emitSelectionChange();
      }
      // Note: cursor-changed handles the case when selection is cleared
    });

    // Forward table cell cursor changes from CanvasManager (click events)
    this.canvasManager.on('tablecell-cursor-changed', (data: any) => {
      this.emit('tablecell-cursor-changed', data);
    });

    this.canvasManager.on('repeating-section-clicked', (data: any) => {
      // Repeating section clicked - update selection state
      if (data.section && data.section.id) {
        this.currentSelection = {
          type: 'repeating-section',
          sectionId: data.section.id
        };
        this.emitSelectionChange();
      }
    });

    // Listen for section focus changes from CanvasManager (double-click)
    this.canvasManager.on('section-focus-changed', (data: any) => {
      // Update our internal state to match the canvas manager
      if (data.section && data.section !== this._activeEditingSection) {
        this._activeEditingSection = data.section;
        this.emit('section-focus-changed', data);
      }
    });

    // Listen for focus changes to enable keyboard input for tables and other focusable controls
    this.canvasManager.on('focus-changed', (data: { control: Focusable | null }) => {
      if (data.control) {
        // Enable keyboard input when any control is focused
        this.enableTextInput();
      }
      // Check and emit unified text editing events
      this.checkAndEmitTextEditingEvents();
    });

    // Also check text editing state when textbox editing starts/ends
    this.canvasManager.on('textbox-editing-started', () => {
      this.checkAndEmitTextEditingEvents();
    });
    this.canvasManager.on('textbox-editing-ended', () => {
      this.checkAndEmitTextEditingEvents();
    });
  }

  /**
   * Get the FlowingTextContent for a specific section.
   */
  private getFlowingContentForSection(section: EditingSection): FlowingTextContent {
    switch (section) {
      case 'header':
        return this.document.headerFlowingContent;
      case 'footer':
        return this.document.footerFlowingContent;
      case 'body':
      default:
        return this.document.bodyFlowingContent;
    }
  }

  /**
   * Set up the new transaction-based undo system.
   */
  private setupTransactionUndo(): void {
    // Create FocusTracker with callbacks
    const focusTracker = new FocusTracker(
      // getActiveContent callback
      () => {
        const section = this._activeEditingSection;
        const focusedControl = this.canvasManager?.getFocusedControl();

        // Check if editing a table cell
        if (focusedControl instanceof TableObject && focusedControl.focusedCell) {
          const cell = focusedControl.getCell(
            focusedControl.focusedCell.row,
            focusedControl.focusedCell.col
          );
          if (cell && 'flowingContent' in cell) {
            return {
              content: (cell as any).flowingContent as FlowingTextContent,
              section,
              focusedObjectId: focusedControl.id,
              tableCellAddress: focusedControl.focusedCell
            };
          }
        }

        // Check if editing a text box
        if (this.canvasManager?.isEditingTextBox()) {
          const textBox = this.canvasManager.getEditingTextBox();
          if (textBox) {
            return {
              content: textBox.flowingContent,
              section,
              focusedObjectId: textBox.id,
              tableCellAddress: null
            };
          }
        }

        // Default to section content
        return {
          content: this.getFlowingContentForSection(section),
          section,
          focusedObjectId: null,
          tableCellAddress: null
        };
      },
      // restoreFocus callback
      (state) => {
        // Restore the focus state after undo/redo
        this._activeEditingSection = state.activeSection;

        // If there was a focused object, try to focus it
        if (state.focusedObjectId) {
          // For now, we'll restore cursor position in the appropriate content
          // Full object focus restoration would require more infrastructure
        }

        // Restore cursor position
        const content = this.getFlowingContentForSection(state.activeSection);
        if (content) {
          content.setCursorPosition(state.cursorPosition);
          if (state.selection) {
            content.setSelection(state.selection.start, state.selection.end);
          }
        }

        this.canvasManager?.render();
      }
    );

    // Create TransactionManager
    this.transactionManager = new TransactionManager(
      focusTracker,
      // getContent callback
      (sourceId: ContentSourceId) => {
        if (sourceId.type === 'body') return this.document.bodyFlowingContent;
        if (sourceId.type === 'header') return this.document.headerFlowingContent;
        if (sourceId.type === 'footer') return this.document.footerFlowingContent;

        // For table cells and text boxes, search through embedded objects
        if (sourceId.type === 'tablecell' && sourceId.objectId && sourceId.cellAddress) {
          const table = this.findObjectById(sourceId.objectId) as TableObject | null;
          if (table) {
            const cell = table.getCell(sourceId.cellAddress.row, sourceId.cellAddress.col);
            if (cell && 'flowingContent' in cell) {
              return (cell as any).flowingContent as FlowingTextContent;
            }
          }
        }

        if (sourceId.type === 'textbox' && sourceId.objectId) {
          const textBox = this.findObjectById(sourceId.objectId) as TextBoxObject | null;
          if (textBox) {
            return textBox.flowingContent;
          }
        }

        return null;
      },
      // getObject callback
      (sourceId: ObjectSourceId) => {
        return this.findObjectById(sourceId.objectId);
      }
    );

    // Create TextMutationObserver
    this.textMutationObserver = new TextMutationObserver(this.transactionManager);

    // Create ObjectMutationObserver
    this.objectMutationObserver = new ObjectMutationObserver(this.transactionManager);

    // Observe all existing embedded objects
    this.observeAllEmbeddedObjects();

    // Create MutationUndo
    this.mutationUndo = new MutationUndo(
      (sourceId) => this.transactionManager.getContent(sourceId),
      (sourceId) => this.transactionManager.getObject(sourceId) as BaseEmbeddedObject | null
    );

    // Wire up mutation undo/redo events
    this.transactionManager.on('undo-mutation', (data: { mutation: any }) => {
      this.mutationUndo.undoMutation(data.mutation);
    });

    this.transactionManager.on('redo-mutation', (data: { mutation: any }) => {
      this.mutationUndo.redoMutation(data.mutation);
    });

    // Forward state change events
    this.transactionManager.on('state-changed', (data: { canUndo: boolean; canRedo: boolean }) => {
      this.emit('undo-state-changed', data);
    });

    // Create ContentDiscovery to auto-register content sources
    this._contentDiscovery = new ContentDiscovery(
      this.textMutationObserver,
      {
        bodyFlowingContent: this.document.bodyFlowingContent,
        headerFlowingContent: this.document.headerFlowingContent,
        footerFlowingContent: this.document.footerFlowingContent
      },
      this.canvasManager as any // Cast to FocusEventSource
    );

    // Log initialization success (also ensures _contentDiscovery is "used")
    if (this._contentDiscovery) {
      // ContentDiscovery is active and listening for focus events
    }
  }

  /**
   * Find an embedded object by ID across all content sources.
   */
  private findObjectById(objectId: string): BaseEmbeddedObject | null {
    // Search in body
    for (const [, obj] of this.document.bodyFlowingContent.getEmbeddedObjects()) {
      if (obj.id === objectId) return obj;
    }

    // Search in header
    for (const [, obj] of this.document.headerFlowingContent.getEmbeddedObjects()) {
      if (obj.id === objectId) return obj;
    }

    // Search in footer
    for (const [, obj] of this.document.footerFlowingContent.getEmbeddedObjects()) {
      if (obj.id === objectId) return obj;
    }

    return null;
  }

  /**
   * Observe all embedded objects for undo/redo tracking.
   */
  private observeAllEmbeddedObjects(): void {
    // Observe body objects
    for (const [, obj] of this.document.bodyFlowingContent.getEmbeddedObjects()) {
      this.objectMutationObserver.observe(obj);
    }

    // Observe header objects
    for (const [, obj] of this.document.headerFlowingContent.getEmbeddedObjects()) {
      this.objectMutationObserver.observe(obj);
    }

    // Observe footer objects
    for (const [, obj] of this.document.footerFlowingContent.getEmbeddedObjects()) {
      this.objectMutationObserver.observe(obj);
    }
  }

  /**
   * Observe a single embedded object for undo/redo tracking.
   */
  private observeEmbeddedObject(object: BaseEmbeddedObject): void {
    if (this.objectMutationObserver) {
      this.objectMutationObserver.observe(object);
    }
  }

  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Get the current selection state.
   * Returns a union type indicating text selection, element selection, or no selection.
   */
  getSelection(): EditorSelection {
    return this.currentSelection;
  }

  /**
   * Get the text selection directly from the active FlowingTextContent.
   * This is a more direct query than getSelection() which relies on event tracking.
   * Returns null if no text is selected.
   */
  getTextSelection(): { start: number; end: number } | null {
    const flowingContent = this.getEditingFlowingContent() || this.getActiveFlowingContent();
    if (flowingContent) {
      return flowingContent.getSelection();
    }
    return null;
  }

  /**
   * Get the currently active editing section (header, body, or footer).
   */
  getActiveSection(): EditingSection {
    return this._activeEditingSection;
  }

  /**
   * Set the active editing section.
   * This changes which section receives keyboard input and cursor positioning.
   */
  setActiveSection(section: EditingSection): void {
    if (this._activeEditingSection !== section) {
      this._activeEditingSection = section;
      // Delegate to canvas manager which handles the section change and emits events
      this.canvasManager.setActiveSection(section);
    }
  }

  /**
   * Get the FlowingTextContent for the currently active section.
   */
  private getActiveFlowingContent(): FlowingTextContent {
    switch (this._activeEditingSection) {
      case 'header':
        return this.document.headerFlowingContent;
      case 'footer':
        return this.document.footerFlowingContent;
      case 'body':
      default:
        return this.document.bodyFlowingContent;
    }
  }

  /**
   * Emit the unified selection-change event.
   */
  private emitSelectionChange(): void {
    this.emit('selection-change', {
      selection: this.currentSelection
    });
  }

  /**
   * Emit a cursor changed event for the focused table cell.
   */
  private emitTableCellCursorChanged(table: TableObject): void {
    if (!table.focusedCell) return;
    const cell = table.getCell(table.focusedCell.row, table.focusedCell.col);
    if (cell) {
      this.emit('tablecell-cursor-changed', {
        table,
        cell,
        cursorPosition: cell.flowingContent.getCursorPosition(),
        selection: cell.flowingContent.getSelection()
      });
    }
  }

  /**
   * Get the current text editing source type.
   * Returns null if no text is being edited.
   */
  private getTextEditingSource(): 'body' | 'textbox' | 'tablecell' | null {
    const focusedControl = this.canvasManager.getFocusedControl();

    // Check body/header/footer text has focus
    if (focusedControl instanceof FlowingTextContent) return 'body';

    // Check text box editing
    if (this.canvasManager.isEditingTextBox()) return 'textbox';

    // Check table cell editing
    if (focusedControl instanceof TableObject && focusedControl.focusedCell) return 'tablecell';

    return null;
  }

  /**
   * Check if text editing state changed and emit appropriate events.
   */
  private checkAndEmitTextEditingEvents(): void {
    const currentSource = this.getTextEditingSource();
    const isNowEditing = currentSource !== null;

    // Check for state changes
    if (isNowEditing && !this._wasTextEditing) {
      // Started editing
      this._wasTextEditing = true;
      this._textEditingSource = currentSource;
      this.emit('text-editing-started', { source: currentSource });
    } else if (!isNowEditing && this._wasTextEditing) {
      // Stopped editing
      const previousSource = this._textEditingSource;
      this._wasTextEditing = false;
      this._textEditingSource = null;
      this.emit('text-editing-ended', { source: previousSource });
    } else if (isNowEditing && this._wasTextEditing && currentSource !== this._textEditingSource) {
      // Changed from one text editing context to another
      const previousSource = this._textEditingSource;
      this._textEditingSource = currentSource;
      this.emit('text-editing-ended', { source: previousSource });
      this.emit('text-editing-started', { source: currentSource });
    }
  }

  loadDocument(documentData: DocumentData): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    this.document.clear();
    this.document = new Document(documentData);
    this.canvasManager.setDocument(this.document);

    // Reset editing state
    this._activeEditingSection = 'body';
    this.currentSelection = { type: 'none' };

    // Clear undo history on document load
    this.clearUndoHistory();

    // Update layout engine with new document
    this.layoutEngine.destroy();
    this.layoutEngine = new LayoutEngine(this.document, {
      autoFlow: true,
      snapToGrid: this.options.showGrid,
      gridSize: this.options.gridSize
    });

    this.setupEventListeners();
    this.setupTransactionUndo();
    this.emit('document-loaded', { document: documentData });
  }

  getDocument(): DocumentData {
    return this.document.toData();
  }

  bindData(data: DataBindingContext): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const boundDocument = this.dataBinder.bind(this.document.toData(), data);
    this.loadDocument(boundDocument);
    this.emit('data-bound', { data });
  }

  async exportPDF(options?: PDFExportOptions): Promise<Blob> {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Save original document state before applying merge data
    // so we can restore it after PDF generation
    let originalDocumentData: DocumentData | null = null;

    try {
      // Apply merge data if requested
      if (options?.applyMergeData && options?.mergeData) {
        // Save the original document state before merge
        originalDocumentData = this.document.toData();

        this.applyMergeData(options.mergeData);
        // Re-render to update flowed content after merge
        this.canvasManager.render();
      }

      // Get flowed content snapshot for PDF generation
      const flowedContent = this.canvasManager.getFlowedPagesSnapshot();

      const pdfBlob = await this.pdfGenerator.generate(this.document, flowedContent, options);
      this.emit('pdf-exported');
      return pdfBlob;
    } catch (error) {
      console.error('Failed to export PDF:', error);
      this.emit('error', { error, context: 'pdf-export' });
      throw error;
    } finally {
      // Restore original document state if we saved it
      if (originalDocumentData) {
        this.loadDocument(originalDocumentData);
      }
    }
  }

  // ============================================
  // Document Save/Load
  // ============================================

  /**
   * Save the current document state to a JSON string.
   * @returns JSON string representation of the document
   */
  saveDocument(): string {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const documentData = this.document.toData();
    return JSON.stringify(documentData, null, 2);
  }

  /**
   * Save the current document state to a downloadable file.
   * @param filename Optional filename (defaults to 'document.pceditor.json')
   */
  saveDocumentToFile(filename: string = 'document.pceditor.json'): void {
    const jsonString = this.saveDocument();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.emit('document-saved', { filename });
  }

  /**
   * Load a document from a JSON string.
   * @param jsonString JSON string representation of the document
   */
  loadDocumentFromJSON(jsonString: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    try {
      const documentData = JSON.parse(jsonString) as DocumentData;
      this.validateDocumentData(documentData);
      this.loadDocument(documentData);
      this.emit('document-loaded-from-json', { version: documentData.version });
    } catch (error) {
      this.emit('error', { error, context: 'load-document' });
      throw error;
    }
  }

  /**
   * Load a document from a File object.
   * @param file File object to load
   * @returns Promise that resolves when loading is complete
   */
  async loadDocumentFromFile(file: File): Promise<void> {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const jsonString = event.target?.result as string;
          this.loadDocumentFromJSON(jsonString);
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        const error = new Error('Failed to read file');
        this.emit('error', { error, context: 'file-read' });
        reject(error);
      };

      reader.readAsText(file);
    });
  }

  /**
   * Validate document data structure before loading.
   * @throws Error if validation fails
   */
  private validateDocumentData(data: unknown): asserts data is DocumentData {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid document data: expected object');
    }

    const doc = data as Record<string, unknown>;

    if (typeof doc.version !== 'string') {
      throw new Error('Invalid document data: missing or invalid version');
    }

    if (!Array.isArray(doc.pages)) {
      throw new Error('Invalid document data: missing or invalid pages array');
    }

    // Validate each page has an ID
    for (const page of doc.pages) {
      if (!page || typeof page !== 'object' || typeof (page as Record<string, unknown>).id !== 'string') {
        throw new Error('Invalid document data: page missing id');
      }
    }

    // Version compatibility check
    const [major] = doc.version.split('.').map(Number);
    if (major > 1) {
      console.warn(`Document version ${doc.version} may not be fully compatible with this editor`);
    }
  }

  selectElement(elementId: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    this.canvasManager.selectElement(elementId);
  }

  clearSelection(): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    this.canvasManager.clearSelection();
  }

  removeEmbeddedObject(objectId: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    this.canvasManager.removeEmbeddedObject(objectId);
  }

  /**
   * Undo the last operation.
   */
  undo(): void {
    if (!this._isReady) return;

    const success = this.transactionManager.undo();
    if (success) {
      this.canvasManager.render();
    }
    this.emit('undo');
  }

  /**
   * Redo the last undone operation.
   */
  redo(): void {
    if (!this._isReady) return;

    const success = this.transactionManager.redo();
    if (success) {
      this.canvasManager.render();
    }
    this.emit('redo');
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.transactionManager.canUndo();
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.transactionManager.canRedo();
  }

  /**
   * Clear undo/redo history.
   */
  clearUndoHistory(): void {
    this.transactionManager.clear();
  }

  /**
   * Set the maximum number of undo entries.
   */
  setMaxUndoHistory(count: number): void {
    this.transactionManager.setMaxHistory(count);
  }

  zoomIn(): void {
    if (!this._isReady) return;
    this.canvasManager.zoomIn();
  }

  zoomOut(): void {
    if (!this._isReady) return;
    this.canvasManager.zoomOut();
  }

  setZoom(level: number): void {
    if (!this._isReady) return;
    this.canvasManager.setZoom(level);
  }

  fitToWidth(): void {
    if (!this._isReady) return;
    this.canvasManager.fitToWidth();
  }

  /**
   * Force a re-render of the canvas.
   */
  render(): void {
    if (!this._isReady) return;
    this.canvasManager.render();
  }

  fitToPage(): void {
    if (!this._isReady) return;
    this.canvasManager.fitToPage();
  }

  // Layout control methods
  setAutoFlow(enabled: boolean): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    this.layoutEngine.setAutoFlow(enabled);
  }

  reflowDocument(): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    this.layoutEngine.reflowDocument();
  }

  setSnapToGrid(enabled: boolean): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    this.layoutEngine.setSnapToGrid(enabled, this.options.gridSize);
  }

  getDocumentMetrics(): any {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    return this.layoutEngine.getDocumentMetrics();
  }

  addPage(): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const newPageData = {
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const newPage = new Page(newPageData, this.document.settings);
    this.document.addPage(newPage);
    this.canvasManager.setDocument(this.document);
  }

  removePage(pageId: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    
    if (this.document.pages.length <= 1) {
      throw new Error('Cannot remove the last page');
    }
    
    this.document.removePage(pageId);
    this.canvasManager.setDocument(this.document);
  }

  private setupKeyboardListeners(): void {
    // Make the container focusable
    this.container.setAttribute('tabindex', '0');
    
    this.container.addEventListener('keydown', (e) => {
      if (!this.keyboardListenerActive) return;
      
      this.handleKeyDown(e);
    });
    
    this.container.addEventListener('blur', () => {
      this.disableTextInput();
    });

    this.container.addEventListener('focus', () => {
      // Re-enable keyboard input when the container regains focus
      this.enableTextInput();
    });
  }
  
  private handleKeyDown(e: KeyboardEvent): void {
    // Handle undo/redo shortcuts first (works globally)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault();
      this.redo();
      return;
    }

    // Handle copy/cut/paste shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      this.copy();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      e.preventDefault();
      this.cut();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      this.paste();
      return;
    }

    // If an embedded object is selected (but not being edited), arrow keys should deselect it
    // and move the cursor in the text flow
    const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
    if (isArrowKey && this.canvasManager.hasSelectedElements()) {
      // Check if we're not in editing mode
      const editingTextBox = this.canvasManager.getEditingTextBox();
      const focusedTable = this.canvasManager.getFocusedControl();
      const isEditing = editingTextBox?.editing || (focusedTable instanceof TableObject && focusedTable.editing);

      if (!isEditing) {
        // Clear the selection and let the key be handled by the body content
        this.canvasManager.clearSelection();
      }
    }

    // Use the unified focus system to get the currently focused control
    const focusedControl = this.canvasManager.getFocusedControl();
    console.log('[PCEditor.handleKeyDown] Key:', e.key, 'focusedControl:', focusedControl?.constructor?.name);
    if (!focusedControl) return;

    // Vertical navigation needs layout context - handle specially
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.handleVerticalNavigation(e, focusedControl);
      return;
    }

    // Capture embedded object info before handling Escape, so we can return focus to parent
    let embeddedObjectTextIndex: number | null = null;
    let embeddedObjectId: string | null = null;
    const editingTextBoxBefore = this.canvasManager.getEditingTextBox();

    if (e.key === 'Escape') {
      if (editingTextBoxBefore && editingTextBoxBefore.editing) {
        embeddedObjectTextIndex = editingTextBoxBefore.textIndex;
        embeddedObjectId = editingTextBoxBefore.id;
      } else if (focusedControl instanceof TableObject && focusedControl.editing) {
        embeddedObjectTextIndex = focusedControl.textIndex;
        embeddedObjectId = focusedControl.id;
      }
    }

    // Delegate to the focused control's handleKeyDown
    console.log('[PCEditor.handleKeyDown] Calling focusedControl.handleKeyDown');
    const handled = focusedControl.handleKeyDown(e);
    console.log('[PCEditor.handleKeyDown] handled:', handled);

    if (handled) {
      this.canvasManager.render();

      // Handle text box-specific post-processing
      const editingTextBox = this.canvasManager.getEditingTextBox();
      if (editingTextBox) {
        // If Escape was pressed, the text box exits editing mode
        if (!editingTextBox.editing) {
          this.canvasManager.setEditingTextBox(null);
        } else {
          // Emit cursor changed event for text box so UI can update
          this.emit('textbox-cursor-changed', {
            textBox: editingTextBox,
            cursorPosition: editingTextBox.flowingContent.getCursorPosition(),
            selection: editingTextBox.flowingContent.getSelection()
          });
        }
      }

      // Handle table cell-specific post-processing
      if (focusedControl instanceof TableObject && focusedControl.focusedCell) {
        const cell = focusedControl.getCell(focusedControl.focusedCell.row, focusedControl.focusedCell.col);
        if (cell) {
          // Emit cursor changed event for table cell so UI can update
          this.emit('tablecell-cursor-changed', {
            table: focusedControl,
            cell: cell,
            cursorPosition: cell.flowingContent.getCursorPosition(),
            selection: cell.flowingContent.getSelection()
          });
        }
      }

      // Return focus to parent flowing content after Escape exits an embedded object
      if (e.key === 'Escape' && embeddedObjectId !== null && embeddedObjectTextIndex !== null) {
        this.returnFocusToParentFlowingContent(embeddedObjectId, embeddedObjectTextIndex);
      }
    } else if (e.key === 'Escape') {
      // If focused control didn't handle Escape, check if we have selected elements to clear
      this.handleEscapeForSelectedElements();
    }
  }

  /**
   * Handle Escape key when there are selected elements (not in editing mode).
   * Clears selection and returns cursor focus to the flowing text.
   */
  private handleEscapeForSelectedElements(): void {
    // Check if there are any selected embedded objects
    const selectedElements = this.canvasManager.getSelectedElements();
    if (selectedElements.length === 0) return;

    // Find the first selected embedded object and get its info
    for (const elementId of selectedElements) {
      const objectInfo = this.findEmbeddedObjectInfo(elementId);
      if (objectInfo) {
        // Clear selection first
        this.canvasManager.clearSelection();

        // Return focus to the parent flowing content at the object's position
        objectInfo.content.setCursorPosition(objectInfo.textIndex);
        this.canvasManager.setFocus(objectInfo.content);

        // Update active section if needed
        if (objectInfo.section !== this.canvasManager.getActiveSection()) {
          this.canvasManager.setActiveSection(objectInfo.section);
        }

        this.canvasManager.render();
        return;
      }
    }

    // If no embedded objects found, just clear selection
    this.canvasManager.clearSelection();
    this.canvasManager.render();
  }

  /**
   * Find embedded object info by ID across all flowing content sources.
   */
  private findEmbeddedObjectInfo(objectId: string): { content: FlowingTextContent; section: 'header' | 'body' | 'footer'; textIndex: number } | null {
    const flowingContents: Array<{ content: FlowingTextContent; section: 'header' | 'body' | 'footer' }> = [];

    if (this.document.headerFlowingContent) {
      flowingContents.push({ content: this.document.headerFlowingContent, section: 'header' });
    }

    // Body content is document-level
    flowingContents.push({ content: this.document.bodyFlowingContent, section: 'body' });

    if (this.document.footerFlowingContent) {
      flowingContents.push({ content: this.document.footerFlowingContent, section: 'footer' });
    }

    for (const { content, section } of flowingContents) {
      const embeddedObjectManager = content.getEmbeddedObjectManager();
      const entry = embeddedObjectManager.findById(objectId);
      if (entry) {
        return { content, section, textIndex: entry.object.textIndex };
      }
    }

    return null;
  }

  /**
   * Find the parent FlowingTextContent for an embedded object and return focus to it.
   */
  private returnFocusToParentFlowingContent(objectId: string, textIndex: number): void {
    // Search all flowing content sources for the embedded object
    const flowingContents: Array<{ content: FlowingTextContent; section: 'header' | 'body' | 'footer' }> = [];

    // Add header flowing content
    if (this.document.headerFlowingContent) {
      flowingContents.push({ content: this.document.headerFlowingContent, section: 'header' });
    }

    // Body content is document-level
    flowingContents.push({ content: this.document.bodyFlowingContent, section: 'body' });

    // Add footer flowing content
    if (this.document.footerFlowingContent) {
      flowingContents.push({ content: this.document.footerFlowingContent, section: 'footer' });
    }

    // Find which flowing content contains this embedded object
    for (const { content, section } of flowingContents) {
      const embeddedObjectManager = content.getEmbeddedObjectManager();
      const entry = embeddedObjectManager.findById(objectId);

      if (entry) {
        // Found the parent - set cursor position and focus
        content.setCursorPosition(textIndex);
        this.canvasManager.setFocus(content);

        // Update active section if needed
        if (section !== this.canvasManager.getActiveSection()) {
          this.canvasManager.setActiveSection(section);
        }

        this.canvasManager.render();
        return;
      }
    }
  }

  /**
   * Handle vertical navigation for the focused control.
   * This needs special handling because it requires layout context.
   */
  private handleVerticalNavigation(e: KeyboardEvent, focusedControl: Focusable): void {
    const direction = e.key === 'ArrowUp' ? -1 : 1;
    const editingTextBox = this.canvasManager.getEditingTextBox();

    // Check if we're editing a table - handle vertical navigation within/between cells
    if (focusedControl instanceof TableObject) {
      const table = focusedControl;
      if (table.focusedCell) {
        const cell = table.getCell(table.focusedCell.row, table.focusedCell.col);
        if (cell) {
          const flowingContent = cell.flowingContent;
          const flowedLines = cell.getFlowedLines(0);
          const cursorPos = flowingContent.getCursorPosition();

          // Handle shift+arrow for selection
          if (e.shiftKey) {
            if (!flowingContent.hasSelectionAnchor()) {
              flowingContent.setSelectionAnchor();
            }
          } else {
            flowingContent.clearSelection();
          }

          // Find which line the cursor is on
          let currentLineIndex = 0;
          for (let i = 0; i < flowedLines.length; i++) {
            if (cursorPos <= flowedLines[i].endIndex) {
              currentLineIndex = i;
              break;
            }
            if (i === flowedLines.length - 1) {
              currentLineIndex = i;
            }
          }

          const isOnFirstLine = currentLineIndex === 0;
          const isOnLastLine = currentLineIndex === flowedLines.length - 1 || flowedLines.length === 0;

          // If moving up and on first line, go to cell above
          if (direction === -1 && isOnFirstLine) {
            const newRow = table.focusedCell.row - 1;
            if (newRow >= 0) {
              table.focusCell(newRow, table.focusedCell.col);
              // Position cursor at end of new cell
              const newCell = table.getCell(newRow, table.focusedCell.col);
              if (newCell) {
                const text = newCell.flowingContent.getText();
                newCell.flowingContent.setCursorPosition(text.length);
              }
            }
            this.canvasManager.render();
            this.emitTableCellCursorChanged(table);
            return;
          }

          // If moving down and on last line, go to cell below
          if (direction === 1 && isOnLastLine) {
            const newRow = table.focusedCell.row + 1;
            if (newRow < table.rowCount) {
              table.focusCell(newRow, table.focusedCell.col);
              // Position cursor at start of new cell
              const newCell = table.getCell(newRow, table.focusedCell.col);
              if (newCell) {
                newCell.flowingContent.setCursorPosition(0);
              }
            }
            this.canvasManager.render();
            this.emitTableCellCursorChanged(table);
            return;
          }

          // Move within the cell - find position on adjacent line
          const targetLineIndex = currentLineIndex + direction;
          if (targetLineIndex >= 0 && targetLineIndex < flowedLines.length) {
            const targetLine = flowedLines[targetLineIndex];
            // Try to maintain horizontal position
            const currentLine = flowedLines[currentLineIndex];
            const offsetInLine = cursorPos - currentLine.startIndex;
            const lineLength = targetLine.endIndex - targetLine.startIndex;
            const newOffset = Math.min(offsetInLine, lineLength);
            flowingContent.setCursorPosition(targetLine.startIndex + newOffset);
            flowingContent.resetCursorBlink();
          }

          this.canvasManager.render();
          this.emitTableCellCursorChanged(table);
        }
      }
      return;
    }

    // Get the FlowingTextContent for selection handling
    const flowingContent = editingTextBox
      ? editingTextBox.flowingContent
      : this.getActiveFlowingContent();

    // Handle shift+arrow for selection
    if (e.shiftKey) {
      if (!flowingContent.hasSelectionAnchor()) {
        flowingContent.setSelectionAnchor();
      }
    } else {
      flowingContent.clearSelection();
    }

    if (editingTextBox) {
      // Text box vertical navigation needs canvas context
      const pageId = this.canvasManager.getEditingTextBoxPageId();
      if (pageId) {
        const ctx = this.canvasManager.getContext(pageId);
        if (ctx) {
          editingTextBox.moveCursorVertical(direction, ctx);
          this.canvasManager.render();

          // Emit cursor changed event for text box
          this.emit('textbox-cursor-changed', {
            textBox: editingTextBox,
            cursorPosition: editingTextBox.flowingContent.getCursorPosition(),
            selection: editingTextBox.flowingContent.getSelection()
          });
        }
      }
    } else {
      // Body/header/footer vertical navigation
      const newTextIndex = this.canvasManager.moveCursorVertical(direction);
      if (newTextIndex !== null) {
        flowingContent.setCursorPosition(newTextIndex);
        flowingContent.resetCursorBlink();
      }
      this.canvasManager.render();
    }
  }

  enableTextInput(): void {
    this.keyboardListenerActive = true;
    // Only show the main cursor if NOT editing a text box or focused control
    // When editing a text box or table, those controls manage their own cursor
    if (this.canvasManager.isEditingTextBox()) {
      // When editing a text box, we only need keyboard input active
      // Don't show main cursor or refocus (we're already focused)
      this.emit('text-input-enabled');
      return;
    }
    // Check if there's already a focused control (e.g., a table in edit mode)
    // Don't override its focus with the main FlowingTextContent
    if (this.canvasManager.getFocusedControl()) {
      // Resume cursor if it was suspended (e.g., editor regaining browser focus)
      if (this.canvasManager.isCursorSuspended()) {
        this.canvasManager.resumeCursor();
      }
      this.container.focus();
      this.emit('text-input-enabled');
      return;
    }
    this.canvasManager.showTextCursor();
    this.container.focus();
    this.emit('text-input-enabled');
  }

  disableTextInput(): void {
    this.keyboardListenerActive = false;
    this.canvasManager.hideTextCursor();
    this.emit('text-input-disabled');
  }

  /**
   * Check if a text box is currently being edited.
   */
  isEditingTextBox(): boolean {
    return this.canvasManager.isEditingTextBox();
  }

  /**
   * Check if any text content is being edited (body, header, footer, text box, or table cell).
   * This is a unified check for determining if the formatting pane should be shown.
   */
  isTextEditing(): boolean {
    const focusedControl = this.canvasManager.getFocusedControl();

    // Check body/header/footer text has focus
    if (focusedControl instanceof FlowingTextContent) return true;

    // Check text box editing
    if (this.canvasManager.isEditingTextBox()) return true;

    // Check table cell editing
    if (focusedControl instanceof TableObject && focusedControl.focusedCell) return true;

    return false;
  }

  // Saved editing context for when UI controls steal focus
  private _savedEditingContext: {
    flowingContent: FlowingTextContent;
    selection: { start: number; end: number } | null;
  } | null = null;

  /**
   * Get the FlowingTextContent currently being edited, regardless of context.
   * Works for body text, text boxes, and table cells.
   * Returns null if no text is being edited.
   */
  getEditingFlowingContent(): FlowingTextContent | null {
    const focusedControl = this.canvasManager.getFocusedControl();

    // Body/header/footer text
    if (focusedControl instanceof FlowingTextContent) return focusedControl;

    // Text box
    const textBox = this.canvasManager.getEditingTextBox();
    if (textBox) return textBox.flowingContent;

    // Table cell
    if (focusedControl instanceof TableObject && focusedControl.focusedCell) {
      const cell = focusedControl.getCell(focusedControl.focusedCell.row, focusedControl.focusedCell.col);
      if (cell) return cell.flowingContent;
    }

    return null;
  }

  /**
   * Save the current editing context (FlowingTextContent and selection).
   * Call this before UI elements steal focus (e.g., dropdown opens).
   */
  saveEditingContext(): void {
    const flowingContent = this.getEditingFlowingContent();
    if (flowingContent) {
      const selection = flowingContent.getSelection();
      this._savedEditingContext = {
        flowingContent,
        selection: selection && selection.start !== selection.end
          ? { start: selection.start, end: selection.end }
          : null
      };
    }
  }

  /**
   * Get the saved editing context selection, or the current selection if available.
   */
  getSavedOrCurrentSelection(): { start: number; end: number } | null {
    // First try to get current selection
    const currentSelection = this.getUnifiedSelection();
    if (currentSelection) return currentSelection;

    // Fall back to saved context
    if (this._savedEditingContext?.selection) {
      return this._savedEditingContext.selection;
    }

    return null;
  }

  /**
   * Apply formatting using the saved context if current context is not available.
   * This is useful when UI controls have stolen focus.
   */
  applyFormattingWithFallback(start: number, end: number, formatting: Partial<TextFormattingStyle>): void {
    // Try current context first
    let flowingContent = this.getEditingFlowingContent();

    // Fall back to saved context
    if (!flowingContent && this._savedEditingContext) {
      flowingContent = this._savedEditingContext.flowingContent;
    }

    if (!flowingContent) {
      throw new Error('No text is being edited');
    }

    flowingContent.applyFormatting(start, end, formatting);
    this.canvasManager.render();
  }

  /**
   * Set pending formatting to apply to the next inserted character.
   * Used when formatting is applied with just a cursor (no selection).
   */
  setPendingFormatting(formatting: Partial<TextFormattingStyle>): void {
    let flowingContent = this.getEditingFlowingContent();

    // Fall back to saved context
    if (!flowingContent && this._savedEditingContext) {
      flowingContent = this._savedEditingContext.flowingContent;
    }

    if (!flowingContent) {
      throw new Error('No text is being edited');
    }

    flowingContent.setPendingFormatting(formatting);
  }

  /**
   * Get the current pending formatting, if any.
   */
  getPendingFormatting(): Partial<TextFormattingStyle> | null {
    const flowingContent = this.getEditingFlowingContent();
    if (!flowingContent) return null;
    return flowingContent.getPendingFormatting();
  }

  /**
   * Check if there is pending formatting.
   */
  hasPendingFormatting(): boolean {
    const flowingContent = this.getEditingFlowingContent();
    if (!flowingContent) return false;
    return flowingContent.hasPendingFormatting();
  }

  /**
   * Clear pending formatting.
   */
  clearPendingFormatting(): void {
    const flowingContent = this.getEditingFlowingContent();
    if (flowingContent) {
      flowingContent.clearPendingFormatting();
    }
  }

  /**
   * Clear the saved editing context.
   */
  clearSavedEditingContext(): void {
    this._savedEditingContext = null;
  }

  /**
   * Get the currently editing text box, if any.
   */
  getEditingTextBox(): TextBoxObject | null {
    return this.canvasManager.getEditingTextBox();
  }

  /**
   * Get the selection from the currently editing text box.
   * Returns null if no text box is being edited or no selection.
   */
  getTextBoxSelection(): { start: number; end: number } | null {
    const textBox = this.canvasManager.getEditingTextBox();
    if (!textBox) return null;

    const selection = textBox.flowingContent.getSelection();
    if (!selection) return null;

    return { start: selection.start, end: selection.end };
  }

  /**
   * Apply formatting to the selection in the currently editing text box.
   */
  applyTextBoxFormatting(start: number, end: number, formatting: Partial<TextFormattingStyle>): void {
    const textBox = this.canvasManager.getEditingTextBox();
    if (!textBox) {
      throw new Error('No text box is being edited');
    }

    textBox.flowingContent.applyFormatting(start, end, formatting);
    this.canvasManager.render();
  }

  /**
   * Get the formatting at the cursor position in the editing text box.
   */
  getTextBoxFormattingAtCursor(): TextFormattingStyle | null {
    const textBox = this.canvasManager.getEditingTextBox();
    if (!textBox) return null;

    // If there's a selection, get formatting at selection start
    const selection = textBox.flowingContent.getSelection();
    if (selection && selection.start !== selection.end) {
      return textBox.flowingContent.getFormattingAt(selection.start);
    }

    // Otherwise use cursor position
    const cursorPos = textBox.flowingContent.getCursorPosition();
    return textBox.flowingContent.getFormattingAt(cursorPos);
  }

  /**
   * Set the alignment for the current paragraph or selection in the editing text box.
   * If there's a text selection, applies to all paragraphs in the selection.
   * Otherwise applies to the paragraph at cursor.
   */
  setTextBoxAlignment(alignment: TextAlignment): void {
    const textBox = this.canvasManager.getEditingTextBox();
    if (!textBox) {
      throw new Error('No text box is being edited');
    }

    const selection = textBox.flowingContent.getSelection();
    if (selection && selection.start !== selection.end) {
      // Apply to all paragraphs in the selection range
      textBox.flowingContent.setAlignmentForRange(selection.start, selection.end, alignment);
    } else {
      // Apply to paragraph at cursor
      textBox.flowingContent.setAlignment(alignment);
    }
    this.canvasManager.render();
  }

  /**
   * Get the alignment at the cursor position in the editing text box.
   */
  getTextBoxAlignmentAtCursor(): TextAlignment {
    const textBox = this.canvasManager.getEditingTextBox();
    if (!textBox) return 'left';

    const cursorPos = textBox.flowingContent.getCursorPosition();
    return textBox.flowingContent.getAlignmentAt(cursorPos);
  }

  // ============================================
  // Unified Text Editing API
  // These methods work for body, text boxes, AND table cells
  // ============================================

  /**
   * Get the formatting at the cursor position in whatever text is being edited.
   * Works for body text, text boxes, and table cells.
   * Considers pending formatting if present.
   */
  getUnifiedFormattingAtCursor(): TextFormattingStyle | null {
    const flowingContent = this.getEditingFlowingContent();
    if (!flowingContent) return null;

    // If there's a selection, get formatting at selection start
    const selection = flowingContent.getSelection();
    if (selection && selection.start !== selection.end) {
      return flowingContent.getFormattingAt(selection.start);
    }

    // Use effective formatting which includes pending formatting
    return flowingContent.getEffectiveFormattingAtCursor();
  }

  /**
   * Apply formatting to the current selection in whatever text is being edited.
   * Works for body text, text boxes, and table cells.
   */
  applyUnifiedFormatting(start: number, end: number, formatting: Partial<TextFormattingStyle>): void {
    const flowingContent = this.getEditingFlowingContent();
    if (!flowingContent) {
      throw new Error('No text is being edited');
    }

    flowingContent.applyFormatting(start, end, formatting);
    this.canvasManager.render();
  }

  /**
   * Get the selection from whatever text is being edited.
   * Works for body text, text boxes, and table cells.
   */
  getUnifiedSelection(): { start: number; end: number } | null {
    const flowingContent = this.getEditingFlowingContent();
    if (!flowingContent) return null;

    const selection = flowingContent.getSelection();
    if (selection && selection.start !== selection.end) {
      return { start: selection.start, end: selection.end };
    }
    return null;
  }

  /**
   * Get the alignment at the cursor position in whatever text is being edited.
   * Works for body text, text boxes, and table cells.
   */
  getUnifiedAlignmentAtCursor(): TextAlignment {
    const flowingContent = this.getEditingFlowingContent();
    if (!flowingContent) return 'left';

    const cursorPos = flowingContent.getCursorPosition();
    return flowingContent.getAlignmentAt(cursorPos);
  }

  /**
   * Set the alignment for the current paragraph or selection in whatever text is being edited.
   * Works for body text, text boxes, and table cells.
   */
  setUnifiedAlignment(alignment: TextAlignment): void {
    const flowingContent = this.getEditingFlowingContent();
    if (!flowingContent) {
      throw new Error('No text is being edited');
    }

    const selection = flowingContent.getSelection();
    if (selection && selection.start !== selection.end) {
      // Apply to all paragraphs in the selection range
      flowingContent.setAlignmentForRange(selection.start, selection.end, alignment);
    } else {
      // Apply to paragraph at cursor
      flowingContent.setAlignment(alignment);
    }
    this.canvasManager.render();
  }

  insertText(text: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const flowingContent = this.getActiveFlowingContent();
    if (flowingContent) {
      flowingContent.insertText(text);
    }
  }
  
  getFlowingText(): string {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const flowingContent = this.getActiveFlowingContent();
    return flowingContent ? flowingContent.getText() : '';
  }
  
  setFlowingText(text: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const flowingContent = this.getActiveFlowingContent();
    if (flowingContent) {
      flowingContent.setText(text);
    }
  }

  /**
   * Set the cursor position in the active flowing content.
   * Works for body, header, footer, text boxes, and table cells.
   */
  setCursorPosition(position: number): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // First try editing content (table cells, text boxes)
    let flowingContent = this.getEditingFlowingContent();

    // Fall back to active section
    if (!flowingContent) {
      flowingContent = this.getActiveFlowingContent();
    }

    if (flowingContent) {
      flowingContent.setCursorPosition(position);

      // Update currentSelection to reflect the new cursor position
      this.currentSelection = {
        type: 'cursor',
        position: position,
        section: this._activeEditingSection
      };
      this.emitSelectionChange();
    }
  }

  /**
   * Get the current cursor position in the active flowing content.
   * Returns the position for cursor selections, start position for text selections,
   * or 0 if no text content is selected.
   */
  getCursorPosition(): number {
    const selection = this.currentSelection;

    if (selection.type === 'cursor') {
      return selection.position;
    }

    if (selection.type === 'text') {
      return selection.start;
    }

    // For non-text selections, try to get from the active content
    const flowingContent = this.getEditingFlowingContent() || this.getActiveFlowingContent();
    if (flowingContent) {
      return flowingContent.getCursorPosition();
    }

    return 0;
  }

  /**
   * Insert an embedded object at the current cursor position.
   * Works for body, header, footer, text boxes, and table cells.
   */
  insertEmbeddedObject(object: BaseEmbeddedObject, position: ObjectPosition = 'inline'): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Clear any existing selection before inserting
    this.canvasManager.clearSelection();

    // First try to get the currently editing content (handles table cells, text boxes)
    let flowingContent = this.getEditingFlowingContent();

    // Fall back to active section if nothing is being edited
    if (!flowingContent) {
      flowingContent = this.getActiveFlowingContent();
    }

    if (!flowingContent) {
      throw new Error('No active section available');
    }

    // Insert the embedded object at the current cursor position
    flowingContent.insertEmbeddedObject(object, position);

    // Observe the new object for undo/redo tracking
    this.observeEmbeddedObject(object);

    this.canvasManager.render();
    this.emit('embedded-object-added', { object, position, section: this._activeEditingSection });
  }

  /**
   * Insert a substitution field at the current cursor position.
   * Works for body, header, footer, text boxes, and table cells.
   */
  insertSubstitutionField(fieldName: string, config?: SubstitutionFieldConfig): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Clear any existing selection before inserting
    this.canvasManager.clearSelection();

    // First try to get the currently editing content (handles table cells, text boxes)
    let flowingContent = this.getEditingFlowingContent();

    // Fall back to active section if nothing is being edited
    if (!flowingContent) {
      flowingContent = this.getActiveFlowingContent();
    }

    if (!flowingContent) {
      throw new Error('No active section available');
    }

    const field = flowingContent.insertSubstitutionField(fieldName, config);

    this.canvasManager.render();
    this.emit('substitution-field-added', { field, section: this._activeEditingSection });
  }

  /**
   * Insert a page number field at the current cursor position.
   * The field displays the current page number during rendering.
   * Works for body, header, footer, text boxes, and table cells.
   * @param displayFormat Optional format string (e.g., "Page %d" where %d is replaced by page number)
   */
  insertPageNumberField(displayFormat?: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Clear any existing selection before inserting
    this.canvasManager.clearSelection();

    // First try to get the currently editing content (handles table cells, text boxes)
    let flowingContent = this.getEditingFlowingContent();

    // Fall back to active section if nothing is being edited
    if (!flowingContent) {
      flowingContent = this.getActiveFlowingContent();
    }

    if (!flowingContent) {
      throw new Error('No active section available');
    }

    const field = flowingContent.insertPageNumberField(displayFormat);

    this.canvasManager.render();
    this.emit('page-number-field-added', { field, section: this._activeEditingSection });
  }

  /**
   * Insert a page count field at the current cursor position.
   * The field displays the total page count during rendering.
   * Works for body, header, footer, text boxes, and table cells.
   * @param displayFormat Optional format string (e.g., "of %d" where %d is replaced by page count)
   */
  insertPageCountField(displayFormat?: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Clear any existing selection before inserting
    this.canvasManager.clearSelection();

    // First try to get the currently editing content (handles table cells, text boxes)
    let flowingContent = this.getEditingFlowingContent();

    // Fall back to active section if nothing is being edited
    if (!flowingContent) {
      flowingContent = this.getActiveFlowingContent();
    }

    if (!flowingContent) {
      throw new Error('No active section available');
    }

    const field = flowingContent.insertPageCountField(displayFormat);

    this.canvasManager.render();
    this.emit('page-count-field-added', { field, section: this._activeEditingSection });
  }

  /**
   * Insert a page break at the current cursor position.
   * Forces subsequent content to start on a new page.
   * Works for body content. Note: Page breaks in headers, footers, text boxes,
   * or table cells are not recommended as these don't span pages.
   */
  insertPageBreak(): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Only allow page breaks in body content
    const flowingContent = this.document.bodyFlowingContent;
    if (!flowingContent.hasFocus()) {
      throw new Error('Page breaks can only be inserted in body content');
    }

    flowingContent.insertPageBreak();

    this.canvasManager.render();
    this.emit('page-break-inserted', { position: flowingContent.getCursorPosition() });
  }

  /**
   * Get a substitution field at a specific text position in the active section.
   * @param position The text index to check
   * @returns The substitution field at that position, or null if none
   */
  getFieldAt(position: number): SubstitutionField | null {
    if (!this._isReady) {
      return null;
    }

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) {
      return null;
    }

    const fieldManager = flowingContent.getSubstitutionFieldManager();
    // Check at position first, then check position - 1
    // (cursor is positioned AFTER the field when clicking on it)
    return fieldManager.getFieldAt(position) || fieldManager.getFieldAt(position - 1) || null;
  }

  /**
   * Get the substitution field at the current selection/cursor position.
   * @returns The substitution field if the cursor/selection is on a field, or null
   */
  getSelectedField(): SubstitutionField | null {
    const selection = this.currentSelection;

    if (selection.type === 'cursor') {
      return this.getFieldAt(selection.position);
    } else if (selection.type === 'text') {
      // Check if selection start is on a field
      return this.getFieldAt(selection.start);
    }

    return null;
  }

  /**
   * Get the currently selected text box if one is selected.
   * @returns The selected TextBoxObject or null if no text box is selected
   */
  getSelectedTextBox(): TextBoxObject | null {
    // Check all selected embedded objects
    const selectedIds = this.canvasManager.getSelectedElements();
    if (selectedIds.length === 0) return null;

    const flowingContents = [
      this.document.bodyFlowingContent,
      this.document.headerFlowingContent,
      this.document.footerFlowingContent
    ].filter(Boolean);

    for (const flowingContent of flowingContents) {
      const embeddedObjects = flowingContent.getEmbeddedObjects();
      for (const elementId of selectedIds) {
        for (const [, obj] of embeddedObjects.entries()) {
          if (obj.id === elementId && obj instanceof TextBoxObject) {
            return obj;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get the currently selected table if one is selected.
   * @returns The selected TableObject or null if no table is selected
   */
  getSelectedTable(): TableObject | null {
    // Check all selected embedded objects
    const selectedIds = this.canvasManager.getSelectedElements();
    if (selectedIds.length === 0) return null;

    const flowingContents = [
      this.document.bodyFlowingContent,
      this.document.headerFlowingContent,
      this.document.footerFlowingContent
    ].filter(Boolean);

    for (const flowingContent of flowingContents) {
      const embeddedObjects = flowingContent.getEmbeddedObjects();
      for (const elementId of selectedIds) {
        for (const [, obj] of embeddedObjects.entries()) {
          if (obj.id === elementId && obj instanceof TableObject) {
            return obj;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get the currently selected image if one is selected.
   * @returns The selected ImageObject or null if no image is selected
   */
  getSelectedImage(): ImageObject | null {
    // Check all selected embedded objects
    const selectedIds = this.canvasManager.getSelectedElements();
    if (selectedIds.length === 0) return null;

    const flowingContents = [
      this.document.bodyFlowingContent,
      this.document.headerFlowingContent,
      this.document.footerFlowingContent
    ].filter(Boolean);

    for (const flowingContent of flowingContents) {
      const embeddedObjects = flowingContent.getEmbeddedObjects();
      for (const elementId of selectedIds) {
        for (const [, obj] of embeddedObjects.entries()) {
          if (obj.id === elementId && obj instanceof ImageObject) {
            return obj;
          }
        }
      }
    }

    return null;
  }

  /**
   * Get the currently focused table (table being edited).
   * @returns The focused TableObject or null
   */
  getFocusedTable(): TableObject | null {
    const focusedControl = this.canvasManager?.getFocusedControl();
    if (focusedControl && focusedControl instanceof TableObject) {
      return focusedControl;
    }
    return null;
  }

  // ============================================
  // Table Structure Operations (with undo support)
  // ============================================

  /**
   * Insert a row into a table.
   * Undo is automatically tracked via ObjectMutationObserver.
   * @param table The table to modify
   * @param rowIndex The index at which to insert the row
   * @param config Optional row configuration
   */
  tableInsertRow(table: TableObject, rowIndex: number, config?: TableRowConfig): void {
    if (!this._isReady) return;
    table.insertRow(rowIndex, config);
    this.canvasManager.render();
  }

  /**
   * Remove a row from a table.
   * Undo is automatically tracked via ObjectMutationObserver.
   * @param table The table to modify
   * @param rowIndex The index of the row to remove
   */
  tableRemoveRow(table: TableObject, rowIndex: number): void {
    if (!this._isReady) return;
    table.removeRow(rowIndex);
    this.canvasManager.render();
  }

  /**
   * Insert a column into a table.
   * Undo is automatically tracked via ObjectMutationObserver.
   * @param table The table to modify
   * @param colIndex The index at which to insert the column
   * @param width Optional column width
   */
  tableInsertColumn(table: TableObject, colIndex: number, width?: number): void {
    if (!this._isReady) return;
    table.insertColumn(colIndex, width);
    this.canvasManager.render();
  }

  /**
   * Remove a column from a table.
   * Undo is automatically tracked via ObjectMutationObserver.
   * @param table The table to modify
   * @param colIndex The index of the column to remove
   */
  tableRemoveColumn(table: TableObject, colIndex: number): void {
    if (!this._isReady) return;
    table.removeColumn(colIndex);
    this.canvasManager.render();
  }

  /**
   * Begin a compound operation. Groups multiple mutations into a single undo entry.
   * Call endCompoundOperation after making changes.
   * @param description Description of the change for undo/redo
   */
  beginCompoundOperation(description?: string): void {
    this.transactionManager.beginCompoundOperation(description);
  }

  /**
   * End a compound operation.
   * @param description Description of the change for undo/redo (overrides begin description)
   */
  endCompoundOperation(description?: string): void {
    this.transactionManager.endCompoundOperation(description);
    this.canvasManager.render();
  }

  /**
   * Update a substitution field's properties in the active section.
   * @param textIndex The text index of the field to update
   * @param updates The properties to update
   * @returns true if the field was updated, false if not found
   */
  updateField(textIndex: number, updates: { fieldName?: string; defaultValue?: string; displayFormat?: string }): boolean {
    if (!this._isReady) {
      return false;
    }

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) {
      return false;
    }

    const fieldManager = flowingContent.getSubstitutionFieldManager();
    const field = fieldManager.getFieldAt(textIndex);
    if (!field) {
      return false;
    }

    const success = fieldManager.updateFieldConfig(textIndex, updates);

    if (success) {
      // Field updates are captured by TextMutationObserver via 'substitution-field-updated' event
      this.canvasManager.render();
      this.emit('substitution-field-updated', { textIndex, updates, section: this._activeEditingSection });
    }

    return success;
  }

  /**
   * @deprecated Use insertEmbeddedObject instead
   */
  insertInlineElement(_elementData: unknown, _position: ObjectPosition = 'inline'): void {
    console.warn('insertInlineElement is deprecated and no longer functional. Use insertEmbeddedObject instead.');
  }

  /**
   * Apply merge data to substitute all substitution fields with their values.
   * First expands repeating sections (body only), then replaces fields in body, header, and footer.
   * Field names can use dot-notation to access nested properties (e.g., "contact.address.street").
   * For arrays, the 0th element is used by default (e.g., "items.item" resolves to items[0].item).
   * Fields inside loops resolve relative to their iteration index.
   * @param data Object containing merge data (can be nested)
   */
  applyMergeData(data: Record<string, unknown>): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Body content is document-level
    const bodyContent = this.document.bodyFlowingContent;
    let totalFieldCount = 0;

    // Step 1: Expand repeating sections in body (header/footer don't support them)
    this.expandRepeatingSections(bodyContent, data);

    // Step 2: Expand table row loops in body, header, and footer
    this.expandTableRowLoops(bodyContent, data);
    this.expandTableRowLoops(this.document.headerFlowingContent, data);
    this.expandTableRowLoops(this.document.footerFlowingContent, data);

    // Step 3: Substitute all fields in body
    totalFieldCount += this.substituteFieldsInContent(bodyContent, data);

    // Step 4: Substitute all fields in embedded objects in body
    totalFieldCount += this.substituteFieldsInEmbeddedObjects(bodyContent, data);

    // Step 5: Substitute all fields in header
    totalFieldCount += this.substituteFieldsInContent(this.document.headerFlowingContent, data);

    // Step 6: Substitute all fields in embedded objects in header
    totalFieldCount += this.substituteFieldsInEmbeddedObjects(this.document.headerFlowingContent, data);

    // Step 7: Substitute all fields in footer
    totalFieldCount += this.substituteFieldsInContent(this.document.footerFlowingContent, data);

    // Step 8: Substitute all fields in embedded objects in footer
    totalFieldCount += this.substituteFieldsInEmbeddedObjects(this.document.footerFlowingContent, data);

    this.canvasManager.render();
    this.emit('merge-data-applied', { data, fieldCount: totalFieldCount });
  }

  /**
   * Substitute all fields in a FlowingTextContent with values from data.
   * @returns The number of fields substituted
   */
  private substituteFieldsInContent(flowingContent: FlowingTextContent, data: Record<string, unknown>): number {
    const fieldManager = flowingContent.getSubstitutionFieldManager();

    // Get only data fields (skip page number and page count fields)
    // Sort by text index descending so we process from end to start
    const fields = fieldManager.getFieldsArray()
      .filter(f => !f.fieldType || f.fieldType === 'data')
      .sort((a, b) => b.textIndex - a.textIndex);

    // Replace each field with its value
    for (const field of fields) {
      const value = this.resolveFieldPath(field.fieldName, data);
      const replacement = value !== undefined ? String(value) : (field.defaultValue || `{{${field.fieldName}}}`);

      // Store the field's formatting before we delete it
      const fieldFormatting = field.formatting;
      const insertPosition = field.textIndex;

      // Delete the placeholder character at the field's position
      // This will automatically remove the field from the manager
      flowingContent.deleteText(field.textIndex, 1);

      // Insert the replacement value at that position
      flowingContent.setCursorPosition(insertPosition);
      flowingContent.insertText(replacement);

      // Apply the field's formatting to the replacement text
      if (fieldFormatting) {
        flowingContent.applyFormatting(insertPosition, insertPosition + replacement.length, fieldFormatting);
      }
    }

    return fields.length;
  }

  /**
   * Substitute all fields in embedded objects (text boxes and tables) within a FlowingTextContent.
   * @returns The number of fields substituted
   */
  private substituteFieldsInEmbeddedObjects(flowingContent: FlowingTextContent, data: Record<string, unknown>): number {
    let totalFieldCount = 0;

    const embeddedObjects = flowingContent.getEmbeddedObjects();
    for (const [, obj] of embeddedObjects.entries()) {
      // Handle TextBoxObject
      if (obj instanceof TextBoxObject) {
        totalFieldCount += this.substituteFieldsInContent(obj.flowingContent, data);
      }
      // Handle TableObject
      else if (obj instanceof TableObject) {
        for (const row of obj.rows) {
          for (const cell of row.cells) {
            totalFieldCount += this.substituteFieldsInContent(cell.flowingContent, data);
          }
        }
      }
    }

    return totalFieldCount;
  }

  /**
   * Expand table row loops in embedded tables within a FlowingTextContent.
   * For each table with row loops, duplicates template rows for each array element.
   * Must be called before substituteFieldsInEmbeddedObjects().
   */
  private expandTableRowLoops(flowingContent: FlowingTextContent, data: Record<string, unknown>): void {
    const embeddedObjects = flowingContent.getEmbeddedObjects();

    for (const [, obj] of embeddedObjects.entries()) {
      if (obj instanceof TableObject) {
        this.expandTableRowLoopsInTable(obj, data);
      }
    }
  }

  /**
   * Expand row loops in a single table.
   * Processes loops from end to start to preserve row indices.
   */
  private expandTableRowLoopsInTable(table: TableObject, data: Record<string, unknown>): void {
    const loops = table.getAllRowLoops();
    if (loops.length === 0) return;

    // Sort loops by startRowIndex descending (process end-to-start)
    const sortedLoops = [...loops].sort((a, b) => b.startRowIndex - a.startRowIndex);

    for (const loop of sortedLoops) {
      // Resolve the array from fieldPath
      const arrayValue = this.getValueAtPath(data, loop.fieldPath);

      // If not an array or empty, just remove the loop (template rows stay once)
      if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
        table.removeRowLoop(loop.id);
        continue;
      }

      const arrayLength = arrayValue.length;

      // Get the template rows
      const templateRows = table.getRowsInRange(loop.startRowIndex, loop.endRowIndex);

      // Remove the original template rows
      table.removeRowsInRange(loop.startRowIndex, loop.endRowIndex);

      // Insert duplicated rows for each array item
      // Process in reverse order to maintain correct indices
      for (let i = arrayLength - 1; i >= 0; i--) {
        // Clone the template rows
        const clonedRows = templateRows.map(row => row.clone());

        // Rewrite field names in each cloned row's cells
        for (const row of clonedRows) {
          for (const cell of row.cells) {
            this.rewriteFieldsInContent(cell.flowingContent, loop.fieldPath, i);
          }
        }

        // Insert the cloned rows at the original start position
        table.insertRowsAt(loop.startRowIndex, clonedRows);
      }

      // Remove the loop definition since it's now expanded
      table.removeRowLoop(loop.id);
    }

    // Update table layout
    table.markLayoutDirty();
  }

  /**
   * Rewrite field names in a FlowingTextContent to include array index.
   * Fields that start with fieldPath will have the index inserted.
   * E.g., "items.name" with fieldPath "items" and index 1 -> "items[1].name"
   */
  private rewriteFieldsInContent(flowingContent: FlowingTextContent, fieldPath: string, index: number): void {
    const fieldManager = flowingContent.getSubstitutionFieldManager();
    const fields = fieldManager.getFieldsArray();

    for (const field of fields) {
      // Check if this field's name starts with the loop's fieldPath
      if (field.fieldName.startsWith(fieldPath + '.') || field.fieldName === fieldPath) {
        // Rewrite the field name to include the array index
        const newFieldName = this.rewriteFieldNameWithIndex(field.fieldName, fieldPath, index);

        // Update the field's name directly
        // Since SubstitutionField objects are stored by reference, we can modify them
        (field as { fieldName: string }).fieldName = newFieldName;
      }
    }
  }

  /**
   * Expand repeating sections by duplicating content for each array element.
   * Processes sections from end to start to preserve text indices.
   */
  private expandRepeatingSections(
    flowingContent: FlowingTextContent,
    data: Record<string, unknown>
  ): void {
    const sectionManager = flowingContent.getRepeatingSectionManager();
    const fieldManager = flowingContent.getSubstitutionFieldManager();

    // Get sections in descending order (process end-to-start)
    const sections = sectionManager.getSectionsDescending();

    for (const section of sections) {
      // Resolve the array from fieldPath
      const arrayValue = this.getValueAtPath(data, section.fieldPath);

      // If not an array or empty, just remove the section (content stays once)
      if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
        sectionManager.remove(section.id);
        continue;
      }

      const arrayLength = arrayValue.length;

      // Get the content within the section
      const text = flowingContent.getText();
      const sectionContent = text.substring(section.startIndex, section.endIndex);
      const sectionLength = section.endIndex - section.startIndex;

      // Get fields within this section
      const fieldsInSection = fieldManager.getFieldsArray().filter(
        (f: SubstitutionField) => f.textIndex >= section.startIndex && f.textIndex < section.endIndex
      );

      // For each additional iteration (beyond the first), duplicate the content
      // We already have 1 copy, so we need (arrayLength - 1) more copies
      if (arrayLength > 1) {
        // Insert duplicates starting from the end of the section
        const insertPosition = section.endIndex;

        for (let i = 1; i < arrayLength; i++) {
          // Insert the section content
          flowingContent.setCursorPosition(insertPosition + (i - 1) * sectionLength);
          flowingContent.insertText(sectionContent);

          // Copy fields for this iteration
          for (const originalField of fieldsInSection) {
            const relativePos = originalField.textIndex - section.startIndex;
            const newTextIndex = insertPosition + (i - 1) * sectionLength + relativePos;

            // Create new field with modified name to include array index
            const newFieldName = this.rewriteFieldNameWithIndex(
              originalField.fieldName,
              section.fieldPath,
              i
            );

            // Insert a new field at the duplicated position
            // First, we need to account for the text we just inserted
            fieldManager.insert(newFieldName, newTextIndex, {
              displayFormat: originalField.displayFormat,
              defaultValue: originalField.defaultValue
            });

            // Copy formatting if present
            if (originalField.formatting) {
              fieldManager.setFieldFormatting(newTextIndex, originalField.formatting);
            }
          }
        }
      }

      // Rewrite field names in the original (first) iteration to use index 0
      for (const field of fieldsInSection) {
        const newFieldName = this.rewriteFieldNameWithIndex(
          field.fieldName,
          section.fieldPath,
          0
        );
        fieldManager.updateFieldConfig(field.textIndex, { fieldName: newFieldName });
      }

      // Remove the section after expansion
      sectionManager.remove(section.id);
    }
  }

  /**
   * Get a value at a path without array defaulting.
   * Used to get the array itself rather than its first element.
   */
  private getValueAtPath(data: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Rewrite a field name to use an explicit array index.
   * E.g., if fieldPath is "items" and the field name is "items.name",
   * this returns "items[index].name".
   */
  private rewriteFieldNameWithIndex(
    fieldName: string,
    loopFieldPath: string,
    index: number
  ): string {
    // If field name starts with the loop field path, insert the index
    if (fieldName.startsWith(loopFieldPath + '.')) {
      const remainder = fieldName.substring(loopFieldPath.length);
      return `${loopFieldPath}[${index}]${remainder}`;
    }

    // If field name equals the loop field path (the array itself)
    if (fieldName === loopFieldPath) {
      return `${loopFieldPath}[${index}]`;
    }

    // Field doesn't match loop path, return unchanged
    return fieldName;
  }

  /**
   * Resolve a dot-notation field path to a value in the data object.
   * Supports nested objects, arrays (default to 0th element), and explicit indices.
   * @param path Dot-notation path (e.g., "contact.address.street", "items.item", or "items[0].item")
   * @param data The data object to resolve against
   * @returns The resolved value or undefined if not found
   */
  private resolveFieldPath(path: string, data: Record<string, unknown>): unknown {
    // Parse path into segments, handling both dot notation and array indices
    // E.g., "items[0].name" -> ["items", "[0]", "name"]
    const segments = this.parseFieldPath(path);
    let current: unknown = data;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Check if this segment is an array index (e.g., "[0]")
      const indexMatch = segment.match(/^\[(\d+)\]$/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1], 10);
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
        continue;
      }

      // If current is an array without explicit index, default to 0th element
      if (Array.isArray(current)) {
        current = current[0];
        if (current === null || current === undefined) {
          return undefined;
        }
      }

      // Now access the property
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    // Final check: if result is an array without explicit index, return 0th element
    if (Array.isArray(current)) {
      return current[0];
    }

    return current;
  }

  /**
   * Parse a field path into segments, separating dot notation and array indices.
   * E.g., "items[0].name" -> ["items", "[0]", "name"]
   * E.g., "items.name" -> ["items", "name"]
   */
  private parseFieldPath(path: string): string[] {
    const segments: string[] = [];
    let current = '';

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === '.') {
        if (current) {
          segments.push(current);
          current = '';
        }
      } else if (char === '[') {
        if (current) {
          segments.push(current);
          current = '';
        }
        // Find the closing bracket
        const closeIndex = path.indexOf(']', i);
        if (closeIndex !== -1) {
          segments.push(path.substring(i, closeIndex + 1));
          i = closeIndex;
        }
      } else {
        current += char;
      }
    }

    if (current) {
      segments.push(current);
    }

    return segments;
  }
  
  applyTextFormatting(start: number, end: number, formatting: any): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const flowingContent = this.getActiveFlowingContent();
    if (flowingContent) {
      flowingContent.applyFormatting(start, end, formatting);
    }
  }

  /**
   * Get the text formatting at a specific position in the active section.
   * @param position The text index to get formatting at
   * @returns The formatting style at that position
   */
  getFormattingAt(position: number): TextFormattingStyle | null {
    if (!this._isReady) {
      return null;
    }

    const flowingContent = this.getActiveFlowingContent();
    if (flowingContent) {
      return flowingContent.getFormattingAt(position);
    }
    return null;
  }

  /**
   * Get the text formatting for the current selection or cursor position.
   * Returns the formatting at the start of the selection or at the cursor position.
   * @returns The formatting style, or null if no text selection/cursor
   */
  getSelectionFormatting(): TextFormattingStyle | null {
    if (!this._isReady) {
      return null;
    }

    const selection = this.currentSelection;
    let position: number;

    if (selection.type === 'text') {
      position = selection.start;
    } else if (selection.type === 'cursor') {
      position = selection.position;
    } else {
      return null;
    }

    const flowingContent = this.getActiveFlowingContent();
    if (flowingContent) {
      return flowingContent.getFormattingAt(position);
    }
    return null;
  }

  // ============================================
  // Paragraph Alignment API
  // ============================================

  /**
   * Set the alignment for the paragraph at the current cursor position.
   * @param alignment The alignment to apply ('left', 'center', 'right', or 'justify')
   */
  setAlignment(alignment: TextAlignment): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const flowingContent = this.getActiveFlowingContent();
    if (flowingContent) {
      flowingContent.setAlignment(alignment);
      this.canvasManager.render();
      this.emit('alignment-changed', { alignment, section: this._activeEditingSection });
    }
  }

  /**
   * Set the alignment for all paragraphs within the current text selection.
   * If there's no selection, applies to the paragraph at cursor.
   * @param alignment The alignment to apply ('left', 'center', 'right', or 'justify')
   */
  setAlignmentForSelection(alignment: TextAlignment): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const selection = this.currentSelection;
    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return;

    if (selection.type === 'text') {
      flowingContent.setAlignmentForRange(selection.start, selection.end, alignment);
    } else {
      flowingContent.setAlignment(alignment);
    }

    this.canvasManager.render();
    this.emit('alignment-changed', { alignment, section: this._activeEditingSection });
  }

  /**
   * Get the alignment at the current cursor position.
   * @returns The alignment at cursor, or 'left' as default
   */
  getAlignmentAtCursor(): TextAlignment {
    if (!this._isReady) {
      return 'left';
    }

    const selection = this.currentSelection;
    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return 'left';

    let position: number;
    if (selection.type === 'text') {
      position = selection.start;
    } else if (selection.type === 'cursor') {
      position = selection.position;
    } else {
      position = flowingContent.getCursorPosition();
    }

    return flowingContent.getAlignmentAt(position);
  }

  // ============================================
  // List Operations
  // ============================================

  /**
   * Toggle bullet list for the current paragraph.
   */
  toggleBulletList(): void {
    if (!this._isReady) return;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return;

    flowingContent.toggleBulletList();
    this.canvasManager.render();
    this.emit('list-changed', { type: 'bullet', section: this._activeEditingSection });
  }

  /**
   * Toggle numbered list for the current paragraph.
   */
  toggleNumberedList(): void {
    if (!this._isReady) return;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return;

    flowingContent.toggleNumberedList();
    this.canvasManager.render();
    this.emit('list-changed', { type: 'number', section: this._activeEditingSection });
  }

  /**
   * Indent the current paragraph (increase list nesting level).
   */
  indentParagraph(): void {
    if (!this._isReady) return;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return;

    flowingContent.indentParagraph();
    this.canvasManager.render();
    this.emit('indent-changed', { section: this._activeEditingSection });
  }

  /**
   * Outdent the current paragraph (decrease list nesting level).
   */
  outdentParagraph(): void {
    if (!this._isReady) return;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return;

    flowingContent.outdentParagraph();
    this.canvasManager.render();
    this.emit('indent-changed', { section: this._activeEditingSection });
  }

  /**
   * Get list formatting for the current paragraph.
   */
  getListFormatting(): import('../text').ListFormatting | undefined {
    if (!this._isReady) return undefined;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return undefined;

    return flowingContent.getListFormatting();
  }

  // ============================================
  // Hyperlink API
  // ============================================

  /**
   * Insert a hyperlink for the current selection.
   * @returns The created hyperlink, or null if no selection
   */
  insertHyperlink(url: string, options?: import('../text').HyperlinkOptions): import('../text').Hyperlink | null {
    if (!this._isReady) return null;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return null;

    const hyperlink = flowingContent.insertHyperlink(url, options);
    if (hyperlink) {
      this.canvasManager.render();
      this.emit('hyperlink-inserted', { hyperlink });
    }
    return hyperlink;
  }

  /**
   * Insert a hyperlink at a specific range.
   */
  insertHyperlinkAt(
    url: string,
    startIndex: number,
    endIndex: number,
    options?: import('../text').HyperlinkOptions
  ): import('../text').Hyperlink | null {
    if (!this._isReady) return null;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return null;

    const hyperlink = flowingContent.insertHyperlinkAt(url, startIndex, endIndex, options);
    this.canvasManager.render();
    this.emit('hyperlink-inserted', { hyperlink });
    return hyperlink;
  }

  /**
   * Remove a hyperlink by ID.
   */
  removeHyperlink(id: string): void {
    if (!this._isReady) return;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return;

    flowingContent.removeHyperlink(id);
    this.canvasManager.render();
    this.emit('hyperlink-removed', { id });
  }

  /**
   * Update a hyperlink's properties.
   */
  updateHyperlink(id: string, updates: import('../text').HyperlinkUpdate): void {
    if (!this._isReady) return;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return;

    flowingContent.updateHyperlink(id, updates);
    this.canvasManager.render();
    this.emit('hyperlink-updated', { id, updates });
  }

  /**
   * Get the hyperlink at a specific text index.
   */
  getHyperlinkAt(textIndex: number): import('../text').Hyperlink | undefined {
    if (!this._isReady) return undefined;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return undefined;

    return flowingContent.getHyperlinkAt(textIndex);
  }

  /**
   * Get a hyperlink by ID.
   */
  getHyperlinkById(id: string): import('../text').Hyperlink | undefined {
    if (!this._isReady) return undefined;

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return undefined;

    return flowingContent.getHyperlinkById(id);
  }

  /**
   * Get all hyperlinks overlapping a range.
   */
  getHyperlinksInRange(startIndex: number, endIndex: number): import('../text').Hyperlink[] {
    if (!this._isReady) return [];

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return [];

    return flowingContent.getHyperlinksInRange(startIndex, endIndex);
  }

  /**
   * Get all hyperlinks.
   */
  getAllHyperlinks(): import('../text').Hyperlink[] {
    if (!this._isReady) return [];

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) return [];

    return flowingContent.getAllHyperlinks();
  }

  updateDocumentSettings(settings: Partial<any>): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    
    this.document.updateSettings(settings);
    this.emit('document-settings-changed', { settings });
  }

  getDocumentSettings(): any {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    return this.document.settings;
  }

  /**
   * Set whether control characters (spaces, tabs, newlines) are shown.
   * @param show true to show control characters, false to hide
   */
  setShowControlCharacters(show: boolean): void {
    this.options.showControlCharacters = show;
    if (this.canvasManager) {
      this.canvasManager.setShowControlCharacters(show);
    }
    this.emit('control-characters-changed', { show });
  }

  /**
   * Get whether control characters are currently shown.
   */
  getShowControlCharacters(): boolean {
    return this.options.showControlCharacters;
  }

  /**
   * Set whether the grid is shown.
   * @param show true to show the grid, false to hide
   */
  setShowGrid(show: boolean): void {
    this.options.showGrid = show;
    if (this.canvasManager) {
      this.canvasManager.setShowGrid(show);
    }
    this.emit('grid-changed', { show });
  }

  /**
   * Get whether the grid is currently shown.
   */
  getShowGrid(): boolean {
    return this.options.showGrid;
  }

  /**
   * Set whether margin lines are shown.
   * @param show true to show margin lines, false to hide
   */
  setShowMarginLines(show: boolean): void {
    if (this.canvasManager) {
      this.canvasManager.setShowMarginLines(show);
    }
    this.emit('margin-lines-changed', { show });
  }

  /**
   * Get whether margin lines are currently shown.
   */
  getShowMarginLines(): boolean {
    if (this.canvasManager) {
      return this.canvasManager.getShowMarginLines();
    }
    return true; // Default
  }

  // ============================================
  // Repeating Section API
  // ============================================

  /**
   * Get all paragraph boundaries in the body content.
   * Returns indices that are valid start/end points for repeating sections.
   * Note: Repeating sections are only supported in the body, not in header/footer.
   */
  getParagraphBoundaries(): number[] {
    if (!this._isReady) {
      return [];
    }

    // Repeating sections only work in body (document-level)
    return this.document.bodyFlowingContent.getParagraphBoundaries();
  }

  /**
   * Create a repeating section in the body content.
   * Note: Repeating sections are only supported in the body, not in header/footer.
   * @param startIndex Text index at paragraph start (must be at a paragraph boundary)
   * @param endIndex Text index at closing paragraph start (must be at a paragraph boundary)
   * @param fieldPath The field path to the array to loop over (e.g., "items")
   * @returns The created section, or null if boundaries are invalid
   */
  createRepeatingSection(
    startIndex: number,
    endIndex: number,
    fieldPath: string
  ): RepeatingSection | null {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Repeating sections only work in body (document-level)
    const section = this.document.bodyFlowingContent.createRepeatingSection(startIndex, endIndex, fieldPath);

    if (section) {
      this.canvasManager.render();
      this.emit('repeating-section-added', { section });
    }

    return section;
  }

  /**
   * Get a repeating section by ID.
   */
  getRepeatingSection(id: string): RepeatingSection | null {
    if (!this._isReady) {
      return null;
    }

    return this.document.bodyFlowingContent.getRepeatingSection(id) || null;
  }

  /**
   * Get all repeating sections.
   */
  getRepeatingSections(): RepeatingSection[] {
    if (!this._isReady) {
      return [];
    }

    return this.document.bodyFlowingContent.getRepeatingSections();
  }

  /**
   * Update a repeating section's field path.
   */
  updateRepeatingSectionFieldPath(id: string, fieldPath: string): boolean {
    if (!this._isReady) {
      return false;
    }

    const success = this.document.bodyFlowingContent.updateRepeatingSectionFieldPath(id, fieldPath);

    if (success) {
      this.canvasManager.render();
      this.emit('repeating-section-updated', { id, fieldPath });
    }

    return success;
  }

  /**
   * Remove a repeating section by ID.
   */
  removeRepeatingSection(id: string): boolean {
    if (!this._isReady) {
      return false;
    }

    const success = this.document.bodyFlowingContent.removeRepeatingSection(id);

    if (success) {
      this.canvasManager.render();
      this.emit('repeating-section-removed', { id });
    }

    return success;
  }

  /**
   * Find a repeating section that has a boundary at the given text index.
   */
  getRepeatingSectionAtBoundary(textIndex: number): RepeatingSection | null {
    if (!this._isReady) {
      return null;
    }

    return this.document.bodyFlowingContent.getRepeatingSectionAtBoundary(textIndex) || null;
  }

  // ============================================
  // Header/Footer API
  // ============================================

  /**
   * Get the header text content.
   */
  getHeaderText(): string {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    return this.document.headerFlowingContent.getText();
  }

  /**
   * Set the header text content.
   */
  setHeaderText(text: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    this.document.headerFlowingContent.setText(text);
  }

  /**
   * Get the footer text content.
   */
  getFooterText(): string {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    return this.document.footerFlowingContent.getText();
  }

  /**
   * Set the footer text content.
   */
  setFooterText(text: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    this.document.footerFlowingContent.setText(text);
  }

  /**
   * Insert a substitution field in the header at the current cursor position.
   * Temporarily switches to header section, inserts, then restores previous section.
   */
  insertHeaderSubstitutionField(fieldName: string, config?: SubstitutionFieldConfig): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Clear any existing selection before inserting
    this.canvasManager.clearSelection();

    const field = this.document.headerFlowingContent.insertSubstitutionField(fieldName, config);
    this.canvasManager.render();
    this.emit('substitution-field-added', { field, section: 'header' });
  }

  /**
   * Insert a substitution field in the footer at the current cursor position.
   * Temporarily switches to footer section, inserts, then restores previous section.
   */
  insertFooterSubstitutionField(fieldName: string, config?: SubstitutionFieldConfig): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Clear any existing selection before inserting
    this.canvasManager.clearSelection();

    const field = this.document.footerFlowingContent.insertSubstitutionField(fieldName, config);
    this.canvasManager.render();
    this.emit('substitution-field-added', { field, section: 'footer' });
  }

  /**
   * Insert an embedded object in the header.
   */
  insertHeaderEmbeddedObject(object: BaseEmbeddedObject, position: ObjectPosition = 'inline'): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Clear any existing selection before inserting
    this.canvasManager.clearSelection();

    this.document.headerFlowingContent.insertEmbeddedObject(object, position);

    // Observe the new object for undo/redo tracking
    this.observeEmbeddedObject(object);

    this.canvasManager.render();
    this.emit('embedded-object-added', { object, position, section: 'header' });
  }

  /**
   * Insert an embedded object in the footer.
   */
  insertFooterEmbeddedObject(object: BaseEmbeddedObject, position: ObjectPosition = 'inline'): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Clear any existing selection before inserting
    this.canvasManager.clearSelection();

    this.document.footerFlowingContent.insertEmbeddedObject(object, position);

    // Observe the new object for undo/redo tracking
    this.observeEmbeddedObject(object);

    this.canvasManager.render();
    this.emit('embedded-object-added', { object, position, section: 'footer' });
  }

  // ============================================
  // Clipboard Operations
  // ============================================

  /**
   * Copy the current selection to the clipboard.
   * Returns true if content was copied.
   */
  async copy(): Promise<boolean> {
    const flowingContent = this.getEditingFlowingContent() || this.getActiveFlowingContent();
    if (!flowingContent) {
      return false;
    }

    const success = await this.clipboardManager.copy(flowingContent);
    if (success) {
      this.emit('copy', { success: true });
    }
    return success;
  }

  /**
   * Cut the current selection to the clipboard (copy + delete).
   * Returns true if content was cut.
   */
  async cut(): Promise<boolean> {
    const flowingContent = this.getEditingFlowingContent() || this.getActiveFlowingContent();
    if (!flowingContent) {
      return false;
    }

    const selection = flowingContent.getSelection();
    if (!selection || selection.start === selection.end) {
      return false;
    }

    // Copy first
    const copySuccess = await this.clipboardManager.copy(flowingContent);
    if (!copySuccess) {
      return false;
    }

    // Then delete selection (wrapped in transaction)
    this.transactionManager.beginCompoundOperation('Cut');
    try {
      flowingContent.deleteSelection();
      this.transactionManager.endCompoundOperation();
      this.canvasManager.render();
      this.emit('cut', { success: true });
      return true;
    } catch (error) {
      // Undo any partial changes by ending the compound operation
      // The transaction will be empty if nothing was recorded
      this.transactionManager.endCompoundOperation();
      console.error('Cut failed:', error);
      return false;
    }
  }

  /**
   * Paste content from the clipboard at the current cursor position.
   * Returns true if content was pasted.
   */
  async paste(): Promise<boolean> {
    const flowingContent = this.getEditingFlowingContent() || this.getActiveFlowingContent();
    if (!flowingContent) {
      return false;
    }

    const result = await this.clipboardManager.read();

    if (result.type === 'empty' || result.data === null) {
      return false;
    }

    this.transactionManager.beginCompoundOperation('Paste');
    try {
      // Delete any current selection first
      if (flowingContent.hasSelection()) {
        flowingContent.deleteSelection();
      }

      let pasted = false;

      if (result.type === 'pceditor') {
        // Paste proprietary format with full fidelity
        pasted = await this.pasteProprietaryContent(flowingContent, result.data as PCEditorClipboardData);
      } else if (result.type === 'html') {
        // Parse HTML and paste
        const content = this.clipboardManager.parseHtml(result.data as string);
        pasted = this.pasteClipboardContent(flowingContent, content);
      } else if (result.type === 'text') {
        // Paste plain text
        const text = result.data as string;
        flowingContent.insertText(text);
        pasted = true;
      } else if (result.type === 'image') {
        // Create and insert image object
        pasted = await this.pasteImage(flowingContent, result.data as Blob);
      }

      this.transactionManager.endCompoundOperation();
      if (pasted) {
        this.canvasManager.render();
        this.emit('paste', { success: true, type: result.type });
        return true;
      } else {
        return false;
      }
    } catch (error) {
      this.transactionManager.endCompoundOperation();
      console.error('Paste failed:', error);
      return false;
    }
  }

  /**
   * Paste proprietary clipboard content.
   */
  private async pasteProprietaryContent(
    flowingContent: FlowingTextContent,
    data: PCEditorClipboardData
  ): Promise<boolean> {
    // Generate new IDs for all items to avoid conflicts
    const content = this.clipboardManager.generateNewIds(data.content);
    return this.pasteClipboardContent(flowingContent, content);
  }

  /**
   * Paste clipboard content into FlowingTextContent.
   */
  private pasteClipboardContent(
    flowingContent: FlowingTextContent,
    content: ClipboardContent
  ): boolean {
    const insertPosition = flowingContent.getCursorPosition();
    const { text, formattingRuns, substitutionFields, embeddedObjects, hyperlinks } = content;

    // Insert the text
    flowingContent.insertText(text);

    // Apply formatting runs
    if (formattingRuns && formattingRuns.length > 0) {
      const formattingManager = flowingContent.getFormattingManager();
      for (let i = 0; i < formattingRuns.length; i++) {
        const run = formattingRuns[i];
        const nextRun = formattingRuns[i + 1];
        const startIndex = insertPosition + run.index;
        const endIndex = nextRun
          ? insertPosition + nextRun.index
          : insertPosition + text.length;

        formattingManager.applyFormatting(startIndex, endIndex, {
          fontFamily: run.formatting.fontFamily,
          fontSize: run.formatting.fontSize,
          fontWeight: run.formatting.fontWeight,
          fontStyle: run.formatting.fontStyle,
          color: run.formatting.color,
          backgroundColor: run.formatting.backgroundColor
        });
      }
    }

    // Insert substitution fields (they're already positioned in text as U+FFFC)
    if (substitutionFields && substitutionFields.length > 0) {
      for (const field of substitutionFields) {
        const fieldPosition = insertPosition + field.textIndex;
        flowingContent.insertSubstitutionFieldAt(field.fieldName, fieldPosition, {
          fieldType: field.fieldType,
          displayFormat: field.displayFormat,
          defaultValue: field.defaultValue,
          formatting: field.formatting
        });
      }
    }

    // Insert embedded objects (they're already positioned in text as U+FFFC)
    if (embeddedObjects && embeddedObjects.length > 0) {
      for (const ref of embeddedObjects) {
        const objPosition = insertPosition + ref.textIndex;
        const object = this.createEmbeddedObjectFromData(ref.object);
        if (object) {
          flowingContent.insertEmbeddedObjectAt(object, objPosition, object.position);
          this.observeEmbeddedObject(object);
        }
      }
    }

    // Insert hyperlinks
    if (hyperlinks && hyperlinks.length > 0) {
      for (const link of hyperlinks) {
        const startIndex = insertPosition + link.startIndex;
        const endIndex = insertPosition + link.endIndex;
        flowingContent.insertHyperlinkAt(link.url, startIndex, endIndex, {
          title: link.title,
          formatting: link.formatting
        });
      }
    }

    return true;
  }

  /**
   * Create an embedded object from serialized data.
   */
  private createEmbeddedObjectFromData(data: EmbeddedObjectData): BaseEmbeddedObject | null {
    const object = EmbeddedObjectFactory.tryCreate(data);
    if (!object) {
      console.warn('Unknown object type:', data.objectType);
    }
    return object;
  }

  /**
   * Paste an image blob as an embedded ImageObject.
   */
  private async pasteImage(flowingContent: FlowingTextContent, blob: Blob): Promise<boolean> {
    try {
      const { dataUrl, width, height } = await this.clipboardManager.createImageFromBlob(blob);

      // Create image object with reasonable default size
      const maxWidth = 400;
      const scale = width > maxWidth ? maxWidth / width : 1;
      const imageObject = new ImageObject({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        textIndex: flowingContent.getCursorPosition(),
        size: { width: width * scale, height: height * scale },
        src: dataUrl,
        alt: 'Pasted image'
      });

      flowingContent.insertEmbeddedObject(imageObject, 'inline');
      this.observeEmbeddedObject(imageObject);
      return true;
    } catch (error) {
      console.error('Failed to paste image:', error);
      return false;
    }
  }

  destroy(): void {
    this.disableTextInput();
    if (this.canvasManager) {
      this.canvasManager.destroy();
    }
    if (this.layoutEngine) {
      this.layoutEngine.destroy();
    }
    this.document.clear();
    this.removeAllListeners();
    this._isReady = false;
  }
}