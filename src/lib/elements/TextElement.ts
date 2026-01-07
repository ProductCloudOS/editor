import { BaseElement } from './BaseElement';
import { ElementData, TextElementData } from '../types';

export class TextElement extends BaseElement {
  private textData: TextElementData;

  constructor(data: ElementData) {
    super(data);
    this.textData = data.data as TextElementData;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply transformations
    ctx.translate(this._position.x + this._size.width / 2, this._position.y + this._size.height / 2);
    ctx.rotate((this._rotation * Math.PI) / 180);
    ctx.translate(-this._size.width / 2, -this._size.height / 2);
    ctx.globalAlpha = this._opacity;

    // Text setup first to calculate height
    ctx.font = `${this.textData.fontStyle || ''} ${this.textData.fontWeight || ''} ${this.textData.fontSize}px ${this.textData.fontFamily}`.trim();
    ctx.textAlign = (this.textData.textAlign || 'left') as CanvasTextAlign;
    ctx.textBaseline = 'top';

    // Calculate padding and text metrics
    const padding = this.textData.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    const maxWidth = this._size.width - padding.left - padding.right;
    const lines = this.wrapText(ctx, this.textData.content, maxWidth);
    const lineHeight = this.textData.fontSize * (this.textData.lineHeight || 1.2);
    
    // Auto-adjust height based on text content
    const requiredHeight = padding.top + (lines.length * lineHeight) + padding.bottom;
    if (Math.abs(requiredHeight - this._size.height) > 1) {
      this._size.height = requiredHeight;
      this.emit('change', { property: 'size', value: this._size });
    }

    // Background
    if (this.textData.backgroundColor) {
      ctx.fillStyle = this.textData.backgroundColor;
      ctx.fillRect(0, 0, this._size.width, this._size.height);
    }

    // Render text
    ctx.fillStyle = this.textData.color || '#000000';
    const textY = padding.top;

    lines.forEach((line, index) => {
      const y = textY + index * lineHeight;
      
      // Adjust x position based on text alignment
      let x = padding.left;
      if (this.textData.textAlign === 'center') {
        x = this._size.width / 2;
      } else if (this.textData.textAlign === 'right') {
        x = this._size.width - padding.right;
      }
      
      ctx.fillText(line, x, y, maxWidth);
    });

    // Draw selection border if selected
    if (this._selected) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(-2, -2, this._size.width + 4, this._size.height + 4);
    }

    ctx.restore();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    if (maxWidth <= 0) return [text];
    
    // Handle explicit line breaks
    const paragraphs = text.split('\n');
    const lines: string[] = [];
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }
      
      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines.length > 0 ? lines : [text];
  }

  toData(): ElementData {
    return {
      id: this._id,
      type: 'text',
      position: this.position,
      size: this.size,
      rotation: this._rotation,
      opacity: this._opacity,
      zIndex: this._zIndex,
      locked: this._locked,
      data: { ...this.textData }
    };
  }

  clone(): TextElement {
    return new TextElement({
      ...this.toData(),
      id: `${this._id}_copy_${Date.now()}`
    });
  }

  updateTextData(data: Partial<TextElementData>): void {
    this.textData = { ...this.textData, ...data };
    this.emit('change', { property: 'data', value: this.textData });
  }
}