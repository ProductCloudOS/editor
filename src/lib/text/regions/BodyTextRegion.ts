import { Rect } from '../../types';
import { FlowedLine, FlowedPage } from '../types';
import { FlowingTextContent } from '../FlowingTextContent';
import { BaseTextRegion, RegionType } from '../EditableTextRegion';

/**
 * Callback to get a page by index for bounds calculation.
 */
export type PageBoundsProvider = (pageIndex: number) => {
  getContentBounds(): { position: { x: number; y: number }; size: { width: number; height: number } };
} | null;

/**
 * Body text region - handles the main document content.
 * Body text can span multiple pages.
 */
export class BodyTextRegion extends BaseTextRegion {
  readonly id = 'body';
  readonly type: RegionType = 'body';

  private _flowingContent: FlowingTextContent;
  private _getPage: PageBoundsProvider;
  private _flowedPages: FlowedPage[] = [];
  private _availableWidth: number = 0;

  /**
   * Create a body text region.
   * @param flowingContent The FlowingTextContent for body text (from first page)
   * @param getPage Callback to get page bounds by index
   */
  constructor(flowingContent: FlowingTextContent, getPage: PageBoundsProvider) {
    super();
    this._flowingContent = flowingContent;
    this._getPage = getPage;
  }

  get flowingContent(): FlowingTextContent {
    return this._flowingContent;
  }

  /**
   * Get the bounds of the body content area on a specific page.
   */
  getRegionBounds(pageIndex: number): Rect | null {
    const page = this._getPage(pageIndex);
    if (!page) return null;

    const contentBounds = page.getContentBounds();
    return {
      x: contentBounds.position.x,
      y: contentBounds.position.y,
      width: contentBounds.size.width,
      height: contentBounds.size.height
    };
  }

  /**
   * Get flowed lines for a specific page.
   */
  getFlowedLines(pageIndex: number): FlowedLine[] {
    if (pageIndex < 0 || pageIndex >= this._flowedPages.length) {
      return [];
    }
    return this._flowedPages[pageIndex].lines;
  }

  /**
   * Get all flowed pages.
   */
  getFlowedPages(): FlowedPage[] {
    return this._flowedPages;
  }

  /**
   * Get the available width for text.
   */
  getAvailableWidth(): number {
    return this._availableWidth;
  }

  /**
   * Body text can span multiple pages.
   */
  spansMultiplePages(): boolean {
    return true;
  }

  /**
   * Reflow the text content.
   */
  reflow(ctx: CanvasRenderingContext2D): void {
    // Get bounds from first page for width
    const bounds = this.getRegionBounds(0);
    if (!bounds) {
      this._flowedPages = [];
      this._availableWidth = 0;
      return;
    }

    this._availableWidth = bounds.width;

    // Flow the text - use a large height to get all pages
    this._flowedPages = this._flowingContent.flowText(
      bounds.width,
      bounds.height * 100, // Large height to capture all content
      ctx
    );
  }

  /**
   * Update the flowed pages from external source.
   * This is useful when FlowingTextRenderer has already computed the flow.
   */
  setFlowedPages(pages: FlowedPage[], availableWidth: number): void {
    this._flowedPages = pages;
    this._availableWidth = availableWidth;
  }
}
