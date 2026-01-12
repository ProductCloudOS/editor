/**
 * RulerControl - Base class for horizontal and vertical rulers.
 *
 * Provides common functionality for calculating tick marks,
 * rendering, and responding to editor events.
 */

import { BaseControl } from '../BaseControl';
import {
  RulerOptions,
  RulerOrientation,
  TickMark,
  DEFAULT_RULER_OPTIONS,
  getPixelsPerUnit
} from './types';

/**
 * Abstract base class for ruler controls.
 */
export abstract class RulerControl extends BaseControl {
  protected options: Required<RulerOptions>;
  protected canvas: HTMLCanvasElement | null = null;
  protected ctx: CanvasRenderingContext2D | null = null;
  protected currentMousePosition: number | null = null;
  protected zoomLevel: number = 1;
  protected scrollOffset: number = 0;
  protected documentSize: number = 0;
  protected marginStart: number = 0;
  protected marginEnd: number = 0;

  protected abstract readonly orientation: RulerOrientation;

  constructor(id: string, options: RulerOptions = {}) {
    super(id, options);
    this.options = { ...DEFAULT_RULER_OPTIONS, ...options };
  }

  private resizeObserver: ResizeObserver | null = null;

  /**
   * Create the ruler element.
   */
  protected createElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `pc-ruler pc-ruler-${this.orientation}`;
    wrapper.style.position = 'absolute';
    wrapper.style.overflow = 'hidden';
    wrapper.style.backgroundColor = this.options.backgroundColor;

    if (this.orientation === 'horizontal') {
      wrapper.style.height = `${this.options.thickness}px`;
      wrapper.style.width = '100%';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.right = '0';
    } else {
      wrapper.style.width = `${this.options.thickness}px`;
      wrapper.style.top = '0';
      wrapper.style.bottom = '0';
      wrapper.style.left = '0';
    }

    // Create canvas for rendering
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    wrapper.appendChild(this.canvas);

    // Set up mouse tracking
    this.setupMouseTracking(wrapper);

