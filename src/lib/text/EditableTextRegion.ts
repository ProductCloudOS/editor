import { Point, Rect } from '../types';
import { FlowedLine, FlowedPage } from './types';
import { FlowingTextContent } from './FlowingTextContent';

/**
 * Types of editable text regions in the document.
 */
export type RegionType = 'body' | 'header' | 'footer' | 'textbox';

/**
 * Interface for editable text regions.
 * This abstraction unifies body, header, footer, and text box contexts
 * so that interaction logic (click handling, cursor positioning, selection)
 * can be shared across all of them.
 */
export interface EditableTextRegion {
  /**
   * Unique identifier for this region.
   * For body/header/footer this is a fixed string.
   * For text boxes this is the text box ID.
   */
  readonly id: string;

  /**
   * The type of region.
   */
  readonly type: RegionType;

  /**
   * The underlying FlowingTextContent that manages text state.
   */
  readonly flowingContent: FlowingTextContent;

  /**
   * Get the bounds of this region on a specific page.
   * @param pageIndex The page index (0-based)
   * @returns The bounds in canvas coordinates, or null if not visible on this page
   */
  getRegionBounds(pageIndex: number): Rect | null;

  /**
   * Convert a point from global (canvas) coordinates to local (region) coordinates.
   * @param point Point in canvas coordinates
   * @param pageIndex The page index
   * @returns Point in region-local coordinates, or null if point is outside this region
   */
  globalToLocal(point: Point, pageIndex: number): Point | null;

  /**
   * Convert a point from local (region) coordinates to global (canvas) coordinates.
   * @param point Point in region-local coordinates
   * @param pageIndex The page index
   * @returns Point in canvas coordinates
   */
  localToGlobal(point: Point, pageIndex: number): Point;

  /**
   * Get the flowed lines for this region on a specific page.
   * @param pageIndex The page index
   * @returns Array of flowed lines for this page
   */
  getFlowedLines(pageIndex: number): FlowedLine[];

  /**
   * Get all flowed pages for this region.
   * @returns Array of flowed pages
   */
  getFlowedPages(): FlowedPage[];

  /**
   * Get the available width for text in this region.
   * This is used for alignment calculations.
   */
  getAvailableWidth(): number;

  /**
   * Whether this region spans multiple pages.
   * Body text can span pages; header/footer/textbox cannot.
   */
  spansMultiplePages(): boolean;

  /**
   * Get the number of pages this region spans.
   * For single-page regions, returns 1.
   */
  getPageCount(): number;

  /**
   * Check if a point is within this region.
   * @param point Point in canvas coordinates
   * @param pageIndex The page index
   */
  containsPointInRegion(point: Point, pageIndex: number): boolean;

  /**
   * Trigger a reflow of text in this region.
   * @param ctx Canvas context for text measurement
   */
  reflow(ctx: CanvasRenderingContext2D): void;
}

/**
 * Abstract base class providing common functionality for regions.
 */
export abstract class BaseTextRegion implements EditableTextRegion {
  abstract readonly id: string;
  abstract readonly type: RegionType;
  abstract readonly flowingContent: FlowingTextContent;

  abstract getRegionBounds(pageIndex: number): Rect | null;
  abstract getFlowedLines(pageIndex: number): FlowedLine[];
  abstract getFlowedPages(): FlowedPage[];
  abstract getAvailableWidth(): number;
  abstract spansMultiplePages(): boolean;
  abstract reflow(ctx: CanvasRenderingContext2D): void;

  globalToLocal(point: Point, pageIndex: number): Point | null {
    const bounds = this.getRegionBounds(pageIndex);
    if (!bounds) return null;

    // Check if point is within bounds
    if (point.x < bounds.x || point.x > bounds.x + bounds.width ||
        point.y < bounds.y || point.y > bounds.y + bounds.height) {
      return null;
    }

    return {
      x: point.x - bounds.x,
      y: point.y - bounds.y
    };
  }

  localToGlobal(point: Point, pageIndex: number): Point {
    const bounds = this.getRegionBounds(pageIndex);
    if (!bounds) {
      // Fallback - return the point unchanged
      return point;
    }

    return {
      x: point.x + bounds.x,
      y: point.y + bounds.y
    };
  }

  getPageCount(): number {
    return this.getFlowedPages().length || 1;
  }

  containsPointInRegion(point: Point, pageIndex: number): boolean {
    const bounds = this.getRegionBounds(pageIndex);
    if (!bounds) return false;

    return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  }
}
