import { Rect } from '../../types';
import { FlowedLine, FlowedPage } from '../types';
import { FlowingTextContent } from '../FlowingTextContent';
import { BaseTextRegion, RegionType } from '../EditableTextRegion';

/**
 * Callback to get footer bounds for a page.
 */
export type FooterBoundsProvider = (pageIndex: number) => {
  getFooterBounds(): { position: { x: number; y: number }; size: { width: number; height: number } };
} | null;

/**
 * Footer text region - handles document footer content.
 * Footer content is shared across all pages but renders at the bottom of each page.
 */
export class FooterTextRegion extends BaseTextRegion {
  readonly id = 'footer';
  readonly type: RegionType = 'footer';

  private _flowingContent: FlowingTextContent;
  private _getPage: FooterBoundsProvider;
  private _flowedPage: FlowedPage | null = null;
  private _availableWidth: number = 0;

  /**
   * Create a footer text region.
   * @param flowingContent The FlowingTextContent for footer text
   * @param getPage Callback to get page footer bounds by index
   */
  constructor(flowingContent: FlowingTextContent, getPage: FooterBoundsProvider) {
    super();
    this._flowingContent = flowingContent;
    this._getPage = getPage;
  }

  get flowingContent(): FlowingTextContent {
    return this._flowingContent;
  }

  /**
   * Get the bounds of the footer area on a specific page.
   * Footer renders at the same position on every page.
   */
  getRegionBounds(pageIndex: number): Rect | null {
    const page = this._getPage(pageIndex);
    if (!page) return null;

    const footerBounds = page.getFooterBounds();
    return {
      x: footerBounds.position.x,
      y: footerBounds.position.y,
      width: footerBounds.size.width,
      height: footerBounds.size.height
    };
  }

  /**
   * Get flowed lines. Footer uses the same content on all pages.
   */
  getFlowedLines(_pageIndex: number): FlowedLine[] {
    return this._flowedPage?.lines || [];
  }

  /**
   * Get all flowed pages (footer has just one "page" of content).
   */
  getFlowedPages(): FlowedPage[] {
    return this._flowedPage ? [this._flowedPage] : [];
  }

  /**
   * Get the available width for text.
   */
  getAvailableWidth(): number {
    return this._availableWidth;
  }

  /**
   * Footer does not span multiple pages (content is shared).
   */
  spansMultiplePages(): boolean {
    return false;
  }

  /**
   * Reflow the text content.
   */
  reflow(ctx: CanvasRenderingContext2D): void {
    const bounds = this.getRegionBounds(0);
    if (!bounds) {
      this._flowedPage = null;
      this._availableWidth = 0;
      return;
    }

    this._availableWidth = bounds.width;

    const pages = this._flowingContent.flowText(bounds.width, bounds.height, ctx);
    this._flowedPage = pages.length > 0 ? pages[0] : null;
  }

  /**
   * Update the flowed page from external source.
   */
  setFlowedPage(page: FlowedPage | null, availableWidth: number): void {
    this._flowedPage = page;
    this._availableWidth = availableWidth;
  }
}
