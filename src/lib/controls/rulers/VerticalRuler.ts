/**
 * VerticalRuler - Vertical ruler control that displays to the left of the editor canvas.
 *
 * This control only uses the PCEditor public API - no DOM queries into the editor.
 *
 * The vertical ruler shows measurements starting from 0 at the top of each page,
 * with gray areas displayed in the gaps between pages.
 */

import { RulerControl } from './RulerControl';
import type { RulerOptions, RulerOrientation, TickMark } from './types';
import { getPixelsPerUnit } from './types';

/**
 * Vertical ruler control.
 */
export class VerticalRuler extends RulerControl {
  protected readonly orientation: RulerOrientation = 'vertical';
  private contentOffsetY: number = 0;
  private pageHeightPx: number = 0;
  private pageGap: number = 40; // Gap between pages (20px margin top + 20px margin bottom)
  private totalPages: number = 1;

  constructor(options: RulerOptions = {}) {
    super('vertical-ruler', options);
  }

  /**
   * Update scroll offset from the editor API.
   */
  protected updateScrollOffset(): void {
    if (!this.editor) return;
    const scrollPos = this.editor.getScrollPosition();
    this.scrollOffset = scrollPos.y;
  }

  /**
   * Get the content offset for vertical orientation.
   */
  protected getContentOffset(): number {
    return this.contentOffsetY;
  }

  /**
   * Update from document metrics.
   */
  protected updateFromMetrics(metrics: {
    pageWidth: number;
    pageHeight: number;
    margins: { top: number; right: number; bottom: number; left: number };
    totalPages: number;
  } | null): void {
    if (!metrics || !this.editor) return;

    // Convert from mm to pixels
    const pixelsPerMm = getPixelsPerUnit('mm');

    // Store page metrics for rendering
    this.pageHeightPx = metrics.pageHeight * pixelsPerMm * this.zoomLevel;
    this.totalPages = metrics.totalPages;

    // Total document height is page height * number of pages (plus gaps)
    this.documentSize = (this.pageHeightPx + this.pageGap) * this.totalPages - this.pageGap;

    // Margins apply per page
    this.marginStart = metrics.margins.top * pixelsPerMm * this.zoomLevel;
    this.marginEnd = (metrics.pageHeight - metrics.margins.bottom) * pixelsPerMm * this.zoomLevel;

    // Get content offset from the editor API
    const contentOffset = this.editor.getContentOffset();
    const scrollPos = this.editor.getScrollPosition();

    // contentOffsetY is where the document starts relative to the ruler
    this.contentOffsetY = contentOffset.y - scrollPos.y;
  }

  /**
   * Render margin indicators - gray areas before document, after document, and between pages.
   */
  protected renderMargins(width: number, height: number): void {
    if (!this.ctx) return;

    const startY = this.contentOffsetY;
    const endY = startY + this.documentSize;

    // Top margin area (before first page)
    if (startY > 0) {
      this.ctx.fillStyle = this.options.marginColor;
      this.ctx.fillRect(0, 0, width, startY);
    }

    // Bottom margin area (after last page)
    if (endY < height) {
      this.ctx.fillStyle = this.options.marginColor;
      this.ctx.fillRect(0, endY, width, height - endY);
    }

    // Gray areas between pages
    for (let pageIndex = 0; pageIndex < this.totalPages - 1; pageIndex++) {
      const pageEndY = startY + (pageIndex + 1) * this.pageHeightPx + pageIndex * this.pageGap;
      const gapStartY = pageEndY;
      const gapEndY = pageEndY + this.pageGap;

      // Only draw if visible
      if (gapEndY > 0 && gapStartY < height) {
        this.ctx.fillStyle = this.options.marginColor;
        this.ctx.fillRect(0, Math.max(0, gapStartY), width, Math.min(gapEndY, height) - Math.max(0, gapStartY));
      }
    }

    // Draw margin lines for each visible page
    this.ctx.strokeStyle = this.options.tickColor;
    this.ctx.lineWidth = 1;

    for (let pageIndex = 0; pageIndex < this.totalPages; pageIndex++) {
      const pageStartY = startY + pageIndex * (this.pageHeightPx + this.pageGap);
      const topMarginY = pageStartY + this.marginStart;
      const bottomMarginY = pageStartY + this.marginEnd;

      // Top margin line
      if (topMarginY >= 0 && topMarginY <= height) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, topMarginY);
        this.ctx.lineTo(width, topMarginY);
        this.ctx.stroke();
      }

