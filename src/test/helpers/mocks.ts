/**
 * Mock factories for unit tests
 */
import { vi } from 'vitest';

/**
 * Create a mock canvas element
 */
export function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Create a mock canvas 2D context with all methods stubbed
 */
export function createMockContext(): CanvasRenderingContext2D {
  return {
    // Drawing rectangles
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),

    // Drawing text
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 4,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 8,
      emHeightAscent: 10,
      emHeightDescent: 3,
      hangingBaseline: 10,
      alphabeticBaseline: 0,
      ideographicBaseline: -3
    })),

    // Paths
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    isPointInPath: vi.fn(() => false),
    isPointInStroke: vi.fn(() => false),

    // Transformations
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    getTransform: vi.fn(() => new DOMMatrix()),

    // Drawing images
    drawImage: vi.fn(),
    createImageData: vi.fn(() => new ImageData(1, 1)),
    getImageData: vi.fn(() => new ImageData(1, 1)),
    putImageData: vi.fn(),

    // Line styles
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10,
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    lineDashOffset: 0,

    // Fill and stroke styles
    fillStyle: '#000000',
    strokeStyle: '#000000',
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn()
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn()
    })),
    createPattern: vi.fn(),
    createConicGradient: vi.fn(() => ({
      addColorStop: vi.fn()
    })),

    // Shadows
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    // Text styles
    font: '14px Arial',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    direction: 'ltr' as CanvasDirection,
    fontKerning: 'auto' as CanvasFontKerning,
    fontStretch: 'normal' as CanvasFontStretch,
    fontVariantCaps: 'normal' as CanvasFontVariantCaps,
    textRendering: 'auto' as CanvasTextRendering,
    letterSpacing: '0px',
    wordSpacing: '0px',

    // Compositing
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,

    // Image smoothing
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low' as ImageSmoothingQuality,

    // Filters
    filter: 'none',

    // Canvas reference
    canvas: createMockCanvas(),
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Create a mock container element
 */
export function createMockContainer(width = 800, height = 600): HTMLElement {
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  Object.defineProperty(container, 'clientWidth', { value: width, writable: true });
  Object.defineProperty(container, 'clientHeight', { value: height, writable: true });
  Object.defineProperty(container, 'offsetWidth', { value: width, writable: true });
  Object.defineProperty(container, 'offsetHeight', { value: height, writable: true });
  return container;
}

/**
 * Create a spy that tracks calls and can return values
 */
export function createSpy<T extends (...args: any[]) => any>(
  returnValue?: ReturnType<T>
): T & { calls: Parameters<T>[] } {
  const calls: Parameters<T>[] = [];
  const fn = ((...args: Parameters<T>) => {
    calls.push(args);
    return returnValue;
  }) as T & { calls: Parameters<T>[] };
  fn.calls = calls;
  return fn;
}
