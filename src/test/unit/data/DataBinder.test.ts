/**
 * Unit tests for DataBinder
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataBinder } from '../../../lib/data/DataBinder';
import { DocumentData, DataBindingContext } from '../../../lib/types';

describe('DataBinder', () => {
  let binder: DataBinder;
  let documentData: DocumentData;
  let context: DataBindingContext;

  beforeEach(() => {
    binder = new DataBinder();
    documentData = {
      version: '1.0.0',
      settings: {
        pageSize: 'A4',
        pageOrientation: 'portrait',
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        units: 'mm'
      },
      pages: [{ id: 'page-1' }, { id: 'page-2' }]
    };
    context = {
      data: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    };
  });

  describe('constructor', () => {
    it('should create a DataBinder instance', () => {
      expect(binder).toBeInstanceOf(DataBinder);
    });
  });

  describe('bind()', () => {
    it('should return a document with the same version', () => {
      const result = binder.bind(documentData, context);

      expect(result.version).toBe('1.0.0');
    });

    it('should return a document with the same settings', () => {
      const result = binder.bind(documentData, context);

      expect(result.settings).toEqual(documentData.settings);
    });

    it('should return a document with the same number of pages', () => {
      const result = binder.bind(documentData, context);

      expect(result.pages.length).toBe(2);
    });

    it('should return copies of pages', () => {
      const result = binder.bind(documentData, context);

      expect(result.pages[0]).toEqual({ id: 'page-1' });
      expect(result.pages[1]).toEqual({ id: 'page-2' });
    });

    it('should preserve header content', () => {
      documentData.headerContent = {
        text: 'Header text',
        formatting: []
      };

      const result = binder.bind(documentData, context);

      expect(result.headerContent).toEqual(documentData.headerContent);
    });

    it('should preserve footer content', () => {
      documentData.footerContent = {
        text: 'Footer text',
        formatting: []
      };

      const result = binder.bind(documentData, context);

      expect(result.footerContent).toEqual(documentData.footerContent);
    });

    it('should return a new object, not the original', () => {
      const result = binder.bind(documentData, context);

      expect(result).not.toBe(documentData);
    });

    it('should return new page objects', () => {
      const result = binder.bind(documentData, context);

      expect(result.pages).not.toBe(documentData.pages);
      expect(result.pages[0]).not.toBe(documentData.pages[0]);
    });

    it('should work with empty data context', () => {
      const emptyContext: DataBindingContext = { data: {} };
      const result = binder.bind(documentData, emptyContext);

      expect(result.version).toBe('1.0.0');
      expect(result.pages.length).toBe(2);
    });

    it('should work with single page document', () => {
      const singlePageDoc: DocumentData = {
        ...documentData,
        pages: [{ id: 'only-page' }]
      };

      const result = binder.bind(singlePageDoc, context);

      expect(result.pages.length).toBe(1);
      expect(result.pages[0].id).toBe('only-page');
    });

    it('should work with no pages', () => {
      const noPageDoc: DocumentData = {
        ...documentData,
        pages: []
      };

      const result = binder.bind(noPageDoc, context);

      expect(result.pages.length).toBe(0);
    });

    it('should handle undefined header content', () => {
      delete documentData.headerContent;
      const result = binder.bind(documentData, context);

      expect(result.headerContent).toBeUndefined();
    });

    it('should handle undefined footer content', () => {
      delete documentData.footerContent;
      const result = binder.bind(documentData, context);

      expect(result.footerContent).toBeUndefined();
    });

    it('should not mutate original document', () => {
      const originalVersion = documentData.version;
      const originalPageCount = documentData.pages.length;

      binder.bind(documentData, context);

      expect(documentData.version).toBe(originalVersion);
      expect(documentData.pages.length).toBe(originalPageCount);
    });
  });
});
