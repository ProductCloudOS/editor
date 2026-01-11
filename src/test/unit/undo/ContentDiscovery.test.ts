/**
 * Unit tests for ContentDiscovery
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentDiscovery, DocumentProvider, FocusEventSource } from '../../../lib/undo/transaction/ContentDiscovery';
import { TextMutationObserver } from '../../../lib/undo/transaction/TextMutationObserver';
import { TransactionManager } from '../../../lib/undo/transaction/TransactionManager';
import { FocusTracker } from '../../../lib/undo/transaction/FocusTracker';
import { FlowingTextContent } from '../../../lib/text/FlowingTextContent';
import { TextBoxObject } from '../../../lib/objects/TextBoxObject';
import { TableObject } from '../../../lib/objects/table';
import { EventEmitter } from '../../../lib/events/EventEmitter';

describe('ContentDiscovery', () => {
  let discovery: ContentDiscovery;
  let mutationObserver: TextMutationObserver;
  let manager: TransactionManager;
  let focusTracker: FocusTracker;
  let documentProvider: DocumentProvider;
  let focusEventSource: FocusEventSource;
  let bodyContent: FlowingTextContent;
  let headerContent: FlowingTextContent;
  let footerContent: FlowingTextContent;

  beforeEach(() => {
    // Create FocusTracker
    focusTracker = new FocusTracker(
      () => ({
        content: null,
        section: 'body' as const,
        focusedObjectId: null,
        tableCellAddress: null
      }),
      () => {}
    );

    // Create TransactionManager
    manager = new TransactionManager(
      focusTracker,
      () => null,
      () => null
    );

    // Create TextMutationObserver
    mutationObserver = new TextMutationObserver(manager);

    // Create FlowingTextContent instances
    bodyContent = new FlowingTextContent('Body content');
    headerContent = new FlowingTextContent('Header content');
    footerContent = new FlowingTextContent('Footer content');

    // Create DocumentProvider
    documentProvider = {
      bodyFlowingContent: bodyContent,
      headerFlowingContent: headerContent,
      footerFlowingContent: footerContent
    };

    // Create FocusEventSource
    focusEventSource = new EventEmitter() as FocusEventSource;

    // Create ContentDiscovery
    discovery = new ContentDiscovery(
      mutationObserver,
      documentProvider,
      focusEventSource
    );
  });

  describe('constructor', () => {
    it('should create a ContentDiscovery instance', () => {
      expect(discovery).toBeInstanceOf(ContentDiscovery);
    });

    it('should automatically register document content', () => {
      expect(mutationObserver.isObserving(bodyContent)).toBe(true);
      expect(mutationObserver.isObserving(headerContent)).toBe(true);
      expect(mutationObserver.isObserving(footerContent)).toBe(true);
    });
  });

  describe('getCurrentFocus()', () => {
    it('should return null when no focus set', () => {
      expect(discovery.getCurrentFocus()).toBeNull();
    });

    it('should return focus after section-focused event', () => {
      focusEventSource.emit('section-focused', { section: 'body' });

      const focus = discovery.getCurrentFocus();
      expect(focus).not.toBeNull();
      expect(focus?.content).toBe(bodyContent);
      expect(focus?.sourceId.type).toBe('body');
    });

    it('should return focus for header section', () => {
      focusEventSource.emit('section-focused', { section: 'header' });

      const focus = discovery.getCurrentFocus();
      expect(focus?.content).toBe(headerContent);
      expect(focus?.sourceId.type).toBe('header');
    });

    it('should return focus for footer section', () => {
      focusEventSource.emit('section-focused', { section: 'footer' });

      const focus = discovery.getCurrentFocus();
      expect(focus?.content).toBe(footerContent);
      expect(focus?.sourceId.type).toBe('footer');
    });
  });

  describe('tablecell-focused event', () => {
    it('should register table cell content on focus', () => {
      const mockCell = {
        flowingContent: new FlowingTextContent('Cell content')
      };
      const mockTable = { id: 'table-1' } as TableObject;

      focusEventSource.emit('tablecell-focused', {
        table: mockTable,
        cell: mockCell,
        row: 1,
        col: 2
      });

      expect(mutationObserver.isObserving(mockCell.flowingContent)).toBe(true);
    });

    it('should set current focus to table cell', () => {
      const mockCell = {
        flowingContent: new FlowingTextContent('Cell content')
      };
      const mockTable = { id: 'table-1' } as TableObject;

      focusEventSource.emit('tablecell-focused', {
        table: mockTable,
        cell: mockCell,
        row: 1,
        col: 2
      });

      const focus = discovery.getCurrentFocus();
      expect(focus).not.toBeNull();
      expect(focus?.sourceId.type).toBe('tablecell');
      expect(focus?.sourceId.objectId).toBe('table-1');
      expect(focus?.sourceId.cellAddress).toEqual({ row: 1, col: 2 });
    });

    it('should handle cell without flowingContent', () => {
      const mockTable = { id: 'table-1' } as TableObject;

      // Should not throw
      expect(() => {
        focusEventSource.emit('tablecell-focused', {
          table: mockTable,
          cell: {},
          row: 0,
          col: 0
        });
      }).not.toThrow();
    });
  });

  describe('textbox-editing-started event', () => {
    it('should register text box content on focus', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      focusEventSource.emit('textbox-editing-started', { textBox });

      expect(mutationObserver.isObserving(textBox.flowingContent)).toBe(true);
    });

    it('should set current focus to text box', () => {
      const textBox = new TextBoxObject({
        id: 'tb-2',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      focusEventSource.emit('textbox-editing-started', { textBox });

      const focus = discovery.getCurrentFocus();
      expect(focus).not.toBeNull();
      expect(focus?.sourceId.type).toBe('textbox');
      expect(focus?.sourceId.objectId).toBe('tb-2');
    });

    it('should handle null textBox', () => {
      expect(() => {
        focusEventSource.emit('textbox-editing-started', { textBox: null });
      }).not.toThrow();
    });
  });

  describe('textbox-editing-ended event', () => {
    it('should clear current focus', () => {
      const textBox = new TextBoxObject({
        id: 'tb-1',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      focusEventSource.emit('textbox-editing-started', { textBox });
      expect(discovery.getCurrentFocus()).not.toBeNull();

      focusEventSource.emit('textbox-editing-ended', {});
      expect(discovery.getCurrentFocus()).toBeNull();
    });
  });

  describe('table-editing-ended event', () => {
    it('should clear current focus', () => {
      const mockCell = {
        flowingContent: new FlowingTextContent('Cell content')
      };
      const mockTable = { id: 'table-1' } as TableObject;

      focusEventSource.emit('tablecell-focused', {
        table: mockTable,
        cell: mockCell,
        row: 0,
        col: 0
      });
      expect(discovery.getCurrentFocus()).not.toBeNull();

      focusEventSource.emit('table-editing-ended', {});
      expect(discovery.getCurrentFocus()).toBeNull();
    });
  });

  describe('registerContent()', () => {
    it('should register content with mutation observer', () => {
      const content = new FlowingTextContent('New content');
      discovery.registerContent(content, { type: 'textbox', objectId: 'custom' });

      expect(mutationObserver.isObserving(content)).toBe(true);
    });

    it('should track registered content', () => {
      const content = new FlowingTextContent('New content');
      const sourceId = { type: 'textbox' as const, objectId: 'custom' };
      discovery.registerContent(content, sourceId);

      // Can retrieve by source ID
      const found = discovery.getContentBySourceId(sourceId);
      expect(found).toBe(content);
    });
  });

  describe('unregisterContent()', () => {
    it('should unregister content from mutation observer', () => {
      const content = new FlowingTextContent('New content');
      discovery.registerContent(content, { type: 'textbox', objectId: 'custom' });
      expect(mutationObserver.isObserving(content)).toBe(true);

      discovery.unregisterContent(content);
      expect(mutationObserver.isObserving(content)).toBe(false);
    });
  });

  describe('getContentBySourceId()', () => {
    it('should return body content for body sourceId', () => {
      const content = discovery.getContentBySourceId({ type: 'body' });
      expect(content).toBe(bodyContent);
    });

    it('should return header content for header sourceId', () => {
      const content = discovery.getContentBySourceId({ type: 'header' });
      expect(content).toBe(headerContent);
    });

    it('should return footer content for footer sourceId', () => {
      const content = discovery.getContentBySourceId({ type: 'footer' });
      expect(content).toBe(footerContent);
    });

    it('should return registered content for custom sourceId', () => {
      const customContent = new FlowingTextContent('Custom');
      const sourceId = { type: 'textbox' as const, objectId: 'my-box' };
      discovery.registerContent(customContent, sourceId);

      const found = discovery.getContentBySourceId(sourceId);
      expect(found).toBe(customContent);
    });

    it('should return null for unknown sourceId', () => {
      const found = discovery.getContentBySourceId({ type: 'textbox', objectId: 'nonexistent' });
      expect(found).toBeNull();
    });

    it('should match tablecell sourceId with cell address', () => {
      const cellContent = new FlowingTextContent('Cell');
      const sourceId = {
        type: 'tablecell' as const,
        objectId: 'table-1',
        cellAddress: { row: 2, col: 3 }
      };
      discovery.registerContent(cellContent, sourceId);

      const found = discovery.getContentBySourceId(sourceId);
      expect(found).toBe(cellContent);

      // Different cell address should not match
      const notFound = discovery.getContentBySourceId({
        type: 'tablecell',
        objectId: 'table-1',
        cellAddress: { row: 0, col: 0 }
      });
      expect(notFound).toBeNull();
    });
  });

  describe('registerObject()', () => {
    it('should register TextBoxObject content', () => {
      const textBox = new TextBoxObject({
        id: 'tb-register',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      discovery.registerObject(textBox);

      expect(mutationObserver.isObserving(textBox.flowingContent)).toBe(true);
    });

    it('should register TableObject cells', () => {
      const table = new TableObject({
        id: 'table-register',
        textIndex: 0,
        size: { width: 200, height: 100 },
        rows: 2,
        columns: 2
      });

      discovery.registerObject(table);

      // All cells should be registered
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const cell = table.getCell(row, col);
          if (cell && 'flowingContent' in cell) {
            expect(mutationObserver.isObserving((cell as any).flowingContent)).toBe(true);
          }
        }
      }
    });

    it('should handle non-text objects gracefully', () => {
      // Create a mock object that isn't TextBoxObject or TableObject
      const mockObject = { id: 'mock' } as any;

      // Should not throw
      expect(() => discovery.registerObject(mockObject)).not.toThrow();
    });
  });

  describe('unregisterObject()', () => {
    it('should unregister TextBoxObject content', () => {
      const textBox = new TextBoxObject({
        id: 'tb-unregister',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      discovery.registerObject(textBox);
      expect(mutationObserver.isObserving(textBox.flowingContent)).toBe(true);

      discovery.unregisterObject(textBox);
      expect(mutationObserver.isObserving(textBox.flowingContent)).toBe(false);
    });

    it('should unregister TableObject cells', () => {
      const table = new TableObject({
        id: 'table-unregister',
        textIndex: 0,
        size: { width: 200, height: 100 },
        rows: 2,
        columns: 2
      });

      discovery.registerObject(table);
      discovery.unregisterObject(table);

      // All cells should be unregistered
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const cell = table.getCell(row, col);
          if (cell && 'flowingContent' in cell) {
            expect(mutationObserver.isObserving((cell as any).flowingContent)).toBe(false);
          }
        }
      }
    });
  });

  describe('clear()', () => {
    it('should unobserve all registered content', () => {
      // Register some additional content
      const extra = new FlowingTextContent('Extra');
      discovery.registerContent(extra, { type: 'textbox', objectId: 'extra' });

      discovery.clear();

      expect(mutationObserver.isObserving(bodyContent)).toBe(false);
      expect(mutationObserver.isObserving(headerContent)).toBe(false);
      expect(mutationObserver.isObserving(footerContent)).toBe(false);
      expect(mutationObserver.isObserving(extra)).toBe(false);
    });

    it('should clear current focus', () => {
      focusEventSource.emit('section-focused', { section: 'body' });
      expect(discovery.getCurrentFocus()).not.toBeNull();

      discovery.clear();
      expect(discovery.getCurrentFocus()).toBeNull();
    });

    it('should clear registered content tracking', () => {
      discovery.clear();

      // After clear, getContentBySourceId should still work for document sections
      // because they're looked up directly, not from registered content
      expect(discovery.getContentBySourceId({ type: 'body' })).toBe(bodyContent);
    });
  });

  describe('focus sequence', () => {
    it('should update focus on each focus event', () => {
      // Start in body
      focusEventSource.emit('section-focused', { section: 'body' });
      expect(discovery.getCurrentFocus()?.sourceId.type).toBe('body');

      // Move to header
      focusEventSource.emit('section-focused', { section: 'header' });
      expect(discovery.getCurrentFocus()?.sourceId.type).toBe('header');

      // Move to footer
      focusEventSource.emit('section-focused', { section: 'footer' });
      expect(discovery.getCurrentFocus()?.sourceId.type).toBe('footer');
    });

    it('should handle text box focus then section focus', () => {
      const textBox = new TextBoxObject({
        id: 'tb-sequence',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      focusEventSource.emit('textbox-editing-started', { textBox });
      expect(discovery.getCurrentFocus()?.sourceId.type).toBe('textbox');

      focusEventSource.emit('textbox-editing-ended', {});
      expect(discovery.getCurrentFocus()).toBeNull();

      focusEventSource.emit('section-focused', { section: 'body' });
      expect(discovery.getCurrentFocus()?.sourceId.type).toBe('body');
    });
  });

  describe('sameSourceId (via getContentBySourceId)', () => {
    it('should match simple source IDs', () => {
      const content = new FlowingTextContent('Test');
      discovery.registerContent(content, { type: 'textbox', objectId: 'test' });

      expect(discovery.getContentBySourceId({ type: 'textbox', objectId: 'test' })).toBe(content);
      expect(discovery.getContentBySourceId({ type: 'textbox', objectId: 'other' })).toBeNull();
    });

    it('should match source IDs with cell address', () => {
      const content = new FlowingTextContent('Cell');
      discovery.registerContent(content, {
        type: 'tablecell',
        objectId: 'table',
        cellAddress: { row: 1, col: 2 }
      });

      // Same address
      expect(discovery.getContentBySourceId({
        type: 'tablecell',
        objectId: 'table',
        cellAddress: { row: 1, col: 2 }
      })).toBe(content);

      // Different row
      expect(discovery.getContentBySourceId({
        type: 'tablecell',
        objectId: 'table',
        cellAddress: { row: 0, col: 2 }
      })).toBeNull();

      // Different col
      expect(discovery.getContentBySourceId({
        type: 'tablecell',
        objectId: 'table',
        cellAddress: { row: 1, col: 0 }
      })).toBeNull();
    });

    it('should not match if only one has cellAddress', () => {
      const content = new FlowingTextContent('Cell');
      discovery.registerContent(content, {
        type: 'tablecell',
        objectId: 'table',
        cellAddress: { row: 0, col: 0 }
      });

      // Without cell address - should not match
      expect(discovery.getContentBySourceId({
        type: 'tablecell',
        objectId: 'table'
      })).toBeNull();
    });
  });
});
