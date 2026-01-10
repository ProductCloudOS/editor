/**
 * PDF utility functions for coordinate transformation and font mapping.
 */

import { StandardFonts, PDFFont, PDFPage, rgb, Color } from 'pdf-lib';

/**
 * PDF uses bottom-left origin, canvas uses top-left.
 * Transform Y coordinate from canvas space to PDF space.
 */
export function transformY(y: number, pageHeight: number): number {
  return pageHeight - y;
}

/**
 * Transform a rectangle from canvas coordinates to PDF coordinates.
 * Canvas: (x, y) is top-left corner
 * PDF: (x, y) is bottom-left corner
 */
export function transformRect(
  x: number,
  y: number,
  width: number,
  height: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x,
    y: pageHeight - y - height,
    width,
    height
  };
}

/**
 * Font weight/style variants for PDF standard fonts.
 */
export type FontVariant = 'normal' | 'bold' | 'italic' | 'boldItalic';

/**
 * Map of CSS font families to pdf-lib StandardFonts.
 * Each family maps to its variants.
 */
const FONT_MAP: Record<string, Record<FontVariant, StandardFonts>> = {
  // Sans-serif fonts -> Helvetica
  'arial': {
    normal: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique
  },
  'helvetica': {
    normal: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique
  },
  'sans-serif': {
    normal: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique
  },
  // Serif fonts -> Times
  'times': {
    normal: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic
  },
  'times new roman': {
    normal: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic
  },
  'serif': {
    normal: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic
  },
  'georgia': {
    normal: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic
  },
  // Monospace fonts -> Courier
  'courier': {
    normal: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique
  },
  'courier new': {
    normal: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique
  },
  'monospace': {
    normal: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique
  }
};

/**
 * Get the StandardFonts enum value for a given font family and style.
 */
export function getStandardFont(
  fontFamily: string,
  fontWeight?: string,
  fontStyle?: string
): StandardFonts {
  const family = fontFamily.toLowerCase().trim();
  const isBold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900';
  const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';

  let variant: FontVariant = 'normal';
  if (isBold && isItalic) {
    variant = 'boldItalic';
  } else if (isBold) {
    variant = 'bold';
  } else if (isItalic) {
    variant = 'italic';
  }

  // Look up font family in map
  const fontVariants = FONT_MAP[family];
  if (fontVariants) {
    return fontVariants[variant];
  }

  // Default to Helvetica
  return FONT_MAP['helvetica'][variant];
}

/**
 * Create a unique font key for caching embedded fonts.
 */
export function getFontKey(fontFamily: string, fontWeight?: string, fontStyle?: string): string {
  return `${fontFamily.toLowerCase()}-${fontWeight || 'normal'}-${fontStyle || 'normal'}`;
}

/**
 * Parse a CSS color string to pdf-lib Color.
 * Supports hex (#RGB, #RRGGBB), rgb(), rgba(), and named colors.
 */
export function parseColor(cssColor: string): Color {
  if (!cssColor) {
    return rgb(0, 0, 0);
  }

  const color = cssColor.trim().toLowerCase();

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    let r: number, g: number, b: number;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
    } else {
      return rgb(0, 0, 0);
    }

    return rgb(r, g, b);
  }

  // Handle rgb() and rgba()
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return rgb(
      parseInt(rgbMatch[1]) / 255,
      parseInt(rgbMatch[2]) / 255,
      parseInt(rgbMatch[3]) / 255
    );
  }

  // Common named colors
  const namedColors: Record<string, [number, number, number]> = {
    'black': [0, 0, 0],
    'white': [1, 1, 1],
    'red': [1, 0, 0],
    'green': [0, 0.5, 0],
    'blue': [0, 0, 1],
    'yellow': [1, 1, 0],
    'cyan': [0, 1, 1],
    'magenta': [1, 0, 1],
    'gray': [0.5, 0.5, 0.5],
    'grey': [0.5, 0.5, 0.5],
    'orange': [1, 0.65, 0],
    'purple': [0.5, 0, 0.5],
    'pink': [1, 0.75, 0.8],
    'brown': [0.65, 0.16, 0.16],
    'transparent': [0, 0, 0] // Will be handled separately if alpha matters
  };

  if (namedColors[color]) {
    const [r, g, b] = namedColors[color];
    return rgb(r, g, b);
  }

  // Default to black
  return rgb(0, 0, 0);
}

/**
 * Draw text on a PDF page with proper positioning and formatting.
 */
export function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  fontSize: number,
  color: Color,
  pageHeight: number
): void {
  page.drawText(text, {
    x,
    y: transformY(y, pageHeight),
    font,
    size: fontSize,
    color
  });
}

/**
 * Draw a filled rectangle on a PDF page.
 */
export function drawFilledRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Color,
  pageHeight: number
): void {
  const transformed = transformRect(x, y, width, height, pageHeight);
  page.drawRectangle({
    x: transformed.x,
    y: transformed.y,
    width: transformed.width,
    height: transformed.height,
    color
  });
}

/**
 * Draw a stroked rectangle on a PDF page.
 */
export function drawStrokedRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  borderColor: Color,
  borderWidth: number,
  pageHeight: number
): void {
  const transformed = transformRect(x, y, width, height, pageHeight);
  page.drawRectangle({
    x: transformed.x,
    y: transformed.y,
    width: transformed.width,
    height: transformed.height,
    borderColor,
    borderWidth
  });
}

/**
 * Draw a line on a PDF page.
 */
export function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Color,
  thickness: number,
  pageHeight: number
): void {
  page.drawLine({
    start: { x: x1, y: transformY(y1, pageHeight) },
    end: { x: x2, y: transformY(y2, pageHeight) },
    color,
    thickness
  });
}
