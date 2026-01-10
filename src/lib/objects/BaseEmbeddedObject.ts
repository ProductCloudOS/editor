import { EventEmitter } from '../events/EventEmitter';
import {
  ObjectPosition,
  RelativeOffset,
  Size,
  Point,
  Rect,
  ResizeHandle,
  EmbeddedObjectConfig,
  EmbeddedObjectData
} from './types';

/**
 * Abstract base class for all embedded objects.
 * Defines the API that all object types must implement.
 */
export abstract class BaseEmbeddedObject extends EventEmitter {
  protected _id: string;
  protected _textIndex: number;
  protected _position: ObjectPosition;
  protected _size: Size;
  protected _relativeOffset: RelativeOffset = { x: 0, y: 0 };
  protected _selected: boolean = false;
  protected _locked: boolean = false;
  protected _renderedPosition: Point | null = null;
  protected _renderedPageIndex: number = -1;

  constructor(config: EmbeddedObjectConfig) {
    super();
    this._id = config.id;
    this._textIndex = config.textIndex;
    this._position = config.position || 'inline';
    this._size = { ...config.size };
    if (config.relativeOffset) {
      this._relativeOffset = { ...config.relativeOffset };
    }
  }

  // ============ Abstract Methods (must be implemented by subclasses) ============

  /**
   * Render the object to the canvas.
   * The canvas context is translated so (0,0) is the object's top-left corner.
   */
  abstract render(ctx: CanvasRenderingContext2D): void;

  /**
   * Get the object type identifier (e.g., 'image', 'textbox').
   */
  abstract get objectType(): string;

  /**
   * Serialize to JSON for persistence.
   */
  abstract toData(): EmbeddedObjectData;

  /**
   * Clone this object.
   */
  abstract clone(): BaseEmbeddedObject;

  // ============ Common Properties ============

  get id(): string {
    return this._id;
  }

  get textIndex(): number {
    return this._textIndex;
  }

  set textIndex(value: number) {
    this._textIndex = value;
    this.emit('text-index-changed', { textIndex: value });
  }

  get position(): ObjectPosition {
    return this._position;
  }

  set position(value: ObjectPosition) {
    this._position = value;
    this.emit('position-changed', { position: value });
  }

  /**
   * Get the relative offset (for 'relative' position mode).
   */
  get relativeOffset(): RelativeOffset {
    return { ...this._relativeOffset };
  }

  /**
   * Set the relative offset (for 'relative' position mode).
   */
  set relativeOffset(value: RelativeOffset) {
    this._relativeOffset = { ...value };
    this.emit('offset-changed', { offset: { ...value } });
  }

  get size(): Size {
    return { ...this._size };
  }

  set size(value: Size) {
    this._size = { ...value };
    this.emit('size-changed', { size: { ...value } });
  }

  get width(): number {
    return this._size.width;
  }

  set width(value: number) {
    this._size.width = value;
    this.emit('size-changed', { size: { ...this._size } });
  }

  get height(): number {
    return this._size.height;
  }

  set height(value: number) {
    this._size.height = value;
    this.emit('size-changed', { size: { ...this._size } });
  }

  get selected(): boolean {
    return this._selected;
  }

  set selected(value: boolean) {
    if (this._selected !== value) {
      this._selected = value;
      this.emit('selection-changed', { selected: value });
    }
  }

  get locked(): boolean {
    return this._locked;
  }

  set locked(value: boolean) {
    this._locked = value;
    this.emit('locked-changed', { locked: value });
  }

  /**
   * Get the last rendered position (set during rendering).
   * Used for hit detection of resize handles.
   */
  get renderedPosition(): Point | null {
    return this._renderedPosition;
  }

  /**
   * Set the rendered position (called by renderer).
   */
  set renderedPosition(value: Point | null) {
    this._renderedPosition = value ? { ...value } : null;
  }

  /**
   * Get the page index where this object was last rendered.
   * Used for hit detection to ensure clicks only match objects on the same page.
   */
  get renderedPageIndex(): number {
    return this._renderedPageIndex;
  }

  /**
   * Set the rendered page index (called by renderer).
   */
  set renderedPageIndex(value: number) {
    this._renderedPageIndex = value;
  }