      // Bottom margin line
      if (bottomMarginY >= 0 && bottomMarginY <= height) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, bottomMarginY);
        this.ctx.lineTo(width, bottomMarginY);
        this.ctx.stroke();
      }
    }
  }

  /**
   * Calculate tick marks for each page, starting from 0 at the top of each page.
   * Overrides the base class method to handle per-page measurements.
   */
  protected calculateTickMarks(): TickMark[] {
    const ticks: TickMark[] = [];
    const pixelsPerUnit = getPixelsPerUnit(this.options.units) * this.zoomLevel;
    const majorInterval = this.options.majorTickInterval;
    const minorInterval = majorInterval / this.options.minorTicksPerMajor;
    const visibleLength = this.getVisibleLength();

    // Generate ticks for each page
    for (let pageIndex = 0; pageIndex < this.totalPages; pageIndex++) {
      const pageStartY = pageIndex * (this.pageHeightPx + this.pageGap);

      // Calculate what part of this page is visible in ruler coordinates
      const visibleStart = Math.max(0, -this.contentOffsetY - pageStartY);
      const visibleEnd = Math.min(this.pageHeightPx, visibleLength - this.contentOffsetY - pageStartY);

      // Skip this page if not visible
      if (visibleEnd < 0 || visibleStart > this.pageHeightPx) continue;

      // Calculate unit range for this page (each page starts at 0)
      const startUnit = Math.floor(visibleStart / pixelsPerUnit / minorInterval) * minorInterval - minorInterval;
      const endUnit = Math.ceil(visibleEnd / pixelsPerUnit / minorInterval) * minorInterval + minorInterval;

      // Generate ticks for this page
      for (let unit = Math.max(0, startUnit); unit * pixelsPerUnit <= this.pageHeightPx && unit <= endUnit; unit += minorInterval) {
        // Position is relative to the page start, which becomes absolute when offset by pageStartY
        const position = pageStartY + unit * pixelsPerUnit;
        const isMajor = Math.abs(unit % majorInterval) < 0.001;

        const tick: TickMark = {
          position,
          isMajor
        };

        if (isMajor && this.options.showLabels) {
          tick.label = String(Math.round(unit));
        }

        ticks.push(tick);
      }
    }

    return ticks;
  }

  /**
   * Render tick marks.
   */
  protected renderTicks(ticks: TickMark[], width: number, _height: number): void {
    if (!this.ctx) return;

    const majorWidth = width * 0.6;
    const minorWidth = width * 0.3;

    this.ctx.strokeStyle = this.options.tickColor;
    this.ctx.lineWidth = 1;
    this.ctx.font = `${this.options.labelFontSize}px sans-serif`;
    this.ctx.fillStyle = this.options.labelColor;
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';

    // Offset ticks by content area start
    const offset = this.contentOffsetY;

    for (const tick of ticks) {
      const y = tick.position + offset;

      // Skip ticks outside visible area
      if (y < -10 || y > _height + 10) continue;

      // Skip ticks that fall in page gaps
      if (this.isInPageGap(tick.position)) continue;

      const tickWidth = tick.isMajor ? majorWidth : minorWidth;

      this.ctx.beginPath();
      this.ctx.moveTo(width, y);
      this.ctx.lineTo(width - tickWidth, y);
      this.ctx.stroke();

      if (tick.label) {
        // Rotate label for vertical ruler
        this.ctx.save();
        this.ctx.translate(width - majorWidth - 2, y);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText(tick.label, 0, 0);
        this.ctx.restore();
      }
    }
  }

  /**
   * Check if a position (in document coordinates) falls within a page gap.
   */
  private isInPageGap(position: number): boolean {
    for (let pageIndex = 0; pageIndex < this.totalPages - 1; pageIndex++) {
      const gapStart = (pageIndex + 1) * this.pageHeightPx + pageIndex * this.pageGap;
      const gapEnd = gapStart + this.pageGap;
      if (position >= gapStart && position < gapEnd) {
        return true;
      }
    }
    return false;
  }

  /**
   * Render cursor position indicator.
   */
  protected renderCursorIndicator(width: number, _height: number): void {
    if (!this.ctx || this.currentMousePosition === null) return;

    this.ctx.fillStyle = this.options.activeColor;
    this.ctx.fillRect(0, this.currentMousePosition - 1, width, 2);

    // Also draw a small triangle on the right
    this.ctx.beginPath();
    this.ctx.moveTo(width, this.currentMousePosition - 4);
    this.ctx.lineTo(width, this.currentMousePosition + 4);
    this.ctx.lineTo(width - 6, this.currentMousePosition);
    this.ctx.closePath();
    this.ctx.fill();
  }
}
