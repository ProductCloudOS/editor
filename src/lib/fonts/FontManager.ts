/**
 * FontManager - Manages font registration and availability for the editor.
 *
 * Built-in fonts are web-safe and map to pdf-lib StandardFonts.
 * Custom fonts are loaded via the FontFace API for canvas rendering
 * and their raw bytes are stored for PDF embedding.
 */

import { EventEmitter } from '../events/EventEmitter';
import { Logger } from '../utils/logger';

/**
 * Options for registering a custom font.
 */
export interface RegisterFontOptions {
  /** CSS font-family name */
  family: string;
  /** URL to a .ttf or .woff2 font file (will be fetched) */
  url?: string;
  /** Pre-loaded font bytes (alternative to url) */
  data?: ArrayBuffer;
  /** Font weight: 'normal' or 'bold'. Default: 'normal' */
  weight?: string;
  /** Font style: 'normal' or 'italic'. Default: 'normal' */
  style?: string;
}

/**
 * A registered font variant (weight + style combination).
 */
export interface FontVariant {
  weight: string;
  style: string;
  fontData: ArrayBuffer | null;
  loaded: boolean;
}

/**
 * A registered font family with its variants.
 */
export interface FontRegistration {
  family: string;
  source: 'built-in' | 'custom';
  variants: FontVariant[];
}

/**
 * Built-in web-safe fonts that need no loading.
 */
const BUILT_IN_FONTS = [
  'Arial',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana'
];

export class FontManager extends EventEmitter {
  private fonts: Map<string, FontRegistration> = new Map();

  constructor() {
    super();

    // Register built-in fonts
    for (const family of BUILT_IN_FONTS) {
      this.fonts.set(family.toLowerCase(), {
        family,
        source: 'built-in',
        variants: [{
          weight: 'normal',
          style: 'normal',
          fontData: null,
          loaded: true
        }]
      });
    }
  }

  /**
   * Register a custom font. Fetches the font data if a URL is provided,
   * creates a FontFace for canvas rendering, and stores the raw bytes for PDF embedding.
   */
  async registerFont(options: RegisterFontOptions): Promise<void> {
    const { family, url, data, weight = 'normal', style = 'normal' } = options;
    Logger.log('[pc-editor:FontManager] registerFont', family, weight, style);

    let fontData: ArrayBuffer | null = null;

    // Get font bytes
    if (data) {
      fontData = data;
    } else if (url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
        }
        fontData = await response.arrayBuffer();
      } catch (e) {
        Logger.error(`[pc-editor:FontManager] Failed to fetch font "${family}" from ${url}:`, e);
        throw e;
      }
    }

    // Create FontFace for canvas rendering
    if (fontData && typeof FontFace !== 'undefined') {
      try {
        const fontFace = new FontFace(family, fontData, {
          weight,
          style
        });
        await fontFace.load();
        document.fonts.add(fontFace);
        Logger.log('[pc-editor:FontManager] FontFace loaded:', family, weight, style);
      } catch (e) {
        Logger.error(`[pc-editor:FontManager] Failed to load FontFace "${family}":`, e);
        throw e;
      }
    }

    // Register in our map
    const key = family.toLowerCase();
    let registration = this.fonts.get(key);

    if (!registration) {
      registration = {
        family,
        source: 'custom',
        variants: []
      };
      this.fonts.set(key, registration);
    } else if (registration.source === 'built-in') {
      // Upgrading a built-in font with custom data (e.g., for PDF embedding)
      registration.source = 'custom';
    }

    // Add or update variant
    const existingVariant = registration.variants.find(
      v => v.weight === weight && v.style === style
    );
    if (existingVariant) {
      existingVariant.fontData = fontData;
      existingVariant.loaded = true;
    } else {
      registration.variants.push({
        weight,
        style,
        fontData,
        loaded: true
      });
    }

    this.emit('font-registered', { family, weight, style });
  }

  /**
   * Get all registered font families.
   */
  getAvailableFonts(): FontRegistration[] {
    return Array.from(this.fonts.values());
  }

  /**
   * Get all available font family names.
   */
  getAvailableFontFamilies(): string[] {
    return Array.from(this.fonts.values()).map(f => f.family);
  }

  /**
   * Check if a font family is built-in.
   */
  isBuiltIn(family: string): boolean {
    const reg = this.fonts.get(family.toLowerCase());
    return reg?.source === 'built-in';
  }

  /**
   * Check if a font family is registered (built-in or custom).
   */
  isRegistered(family: string): boolean {
    return this.fonts.has(family.toLowerCase());
  }

  /**
   * Get raw font bytes for PDF embedding.
   * Returns null for built-in fonts (they use StandardFonts in pdf-lib).
   */
  getFontData(family: string, weight: string = 'normal', style: string = 'normal'): ArrayBuffer | null {
    const reg = this.fonts.get(family.toLowerCase());
    if (!reg) return null;

    // Try exact match first
    const exact = reg.variants.find(v => v.weight === weight && v.style === style);
    if (exact?.fontData) return exact.fontData;

    // Fall back to normal variant
    const normal = reg.variants.find(v => v.weight === 'normal' && v.style === 'normal');
    return normal?.fontData || null;
  }
}
