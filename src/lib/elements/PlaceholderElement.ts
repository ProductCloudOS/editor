import { BaseElement } from './BaseElement';
import { ElementData, PlaceholderElementData } from '../types';

export class PlaceholderElement extends BaseElement {
  private placeholderData: PlaceholderElementData;

  constructor(data: ElementData) {
    super(data);
    this.placeholderData = data.data as PlaceholderElementData;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply transformations
    ctx.translate(this._position.x + this._size.width / 2, this._position.y + this._size.height / 2);
    ctx.rotate((this._rotation * Math.PI) / 180);
    ctx.translate(-this._size.width / 2, -this._size.height / 2);
    ctx.globalAlpha = this._opacity;

    // Draw placeholder background
    ctx.fillStyle = '#e8f4fd';
    ctx.fillRect(0, 0, this._size.width, this._size.height);

    // Draw placeholder border
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(0, 0, this._size.width, this._size.height);
    ctx.setLineDash([]);

    // Draw placeholder text
    ctx.fillStyle = '#2196f3';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const displayText = this.placeholderData.displayText || `{{${this.placeholderData.key}}}`;
    ctx.fillText(displayText, this._size.width / 2, this._size.height / 2);

    // Draw key label at top
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.placeholderData.key, 5, 5);

    // Draw selection border if selected
    if (this._selected) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(-2, -2, this._size.width + 4, this._size.height + 4);
    }

    ctx.restore();
  }

  toData(): ElementData {
    return {
      id: this._id,
      type: 'placeholder',
      position: this.position,
      size: this.size,
      rotation: this._rotation,
      opacity: this._opacity,
      zIndex: this._zIndex,
      locked: this._locked,
      data: { ...this.placeholderData }
    };
  }

  clone(): PlaceholderElement {
    return new PlaceholderElement({
      ...this.toData(),
      id: `${this._id}_copy_${Date.now()}`
    });
  }

  updatePlaceholderData(data: Partial<PlaceholderElementData>): void {
    this.placeholderData = { ...this.placeholderData, ...data };
    this.emit('change', { property: 'data', value: this.placeholderData });
  }

  getKey(): string {
    return this.placeholderData.key;
  }

  getDefaultValue(): string | number | undefined {
    return this.placeholderData.defaultValue;
  }
}