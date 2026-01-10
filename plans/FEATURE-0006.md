# FEATURE-0006: Enhanced Image Object - Implementation Plan

## Status: ✅ COMPLETE

## Overview

Implement the image object properly so that:
1. Image data is passed in when the image is created (the client is responsible for getting the data)
2. A formatting pane (like the text box pane) is created supporting:
   - How the image resizes (freely, locked aspect ratio, tiled)
   - Option to change the image

## Current State Analysis

### Existing ImageObject (`src/lib/objects/ImageObject.ts`)

The current `ImageObject` already has:
- Basic image loading from a `src` URL/data URI
- Support for `ImageFitMode`: `'contain' | 'cover' | 'fill' | 'none'`
- Rendering to canvas with proper fit mode calculations
- Serialization via `toData()`
- Loading/error placeholder states
- Natural size retrieval and resize-to-fit utilities

### Key Gaps

1. **Resize Mode**: Current `fit` modes control how the image displays *within* its bounding box, but don't address how the bounding box itself resizes:
   - **Free resize**: User can resize width/height independently (aspect ratio not preserved)
   - **Locked aspect ratio**: Resizing preserves the original image aspect ratio

2. **Tiled Mode**: Image repeating within the bounding box is not currently supported

3. **Image Insertion**: No file picker or user-provided image data mechanism exists - images are inserted with hardcoded placeholders

4. **Image Pane**: No formatting pane for images (unlike text boxes and tables)

5. **PDF Export**: Current implementation has a TODO placeholder for actual image embedding

## Implementation Phases

### Phase 1: Type Definitions

**File: `src/lib/objects/types.ts`**

Add new types:

```typescript
/**
 * How the image element resizes when the user drags resize handles.
 * - free: Width and height can be changed independently
 * - locked-aspect-ratio: Resizing preserves the original aspect ratio
 */
export type ImageResizeMode = 'free' | 'locked-aspect-ratio';

/**
 * How the image content displays when the element size doesn't match the natural image size.
 * - contain: Fit image within bounds, preserving aspect ratio (letterboxed)
 * - cover: Fill bounds, preserving aspect ratio (may crop)
 * - fill: Stretch to fill (distorts if aspect ratios differ)
 * - none: Original size, centered
 * - tile: Repeat image to fill bounds
 */
export type ImageFitMode = 'contain' | 'cover' | 'fill' | 'none' | 'tile';
```

Update `ImageObjectConfig`:

```typescript
export interface ImageObjectConfig extends EmbeddedObjectConfig {
  src: string;                    // Data URI (base64) or URL
  fit?: ImageFitMode;             // How content displays (default: 'contain')
  resizeMode?: ImageResizeMode;   // How element resizes (default: 'locked-aspect-ratio')
  alt?: string;
  naturalWidth?: number;          // Cached natural dimensions (for serialization)
  naturalHeight?: number;
}
```

### Phase 2: ImageObject Enhancement

**File: `src/lib/objects/ImageObject.ts`**

#### 2.1 Add Resize Mode Support

- Add `_resizeMode` property with getter/setter
- Default to `'locked-aspect-ratio'`

#### 2.2 Add Tiled Rendering

Enhance `drawImage()` to handle `'tile'` fit mode:

```typescript
case 'tile': {
  const pattern = ctx.createPattern(this._image, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
  break;
}
```

#### 2.3 Override Resize Method

Override `resize()` to respect `resizeMode`:

```typescript
resize(newSize: Size, handle?: ResizeHandle): void {
  if (this._resizeMode === 'locked-aspect-ratio' && this._loaded) {
    const natural = this.getNaturalSize();
    if (natural) {
      const aspectRatio = natural.width / natural.height;
      // Calculate constrained size based on which handle was dragged
    }
  }
  super.resize(newSize);
}
```

#### 2.4 Add Method to Change Image Source

```typescript
setSource(src: string): Promise<void> {
  this._src = src;
  this._loaded = false;
  this._error = false;
  return this.loadImage();
}
```

#### 2.5 Update Serialization

```typescript
toData(): EmbeddedObjectData {
  const natural = this.getNaturalSize();
  return {
    ...
    data: {
      src: this._src,
      fit: this._fit,
      resizeMode: this._resizeMode,
      alt: this._alt,
      naturalWidth: natural?.width,
      naturalHeight: natural?.height
    }
  };
}
```

### Phase 3: EmbeddedObjectFactory Update

**File: `src/lib/objects/EmbeddedObjectFactory.ts`**

Update the image factory registration to handle new properties:

```typescript
this.register('image', (data) => new ImageObject({
  id: data.id,
  textIndex: data.textIndex,
  position: data.position,
  size: data.size,
  src: data.data.src as string,
  fit: data.data.fit as ImageFitMode | undefined,
  resizeMode: data.data.resizeMode as ImageResizeMode | undefined,
  alt: data.data.alt as string | undefined,
  naturalWidth: data.data.naturalWidth as number | undefined,
  naturalHeight: data.data.naturalHeight as number | undefined
}));
```