  // ============ Common Methods ============

  /**
   * Get bounding rectangle (relative to object's position).
   */
  getBounds(): Rect {
    return {
      x: 0,
      y: 0,
      width: this._size.width,
      height: this._size.height
    };
  }

  /**
   * Check if a point is within the object bounds.
   * @param point The point to test
   * @param objectPosition The position of the object on the canvas
   */
  containsPoint(point: Point, objectPosition: Point): boolean {
    return (
      point.x >= objectPosition.x &&
      point.x <= objectPosition.x + this._size.width &&
      point.y >= objectPosition.y &&
      point.y <= objectPosition.y + this._size.height
    );
  }

  /**
   * Resize the object to a new size.
   */
  resize(newSize: Size): void {
    const minSize = this.getMinSize();
    const maxSize = this.getMaxSize();

    let width = Math.max(newSize.width, minSize.width);
    let height = Math.max(newSize.height, minSize.height);

    if (maxSize) {
      width = Math.min(width, maxSize.width);
      height = Math.min(height, maxSize.height);
    }

    this.size = { width, height };
  }

  /**
   * Called when the object is clicked.
   * Default behavior: select the object.
   */
  handleClick(_point: Point): void {
    if (!this._locked) {
      this.selected = true;
    }
  }

  /**
   * Called when the object is double-clicked.
   * Default: no-op. Subclasses can override for editing behavior.
   */
  handleDoubleClick(_point: Point): void {
    // Default: no-op
  }

  /**
   * Get minimum size constraints.
   */
  getMinSize(): Size {
    return { width: 20, height: 20 };
  }

  /**
   * Get maximum size constraints. Returns null for no limit.
   */
  getMaxSize(): Size | null {
    return null;
  }

  /**
   * Whether this object type supports resizing.
   */
  get resizable(): boolean {
    return !this._locked;
  }

  /**
   * Get resize handle positions.
   * Can be overridden for custom handle configurations.
   */
  getResizeHandles(): ResizeHandle[] {
    if (this._locked) {
      return [];
    }
    return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  }

  /**
   * Render selection border and handles.
   * Called by subclasses when selected.
   */
  protected renderSelectionBorder(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this._size;

    // Draw selection border
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(0, 0, width, height);
    ctx.setLineDash([]);

    // Draw resize handles
    if (this.resizable) {
      const handleSize = 8;
      const handles = this.getResizeHandles();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1;

      for (const handle of handles) {
        const pos = this.getHandlePosition(handle, handleSize);
        ctx.fillRect(pos.x, pos.y, handleSize, handleSize);
        ctx.strokeRect(pos.x, pos.y, handleSize, handleSize);
      }
    }
  }

  /**
   * Get the position of a resize handle.
   */
  private getHandlePosition(handle: ResizeHandle, handleSize: number): Point {
    const { width, height } = this._size;
    const half = handleSize / 2;

    switch (handle) {
      case 'nw':
        return { x: -half, y: -half };
      case 'n':
        return { x: width / 2 - half, y: -half };
      case 'ne':
        return { x: width - half, y: -half };
      case 'e':
        return { x: width - half, y: height / 2 - half };
      case 'se':
        return { x: width - half, y: height - half };
      case 's':
        return { x: width / 2 - half, y: height - half };
      case 'sw':
        return { x: -half, y: height - half };
      case 'w':
        return { x: -half, y: height / 2 - half };
    }
  }

  /**
   * Get which resize handle (if any) is at the given point.
   * @param point The point to test (relative to object position)
   * @param handleSize Size of the handle hit area
   */
  getResizeHandleAtPoint(point: Point, handleSize: number = 12): ResizeHandle | null {
    if (!this.resizable) {
      return null;
    }

    const handles = this.getResizeHandles();
    const half = handleSize / 2;

    for (const handle of handles) {
      const pos = this.getHandlePosition(handle, handleSize);
      if (
        point.x >= pos.x - half &&
        point.x <= pos.x + handleSize + half &&
        point.y >= pos.y - half &&
        point.y <= pos.y + handleSize + half
      ) {
        return handle;
      }
    }

    return null;
  }
}
