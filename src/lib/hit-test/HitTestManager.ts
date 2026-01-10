/**
 * HitTestManager - Centralized hit testing for click/hover detection.
 *
 * Hit targets are registered during reflow (for content) and on selection
 * change (for resize handles). This eliminates the need to recalculate
 * positions on every mouse event.
 *
 * All coordinates are in document space (not affected by zoom).
 */

import { Point } from '../objects/types';
import type { HitTarget, HitTargetCategory } from './types';

export class HitTestManager {
  /**
   * Registered hit targets per page (document coordinates).
   * Key is page index, value is array of targets for that page.
   */
  private targets: Map<number, HitTarget[]> = new Map();

  /**
   * Clear all hit targets.
   * Call this when the entire document needs to be rebuilt.
   */
  clear(): void {
    this.targets.clear();
  }

  /**
   * Clear all targets of a specific category.
   * This enables efficient partial updates:
   * - 'content': Clear when reflow occurs
   * - 'resize-handles': Clear when selection changes
   * - 'table-dividers': Clear when table focus changes
   */
  clearCategory(category: HitTargetCategory): void {
    for (const [pageIndex, pageTargets] of this.targets) {
      const filtered = pageTargets.filter(t => t.category !== category);
      if (filtered.length === 0) {
        this.targets.delete(pageIndex);
      } else {
        this.targets.set(pageIndex, filtered);
      }
    }
  }

  /**
   * Register a hit target for a specific page.
   *
   * @param pageIndex - The page where this target exists
   * @param target - The hit target to register
   */
  register(pageIndex: number, target: HitTarget): void {
    let pageTargets = this.targets.get(pageIndex);
    if (!pageTargets) {
      pageTargets = [];
      this.targets.set(pageIndex, pageTargets);
    }
    pageTargets.push(target);
  }

  /**
   * Query for the highest-priority hit target at a point.
   *
   * @param pageIndex - The page to query
   * @param point - Point in document coordinates
   * @returns The highest-priority target at this point, or null if none
   */
  queryAtPoint(pageIndex: number, point: Point): HitTarget | null {
    const pageTargets = this.targets.get(pageIndex);
    if (!pageTargets) {
      return null;
    }

    // Find all targets that contain the point
    const hits: HitTarget[] = [];
    for (const target of pageTargets) {
      if (this.containsPoint(target.bounds, point)) {
        hits.push(target);
      }
    }

    if (hits.length === 0) {
      return null;
    }

    // Return the highest priority target
    hits.sort((a, b) => b.priority - a.priority);
    return hits[0];
  }

  /**
   * Query for all hit targets at a point, sorted by priority (highest first).
   *
   * @param pageIndex - The page to query
   * @param point - Point in document coordinates
   * @returns Array of targets at this point, sorted by priority
   */
  queryAllAtPoint(pageIndex: number, point: Point): HitTarget[] {
    const pageTargets = this.targets.get(pageIndex);
    if (!pageTargets) {
      return [];
    }

    const hits: HitTarget[] = [];
    for (const target of pageTargets) {
      if (this.containsPoint(target.bounds, point)) {
        hits.push(target);
      }
    }

    hits.sort((a, b) => b.priority - a.priority);
    return hits;
  }

  /**
   * Query for targets of a specific type at a point.
   *
   * @param pageIndex - The page to query
   * @param point - Point in document coordinates
   * @param type - The type of target to find
   * @returns The highest-priority target of this type, or null
   */
  queryByType(
    pageIndex: number,
    point: Point,
    type: HitTarget['type']
  ): HitTarget | null {
    const pageTargets = this.targets.get(pageIndex);
    if (!pageTargets) {
      return null;
    }

    let bestMatch: HitTarget | null = null;
    for (const target of pageTargets) {
      if (target.type === type && this.containsPoint(target.bounds, point)) {
        if (!bestMatch || target.priority > bestMatch.priority) {
          bestMatch = target;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get all registered targets for a page.
   * Useful for debugging and testing.
   */
  getTargetsForPage(pageIndex: number): readonly HitTarget[] {
    return this.targets.get(pageIndex) || [];
  }

  /**
   * Get all page indices that have targets registered.
   */
  getPageIndices(): number[] {
    return Array.from(this.targets.keys()).sort((a, b) => a - b);
  }

  /**
   * Get total count of registered targets across all pages.
   */
  getTotalTargetCount(): number {
    let count = 0;
    for (const pageTargets of this.targets.values()) {
      count += pageTargets.length;
    }
    return count;
  }

  /**
   * Check if a point is within bounds.
   */
  private containsPoint(
    bounds: { x: number; y: number; width: number; height: number },
    point: Point
  ): boolean {
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }
}
