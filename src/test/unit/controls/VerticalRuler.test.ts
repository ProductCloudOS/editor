/**
 * Unit tests for VerticalRuler
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VerticalRuler } from '../../../lib/controls/rulers/VerticalRuler';

describe('VerticalRuler', () => {
  let ruler: VerticalRuler;
  let container: HTMLElement;
  let mockEditor: any;
  let mockEditorContainer: HTMLElement;

  beforeEach(() => {
    ruler = new VerticalRuler({ units: 'mm' });
    container = document.createElement('div');
    container.style.height = '600px';
    document.body.appendChild(container);

    mockEditorContainer = document.createElement('div');
    mockEditorContainer.className = 'editor-container';
    document.body.appendChild(mockEditorContainer);

    mockEditor = {
      on: vi.fn(),
      off: vi.fn(),
      getZoomLevel: vi.fn().mockReturnValue(1),
      getContainer: vi.fn().mockReturnValue(mockEditorContainer),
      getDocumentMetrics: vi.fn().mockReturnValue({
        pageWidth: 210,
        pageHeight: 297,
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        totalPages: 1
      }),
      getScrollPosition: vi.fn().mockReturnValue({ x: 0, y: 0 }),
      getContentOffset: vi.fn().mockReturnValue({ x: 100, y: 50 })
    };
  });

  afterEach(() => {
    if (ruler.isAttached) {
      ruler.detach();
    }
    document.body.removeChild(container);
    document.body.removeChild(mockEditorContainer);
  });

  describe('constructor', () => {
    it('should create a vertical ruler with default options', () => {
      const r = new VerticalRuler();
      expect(r.id).toBe('vertical-ruler');
    });

    it('should accept custom units option', () => {
      const r = new VerticalRuler({ units: 'in' });
      expect(r.id).toBe('vertical-ruler');
    });
  });

  describe('attach()', () => {
    it('should attach and create a ruler element', () => {
      ruler.attach({ editor: mockEditor, container });

      expect(ruler.isAttached).toBe(true);
      expect(container.querySelector('.pc-ruler-vertical')).not.toBeNull();
    });

    it('should create a canvas element', () => {
      ruler.attach({ editor: mockEditor, container });

      expect(container.querySelector('canvas')).not.toBeNull();
    });

    it('should set up event listeners on the editor', () => {
      ruler.attach({ editor: mockEditor, container });

      expect(mockEditor.on).toHaveBeenCalledWith('zoom-changed', expect.any(Function));
      expect(mockEditor.on).toHaveBeenCalledWith('settings-changed', expect.any(Function));
    });
  });

  describe('update()', () => {
    it('should update when called after attach', () => {
      ruler.attach({ editor: mockEditor, container });

      // Should not throw
      expect(() => ruler.update()).not.toThrow();
    });

    it('should get zoom level from editor', () => {
      ruler.attach({ editor: mockEditor, container });
      mockEditor.getZoomLevel.mockClear();

      ruler.update();

      expect(mockEditor.getZoomLevel).toHaveBeenCalled();
    });

    it('should get document metrics from editor', () => {
      ruler.attach({ editor: mockEditor, container });
      mockEditor.getDocumentMetrics.mockClear();

      ruler.update();

      expect(mockEditor.getDocumentMetrics).toHaveBeenCalled();
    });
  });

  describe('multi-page support', () => {
    it('should handle multiple pages in document metrics', () => {
      mockEditor.getDocumentMetrics.mockReturnValue({
        pageWidth: 210,
        pageHeight: 297,
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        totalPages: 3
      });

      ruler.attach({ editor: mockEditor, container });

      // Should handle multi-page metrics without error
      expect(ruler.isAttached).toBe(true);
    });
  });

  describe('visibility', () => {
    it('should be visible by default', () => {
      ruler.attach({ editor: mockEditor, container });

      expect(ruler.isVisible).toBe(true);
    });

    it('should hide when hide() is called', () => {
      ruler.attach({ editor: mockEditor, container });
      ruler.hide();

      expect(ruler.isVisible).toBe(false);
      const element = container.querySelector('.pc-ruler-vertical') as HTMLElement;
      expect(element.style.display).toBe('none');
    });

    it('should show when show() is called', () => {
      ruler.attach({ editor: mockEditor, container });
      ruler.hide();
      ruler.show();

      expect(ruler.isVisible).toBe(true);
      const element = container.querySelector('.pc-ruler-vertical') as HTMLElement;
      expect(element.style.display).toBe('');
    });
  });

  describe('zoom changes', () => {
    it('should respond to zoom-changed events', () => {
      ruler.attach({ editor: mockEditor, container });

      // Find the zoom-changed handler
      const zoomChangedCall = mockEditor.on.mock.calls.find(
        (call: any[]) => call[0] === 'zoom-changed'
      );
      expect(zoomChangedCall).toBeDefined();

      // Simulate zoom change
      mockEditor.getZoomLevel.mockReturnValue(2.0);
      zoomChangedCall[1]({ zoom: 2.0 });

      // Should update without error
      expect(ruler.isAttached).toBe(true);
    });
  });

  describe('scroll changes', () => {
    it('should listen for scroll events', () => {
      ruler.attach({ editor: mockEditor, container });

      // Verify scroll listener was registered
      expect(mockEditor.on).toHaveBeenCalledWith('scroll', expect.any(Function));
    });

    it('should respond to scroll events', () => {
      ruler.attach({ editor: mockEditor, container });

      // Find the scroll handler
      const scrollCall = mockEditor.on.mock.calls.find(
        (call: any[]) => call[0] === 'scroll'
      );
      expect(scrollCall).toBeDefined();

      // Update mock to return new scroll position
      mockEditor.getScrollPosition.mockReturnValue({ x: 0, y: 100 });
      mockEditor.getContentOffset.mockReturnValue({ x: 100, y: 150 });

      // Simulate scroll event with data
      scrollCall[1]({ x: 0, y: 100 });

      // Should update without error
      expect(ruler.isAttached).toBe(true);
    });
  });

  describe('detach()', () => {
    it('should clean up event listeners', () => {
      ruler.attach({ editor: mockEditor, container });
      ruler.detach();

      expect(mockEditor.off).toHaveBeenCalledWith('zoom-changed', expect.any(Function));
      expect(mockEditor.off).toHaveBeenCalledWith('settings-changed', expect.any(Function));
      expect(mockEditor.off).toHaveBeenCalledWith('scroll', expect.any(Function));
    });

    it('should remove the ruler element', () => {
      ruler.attach({ editor: mockEditor, container });
      ruler.detach();

      expect(container.querySelector('.pc-ruler-vertical')).toBeNull();
    });
  });
});
