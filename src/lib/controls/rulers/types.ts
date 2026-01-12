/**
 * Types for ruler controls.
 */

import type { Units, ControlOptions } from '../types';

/**
 * Options for creating a ruler control.
 */
export interface RulerOptions extends ControlOptions {
  /** Measurement units to display */
  units?: Units;
  /** Interval for major tick marks (in the specified units) */
  majorTickInterval?: number;
  /** Number of minor ticks between major ticks */
  minorTicksPerMajor?: number;
  /** Whether to show labels on major ticks */
  showLabels?: boolean;
  /** Thickness of the ruler in pixels */
  thickness?: number;
  /** Background color */
  backgroundColor?: string;
  /** Color for tick marks */
  tickColor?: string;
  /** Color for labels */
  labelColor?: string;
  /** Color for the active position indicator */
  activeColor?: string;
  /** Font size for labels */
  labelFontSize?: number;
  /** Whether to show margin indicators */
  showMargins?: boolean;
  /** Color for margin indicators */
  marginColor?: string;
}

/**
 * Default ruler options.
 */
export const DEFAULT_RULER_OPTIONS: Required<RulerOptions> = {
  visible: true,
  units: 'mm',
  majorTickInterval: 10,
  minorTicksPerMajor: 10,
  showLabels: true,
  thickness: 20,
  backgroundColor: '#f5f5f5',
  tickColor: '#666666',
  labelColor: '#333333',
  activeColor: '#2196f3',
  labelFontSize: 9,
  showMargins: true,
  marginColor: '#666666'  // Dark gray for areas outside the page
};

/**
 * Ruler orientation.
 */
export type RulerOrientation = 'horizontal' | 'vertical';

/**
 * A tick mark on the ruler.
 */
export interface TickMark {
  /** Position in pixels (from ruler start) */
  position: number;
  /** Whether this is a major tick */
  isMajor: boolean;
  /** Label text (for major ticks with labels) */
  label?: string;
}

/**
 * Conversion factors from various units to pixels.
 * Based on 96 DPI standard.
 */
export const PIXELS_PER_UNIT: Record<Units, number> = {
  px: 1,
  pt: 96 / 72,        // 1.333...
  mm: 96 / 25.4,      // 3.779...
  in: 96              // 96 pixels per inch
};

/**
 * Get pixels per unit for a given unit type.
 */
export function getPixelsPerUnit(units: Units): number {
  return PIXELS_PER_UNIT[units];
}