### Phase 4: PCEditor API

**File: `src/lib/core/PCEditor.ts`**

Add method to get selected image (following the pattern of `getSelectedTextBox()` and `getSelectedTable()`):

```typescript
getSelectedImage(): ImageObject | null {
  const selectedIds = this.canvasManager.getSelectedElements();
  if (selectedIds.length === 0) return null;

  // Check body, header, footer for selected image
  for (const content of [this.document.bodyFlowingContent,
                         this.document.headerFlowingContent,
                         this.document.footerFlowingContent]) {
    for (const id of selectedIds) {
      const obj = content.getEmbeddedObjectById(id);
      if (obj instanceof ImageObject) {
        return obj;
      }
    }
  }
  return null;
}
```

### Phase 5: Demo Image Pane HTML

**File: `src/demo/index.html`**

Add new collapsible section (following TextBox pane pattern):

```html
<div class="collapsible-section" id="image-section" style="display: none;">
    <button class="collapsible-header expanded" data-target="image-properties">
        <span class="collapsible-icon"></span>
        <span>Image</span>
    </button>
    <div class="collapsible-content" id="image-properties">
        <div class="setting-group">
            <label>Fit Mode:</label>
            <select id="image-fit-mode">
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fill">Stretch</option>
                <option value="tile">Tile</option>
                <option value="none">Original Size</option>
            </select>
        </div>
        <div class="setting-group">
            <label>Resize Behavior:</label>
            <select id="image-resize-mode">
                <option value="locked-aspect-ratio">Lock Aspect Ratio</option>
                <option value="free">Free Resize</option>
            </select>
        </div>
        <div class="setting-group">
            <label>Alt Text:</label>
            <input type="text" id="image-alt-text" placeholder="Image description">
        </div>
        <div class="setting-group">
            <button id="image-change-source">Change Image...</button>
            <input type="file" id="image-file-input" accept="image/*" style="display: none;">
        </div>
        <div class="setting-group">
            <button id="image-reset-size">Reset to Natural Size</button>
        </div>
        <button id="apply-image-changes">Apply Changes</button>
    </div>
</div>
```

### Phase 6: Demo Image Pane Logic

**File: `src/demo/demo.ts`**

#### 6.1 State Variable

```typescript
let currentSelectedImage: ImageObject | null = null;
```

#### 6.2 Update Selection Handler

Update `selection-change` handler to show/hide image pane:

```typescript
const selectedImage = editor.getSelectedImage?.();
if (selectedImage) {
  updateImagePane(selectedImage);
  showImagePane();
} else {
  hideImagePane();
}
```

#### 6.3 Pane Functions

```typescript
function updateImagePane(image: ImageObject): void {
  currentSelectedImage = image;
  (document.getElementById('image-fit-mode') as HTMLSelectElement).value = image.fit;
  (document.getElementById('image-resize-mode') as HTMLSelectElement).value = image.resizeMode;
  (document.getElementById('image-alt-text') as HTMLInputElement).value = image.alt || '';
}

function showImagePane(): void {
  const section = document.getElementById('image-section');
  if (section) section.style.display = 'block';
}

function hideImagePane(): void {
  const section = document.getElementById('image-section');
  if (section) section.style.display = 'none';
  currentSelectedImage = null;
}

function applyImageChanges(): void {
  if (!currentSelectedImage || !editor) return;

  const fitMode = (document.getElementById('image-fit-mode') as HTMLSelectElement).value;
  const resizeMode = (document.getElementById('image-resize-mode') as HTMLSelectElement).value;
  const altText = (document.getElementById('image-alt-text') as HTMLInputElement).value;

  currentSelectedImage.fit = fitMode as ImageFitMode;
  currentSelectedImage.resizeMode = resizeMode as ImageResizeMode;
  currentSelectedImage.alt = altText;

  editor.render();
}
```

#### 6.4 Image Insertion with File Picker

Replace hardcoded image insertion with file picker:

```typescript
function insertEmbeddedImage(): void {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !editor) return;

    const dataUrl = await readFileAsDataUrl(file);
    const dimensions = await getImageDimensions(dataUrl);

    // Scale down if too large
    let width = dimensions.width;
    let height = dimensions.height;
    const maxDimension = 400;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width *= scale;
      height *= scale;
    }

    const imageObject = new ImageObject({
      id: `image_${Date.now()}`,
      textIndex: 0,
      size: { width, height },
      src: dataUrl,
      fit: 'contain',
      resizeMode: 'locked-aspect-ratio',
      alt: file.name
    });

    editor.insertEmbeddedObject(imageObject, 'inline');
  };
  fileInput.click();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(dataUrl: string): Promise<{width: number, height: number}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });
}
```

#### 6.5 Change Image Source Handler

