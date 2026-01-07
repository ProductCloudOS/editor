import { BaseElement } from './BaseElement';
import { ElementData, ImageElementData } from '../types';

export class ImageElement extends BaseElement {
  private imageData: ImageElementData;
  private image: HTMLImageElement | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor(data: ElementData) {
    super(data);
    this.imageData = data.data as ImageElementData;
    this.loadImage();
  }

  private loadImage(): void {
    this.loadPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.emit('loaded');
        resolve();
      };
      img.onerror = (error) => {
        console.error('Failed to load image:', error);
        this.emit('error', { error });
        reject(error);
      };
      img.src = this.imageData.src;
    });
  }

  async waitForLoad(): Promise<void> {
    if (this.loadPromise) {
      await this.loadPromise;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Apply transformations
    ctx.translate(this._position.x + this._size.width / 2, this._position.y + this._size.height / 2);
    ctx.rotate((this._rotation * Math.PI) / 180);
    ctx.translate(-this._size.width / 2, -this._size.height / 2);
    ctx.globalAlpha = this._opacity;

    // Draw placeholder if image not loaded
    if (!this.image || !this.image.complete) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, this._size.width, this._size.height);
      ctx.fillStyle = '#999999';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading...', this._size.width / 2, this._size.height / 2);
    } else {
      // Draw the image with the specified fit mode
      this.drawImageWithFit(ctx);
    }

    // Draw selection border if selected
    if (this._selected) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(-2, -2, this._size.width + 4, this._size.height + 4);
    }

    ctx.restore();
  }

  private drawImageWithFit(ctx: CanvasRenderingContext2D): void {
    if (!this.image) return;

    const imgWidth = this.image.width;
    const imgHeight = this.image.height;
    const boxWidth = this._size.width;
    const boxHeight = this._size.height;

    let sx = 0, sy = 0, sw = imgWidth, sh = imgHeight;
    let dx = 0, dy = 0, dw = boxWidth, dh = boxHeight;

    switch (this.imageData.fit || 'contain') {
      case 'contain': {
        const scale = Math.min(boxWidth / imgWidth, boxHeight / imgHeight);
        dw = imgWidth * scale;
        dh = imgHeight * scale;
        dx = (boxWidth - dw) / 2;
        dy = (boxHeight - dh) / 2;
        break;
      }
      case 'cover': {
        const scale = Math.max(boxWidth / imgWidth, boxHeight / imgHeight);
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        
        if (scaledWidth > boxWidth) {
          const ratio = boxWidth / scaledWidth;
          sw = imgWidth * ratio;
          sx = (imgWidth - sw) / 2;
        }
        if (scaledHeight > boxHeight) {
          const ratio = boxHeight / scaledHeight;
          sh = imgHeight * ratio;
          sy = (imgHeight - sh) / 2;
        }
        break;
      }
      case 'fill':
        // Default values already set - stretch to fill
        break;
      case 'none':
        dx = (boxWidth - imgWidth) / 2;
        dy = (boxHeight - imgHeight) / 2;
        dw = imgWidth;
        dh = imgHeight;
        break;
    }

    ctx.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  toData(): ElementData {
    return {
      id: this._id,
      type: 'image',
      position: this.position,
      size: this.size,
      rotation: this._rotation,
      opacity: this._opacity,
      zIndex: this._zIndex,
      locked: this._locked,
      data: { ...this.imageData }
    };
  }

  clone(): ImageElement {
    return new ImageElement({
      ...this.toData(),
      id: `${this._id}_copy_${Date.now()}`
    });
  }

  updateImageData(data: Partial<ImageElementData>): void {
    this.imageData = { ...this.imageData, ...data };
    if (data.src) {
      this.loadImage();
    }
    this.emit('change', { property: 'data', value: this.imageData });
  }
}