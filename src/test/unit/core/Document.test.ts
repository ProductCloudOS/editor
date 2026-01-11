/**
 * Unit tests for Document
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Document } from '../../../lib/core/Document';
import { Page } from '../../../lib/core/Page';
import { DocumentData, DocumentSettings } from '../../../lib/types';

describe('Document', () => {
  let doc: Document;

  beforeEach(() => {
    doc = new Document();
  });

  describe('constructor', () => {
    it('should create document with default settings', () => {
      expect(doc.settings.pageSize).toBe('A4');
      expect(doc.settings.pageOrientation).toBe('portrait');
      expect(doc.settings.units).toBe('mm');
    });

    it('should create document with one default page', () => {
      expect(doc.pageCount).toBe(1);
      expect(doc.pages.length).toBe(1);
    });

    it('should initialize empty flowing content', () => {
      expect(doc.bodyFlowingContent).toBeDefined();
      expect(doc.headerFlowingContent).toBeDefined();
      expect(doc.footerFlowingContent).toBeDefined();
    });

    it('should load from provided data', () => {
      const data: DocumentData = {
        version: '2.0.0',
        settings: {
          pageSize: 'Letter',
          pageOrientation: 'landscape',
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
          units: 'in'
        },
        pages: [{ id: 'page-1' }, { id: 'page-2' }]
      };

      const loadedDoc = new Document(data);

      expect(loadedDoc.version).toBe('2.0.0');
      expect(loadedDoc.settings.pageSize).toBe('Letter');
      expect(loadedDoc.pageCount).toBe(2);
    });

    it('should load body content from data', () => {
      const data: DocumentData = {
        version: '1.0.0',
        settings: {
          pageSize: 'A4',
          pageOrientation: 'portrait',
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          units: 'mm'
        },
        pages: [{ id: 'page-1' }],
        bodyContent: {
          text: 'Test body content',
          formatting: []
        }
      };

      const loadedDoc = new Document(data);
      expect(loadedDoc.bodyFlowingContent.getText()).toBe('Test body content');
    });

    it('should load header content from data', () => {
      const data: DocumentData = {
        version: '1.0.0',
        settings: {
          pageSize: 'A4',
          pageOrientation: 'portrait',
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          units: 'mm'
        },
        pages: [{ id: 'page-1' }],
        headerContent: {
          text: 'Header text',
          formatting: []
        }
      };

      const loadedDoc = new Document(data);
      expect(loadedDoc.headerFlowingContent.getText()).toBe('Header text');
    });

    it('should load footer content from data', () => {
      const data: DocumentData = {
        version: '1.0.0',
        settings: {
          pageSize: 'A4',
          pageOrientation: 'portrait',
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          units: 'mm'
        },
        pages: [{ id: 'page-1' }],
        footerContent: {
          text: 'Footer text',
          formatting: []
        }
      };

      const loadedDoc = new Document(data);
      expect(loadedDoc.footerFlowingContent.getText()).toBe('Footer text');
    });
  });

  describe('version', () => {
    it('should return default version', () => {
      expect(doc.version).toBe('1.0.0');
    });

    it('should return loaded version', () => {
      const data: DocumentData = {
        version: '3.5.0',
        settings: {
          pageSize: 'A4',
          pageOrientation: 'portrait',
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          units: 'mm'
        },
        pages: [{ id: 'page-1' }]
      };

      const loadedDoc = new Document(data);
      expect(loadedDoc.version).toBe('3.5.0');
    });
  });

  describe('pages', () => {
    it('should return array of pages', () => {
      expect(Array.isArray(doc.pages)).toBe(true);
      expect(doc.pages[0]).toBeInstanceOf(Page);
    });
  });

  describe('pageCount', () => {
    it('should return number of pages', () => {
      expect(doc.pageCount).toBe(1);
    });
  });

  describe('settings', () => {
    it('should return a copy of settings', () => {
      const settings1 = doc.settings;
      const settings2 = doc.settings;
      expect(settings1).toEqual(settings2);
      expect(settings1).not.toBe(settings2);
    });
  });

  describe('addPage()', () => {
    it('should add a page at the end by default', () => {
      const newPage = new Page({ id: 'new-page' }, doc.settings);
      doc.addPage(newPage);

      expect(doc.pageCount).toBe(2);
      expect(doc.pages[1].id).toBe('new-page');
    });

    it('should add a page at specified index', () => {
      const page1 = new Page({ id: 'page-a' }, doc.settings);
      const page2 = new Page({ id: 'page-b' }, doc.settings);
      doc.addPage(page1);
      doc.addPage(page2, 1);

      expect(doc.pages[1].id).toBe('page-b');
      expect(doc.pages[2].id).toBe('page-a');
    });

    it('should add page at end if index out of bounds', () => {
      const newPage = new Page({ id: 'new-page' }, doc.settings);
      doc.addPage(newPage, 100);

      expect(doc.pageCount).toBe(2);
      expect(doc.pages[1].id).toBe('new-page');
    });

    it('should emit page-added event', () => {
      const handler = vi.fn();
      doc.on('page-added', handler);

      const newPage = new Page({ id: 'new-page' }, doc.settings);
      doc.addPage(newPage);

      expect(handler).toHaveBeenCalledWith({ page: newPage, index: undefined });
    });

    it('should emit change event', () => {
      const handler = vi.fn();
      doc.on('change', handler);

      const newPage = new Page({ id: 'new-page' }, doc.settings);
      doc.addPage(newPage);

      expect(handler).toHaveBeenCalled();
    });

    it('should listen to page change events', () => {
      const changeHandler = vi.fn();
      doc.on('change', changeHandler);

      const newPage = new Page({ id: 'new-page' }, doc.settings);
      doc.addPage(newPage);
      changeHandler.mockClear();

      newPage.updateSettings(doc.settings);

      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('removePage()', () => {
    it('should remove page by id', () => {
      const newPage = new Page({ id: 'page-to-remove' }, doc.settings);
      doc.addPage(newPage);

      const removed = doc.removePage('page-to-remove');

      expect(removed).toBe(newPage);
      expect(doc.pageCount).toBe(1);
    });

    it('should return null if page not found', () => {
      const removed = doc.removePage('non-existent');

      expect(removed).toBeNull();
    });

    it('should emit page-removed event', () => {
      const handler = vi.fn();
      const newPage = new Page({ id: 'page-to-remove' }, doc.settings);
      doc.addPage(newPage);
      doc.on('page-removed', handler);

      doc.removePage('page-to-remove');

      expect(handler).toHaveBeenCalledWith({ page: newPage, index: 1 });
    });

    it('should emit change event', () => {
      const newPage = new Page({ id: 'page-to-remove' }, doc.settings);
      doc.addPage(newPage);

      const handler = vi.fn();
      doc.on('change', handler);

      doc.removePage('page-to-remove');

      expect(handler).toHaveBeenCalled();
    });

    it('should remove event listeners from removed page', () => {
      const newPage = new Page({ id: 'page-to-remove' }, doc.settings);
      doc.addPage(newPage);
      doc.removePage('page-to-remove');

      const changeHandler = vi.fn();
      doc.on('change', changeHandler);
      changeHandler.mockClear();

      // Updating settings on removed page should not trigger doc change
      newPage.updateSettings(doc.settings);

      expect(changeHandler).not.toHaveBeenCalled();
    });
  });

  describe('getPage()', () => {
    it('should find page by id', () => {
      const newPage = new Page({ id: 'find-me' }, doc.settings);
      doc.addPage(newPage);

      const found = doc.getPage('find-me');

      expect(found).toBe(newPage);
    });

    it('should return undefined if not found', () => {
      const found = doc.getPage('not-there');

      expect(found).toBeUndefined();
    });
  });

  describe('getPageByIndex()', () => {
    it('should return page at index', () => {
      const page = doc.getPageByIndex(0);

      expect(page).toBeDefined();
      expect(page).toBe(doc.pages[0]);
    });

    it('should return undefined for invalid index', () => {
      expect(doc.getPageByIndex(-1)).toBeUndefined();
      expect(doc.getPageByIndex(100)).toBeUndefined();
    });
  });

  describe('movePage()', () => {
    beforeEach(() => {
      // Add more pages for testing
      doc.addPage(new Page({ id: 'page-2' }, doc.settings));
      doc.addPage(new Page({ id: 'page-3' }, doc.settings));
    });

    it('should move page to new index', () => {
      const pageId = doc.pages[2].id;
      const result = doc.movePage(pageId, 0);

      expect(result).toBe(true);
      expect(doc.pages[0].id).toBe(pageId);
    });

    it('should return false for non-existent page', () => {
      const result = doc.movePage('non-existent', 0);

      expect(result).toBe(false);
    });

    it('should return false for negative index', () => {
      const result = doc.movePage(doc.pages[0].id, -1);

      expect(result).toBe(false);
    });

    it('should return false for index out of bounds', () => {
      const result = doc.movePage(doc.pages[0].id, 100);

      expect(result).toBe(false);
    });

    it('should emit page-moved event', () => {
      const handler = vi.fn();
      doc.on('page-moved', handler);

      const page = doc.pages[2];
      doc.movePage(page.id, 0);

      expect(handler).toHaveBeenCalledWith({ page, fromIndex: 2, toIndex: 0 });
    });

    it('should emit change event', () => {
      const handler = vi.fn();
      doc.on('change', handler);

      doc.movePage(doc.pages[0].id, 1);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('updateSettings()', () => {
    it('should update document settings', () => {
      doc.updateSettings({ pageSize: 'Letter' });

      expect(doc.settings.pageSize).toBe('Letter');
    });

    it('should preserve existing settings', () => {
      doc.updateSettings({ pageSize: 'Letter' });

      expect(doc.settings.pageOrientation).toBe('portrait');
      expect(doc.settings.units).toBe('mm');
    });

    it('should update all pages', () => {
      doc.addPage(new Page({ id: 'page-2' }, doc.settings));

      doc.updateSettings({ pageOrientation: 'landscape' });

      expect(doc.pages[0].settings.pageOrientation).toBe('landscape');
      expect(doc.pages[1].settings.pageOrientation).toBe('landscape');
    });

    it('should emit settings-changed event', () => {
      const handler = vi.fn();
      doc.on('settings-changed', handler);

      doc.updateSettings({ pageSize: 'A3' });

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].settings.pageSize).toBe('A3');
    });

    it('should emit change event', () => {
      const handler = vi.fn();
      doc.on('change', handler);

      doc.updateSettings({ pageSize: 'Legal' });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('flowing content', () => {
    describe('bodyFlowingContent', () => {
      it('should return FlowingTextContent instance', () => {
        expect(doc.bodyFlowingContent).toBeDefined();
        expect(typeof doc.bodyFlowingContent.getText).toBe('function');
      });

      it('should emit body-content-changed on content change', () => {
        const handler = vi.fn();
        doc.on('body-content-changed', handler);

        doc.bodyFlowingContent.setText('New body text');

        expect(handler).toHaveBeenCalled();
      });

      it('should emit change event on body content change', () => {
        const handler = vi.fn();
        doc.on('change', handler);

        doc.bodyFlowingContent.setText('New text');

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('headerFlowingContent', () => {
      it('should return FlowingTextContent instance', () => {
        expect(doc.headerFlowingContent).toBeDefined();
        expect(typeof doc.headerFlowingContent.getText).toBe('function');
      });

      it('should emit header-content-changed on content change', () => {
        const handler = vi.fn();
        doc.on('header-content-changed', handler);

        doc.headerFlowingContent.setText('Header');

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('footerFlowingContent', () => {
      it('should return FlowingTextContent instance', () => {
        expect(doc.footerFlowingContent).toBeDefined();
        expect(typeof doc.footerFlowingContent.getText).toBe('function');
      });

      it('should emit footer-content-changed on content change', () => {
        const handler = vi.fn();
        doc.on('footer-content-changed', handler);

        doc.footerFlowingContent.setText('Footer');

        expect(handler).toHaveBeenCalled();
      });
    });

    it('should forward cursor-moved event from body content', () => {
      const handler = vi.fn();
      doc.on('cursor-moved', handler);

      // Need text first before cursor can move
      doc.bodyFlowingContent.setText('Hello world');
      doc.bodyFlowingContent.setCursorPosition(5);

      expect(handler).toHaveBeenCalled();
    });

    it('should forward formatting-changed event from body content', () => {
      const handler = vi.fn();
      doc.on('formatting-changed', handler);

      doc.bodyFlowingContent.setText('Test text');
      doc.bodyFlowingContent.applyFormatting(0, 4, { bold: true });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('toData()', () => {
    it('should serialize document to data', () => {
      const data = doc.toData();

      expect(data.version).toBe('1.0.0');
      expect(data.settings).toEqual(doc.settings);
      expect(data.pages.length).toBe(1);
    });

    it('should include body content', () => {
      doc.bodyFlowingContent.setText('Body text');
      const data = doc.toData();

      expect(data.bodyContent).toBeDefined();
      expect(data.bodyContent?.text).toBe('Body text');
    });

    it('should include header content', () => {
      doc.headerFlowingContent.setText('Header text');
      const data = doc.toData();

      expect(data.headerContent).toBeDefined();
      expect(data.headerContent?.text).toBe('Header text');
    });

    it('should include footer content', () => {
      doc.footerFlowingContent.setText('Footer text');
      const data = doc.toData();

      expect(data.footerContent).toBeDefined();
      expect(data.footerContent?.text).toBe('Footer text');
    });

    it('should include metadata with modifiedAt', () => {
      const data = doc.toData();

      expect(data.metadata).toBeDefined();
      expect(data.metadata?.modifiedAt).toBeDefined();
    });

    it('should be JSON serializable', () => {
      doc.bodyFlowingContent.setText('Test');
      const data = doc.toData();

      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.bodyContent.text).toBe('Test');
    });

    it('should include all page data', () => {
      doc.addPage(new Page({ id: 'page-2' }, doc.settings));
      const data = doc.toData();

      expect(data.pages.length).toBe(2);
      expect(data.pages[1].id).toBe('page-2');
    });
  });

  describe('clear()', () => {
    it('should remove all pages', () => {
      doc.addPage(new Page({ id: 'page-2' }, doc.settings));
      doc.clear();

      expect(doc.pageCount).toBe(0);
    });

    it('should clear body content', () => {
      doc.bodyFlowingContent.setText('Some text');
      doc.clear();

      expect(doc.bodyFlowingContent.getText()).toBe('');
    });

    it('should clear header content', () => {
      doc.headerFlowingContent.setText('Header');
      doc.clear();

      expect(doc.headerFlowingContent.getText()).toBe('');
    });

    it('should clear footer content', () => {
      doc.footerFlowingContent.setText('Footer');
      doc.clear();

      expect(doc.footerFlowingContent.getText()).toBe('');
    });

    it('should emit cleared event', () => {
      const handler = vi.fn();
      doc.on('cleared', handler);

      doc.clear();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit change event', () => {
      const handler = vi.fn();
      doc.on('change', handler);

      doc.clear();

      expect(handler).toHaveBeenCalled();
    });

    it('should remove listeners from cleared pages', () => {
      const page = doc.pages[0];
      doc.clear();

      const changeHandler = vi.fn();
      doc.on('change', changeHandler);
      changeHandler.mockClear();

      page.updateSettings(doc.settings);

      expect(changeHandler).not.toHaveBeenCalled();
    });
  });

  describe('round-trip serialization', () => {
    it('should preserve document state after round-trip', () => {
      doc.updateSettings({ pageSize: 'Letter', pageOrientation: 'landscape' });
      doc.bodyFlowingContent.setText('Body content');
      doc.headerFlowingContent.setText('Header content');
      doc.footerFlowingContent.setText('Footer content');
      doc.addPage(new Page({ id: 'page-2' }, doc.settings));

      const data = doc.toData();
      const restored = new Document(data);

      expect(restored.settings.pageSize).toBe('Letter');
      expect(restored.settings.pageOrientation).toBe('landscape');
      expect(restored.bodyFlowingContent.getText()).toBe('Body content');
      expect(restored.headerFlowingContent.getText()).toBe('Header content');
      expect(restored.footerFlowingContent.getText()).toBe('Footer content');
      expect(restored.pageCount).toBe(2);
    });
  });
});
