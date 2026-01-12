/**
 * HorizontalRuler - Horizontal ruler control that displays above the editor canvas.
 *
 * This control only uses the PCEditor public API - no DOM queries into the editor.
 */

import { RulerControl } from './RulerControl';
import type { RulerOptions, RulerOrientation, TickMark } from './types';
import { getPixelsPerUnit } from './types';

/**
 * Horizontal ruler control.
 */
export class HorizontalRuler extends RulerControl {
  protected readonly orientation: RulerOrientation = 'horizontal';
  private contentOffsetX: number = 0;

  constructor(options: RulerOptions = {}) {
    super('horizontal-ruler', options);
  }

  /**
   * Update scroll offset from the editor API.
   */
  protected updateScrollOffset(): void {
    if (!this.editor) return;
    const scrollPos = this.editor.getScrollPosition();
    this.scrollOffset = scrollPos.x;
  }

  /**
   * Get the content offset for horizontal orientation.
   */
  protected getContentOffset(): number {
    return this.contentOffsetX;
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
    this.documentSize = metrics.pageWidth * pixelsPerMm * this.zoomLevel;
    this.marginStart = metrics.margins.left * pixelsPerMm * this.zoomLevel;
    this.marginEnd = (metrics.pageWidth - metrics.margins.right) * pixelsPerMm * this.zoomLevel;

    // Get content offset from the editor API
    const contentOffset = this.editor.getContentOffset();
    const scrollPos = this.editor.getScrollPosition();

    // contentOffsetX is where the document starts relative to the ruler
    // We need to account for any difference between the ruler's position and the scroll container
    this.contentOffsetX = contentOffset.x - scrollPos.x;
  }

  /**
   * Calculate tick marks for the page, stopping at the page edge.
   * Overrides the base class method to limit ticks to page width.
   */
  protected calculateTickMarks(): TickMark[] {
    const ticks: TickMark[] = [];
    const pixelsPerUnit = getPixelsPerUnit(this.options.units) * this.zoomLevel;
    const majorInterval = this.options.majorTickInterval;
    const minorInterval = majorInterval / this.options.minorTicksPerMajor;

    const contentOffset = this.getContentOffset();
    const visibleLength = this.getVisibleLength();

    // Calculate the visible range in document coordinates
    const visibleDocStart = Math.max(0, -contentOffset);
    const visibleDocEnd = Math.min(this.documentSize, visibleLength - contentOffset);

    // Convert to units
    const startUnit = Math.floor(visibleDocStart / pixelsPerUnit / minorInterval) * minorInterval - minorInterval;
    const endUnit = Math.ceil(visibleDocEnd / pixelsPerUnit / minorInterval) * minorInterval + minorInterval;

    // Generate ticks, but stop at page width
    for (let unit = Math.max(0, startUnit); unit <= endUnit; unit += minorInterval) {
      const position = unit * pixelsPerUnit;

      // Don't generate ticks beyond the page width
      if (position > this.documentSize) break;

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

    return ticks;
  }

  /**
   * Render margin indicators.
   */
  protected renderMargins(width: number, height: number): void {
    if (!this.ctx) return;

    const startX = this.contentOffsetX;
    const endX = startX + this.documentSize;

    // Left margin area (before document)
    if (startX > 0) {
      this.ctx.fillStyle = this.options.marginColor;
      this.ctx.fillRect(0, 0, startX, height);
    }

    // Right margin area (beyond document)
    if (endX < width) {
      this.ctx.fillStyle = this.options.marginColor;
      this.ctx.fillRect(endX, 0, width - endX, height);
    }

    // Margin guides within document
    const leftMarginX = startX + this.marginStart;
    const rightMarginX = startX + this.marginEnd;

    this.ctx.strokeStyle = this.options.tickColor;
    this.ctx.lineWidth = 1;

    // Left margin line
    if (leftMarginX >= 0 && leftMarginX <= width) {
      this.ctx.beginPath();
      this.ctx.moveTo(leftMarginX, 0);
      this.ctx.lineTo(leftMarginX, height);
      this.ctx.stroke();
    }

    // Right margin line
    if (rightMarginX >= 0 && rightMarginX <= width) {
      this.ctx.beginPath();
      this.ctx.moveTo(rightMarginX, 0);
      this.ctx.lineTo(rightMarginX, height);
      this.ctx.stroke();
    }
  }

  /**
   * Render tick marks.
   */
  protected renderTicks(ticks: TickMark[], _width: number, height: number): void {
    if (!this.ctx) return;

    const majorHeight = height * 0.6;
    const minorHeight = height * 0.3;

    this.ctx.strokeStyle = this.options.tickColor;
    this.ctx.lineWidth = 1;
    this.ctx.font = `${this.options.labelFontSize}px sans-serif`;
    this.ctx.fillStyle = this.options.labelColor;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    // Offset ticks by content area start
    const offset = this.contentOffsetX;

    for (const tick of ticks) {
      const x = tick.position + offset;

      // Skip ticks outside visible area
      if (x < -10 || x > _width + 10) continue;

      const tickHeight = tick.isMajor ? majorHeight : minorHeight;

      this.ctx.beginPath();
      this.ctx.moveTo(x, height);
      this.ctx.lineTo(x, height - tickHeight);
      this.ctx.stroke();

      if (tick.label) {
        this.ctx.fillText(tick.label, x, 2);
      }
    }
  }

  /**
   * Render cursor position indicator.
   */
  protected renderCursorIndicator(_width: number, height: number): void {
    if (!this.ctx || this.currentMousePosition === null) return;

    this.ctx.fillStyle = this.options.activeColor;
    this.ctx.fillRect(this.currentMousePosition - 1, 0, 2, height);

    // Also draw a small triangle at the bottom
    this.ctx.beginPath();
    this.ctx.moveTo(this.currentMousePosition - 4, height);
    this.ctx.lineTo(this.currentMousePosition + 4, height);
    this.ctx.lineTo(this.currentMousePosition, height - 6);
    this.ctx.closePath();
    this.ctx.fill();
  }
}