```typescript
document.getElementById('image-change-source')?.addEventListener('click', () => {
  if (!currentSelectedImage) return;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const dataUrl = await readFileAsDataUrl(file);
    await currentSelectedImage!.setSource(dataUrl);
    editor?.render();
  };
  fileInput.click();
});
```

### Phase 7: PDF Export Implementation

**File: `src/lib/rendering/PDFGenerator.ts`**

Replace the placeholder `renderImage()` method:

```typescript
private async renderImage(
  pdfPage: PDFPage,
  image: ImageObject,
  x: number,
  y: number,
  pageHeight: number
): Promise<void> {
  const src = image.src;

  if (!src) {
    this.renderImagePlaceholder(pdfPage, x, y, image.width, image.height, pageHeight);
    return;
  }

  try {
    const pdfDoc = pdfPage.doc;
    let embeddedImage;

    // pdf-lib supports PNG and JPEG
    if (src.startsWith('data:image/png')) {
      const base64Data = src.split(',')[1];
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) {
      const base64Data = src.split(',')[1];
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      // Unsupported format - render placeholder
      this.renderImagePlaceholder(pdfPage, x, y, image.width, image.height, pageHeight);
      return;
    }

    // Calculate draw dimensions based on fit mode
    const drawParams = this.calculateImageDrawParams(image, embeddedImage);

    // Handle tiled mode specially
    if (image.fit === 'tile') {
      await this.renderTiledImage(pdfPage, embeddedImage, x, y, image.width, image.height, pageHeight);
    } else {
      const pdfY = pageHeight - y - drawParams.dy - drawParams.dh;
      pdfPage.drawImage(embeddedImage, {
        x: x + drawParams.dx,
        y: pdfY,
        width: drawParams.dw,
        height: drawParams.dh
      });
    }
  } catch (error) {
    console.warn('[PDFGenerator] Failed to embed image:', error);
    this.renderImagePlaceholder(pdfPage, x, y, image.width, image.height, pageHeight);
  }
}

private renderImagePlaceholder(
  pdfPage: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  pageHeight: number
): void {
  const pdfY = pageHeight - y - height;
  pdfPage.drawRectangle({
    x, y: pdfY, width, height,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1
  });
}

private async renderTiledImage(
  pdfPage: PDFPage,
  embeddedImage: PDFImage,
  x: number,
  y: number,
  width: number,
  height: number,
  pageHeight: number
): Promise<void> {
  const imgWidth = embeddedImage.width;
  const imgHeight = embeddedImage.height;

  for (let ty = 0; ty < height; ty += imgHeight) {
    for (let tx = 0; tx < width; tx += imgWidth) {
      const drawWidth = Math.min(imgWidth, width - tx);
      const drawHeight = Math.min(imgHeight, height - ty);
      const pdfY = pageHeight - y - ty - drawHeight;

      pdfPage.drawImage(embeddedImage, {
        x: x + tx,
        y: pdfY,
        width: drawWidth,
        height: drawHeight
      });
    }
  }
}
```

## Image Data Storage Strategy

**Recommendation: Base64 Data URI**

Reasons:
1. **Self-contained**: Document JSON includes all image data, no external dependencies
2. **Serialization**: Works seamlessly with JSON save/load
3. **Browser compatibility**: Works with canvas `drawImage()` and pdf-lib
4. **Existing pattern**: Current code already uses base64 data URIs

Considerations:
- Large images will significantly increase document size
- Could add image compression/resize options for large files in future

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/objects/types.ts` | Add `ImageResizeMode`, update `ImageFitMode` with 'tile', update `ImageObjectConfig` |
| `src/lib/objects/ImageObject.ts` | Add resize mode, tiled rendering, `setSource()`, enhanced serialization |
| `src/lib/objects/EmbeddedObjectFactory.ts` | Update image factory for new properties |
| `src/lib/core/PCEditor.ts` | Add `getSelectedImage()` method |
| `src/lib/rendering/PDFGenerator.ts` | Implement actual image embedding |
| `src/demo/index.html` | Add image formatting pane HTML |
| `src/demo/demo.ts` | Add image pane handlers, file picker integration |

## Testing Checklist

- [ ] Insert image via file picker
- [ ] Image displays correctly with all fit modes (contain, cover, fill, none, tile)
- [ ] Resize with locked aspect ratio works
- [ ] Resize with free mode works
- [ ] Image pane shows when image is selected
- [ ] Change image source via pane
- [ ] Reset to natural size works
- [ ] Alt text can be edited
- [ ] Save/Load preserves image data and settings
- [ ] PDF export embeds images correctly (PNG, JPEG)
- [ ] PDF export handles tiled mode
- [ ] PDF export shows placeholder for unsupported formats

## Edge Cases

1. **Large images**: Consider maximum file size limit or compression
2. **Unsupported formats**: GIF, WebP, SVG - show placeholder or convert
3. **Broken image URLs**: Handle gracefully with placeholder
4. **Aspect ratio edge cases**: Very wide or very tall images
5. **Memory usage**: Large documents with many images
