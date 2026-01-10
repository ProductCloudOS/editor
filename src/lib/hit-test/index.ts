/**
 * Hit test system for efficient click/hover detection.
 *
 * @example
 * ```typescript
 * import { HitTestManager, HIT_PRIORITY } from './hit-test';
 *
 * const hitTestManager = new HitTestManager();
 *
 * // Register targets during reflow
 * hitTestManager.register(pageIndex, {
 *   type: 'embedded-object',
 *   category: 'content',
 *   bounds: { x: 100, y: 200, width: 300, height: 150 },
 *   priority: HIT_PRIORITY.EMBEDDED_OBJECT,
 *   data: { type: 'embedded-object', object: myObject }
 * });
 *
 * // Query on click
 * const target = hitTestManager.queryAtPoint(pageIndex, { x: 150, y: 250 });
 * if (target) {
 *   console.log('Hit:', target.type, target.data);
 * }
 *
 * // Clear category on selection change
 * hitTestManager.clearCategory('resize-handles');
 * ```
 */

export { HitTestManager } from './HitTestManager';

export { HIT_PRIORITY } from './types';

export type {
  HitTargetCategory,
  HitTargetType,
  HitTarget,
  HitTargetData,
  HitTestResult,
  ResizeHandleData,
  EmbeddedObjectData,
  TableCellData,
  TableDividerData,
  TextRegionData,
  SubstitutionFieldData,
} from './types';
