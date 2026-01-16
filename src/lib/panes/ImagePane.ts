/**
 * ImagePane - Edit image properties.
 *
 * Shows:
 * - Position (inline, block, relative)
 * - Relative offset (for relative positioning)
 * - Fit mode (contain, cover, fill, none, tile)
 * - Resize mode (free, locked-aspect-ratio)
 * - Alt text
 * - Source file picker
 *
 * Uses the PCEditor public API:
 * - editor.getSelectedImage()
 * - editor.updateImage()
 * - editor.setImageSource()
 */

import { BasePane } from './BasePane';
import type { PaneAttachOptions } from './types';
import type { ImageObject } from '../objects';

/**
 * Options for ImagePane.
 */
export interface ImagePaneOptions {
  className?: string;
  /**
   * Maximum width for auto-sizing when setting image source.
   */
  maxImageWidth?: number;
  /**
   * Maximum height for auto-sizing when setting image source.
   */
  maxImageHeight?: number;
  /**
   * Callback when image changes are applied.
   */
  onApply?: (success: boolean, error?: Error) => void;
}

export class ImagePane extends BasePane {
  private positionSelect: HTMLSelectElement | null = null;
  private offsetGroup: HTMLElement | null = null;
  private offsetXInput: HTMLInputElement | null = null;
  private offsetYInput: HTMLInputElement | null = null;
  private fitModeSelect: HTMLSelectElement | null = null;
  private resizeModeSelect: HTMLSelectElement | null = null;
  private altTextInput: HTMLInputElement | null = null;
  private fileInput: HTMLInputElement | null = null;

  private currentImage: ImageObject | null = null;
  private maxImageWidth: number;
  private maxImageHeight: number;
  private onApplyCallback?: (success: boolean, error?: Error) => void;

  constructor(id: string = 'image', options: ImagePaneOptions = {}) {
    super(id, { className: 'pc-pane-image', ...options });
    this.maxImageWidth = options.maxImageWidth ?? 400;
    this.maxImageHeight = options.maxImageHeight ?? 400;
    this.onApplyCallback = options.onApply;
  }

  attach(options: PaneAttachOptions): void {
    super.attach(options);

    if (this.editor) {
      // Listen for selection changes
      const updateHandler = () => this.updateFromSelection();
      this.editor.on('selection-change', updateHandler);
      this.editor.on('image-updated', updateHandler);

      this.eventCleanup.push(() => {
        this.editor?.off('selection-change', updateHandler);
        this.editor?.off('image-updated', updateHandler);
      });

      // Initial update
      this.updateFromSelection();
    }
  }

  protected createContent(): HTMLElement {
    const container = document.createElement('div');

    // Position section
    const positionSection = this.createSection('Position');
    this.positionSelect = this.createSelect([
      { value: 'inline', label: 'Inline' },
      { value: 'block', label: 'Block' },
      { value: 'relative', label: 'Relative' }
    ], 'inline');
    this.addImmediateApplyListener(this.positionSelect, () => this.updateOffsetVisibility());
    positionSection.appendChild(this.createFormGroup('Type', this.positionSelect));

    // Offset group (only visible for relative positioning)
    this.offsetGroup = document.createElement('div');
    this.offsetGroup.style.display = 'none';
    const offsetRow = this.createRow();
    this.offsetXInput = this.createNumberInput({ value: 0 });
    this.offsetYInput = this.createNumberInput({ value: 0 });
    offsetRow.appendChild(this.createFormGroup('X', this.offsetXInput, { inline: true }));
    offsetRow.appendChild(this.createFormGroup('Y', this.offsetYInput, { inline: true }));
    this.offsetGroup.appendChild(offsetRow);
    positionSection.appendChild(this.offsetGroup);
    container.appendChild(positionSection);

    // Fit mode section
    const fitSection = this.createSection('Display');
    this.fitModeSelect = this.createSelect([
      { value: 'contain', label: 'Contain' },
      { value: 'cover', label: 'Cover' },
      { value: 'fill', label: 'Fill' },
      { value: 'none', label: 'None (original size)' },
      { value: 'tile', label: 'Tile' }
    ], 'contain');
    fitSection.appendChild(this.createFormGroup('Fit Mode', this.fitModeSelect));

    this.resizeModeSelect = this.createSelect([
      { value: 'locked-aspect-ratio', label: 'Lock Aspect Ratio' },
      { value: 'free', label: 'Free Resize' }
    ], 'locked-aspect-ratio');
    fitSection.appendChild(this.createFormGroup('Resize Mode', this.resizeModeSelect));
    container.appendChild(fitSection);

    // Alt text section
    const altSection = this.createSection('Accessibility');
    this.altTextInput = this.createTextInput({ placeholder: 'Description of the image' });
    altSection.appendChild(this.createFormGroup('Alt Text', this.altTextInput));
    container.appendChild(altSection);

    // Source section
    const sourceSection = this.createSection('Source');
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', (e) => this.handleFileChange(e));
    sourceSection.appendChild(this.fileInput);

    const changeSourceBtn = this.createButton('Change Image...');
    this.addButtonListener(changeSourceBtn, () => this.fileInput?.click());
    sourceSection.appendChild(changeSourceBtn);
    container.appendChild(sourceSection);

    // Apply button
    const applyBtn = this.createButton('Apply Changes', { variant: 'primary' });
    this.addButtonListener(applyBtn, () => this.applyChanges());
    container.appendChild(applyBtn);

    return container;
  }

