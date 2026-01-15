import { BaseEmbeddedObject } from './BaseEmbeddedObject';
import {
  ImageObjectConfig,
  EmbeddedObjectData,
  ImageFitMode,
  ImageResizeMode,
  Size
} from './types';

/**
 * Image object - displays an image within text flow.
 */
export class ImageObject extends BaseEmbeddedObject {
  private _src: string;
  private _image: HTMLImageElement | null = null;
  private _fit: ImageFitMode;
  private _resizeMode: ImageResizeMode;
  private _alt: string;
  private _loaded: boolean = false;
  private _error: boolean = false;

  constructor(config: ImageObjectConfig) {
    super(config);
    this._src = config.src;
    this._fit = config.fit || 'contain';
    this._resizeMode = config.resizeMode || 'locked-aspect-ratio';
    this._alt = config.alt || '';
    this.loadImage();
  }

  get objectType(): string {
    return 'image';
  }

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    if (this._src !== value) {
      this._src = value;
      this._loaded = false;
      this._error = false;
      this.loadImage();
    }
  }

  get fit(): ImageFitMode {
    return this._fit;
  }

  set fit(value: ImageFitMode) {
    this._fit = value;
    this.emit('fit-changed', { fit: value });
  }

  get resizeMode(): ImageResizeMode {
    return this._resizeMode;
  }

  set resizeMode(value: ImageResizeMode) {
    this._resizeMode = value;
    this.emit('resize-mode-changed', { resizeMode: value });
  }

  get alt(): string {
    return this._alt;
  }

  set alt(value: string) {
    this._alt = value;
  }

  get loaded(): boolean {
    return this._loaded;
  }

  get hasError(): boolean {
    return this._error;
  }

  private loadImage(): void {
    if (!this._src) {
      this._error = true;
      return;
    }

    this._image = new Image();
    this._image.onload = () => {
      this._loaded = true;
      this._error = false;
      this.emit('image-loaded', { src: this._src });
    };
    this._image.onerror = () => {
      this._loaded = false;
      this._error = true;
      this.emit('image-error', { src: this._src });
    };
    this._image.src = this._src;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this._loaded && this._image) {
      this.drawImage(ctx);
    } else if (this._error) {
      this.drawErrorPlaceholder(ctx);
    } else {
      this.drawLoadingPlaceholder(ctx);
    }

    if (this._selected) {
      this.renderSelectionBorder(ctx);
    }
  }

  private drawImage(ctx: CanvasRenderingContext2D): void {
    if (!this._image) return;

    const { width, height } = this._size;
    const imgWidth = this._image.naturalWidth;
    const imgHeight = this._image.naturalHeight;

    let sx = 0, sy = 0, sw = imgWidth, sh = imgHeight;
    let dx = 0, dy = 0, dw = width, dh = height;
    let needsClipping = false;

    switch (this._fit) {
      case 'fill':
        // Stretch to fill
        break;

      case 'contain': {
        // Fit within bounds, maintaining aspect ratio
        const scale = Math.min(width / imgWidth, height / imgHeight);
        dw = imgWidth * scale;
        dh = imgHeight * scale;
        dx = (width - dw) / 2;
        dy = (height - dh) / 2;
        break;
      }

      case 'cover': {
        // Cover bounds, maintaining aspect ratio (may crop)
        const scale = Math.max(width / imgWidth, height / imgHeight);
        sw = width / scale;
        sh = height / scale;
        sx = (imgWidth - sw) / 2;
        sy = (imgHeight - sh) / 2;
        break;
      }

      case 'none':
        // Original size, centered - clip to box bounds if image is larger
        dw = imgWidth;
        dh = imgHeight;
        dx = (width - imgWidth) / 2;
        dy = (height - imgHeight) / 2;
        // Need clipping if image extends beyond bounds
        if (imgWidth > width || imgHeight > height) {
          needsClipping = true;
        }
        break;

      case 'tile':
        // Tile the image to fill bounds
        this.drawTiledImage(ctx, width, height);
        return; // Early return, tiling handles its own drawing
    }

    if (needsClipping) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
    }

    ctx.drawImage(this._image, sx, sy, sw, sh, dx, dy, dw, dh);

    if (needsClipping) {
      ctx.restore();
    }
  }

  private drawTiledImage(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this._image) return;

    const imgWidth = this._image.naturalWidth;
    const imgHeight = this._image.naturalHeight;

    // Tile the image across the bounds
    for (let y = 0; y < height; y += imgHeight) {
      for (let x = 0; x < width; x += imgWidth) {
        // Calculate the portion of the image to draw (may be clipped at edges)
        const drawWidth = Math.min(imgWidth, width - x);
        const drawHeight = Math.min(imgHeight, height - y);

        ctx.drawImage(
          this._image,
          0, 0, drawWidth, drawHeight,  // Source region
          x, y, drawWidth, drawHeight   // Destination region
        );
      }
    }
  }

  private drawLoadingPlaceholder(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this._size;

    // Draw placeholder background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // Draw border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Draw loading text
    ctx.fillStyle = '#888888';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Loading...', width / 2, height / 2);
  }

  private drawErrorPlaceholder(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this._size;

    // Draw placeholder background
    ctx.fillStyle = '#fff0f0';
    ctx.fillRect(0, 0, width, height);

    // Draw border
    ctx.strokeStyle = '#ffcccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Draw X
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.3, height * 0.3);
    ctx.lineTo(width * 0.7, height * 0.7);
    ctx.moveTo(width * 0.7, height * 0.3);
    ctx.lineTo(width * 0.3, height * 0.7);
    ctx.stroke();

    // Draw error text if space allows
    if (height > 40) {
      ctx.fillStyle = '#cc0000';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Image failed', width / 2, height - 5);
    }
  }

  toData(): EmbeddedObjectData {
    return {
      id: this._id,
      objectType: 'image',
      textIndex: this._textIndex,
      position: this._position,
      size: { ...this._size },
      relativeOffset: this._position === 'relative' ? { ...this._relativeOffset } : undefined,
      data: {
        src: this._src,
        fit: this._fit,
        resizeMode: this._resizeMode,
        alt: this._alt,
        naturalWidth: this._image?.naturalWidth,
        naturalHeight: this._image?.naturalHeight
      }
    };
  }

  /**
   * Restore the image state from serialized data.
   * Used for undo/redo operations.
   */
  restoreFromData(data: EmbeddedObjectData): void {
    // Restore size
    this._size = { ...data.size };

    // Restore position mode
    if (data.position) {
      this._position = data.position;
    }

    // Restore relative offset
    if (data.relativeOffset) {
      this._relativeOffset = { ...data.relativeOffset };
    }

    // Restore image specific data
    const imageData = data.data as {
      src?: string;
      fit?: ImageFitMode;
      resizeMode?: ImageResizeMode;
      alt?: string;
    };

    if (imageData) {
      // Only reload image if source changed
      const srcChanged = imageData.src !== undefined && imageData.src !== this._src;

      if (imageData.fit !== undefined) this._fit = imageData.fit;
      if (imageData.resizeMode !== undefined) this._resizeMode = imageData.resizeMode;
      if (imageData.alt !== undefined) this._alt = imageData.alt;

      if (srcChanged) {
        // Reload the image with new source
        this.setSource(imageData.src!);
      }
    }

    this.emit('state-restored', { data });
  }

  clone(): ImageObject {
    return new ImageObject({
      id: `${this._id}-clone-${Date.now()}`,
      textIndex: this._textIndex,
      position: this._position,
      size: { ...this._size },
      relativeOffset: this._position === 'relative' ? { ...this._relativeOffset } : undefined,
      src: this._src,
      fit: this._fit,
      resizeMode: this._resizeMode,
      alt: this._alt
    });
  }

  /**
   * Set a new image source (URL or base64 data URI).
   * Optionally auto-resize to fit within max dimensions.
   */
  setSource(src: string, options?: { maxWidth?: number; maxHeight?: number }): void {
    this._src = src;
    this._loaded = false;
    this._error = false;
    this._image = new Image();

    this._image.onload = () => {
      this._loaded = true;
      this._error = false;

      // Auto-resize if max dimensions provided
      if (options?.maxWidth !== undefined || options?.maxHeight !== undefined) {
        const natural = this.getNaturalSize();
        if (natural) {
          const maxW = options.maxWidth ?? natural.width;
          const maxH = options.maxHeight ?? natural.height;
          const scale = Math.min(maxW / natural.width, maxH / natural.height, 1);
          this.size = {
            width: natural.width * scale,
            height: natural.height * scale
          };
        }
      }

      this.emit('image-loaded', { src: this._src });
    };

    this._image.onerror = () => {
      this._loaded = false;
      this._error = true;
      this.emit('image-error', { src: this._src });
    };

    this._image.src = src;
  }

  /**
   * Get the natural dimensions of the loaded image.
   */
  getNaturalSize(): Size | null {
    if (this._loaded && this._image) {
      return {
        width: this._image.naturalWidth,
        height: this._image.naturalHeight
      };
    }
    return null;
  }

  /**
   * Resize to fit the natural image dimensions.
   */
  resizeToNatural(): void {
    const natural = this.getNaturalSize();
    if (natural) {
      this.size = natural;
    }
  }

  /**
   * Resize to fit within max dimensions while maintaining aspect ratio.
   */
  resizeToFit(maxWidth: number, maxHeight: number): void {
    const natural = this.getNaturalSize();
    if (!natural) return;

    const scale = Math.min(
      maxWidth / natural.width,
      maxHeight / natural.height,
      1 // Don't scale up
    );

    this.size = {
      width: natural.width * scale,
      height: natural.height * scale
    };
  }
}
