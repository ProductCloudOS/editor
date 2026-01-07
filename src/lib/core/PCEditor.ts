import {
  EditorOptions,
  DocumentData,
  DataBindingContext,
  PDFExportOptions,
  ElementData,
  Point,
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
import { BaseEmbeddedObject, ObjectPosition, TextBoxObject } from '../objects';
import { SubstitutionFieldConfig, TextFormattingStyle, SubstitutionField, RepeatingSection, FlowingTextContent, TextAlignment, Focusable } from '../text';

export class PCEditor extends EventEmitter {
  private container: HTMLElement;
  private options: Required<Omit<EditorOptions, 'customPageSize'>> & { customPageSize?: PageDimensions };
  private document: Document;
  private canvasManager!: CanvasManager;
  private dataBinder: DataBinder;
  private pdfGenerator: PDFGenerator;
  private layoutEngine!: LayoutEngine;
  private _isReady: boolean = false;
  private keyboardListenerActive: boolean = false;
  private currentSelection: EditorSelection = { type: 'none' };
  private _activeEditingSection: EditingSection = 'body';

  constructor(container: HTMLElement, options?: EditorOptions) {
    super();

    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.options = this.mergeOptions(options);
    this.document = new Document();
    this.dataBinder = new DataBinder();
    this.pdfGenerator = new PDFGenerator();

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

    this.canvasManager.on('selection-change', (data: any) => {
      // Element selection changed
      const elementIds = data.selectedElements || [];
      if (elementIds.length > 0) {
        this.currentSelection = { type: 'elements', elementIds };
      } else if (this.currentSelection.type === 'elements') {
        // Only clear if we were in element selection mode
        this.currentSelection = { type: 'none' };
      }
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
      if (data.textIndex !== undefined) {
        this.currentSelection = {
          type: 'cursor',
          position: data.textIndex,
          section: this._activeEditingSection
        };
        this.emitSelectionChange();
      }
      this.emit('cursor-changed', data);
    });

    this.canvasManager.on('text-selection-changed', (data: any) => {
      // Text selection changed
      if (data.selection && data.selection.start !== data.selection.end) {
        this.currentSelection = {
          type: 'text',
          start: data.selection.start,
          end: data.selection.end,
          section: this._activeEditingSection
        };
        this.emitSelectionChange();
      }
      // Note: cursor-changed handles the case when selection is cleared
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
        return this.document.pages[0]?.flowingContent;
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

  loadDocument(documentData: DocumentData): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    this.document.clear();
    this.document = new Document(documentData);
    this.canvasManager.setDocument(this.document);
    
    // Update layout engine with new document
    this.layoutEngine.destroy();
    this.layoutEngine = new LayoutEngine(this.document, {
      autoFlow: true,
      snapToGrid: this.options.showGrid,
      gridSize: this.options.gridSize
    });
    
    this.setupEventListeners();
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

    try {
      const pdfBlob = await this.pdfGenerator.generate(this.document, options);
      this.emit('pdf-exported');
      return pdfBlob;
    } catch (error) {
      console.error('Failed to export PDF:', error);
      this.emit('error', { error, context: 'pdf-export' });
      throw error;
    }
  }

  addElement(elementData: ElementData, pageId?: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const targetPageId = pageId || this.document.pages[0]?.id;
    if (!targetPageId) {
      throw new Error('No page available');
    }

    this.canvasManager.addElement(elementData, targetPageId);
  }

  removeElement(elementId: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    this.canvasManager.removeElement(elementId);
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

  getElementAtPoint(point: Point, pageId: string): ElementData | null {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    return this.canvasManager.getElementAtPoint(point, pageId);
  }

  updateElement(elementId: string, updates: Partial<ElementData>): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    // Find the element in any page/section
    for (const page of this.document.pages) {
      for (const section of [page.header, page.content, page.footer]) {
        const element = section.getElement(elementId);
        if (element) {
          // Update element properties
          if (updates.position) {
            element.position = updates.position;
          }
          if (updates.size) {
            element.size = updates.size;
          }
          if (updates.rotation !== undefined) {
            element.rotation = updates.rotation;
          }
          if (updates.opacity !== undefined) {
            element.opacity = updates.opacity;
          }
          if (updates.locked !== undefined) {
            element.locked = updates.locked;
          }
          
          // Type-specific data updates
          if (updates.data) {
            const elementData = element.toData();
            if (elementData.type === 'text' && 'updateTextData' in element) {
              (element as any).updateTextData(updates.data);
            } else if (elementData.type === 'image' && 'updateImageData' in element) {
              (element as any).updateImageData(updates.data);
            } else if (elementData.type === 'placeholder' && 'updatePlaceholderData' in element) {
              (element as any).updatePlaceholderData(updates.data);
            }
          }
          
          this.canvasManager.render();
          this.emit('element-updated', { elementId, updates });
          return;
        }
      }
    }
  }

  undo(): void {
    this.emit('undo');
  }

  redo(): void {
    this.emit('redo');
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

  insertPageBreak(elementId: string): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }
    this.layoutEngine.insertPageBreak(elementId);
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
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      header: { height: 0, elements: [] },
      content: { elements: [] },
      footer: { height: 0, elements: [] }
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
  }
  
  private handleKeyDown(e: KeyboardEvent): void {
    // Use the unified focus system to get the currently focused control
    const focusedControl = this.canvasManager.getFocusedControl();
    if (!focusedControl) return;

    // Vertical navigation needs layout context - handle specially
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.handleVerticalNavigation(e, focusedControl);
      return;
    }

    // Delegate to the focused control's handleKeyDown
    const handled = focusedControl.handleKeyDown(e);

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
    }
  }

  /**
   * Handle vertical navigation for the focused control.
   * This needs special handling because it requires layout context.
   */
  private handleVerticalNavigation(e: KeyboardEvent, _focusedControl: Focusable): void {
    const direction = e.key === 'ArrowUp' ? -1 : 1;
    const editingTextBox = this.canvasManager.getEditingTextBox();

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
    // Only show the main cursor if NOT editing a text box
    // When editing a text box, the text box manages its own cursor
    if (this.canvasManager.isEditingTextBox()) {
      // When editing a text box, we only need keyboard input active
      // Don't show main cursor or refocus (we're already focused)
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
   * Insert an embedded object at the current cursor position in the active section.
   */
  insertEmbeddedObject(object: BaseEmbeddedObject, position: ObjectPosition = 'inline'): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) {
      throw new Error('No active section available');
    }

    // Insert the embedded object at the current cursor position
    flowingContent.insertEmbeddedObject(object, position);

    this.canvasManager.render();
    this.emit('embedded-object-added', { object, position, section: this._activeEditingSection });
  }

  /**
   * Insert a substitution field at the current cursor position in the active section.
   */
  insertSubstitutionField(fieldName: string, config?: SubstitutionFieldConfig): void {
    if (!this._isReady) {
      throw new Error('Editor is not ready');
    }

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) {
      throw new Error('No active section available');
    }

    const field = flowingContent.insertSubstitutionField(fieldName, config);

    this.canvasManager.render();
    this.emit('substitution-field-added', { field, section: this._activeEditingSection });
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
    return fieldManager.getFieldAt(position) || null;
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
    const selection = this.currentSelection;

    if (selection.type === 'elements' && selection.elementIds.length > 0) {
      // Check if any selected element is a text box
      const flowingContent = this.getActiveFlowingContent();
      if (flowingContent) {
        const embeddedObjects = flowingContent.getEmbeddedObjects();
        for (const elementId of selection.elementIds) {
          for (const [, obj] of embeddedObjects.entries()) {
            if (obj.id === elementId && obj instanceof TextBoxObject) {
              return obj;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Update a substitution field's properties in the active section.
   * @param textIndex The text index of the field to update
   * @param updates The properties to update
   * @returns true if the field was updated, false if not found
   */
  updateField(textIndex: number, updates: { fieldName?: string; defaultValue?: string }): boolean {
    if (!this._isReady) {
      return false;
    }

    const flowingContent = this.getActiveFlowingContent();
    if (!flowingContent) {
      return false;
    }

    const fieldManager = flowingContent.getSubstitutionFieldManager();
    const success = fieldManager.updateFieldConfig(textIndex, updates);

    if (success) {
      this.canvasManager.render();
      this.emit('substitution-field-updated', { textIndex, updates, section: this._activeEditingSection });
    }

    return success;
  }

  /**
   * @deprecated Use insertEmbeddedObject instead
   */
  insertInlineElement(_elementData: ElementData, _position: ObjectPosition = 'inline'): void {
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

    const currentPage = this.document.pages[0];
    if (!currentPage) {
      throw new Error('No page available');
    }

    const bodyContent = currentPage.flowingContent;
    let totalFieldCount = 0;

    // Step 1: Expand repeating sections in body (header/footer don't support them)
    this.expandRepeatingSections(bodyContent, data);

    // Step 2: Substitute all fields in body
    totalFieldCount += this.substituteFieldsInContent(bodyContent, data);

    // Step 3: Substitute all fields in header
    totalFieldCount += this.substituteFieldsInContent(this.document.headerFlowingContent, data);

    // Step 4: Substitute all fields in footer
    totalFieldCount += this.substituteFieldsInContent(this.document.footerFlowingContent, data);

    this.canvasManager.render();
    this.emit('merge-data-applied', { data, fieldCount: totalFieldCount });
  }

  /**
   * Substitute all fields in a FlowingTextContent with values from data.
   * @returns The number of fields substituted
   */
  private substituteFieldsInContent(flowingContent: FlowingTextContent, data: Record<string, unknown>): number {
    const fieldManager = flowingContent.getSubstitutionFieldManager();

    // Get all fields sorted by text index (descending so we process from end to start)
    const fields = fieldManager.getFieldsArray().sort((a, b) => b.textIndex - a.textIndex);

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
   * Expand repeating sections by duplicating content for each array element.
   * Processes sections from end to start to preserve text indices.
   */
  private expandRepeatingSections(
    flowingContent: typeof this.document.pages[0]['flowingContent'],
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
        f => f.textIndex >= section.startIndex && f.textIndex < section.endIndex
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

    // Repeating sections only work in body
    const currentPage = this.document.pages[0];
    if (!currentPage) {
      return [];
    }

    return currentPage.flowingContent.getParagraphBoundaries();
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

    // Repeating sections only work in body
    const currentPage = this.document.pages[0];
    if (!currentPage) {
      throw new Error('No page available');
    }

    const section = currentPage.flowingContent.createRepeatingSection(startIndex, endIndex, fieldPath);

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

    const currentPage = this.document.pages[0];
    if (!currentPage) {
      return null;
    }

    return currentPage.flowingContent.getRepeatingSection(id) || null;
  }

  /**
   * Get all repeating sections.
   */
  getRepeatingSections(): RepeatingSection[] {
    if (!this._isReady) {
      return [];
    }

    const currentPage = this.document.pages[0];
    if (!currentPage) {
      return [];
    }

    return currentPage.flowingContent.getRepeatingSections();
  }

  /**
   * Update a repeating section's field path.
   */
  updateRepeatingSectionFieldPath(id: string, fieldPath: string): boolean {
    if (!this._isReady) {
      return false;
    }

    const currentPage = this.document.pages[0];
    if (!currentPage) {
      return false;
    }

    const success = currentPage.flowingContent.updateRepeatingSectionFieldPath(id, fieldPath);

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

    const currentPage = this.document.pages[0];
    if (!currentPage) {
      return false;
    }

    const success = currentPage.flowingContent.removeRepeatingSection(id);

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

    const currentPage = this.document.pages[0];
    if (!currentPage) {
      return null;
    }

    return currentPage.flowingContent.getRepeatingSectionAtBoundary(textIndex) || null;
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

    this.document.headerFlowingContent.insertEmbeddedObject(object, position);
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

    this.document.footerFlowingContent.insertEmbeddedObject(object, position);
    this.canvasManager.render();
    this.emit('embedded-object-added', { object, position, section: 'footer' });
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