/**
 * Unit tests for ImageObject
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageObject } from '../../../lib/objects/ImageObject';

// Create mock canvas context
function createMockContext(): CanvasRenderingContext2D {
  return {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline
  } as unknown as CanvasRenderingContext2D;
}

describe('ImageObject', () => {
  let image: ImageObject;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    // Mock Image constructor for controlled testing
    vi.stubGlobal('Image', class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src: string = '';
      naturalWidth = 100;
      naturalHeight = 80;

      get src() { return this._src; }
      set src(val: string) {
        this._src = val;
        // Simulate async load
        if (val && !val.includes('error')) {
          setTimeout(() => this.onload?.(), 0);
        } else if (val.includes('error')) {
          setTimeout(() => this.onerror?.(), 0);
        }
      }
    });

    image = new ImageObject({
      id: 'img-1',
      textIndex: 0,
      size: { width: 200, height: 150 },
      src: 'test.jpg'
    });
    ctx = createMockContext();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should create with required values', () => {
      expect(image.id).toBe('img-1');
      expect(image.objectType).toBe('image');
      expect(image.src).toBe('test.jpg');
    });

    it('should use default fit mode', () => {
      expect(image.fit).toBe('contain');
    });

    it('should use default resize mode', () => {
      expect(image.resizeMode).toBe('locked-aspect-ratio');
    });

    it('should use empty alt by default', () => {
      expect(image.alt).toBe('');
    });

    it('should create with custom options', () => {
      const img = new ImageObject({
        id: 'img-2',
        textIndex: 5,
        size: { width: 100, height: 100 },
        src: 'custom.png',
        fit: 'cover',
        resizeMode: 'free',
        alt: 'Custom image'
      });

      expect(img.fit).toBe('cover');
      expect(img.resizeMode).toBe('free');
      expect(img.alt).toBe('Custom image');
    });
  });

  describe('objectType', () => {
    it('should return image', () => {
      expect(image.objectType).toBe('image');
    });
  });

  describe('src', () => {
    it('should get src', () => {
      expect(image.src).toBe('test.jpg');
    });

    it('should set src and reload image', () => {
      image.src = 'new-image.png';
      expect(image.src).toBe('new-image.png');
    });

    it('should not reload if src unchanged', () => {
      const loadedBefore = image.loaded;
      image.src = 'test.jpg'; // Same value
      // Should not change state
    });
  });

  describe('fit', () => {
    it('should get and set fit mode', () => {
      image.fit = 'fill';
      expect(image.fit).toBe('fill');
    });

    it('should emit fit-changed event', () => {
      const handler = vi.fn();
      image.on('fit-changed', handler);

      image.fit = 'cover';

      expect(handler).toHaveBeenCalledWith({ fit: 'cover' });
    });
  });

  describe('resizeMode', () => {
    it('should get and set resize mode', () => {
      image.resizeMode = 'free';
      expect(image.resizeMode).toBe('free');
    });

    it('should emit resize-mode-changed event', () => {
      const handler = vi.fn();
      image.on('resize-mode-changed', handler);

      image.resizeMode = 'locked-aspect-ratio';

      expect(handler).toHaveBeenCalledWith({ resizeMode: 'locked-aspect-ratio' });
    });
  });

  describe('alt', () => {
    it('should get and set alt text', () => {
      image.alt = 'Description';
      expect(image.alt).toBe('Description');
    });
  });

  describe('loaded', () => {
    it('should start as false', () => {
      expect(image.loaded).toBe(false);
    });

    it('should become true after image loads', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });
    });
  });

  describe('hasError', () => {
    it('should be false initially', () => {
      expect(image.hasError).toBe(false);
    });

    it('should be true for empty src', () => {
      const img = new ImageObject({
        id: 'err',
        textIndex: 0,
        size: { width: 50, height: 50 },
        src: ''
      });

      expect(img.hasError).toBe(true);
    });

    it('should be true after load error', async () => {
      const img = new ImageObject({
        id: 'err',
        textIndex: 0,
        size: { width: 50, height: 50 },
        src: 'error.jpg'  // Mock triggers error for 'error' in src
      });

      await vi.waitFor(() => expect(img.hasError).toBe(true), { timeout: 100 });
    });
  });

  describe('render()', () => {
    it('should draw loading placeholder when not loaded', () => {
      image.render(ctx);

      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.strokeRect).toHaveBeenCalled();
    });

    it('should draw image when loaded', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      image.render(ctx);

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should draw error placeholder on error', async () => {
      const img = new ImageObject({
        id: 'err',
        textIndex: 0,
        size: { width: 100, height: 80 },
        src: 'error.jpg'
      });

      await vi.waitFor(() => expect(img.hasError).toBe(true), { timeout: 100 });

      img.render(ctx);

      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled(); // X drawing
    });

    it('should draw selection border when selected', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      image.selected = true;
      image.render(ctx);

      expect(ctx.strokeRect).toHaveBeenCalled();
    });
  });

  describe('fit modes rendering', () => {
    beforeEach(async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });
    });

    it('should render with fill mode', () => {
      image.fit = 'fill';
      image.render(ctx);

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should render with contain mode', () => {
      image.fit = 'contain';
      image.render(ctx);

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should render with cover mode', () => {
      image.fit = 'cover';
      image.render(ctx);

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should render with none mode', () => {
      image.fit = 'none';
      image.render(ctx);

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('should render with tile mode', () => {
      image.fit = 'tile';
      image.render(ctx);

      expect(ctx.drawImage).toHaveBeenCalled();
    });
  });

  describe('toData()', () => {
    it('should serialize all properties', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      const data = image.toData();

      expect(data.id).toBe('img-1');
      expect(data.objectType).toBe('image');
      expect(data.size).toEqual({ width: 200, height: 150 });
      expect(data.data.src).toBe('test.jpg');
      expect(data.data.fit).toBe('contain');
      expect(data.data.resizeMode).toBe('locked-aspect-ratio');
      expect(data.data.alt).toBe('');
    });

    it('should include natural dimensions when loaded', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      const data = image.toData();

      expect(data.data.naturalWidth).toBe(100);
      expect(data.data.naturalHeight).toBe(80);
    });
  });

  describe('restoreFromData()', () => {
    it('should restore size', () => {
      const data = image.toData();
      data.size = { width: 300, height: 200 };

      image.restoreFromData(data);

      expect(image.width).toBe(300);
      expect(image.height).toBe(200);
    });

    it('should restore fit mode', () => {
      const data = image.toData();
      data.data.fit = 'cover';

      image.restoreFromData(data);

      expect(image.fit).toBe('cover');
    });

    it('should restore resize mode', () => {
      const data = image.toData();
      data.data.resizeMode = 'free';

      image.restoreFromData(data);

      expect(image.resizeMode).toBe('free');
    });

    it('should restore alt text', () => {
      const data = image.toData();
      data.data.alt = 'Restored alt';

      image.restoreFromData(data);

      expect(image.alt).toBe('Restored alt');
    });

    it('should reload image if src changed', () => {
      const data = image.toData();
      data.data.src = 'new-source.jpg';

      const handler = vi.fn();
      image.on('image-loaded', handler);

      image.restoreFromData(data);

      // Source should be updated
      expect(image.src).toBe('new-source.jpg');
    });

    it('should emit state-restored event', () => {
      const handler = vi.fn();
      image.on('state-restored', handler);

      image.restoreFromData(image.toData());

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('clone()', () => {
    it('should create a copy with new id', () => {
      image.fit = 'cover';
      image.alt = 'Test';

      const cloned = image.clone();

      expect(cloned.id).not.toBe(image.id);
      expect(cloned.id).toContain('clone');
      expect(cloned.src).toBe('test.jpg');
      expect(cloned.fit).toBe('cover');
      expect(cloned.alt).toBe('Test');
    });

    it('should copy size', () => {
      const cloned = image.clone();

      expect(cloned.width).toBe(image.width);
      expect(cloned.height).toBe(image.height);
    });
  });

  describe('setSource()', () => {
    it('should set new source', () => {
      image.setSource('new-image.png');

      expect(image.src).toBe('new-image.png');
    });

    it('should emit image-loaded when loaded', async () => {
      const handler = vi.fn();
      image.on('image-loaded', handler);

      image.setSource('another.jpg');

      await vi.waitFor(() => expect(handler).toHaveBeenCalled(), { timeout: 100 });
    });

    it('should auto-resize when maxWidth provided', async () => {
      image.setSource('another.jpg', { maxWidth: 50 });

      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      // Natural 100x80, maxWidth 50 -> scale 0.5 -> 50x40
      expect(image.width).toBe(50);
      expect(image.height).toBe(40);
    });

    it('should auto-resize when maxHeight provided', async () => {
      image.setSource('another.jpg', { maxHeight: 40 });

      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      // Natural 100x80, maxHeight 40 -> scale 0.5 -> 50x40
      expect(image.width).toBe(50);
      expect(image.height).toBe(40);
    });
  });

  describe('getNaturalSize()', () => {
    it('should return null when not loaded', () => {
      const img = new ImageObject({
        id: 'test',
        textIndex: 0,
        size: { width: 100, height: 100 },
        src: ''
      });

      expect(img.getNaturalSize()).toBeNull();
    });

    it('should return natural dimensions when loaded', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      const natural = image.getNaturalSize();

      expect(natural).not.toBeNull();
      expect(natural!.width).toBe(100);
      expect(natural!.height).toBe(80);
    });
  });

  describe('resizeToNatural()', () => {
    it('should do nothing when not loaded', () => {
      const img = new ImageObject({
        id: 'test',
        textIndex: 0,
        size: { width: 50, height: 50 },
        src: ''
      });

      img.resizeToNatural();

      expect(img.width).toBe(50);
      expect(img.height).toBe(50);
    });

    it('should resize to natural dimensions', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      image.resizeToNatural();

      expect(image.width).toBe(100);
      expect(image.height).toBe(80);
    });
  });

  describe('resizeToFit()', () => {
    it('should do nothing when not loaded', () => {
      const img = new ImageObject({
        id: 'test',
        textIndex: 0,
        size: { width: 100, height: 100 },
        src: ''
      });

      img.resizeToFit(50, 50);

      expect(img.width).toBe(100);
      expect(img.height).toBe(100);
    });

    it('should resize to fit within max dimensions', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      // Natural 100x80, fit in 50x50
      image.resizeToFit(50, 50);

      // Limited by width: 50x40
      expect(image.width).toBe(50);
      expect(image.height).toBe(40);
    });

    it('should not scale up', async () => {
      await vi.waitFor(() => expect(image.loaded).toBe(true), { timeout: 100 });

      // Natural 100x80, fit in 200x200
      image.resizeToFit(200, 200);

      // Should stay at natural size
      expect(image.width).toBe(100);
      expect(image.height).toBe(80);
    });
  });

  describe('events', () => {
    it('should emit image-loaded on successful load', async () => {
      const handler = vi.fn();
      image.on('image-loaded', handler);

      await vi.waitFor(() => expect(handler).toHaveBeenCalled(), { timeout: 100 });
      expect(handler).toHaveBeenCalledWith({ src: 'test.jpg' });
    });

    it('should emit image-error on load failure', async () => {
      const img = new ImageObject({
        id: 'err',
        textIndex: 0,
        size: { width: 50, height: 50 },
        src: 'error.jpg'
      });

      const handler = vi.fn();
      img.on('image-error', handler);

      await vi.waitFor(() => expect(handler).toHaveBeenCalled(), { timeout: 100 });
      expect(handler).toHaveBeenCalledWith({ src: 'error.jpg' });
    });
  });
});
