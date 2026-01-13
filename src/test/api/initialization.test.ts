/**
 * Tests for PCEditor initialization and lifecycle
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { PCEditor } from '../../lib/core/PCEditor';
import { createEditor, cleanupEditor, waitForReady } from '../helpers/createEditor';

describe('PCEditor Initialization', () => {
  let container: HTMLElement | null = null;

  afterEach(() => {
    if (container) {
      cleanupEditor(container);
      container = null;
    }
  });

  describe('constructor', () => {
    it('should create editor with default options', async () => {
      const result = await createEditor();
      container = result.container;

      expect(result.editor).toBeInstanceOf(PCEditor);
      expect(result.editor.isReady).toBe(true);
    });

    it('should throw error when container is null', () => {
      expect(() => new PCEditor(null as unknown as HTMLElement)).toThrow('Container element is required');
    });

    it('should throw error when container is undefined', () => {
      expect(() => new PCEditor(undefined as unknown as HTMLElement)).toThrow('Container element is required');
    });

    it('should accept custom pageSize option', async () => {
      const result = await createEditor({ pageSize: 'Letter' });
      container = result.container;

      const settings = result.editor.getDocumentSettings();
      expect(settings.pageSize).toBe('Letter');
    });

    it('should accept custom pageOrientation option', async () => {
      const result = await createEditor({ pageOrientation: 'landscape' });
      container = result.container;

      const settings = result.editor.getDocumentSettings();
      expect(settings.pageOrientation).toBe('landscape');
    });

    it('should apply custom showGrid option', async () => {
      const result = await createEditor({ showGrid: false });
      container = result.container;

      expect(result.editor.getShowGrid()).toBe(false);
    });

    it('should apply custom showControlCharacters option', async () => {
      const result = await createEditor({ showControlCharacters: true });
      container = result.container;

      expect(result.editor.getShowControlCharacters()).toBe(true);
    });

    it('should use default options when none provided', async () => {
      const result = await createEditor();
      container = result.container;

      const settings = result.editor.getDocumentSettings();
      expect(settings.pageSize).toBe('A4');
      expect(settings.pageOrientation).toBe('portrait');
    });
  });

  describe('ready state', () => {
    it('should set isReady to true after initialization', async () => {
      const result = await createEditor();
      container = result.container;

      expect(result.editor.isReady).toBe(true);
    });

    it('should emit ready event when initialized', async () => {
      container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);

      const readyHandler = vi.fn();
      const editor = new PCEditor(container);
      editor.on('ready', readyHandler);

      await waitForReady(editor);

      expect(readyHandler).toHaveBeenCalled();
    });
  });

  describe('container setup', () => {
    it('should set container position to relative', async () => {
      const result = await createEditor();
      container = result.container;

      expect(container.style.position).toBe('relative');
    });

    it('should not set container overflow (left to parent)', async () => {
      const result = await createEditor();
      container = result.container;

      // Note: overflow is intentionally not set on the container
      // to allow external controls (rulers) to sync with scroll
      expect(container.style.overflow).toBe('');
    });

    it('should add light theme class by default', async () => {
      const result = await createEditor();
      container = result.container;

      expect(container.classList.contains('pc-editor-light')).toBe(true);
    });

    it('should add dark theme class when theme is dark', async () => {
      const result = await createEditor({ theme: 'dark' });
      container = result.container;

      expect(container.classList.contains('pc-editor-dark')).toBe(true);
    });

    it('should make container focusable', async () => {
      const result = await createEditor();
      container = result.container;

      expect(container.getAttribute('tabindex')).toBe('0');
    });
  });

  describe('multiple instances', () => {
    it('should allow creating multiple editor instances', async () => {
      const result1 = await createEditor();
      const result2 = await createEditor();

      expect(result1.editor).toBeInstanceOf(PCEditor);
      expect(result2.editor).toBeInstanceOf(PCEditor);
      expect(result1.editor).not.toBe(result2.editor);

      cleanupEditor(result1.container);
      cleanupEditor(result2.container);
    });
  });
});
