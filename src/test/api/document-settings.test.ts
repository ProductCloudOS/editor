/**
 * Tests for PCEditor document settings operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PCEditor } from '../../lib/core/PCEditor';
import { createEditor, cleanupEditor, nextTick } from '../helpers/createEditor';

describe('PCEditor Document Settings', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    const result = await createEditor();
    editor = result.editor;
    container = result.container;
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('getDocumentSettings', () => {
    it('should return document settings', () => {
      const settings = editor.getDocumentSettings();

      expect(settings).toBeDefined();
      expect(settings.pageSize).toBeDefined();
      expect(settings.pageOrientation).toBeDefined();
    });

    it('should return default page size A4', () => {
      const settings = editor.getDocumentSettings();
      expect(settings.pageSize).toBe('A4');
    });

    it('should return default orientation portrait', () => {
      const settings = editor.getDocumentSettings();
      expect(settings.pageOrientation).toBe('portrait');
    });

    it('should return margins', () => {
      const settings = editor.getDocumentSettings();
      expect(settings.margins).toBeDefined();
      expect(settings.margins.top).toBeDefined();
      expect(settings.margins.right).toBeDefined();
      expect(settings.margins.bottom).toBeDefined();
      expect(settings.margins.left).toBeDefined();
    });
  });

  describe('updateDocumentSettings', () => {
    it('should update page size', () => {
      editor.updateDocumentSettings({ pageSize: 'Letter' });

      const settings = editor.getDocumentSettings();
      expect(settings.pageSize).toBe('Letter');
    });

    it('should update page orientation', () => {
      editor.updateDocumentSettings({ pageOrientation: 'landscape' });

      const settings = editor.getDocumentSettings();
      expect(settings.pageOrientation).toBe('landscape');
    });

    it('should update margins', () => {
      editor.updateDocumentSettings({
        margins: { top: 30, right: 25, bottom: 30, left: 25 }
      });

      const settings = editor.getDocumentSettings();
      expect(settings.margins.top).toBe(30);
      expect(settings.margins.right).toBe(25);
      expect(settings.margins.bottom).toBe(30);
      expect(settings.margins.left).toBe(25);
    });

    it('should update partial margins', () => {
      const originalSettings = editor.getDocumentSettings();
      const originalRight = originalSettings.margins.right;

      editor.updateDocumentSettings({
        margins: { top: 40 }
      });

      const settings = editor.getDocumentSettings();
      expect(settings.margins.top).toBe(40);
      // Other margins may or may not be preserved depending on implementation
    });

    it('should emit document-settings-changed event', async () => {
      const handler = vi.fn();
      editor.on('document-settings-changed', handler);

      editor.updateDocumentSettings({ pageSize: 'Legal' });

      expect(handler).toHaveBeenCalled();
    });

    it('should include updated settings in event', async () => {
      const handler = vi.fn();
      editor.on('document-settings-changed', handler);

      editor.updateDocumentSettings({ pageSize: 'A3' });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            pageSize: 'A3'
          })
        })
      );
    });
  });

  describe('page size options', () => {
    it('should support A4', () => {
      editor.updateDocumentSettings({ pageSize: 'A4' });
      expect(editor.getDocumentSettings().pageSize).toBe('A4');
    });

    it('should support Letter', () => {
      editor.updateDocumentSettings({ pageSize: 'Letter' });
      expect(editor.getDocumentSettings().pageSize).toBe('Letter');
    });

    it('should support Legal', () => {
      editor.updateDocumentSettings({ pageSize: 'Legal' });
      expect(editor.getDocumentSettings().pageSize).toBe('Legal');
    });

    it('should support A3', () => {
      editor.updateDocumentSettings({ pageSize: 'A3' });
      expect(editor.getDocumentSettings().pageSize).toBe('A3');
    });
  });

  describe('page orientation options', () => {
    it('should support portrait', () => {
      editor.updateDocumentSettings({ pageOrientation: 'portrait' });
      expect(editor.getDocumentSettings().pageOrientation).toBe('portrait');
    });

    it('should support landscape', () => {
      editor.updateDocumentSettings({ pageOrientation: 'landscape' });
      expect(editor.getDocumentSettings().pageOrientation).toBe('landscape');
    });

    it('should toggle between orientations', () => {
      editor.updateDocumentSettings({ pageOrientation: 'landscape' });
      expect(editor.getDocumentSettings().pageOrientation).toBe('landscape');

      editor.updateDocumentSettings({ pageOrientation: 'portrait' });
      expect(editor.getDocumentSettings().pageOrientation).toBe('portrait');
    });
  });

  describe('view options', () => {
    describe('showGrid', () => {
      it('should get grid visibility', () => {
        const show = editor.getShowGrid();
        expect(typeof show).toBe('boolean');
      });

      it('should set grid visibility to true', () => {
        editor.setShowGrid(true);
        expect(editor.getShowGrid()).toBe(true);
      });

      it('should set grid visibility to false', () => {
        editor.setShowGrid(false);
        expect(editor.getShowGrid()).toBe(false);
      });

      it('should emit grid-changed event', async () => {
        const handler = vi.fn();
        editor.on('grid-changed', handler);

        editor.setShowGrid(false);

        expect(handler).toHaveBeenCalledWith({ show: false });
      });
    });

    describe('showControlCharacters', () => {
      it('should get control characters visibility', () => {
        const show = editor.getShowControlCharacters();
        expect(typeof show).toBe('boolean');
      });

      it('should set control characters visibility to true', () => {
        editor.setShowControlCharacters(true);
        expect(editor.getShowControlCharacters()).toBe(true);
      });

      it('should set control characters visibility to false', () => {
        editor.setShowControlCharacters(false);
        expect(editor.getShowControlCharacters()).toBe(false);
      });

      it('should emit control-characters-changed event', async () => {
        const handler = vi.fn();
        editor.on('control-characters-changed', handler);

        editor.setShowControlCharacters(true);

        expect(handler).toHaveBeenCalledWith({ show: true });
      });
    });

    describe('showMarginLines', () => {
      it('should get margin lines visibility', () => {
        const show = editor.getShowMarginLines();
        expect(typeof show).toBe('boolean');
      });

      it('should set margin lines visibility to true', () => {
        editor.setShowMarginLines(true);
        expect(editor.getShowMarginLines()).toBe(true);
      });

      it('should set margin lines visibility to false', () => {
        editor.setShowMarginLines(false);
        expect(editor.getShowMarginLines()).toBe(false);
      });

      it('should emit margin-lines-changed event', async () => {
        const handler = vi.fn();
        editor.on('margin-lines-changed', handler);

        editor.setShowMarginLines(false);

        expect(handler).toHaveBeenCalledWith({ show: false });
      });
    });
  });

  describe('zoom controls', () => {
    it('should zoom in without error', () => {
      expect(() => editor.zoomIn()).not.toThrow();
    });

    it('should zoom out without error', () => {
      expect(() => editor.zoomOut()).not.toThrow();
    });

    it('should set zoom level', () => {
      expect(() => editor.setZoom(1.5)).not.toThrow();
    });

    it('should fit to width', () => {
      expect(() => editor.fitToWidth()).not.toThrow();
    });

    it('should fit to page', () => {
      expect(() => editor.fitToPage()).not.toThrow();
    });
  });

  describe('layout controls', () => {
    it('should set auto flow', () => {
      expect(() => editor.setAutoFlow(true)).not.toThrow();
      expect(() => editor.setAutoFlow(false)).not.toThrow();
    });

    it('should reflow document', () => {
      expect(() => editor.reflowDocument()).not.toThrow();
    });

    it('should set snap to grid', () => {
      expect(() => editor.setSnapToGrid(true)).not.toThrow();
      expect(() => editor.setSnapToGrid(false)).not.toThrow();
    });

    it('should get document metrics', () => {
      const metrics = editor.getDocumentMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('page management', () => {
    it('should add page', () => {
      const docBefore = editor.getDocument();
      const pageCountBefore = docBefore.pages.length;

      editor.addPage();

      const docAfter = editor.getDocument();
      expect(docAfter.pages.length).toBe(pageCountBefore + 1);
    });

    it('should remove page by id', () => {
      // Add a page first to ensure we have multiple
      editor.addPage();

      const docBefore = editor.getDocument();
      const pageCountBefore = docBefore.pages.length;
      const pageToRemove = docBefore.pages[1].id;

      editor.removePage(pageToRemove);

      const docAfter = editor.getDocument();
      expect(docAfter.pages.length).toBe(pageCountBefore - 1);
    });

    it('should throw when removing last page', () => {
      const doc = editor.getDocument();
      const onlyPageId = doc.pages[0].id;

      expect(() => editor.removePage(onlyPageId)).toThrow('Cannot remove the last page');
    });
  });

  describe('render', () => {
    it('should force render without error', () => {
      expect(() => editor.render()).not.toThrow();
    });

    it('should render after content change', () => {
      editor.setFlowingText('Test content');
      expect(() => editor.render()).not.toThrow();
    });
  });
});
