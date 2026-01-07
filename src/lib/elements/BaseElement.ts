import { ElementData, Point, Size, Rect } from '../types';
import { EventEmitter } from '../events/EventEmitter';

export abstract class BaseElement extends EventEmitter {
  protected _id: string;
  protected _position: Point;
  protected _size: Size;
  protected _rotation: number;
  protected _opacity: number;
  protected _zIndex: number;
  protected _locked: boolean;
  protected _selected: boolean = false;

  constructor(data: ElementData) {
    super();
    this._id = data.id;
    this._position = { ...data.position };
    this._size = { ...data.size };
    this._rotation = data.rotation || 0;
    this._opacity = data.opacity ?? 1;
    this._zIndex = data.zIndex || 0;
    this._locked = data.locked || false;
  }

  get id(): string {
    return this._id;
  }

  get position(): Point {
    return { ...this._position };
  }

  set position(value: Point) {
    this._position = { ...value };
    this.emit('change', { property: 'position', value });
  }

  get size(): Size {
    return { ...this._size };
  }

  set size(value: Size) {
    this._size = { ...value };
    this.emit('change', { property: 'size', value });
  }

  get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    this._rotation = value;
    this.emit('change', { property: 'rotation', value });
  }

  get opacity(): number {
    return this._opacity;
  }

  set opacity(value: number) {
    this._opacity = Math.max(0, Math.min(1, value));
    this.emit('change', { property: 'opacity', value: this._opacity });
  }

  get zIndex(): number {
    return this._zIndex;
  }

  set zIndex(value: number) {
    this._zIndex = value;
    this.emit('change', { property: 'zIndex', value });
  }

  get locked(): boolean {
    return this._locked;
  }

  set locked(value: boolean) {
    this._locked = value;
    this.emit('change', { property: 'locked', value });
  }

  get selected(): boolean {
    return this._selected;
  }

  set selected(value: boolean) {
    this._selected = value;
    this.emit('selection-change', { selected: value });
  }

  getBounds(): Rect {
    return {
      x: this._position.x,
      y: this._position.y,
      width: this._size.width,
      height: this._size.height
    };
  }

  containsPoint(point: Point): boolean {
    const bounds = this.getBounds();
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }

  move(deltaX: number, deltaY: number): void {
    this.position = {
      x: this._position.x + deltaX,
      y: this._position.y + deltaY
    };
  }

  resize(newSize: Size): void {
    this.size = newSize;
  }

  abstract render(ctx: CanvasRenderingContext2D): void;
  abstract toData(): ElementData;
  abstract clone(): BaseElement;
}