    // Set up resize observer to handle container size changes
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      this.render();
    });
    this.resizeObserver.observe(wrapper);

    // Also listen for window resize as a fallback
    const handleWindowResize = () => {
      this.update();
    };
    window.addEventListener('resize', handleWindowResize);
    this.eventCleanup.push(() => {
      window.removeEventListener('resize', handleWindowResize);
    });

    return wrapper;
  }

  /**
   * Set up mouse position tracking.
   */
  protected setupMouseTracking(element: HTMLElement): void {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      if (this.orientation === 'horizontal') {
        this.currentMousePosition = e.clientX - rect.left;
      } else {
        this.currentMousePosition = e.clientY - rect.top;
      }
      this.render();
    };

    const handleMouseLeave = () => {
      this.currentMousePosition = null;
      this.render();
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    this.eventCleanup.push(() => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    });
  }

  /**
   * Set up event listeners on the editor.
   */
  protected setupEventListeners(): void {
    super.setupEventListeners();

    // Listen for zoom changes
    this.addEditorListener('zoom-changed', (data: { zoom: number }) => {
      this.zoomLevel = data.zoom;
      this.update();
    });

    // Listen for document/settings changes
    this.addEditorListener('settings-changed', () => {
      this.update();
    });

    // Listen for scroll changes via the editor API
    this.addEditorListener('scroll', (data: { x: number; y: number }) => {
      this.scrollOffset = this.orientation === 'horizontal' ? data.x : data.y;
      this.update();
    });

    // Listen for mouse movement over the editor for cursor tracking
    this.addEditorListener('mouse-move', (data: { x: number; y: number }) => {
      this.currentMousePosition = this.orientation === 'horizontal' ? data.x : data.y;
      this.render();
    });

    this.addEditorListener('mouse-leave', () => {
      this.currentMousePosition = null;
      this.render();
    });
  }

  /**
   * Clean up event listeners and observers.
   */
  protected cleanupEventListeners(): void {
    super.cleanupEventListeners();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Update scroll offset from the editor.
   */
  protected abstract updateScrollOffset(): void;

  /**
   * Update the ruler based on current editor state.
   */
  update(): void {
    if (!this._isAttached || !this._isVisible || !this.editor) {
      return;
    }

    // Get current zoom level
    this.zoomLevel = this.editor.getZoomLevel();

    // Get document metrics
    const metrics = this.editor.getDocumentMetrics();
    if (metrics) {
      this.updateFromMetrics(metrics);
    }

    // Resize canvas if needed
    this.resizeCanvas();

    // Render
    this.render();
  }

  /**
   * Update ruler state from document metrics.
   */
  protected abstract updateFromMetrics(metrics: {
    pageWidth: number;
    pageHeight: number;
    margins: { top: number; right: number; bottom: number; left: number };
    totalPages: number;
  } | null): void;

  /**
   * Resize the canvas to match the container.
   */
  protected resizeCanvas(): void {
    if (!this.canvas || !this.element) return;

    const rect = this.element.getBoundingClientRect();

    // Skip if element hasn't been laid out yet
    if (rect.width === 0 && rect.height === 0) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    if (this.orientation === 'horizontal') {
      this.canvas.width = rect.width * dpr;
      this.canvas.height = this.options.thickness * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${this.options.thickness}px`;
    } else {
      this.canvas.width = this.options.thickness * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${this.options.thickness}px`;
      this.canvas.style.height = `${rect.height}px`;
    }

    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  /**
   * Calculate tick marks for the visible portion of the ruler.
   * Takes into account the content offset to generate ticks for the
   * document range that's currently visible.
   */
  protected calculateTickMarks(): TickMark[] {
    const ticks: TickMark[] = [];
    const pixelsPerUnit = getPixelsPerUnit(this.options.units) * this.zoomLevel;
    const majorInterval = this.options.majorTickInterval;
    const minorInterval = majorInterval / this.options.minorTicksPerMajor;

    // Get the content offset (where document starts in ruler coordinates)
    const contentOffset = this.getContentOffset();
    const visibleLength = this.getVisibleLength();

    // Calculate the document coordinate range that's visible in the ruler
    // Ruler shows from 0 to visibleLength in ruler coordinates
    // Convert to document coordinates by subtracting contentOffset
    const visibleDocStart = Math.max(0, -contentOffset); // Can't be before document start
    const visibleDocEnd = visibleLength - contentOffset;

    // Convert to units
    const startUnit = Math.floor(visibleDocStart / pixelsPerUnit / minorInterval) * minorInterval - minorInterval;
    const endUnit = Math.ceil(visibleDocEnd / pixelsPerUnit / minorInterval) * minorInterval + minorInterval;

    // Generate ticks for the visible range
    for (let unit = Math.max(0, startUnit); unit <= endUnit; unit += minorInterval) {
      const position = unit * pixelsPerUnit;
      const isMajor = Math.abs(unit % majorInterval) < 0.001;

      const tick: TickMark = {
        position,
        isMajor
      };

      if (isMajor && this.options.showLabels) {
        tick.label = String(Math.round(unit));
      }

      ticks.push(tick);
    }

    return ticks;
  }

  /**
   * Get the content offset for this ruler orientation.
   */
  protected abstract getContentOffset(): number;

  /**
   * Get the visible length of the ruler.
   */
  protected getVisibleLength(): number {
    if (!this.element) return 0;
    const rect = this.element.getBoundingClientRect();
    return this.orientation === 'horizontal' ? rect.width : rect.height;
  }

  /**
   * Render the ruler.
   */
  protected render(): void {
    if (!this.ctx || !this.canvas) return;

    const width = this.orientation === 'horizontal'
      ? this.canvas.width / (window.devicePixelRatio || 1)
      : this.options.thickness;
    const height = this.orientation === 'horizontal'
      ? this.options.thickness
      : this.canvas.height / (window.devicePixelRatio || 1);

    // Clear
    this.ctx.fillStyle = this.options.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    // Draw margin indicators
    if (this.options.showMargins) {
      this.renderMargins(width, height);
    }

    // Draw tick marks
    const ticks = this.calculateTickMarks();
    this.renderTicks(ticks, width, height);

    // Draw cursor indicator
    if (this.currentMousePosition !== null) {
      this.renderCursorIndicator(width, height);
    }
  }

  /**
   * Render margin indicators.
   */
  protected abstract renderMargins(width: number, height: number): void;

  /**
   * Render tick marks.
   */
  protected abstract renderTicks(ticks: TickMark[], width: number, height: number): void;

  /**
   * Render the cursor position indicator.
   */
  protected abstract renderCursorIndicator(width: number, height: number): void;
}