  private updateFromSelection(): void {
    if (!this.editor) return;

    const image = this.editor.getSelectedImage?.();

    if (image) {
      this.showImage(image);
    } else {
      this.hideImage();
    }
  }

  /**
   * Show the pane with the given image.
   */
  showImage(image: ImageObject): void {
    this.currentImage = image;

    // Populate position
    if (this.positionSelect) {
      this.positionSelect.value = image.position || 'inline';
    }
    this.updateOffsetVisibility();

    // Populate offset
    if (this.offsetXInput) {
      this.offsetXInput.value = String(image.relativeOffset?.x ?? 0);
    }
    if (this.offsetYInput) {
      this.offsetYInput.value = String(image.relativeOffset?.y ?? 0);
    }

    // Populate fit mode
    if (this.fitModeSelect) {
      this.fitModeSelect.value = image.fit || 'contain';
    }

    // Populate resize mode
    if (this.resizeModeSelect) {
      this.resizeModeSelect.value = image.resizeMode || 'locked-aspect-ratio';
    }

    // Populate alt text
    if (this.altTextInput) {
      this.altTextInput.value = image.alt || '';
    }

    this.show();
  }

  /**
   * Hide the pane and clear current image.
   */
  hideImage(): void {
    this.currentImage = null;
    this.hide();
  }

  private updateOffsetVisibility(): void {
    if (this.offsetGroup && this.positionSelect) {
      this.offsetGroup.style.display = this.positionSelect.value === 'relative' ? 'block' : 'none';
    }
  }

  private handleFileChange(event: Event): void {
    if (!this.editor || !this.currentImage) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl && this.currentImage && this.editor) {
        this.editor.setImageSource(this.currentImage.id, dataUrl, {
          maxWidth: this.maxImageWidth,
          maxHeight: this.maxImageHeight
        });
      }
    };
    reader.readAsDataURL(file);

    // Reset file input so the same file can be selected again
    input.value = '';
  }

  private applyChanges(): void {
    if (!this.editor || !this.currentImage) {
      this.onApplyCallback?.(false, new Error('No image selected'));
      return;
    }

    const updates: Parameters<typeof this.editor.updateImage>[1] = {};

    // Position
    if (this.positionSelect) {
      updates.position = this.positionSelect.value as 'inline' | 'block' | 'relative';
    }

    // Relative offset
    if (this.positionSelect?.value === 'relative') {
      updates.relativeOffset = {
        x: parseInt(this.offsetXInput?.value || '0', 10),
        y: parseInt(this.offsetYInput?.value || '0', 10)
      };
    }

    // Fit mode
    if (this.fitModeSelect) {
      updates.fit = this.fitModeSelect.value as 'contain' | 'cover' | 'fill' | 'none' | 'tile';
    }

    // Resize mode
    if (this.resizeModeSelect) {
      updates.resizeMode = this.resizeModeSelect.value as 'free' | 'locked-aspect-ratio';
    }

    // Alt text
    if (this.altTextInput) {
      updates.alt = this.altTextInput.value;
    }

    try {
      const success = this.editor.updateImage(this.currentImage.id, updates);
      if (success) {
        this.onApplyCallback?.(true);
      } else {
        this.onApplyCallback?.(false, new Error('Failed to update image'));
      }
    } catch (error) {
      this.onApplyCallback?.(false, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get the currently selected image.
   */
  getCurrentImage(): ImageObject | null {
    return this.currentImage;
  }

  /**
   * Check if an image is currently selected.
   */
  hasImage(): boolean {
    return this.currentImage !== null;
  }

  /**
   * Update the pane from current editor state.
   */
  update(): void {
    this.updateFromSelection();
  }
}
