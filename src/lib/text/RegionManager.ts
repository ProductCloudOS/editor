import { Point } from '../types';
import { EditableTextRegion } from './EditableTextRegion';

/**
 * Manages all editable text regions in the document.
 * Provides unified access to body, header, footer, and text box regions.
 */
export class RegionManager {
  private _bodyRegion: EditableTextRegion | null = null;
  private _headerRegion: EditableTextRegion | null = null;
  private _footerRegion: EditableTextRegion | null = null;
  private _textBoxRegions: Map<string, EditableTextRegion> = new Map();

  /**
   * Set the body text region.
   */
  setBodyRegion(region: EditableTextRegion): void {
    this._bodyRegion = region;
  }

  /**
   * Get the body text region.
   */
  getBodyRegion(): EditableTextRegion | null {
    return this._bodyRegion;
  }

  /**
   * Set the header text region.
   */
  setHeaderRegion(region: EditableTextRegion): void {
    this._headerRegion = region;
  }

  /**
   * Get the header text region.
   */
  getHeaderRegion(): EditableTextRegion | null {
    return this._headerRegion;
  }

  /**
   * Set the footer text region.
   */
  setFooterRegion(region: EditableTextRegion): void {
    this._footerRegion = region;
  }

  /**
   * Get the footer text region.
   */
  getFooterRegion(): EditableTextRegion | null {
    return this._footerRegion;
  }

  /**
   * Register a text box region.
   */
  registerTextBox(region: EditableTextRegion): void {
    this._textBoxRegions.set(region.id, region);
  }

  /**
   * Unregister a text box region.
   */
  unregisterTextBox(id: string): void {
    this._textBoxRegions.delete(id);
  }

  /**
   * Get a text box region by ID.
   */
  getTextBoxRegion(id: string): EditableTextRegion | null {
    return this._textBoxRegions.get(id) || null;
  }

  /**
   * Get all text box regions.
   */
  getAllTextBoxRegions(): EditableTextRegion[] {
    return Array.from(this._textBoxRegions.values());
  }

  /**
   * Get all regions (body, header, footer, and all text boxes).
   */
  getAllRegions(): EditableTextRegion[] {
    const regions: EditableTextRegion[] = [];

    if (this._bodyRegion) regions.push(this._bodyRegion);
    if (this._headerRegion) regions.push(this._headerRegion);
    if (this._footerRegion) regions.push(this._footerRegion);

    for (const textBox of this._textBoxRegions.values()) {
      regions.push(textBox);
    }

    return regions;
  }

  /**
   * Find the region at a given point.
   * Text boxes are checked first (they're on top), then header/footer, then body.
   *
   * @param point Point in canvas coordinates
   * @param pageIndex The page index
   * @returns The region containing the point, or null if none
   */
  getRegionAtPoint(point: Point, pageIndex: number): EditableTextRegion | null {
    // Check text boxes first (they're rendered on top)
    for (const textBox of this._textBoxRegions.values()) {
      if (textBox.containsPointInRegion(point, pageIndex)) {
        return textBox;
      }
    }

    // Check header
    if (this._headerRegion && this._headerRegion.containsPointInRegion(point, pageIndex)) {
      return this._headerRegion;
    }

    // Check footer
    if (this._footerRegion && this._footerRegion.containsPointInRegion(point, pageIndex)) {
      return this._footerRegion;
    }

    // Check body
    if (this._bodyRegion && this._bodyRegion.containsPointInRegion(point, pageIndex)) {
      return this._bodyRegion;
    }

    return null;
  }

  /**
   * Find the region that contains a specific FlowingTextContent.
   * Useful for routing keyboard events.
   */
  findRegionByFlowingContent(flowingContent: any): EditableTextRegion | null {
    if (this._bodyRegion && this._bodyRegion.flowingContent === flowingContent) {
      return this._bodyRegion;
    }
    if (this._headerRegion && this._headerRegion.flowingContent === flowingContent) {
      return this._headerRegion;
    }
    if (this._footerRegion && this._footerRegion.flowingContent === flowingContent) {
      return this._footerRegion;
    }

    for (const textBox of this._textBoxRegions.values()) {
      if (textBox.flowingContent === flowingContent) {
        return textBox;
      }
    }

    return null;
  }

  /**
   * Clear all regions.
   */
  clear(): void {
    this._bodyRegion = null;
    this._headerRegion = null;
    this._footerRegion = null;
    this._textBoxRegions.clear();
  }
}
