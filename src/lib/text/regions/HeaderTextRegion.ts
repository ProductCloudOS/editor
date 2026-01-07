import { Rect } from '../../types';
import { FlowedLine, FlowedPage } from '../types';
import { FlowingTextContent } from '../FlowingTextContent';
import { BaseTextRegion, RegionType } from '../EditableTextRegion';

/**
 * Callback to get header bounds for a page.
 */
export type HeaderBoundsProvider = (pageIndex: number) => {
  getHeaderBounds(): { position: { x: number; y: number }; size: { width: number; height: number } };
} | null;

/**
 * Header text region - handles document header content.
 * Header content is shared across all pages but renders at the top of each page.
 */
export class HeaderTextRegion extends BaseTextRegion {
  readonly id = 'header';
  readonly type: RegionType = 'header';

  private _flowingContent: FlowingTextContent;
  private _getPage: HeaderBoundsProvider;
  private _flowedPage: FlowedPage | null = null;
  private _availableWidth: number = 0;

  /**
   * Create a header text region.
   * @param flowingContent The FlowingTextContent for header text
   * @param getPage Callback to get page header bounds by index
   */
  constructor(flowingContent: FlowingTextContent, getPage: HeaderBoundsProvider) {
    super();
    this._flowingContent = flowingContent;
    this._getPage = getPage;
  }

  get flowingContent(): FlowingTextContent {
    return this._flowingContent;
  }

  /**
   * Get the bounds of the header area on a specific page.
   * Header renders at the same position on every page.
   */
  getRegionBounds(pageIndex: number): Rect | null {
    const page = this._getPage(pageIndex);
    if (!page) return null;

    const headerBounds = page.getHeaderBounds();
    return {
      x: headerBounds.position.x,
      y: headerBounds.position.y,
      width: headerBounds.size.width,
      height: headerBounds.size.height
    };
  }

  /**
   * Get flowed lines. Header uses the same content on all pages.
   */
  getFlowedLines(_pageIndex: number): FlowedLine[] {
    return this._flowedPage?.lines || [];
  }

  /**
   * Get all flowed pages (header has just one "page" of content).
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
   * Header does not span multiple pages (content is shared).
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
