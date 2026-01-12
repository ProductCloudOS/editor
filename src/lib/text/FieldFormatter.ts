/**
 * FieldFormatter - Formats field values based on format configuration.
 *
 * Provides formatting for:
 * - Numbers (integer, decimal, thousands, percent, scientific)
 * - Currency (USD, EUR, GBP, JPY, custom)
 * - Dates (various presets using Intl.DateTimeFormat)
 */

import type {
  FieldFormatConfig,
  NumberFormatPreset,
  CurrencyFormatPreset,
  DateFormatPreset
} from './types';

/**
 * Default locale for formatting when none specified.
 */
const DEFAULT_LOCALE = 'en-US';

/**
 * Currency code mapping for presets.
 */
const CURRENCY_CODES: Record<Exclude<CurrencyFormatPreset, 'custom'>, string> = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY'
};

/**
 * Format a value according to the provided format configuration.
 *
 * @param value - The raw value to format
 * @param config - Format configuration specifying how to format the value
 * @returns Formatted string representation of the value
 */
export function formatFieldValue(value: unknown, config?: FieldFormatConfig): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (!config || !config.valueType) {
    // No format config - convert to string directly
    return String(value);
  }

  const locale = config.locale || DEFAULT_LOCALE;

  switch (config.valueType) {
    case 'number':
      return formatNumber(value, config, locale);
    case 'currency':
      return formatCurrency(value, config, locale);
    case 'date':
      return formatDate(value, config, locale);
    case 'markdown':
      // Markdown is handled separately during rendering
      return String(value);
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Format a value as a number.
 */
function formatNumber(value: unknown, config: FieldFormatConfig, locale: string): string {
  const num = toNumber(value);
  if (isNaN(num)) {
    return String(value);
  }

  const preset = config.numberFormat as NumberFormatPreset | undefined;
  const options: Intl.NumberFormatOptions = {};

  // Apply preset defaults
  switch (preset) {
    case 'integer':
      options.maximumFractionDigits = 0;
      options.useGrouping = config.useGrouping ?? false;
      break;
    case 'decimal':
      options.minimumFractionDigits = config.decimalPlaces ?? 2;
      options.maximumFractionDigits = config.decimalPlaces ?? 2;
      options.useGrouping = config.useGrouping ?? false;
      break;
    case 'decimal-1':
      options.minimumFractionDigits = 1;
      options.maximumFractionDigits = 1;
      options.useGrouping = config.useGrouping ?? false;
      break;
    case 'decimal-3':
      options.minimumFractionDigits = 3;
      options.maximumFractionDigits = 3;
      options.useGrouping = config.useGrouping ?? false;
      break;
    case 'thousands':
      options.maximumFractionDigits = 0;
      options.useGrouping = true;
      break;
    case 'percent':
      options.style = 'percent';
      options.minimumFractionDigits = config.decimalPlaces ?? 2;
      options.maximumFractionDigits = config.decimalPlaces ?? 2;
      break;
    case 'scientific':
      options.notation = 'scientific';
      options.minimumFractionDigits = config.decimalPlaces ?? 2;
      options.maximumFractionDigits = config.decimalPlaces ?? 2;
      break;
    default:
      // Custom or no preset - use explicit config
      if (config.decimalPlaces !== undefined) {
        options.minimumFractionDigits = config.decimalPlaces;
        options.maximumFractionDigits = config.decimalPlaces;
      }
      if (config.useGrouping !== undefined) {
        options.useGrouping = config.useGrouping;
      }
  }

  try {
    return new Intl.NumberFormat(locale, options).format(num);
  } catch {
    return String(num);
  }
}

/**
 * Format a value as currency.
 */
function formatCurrency(value: unknown, config: FieldFormatConfig, locale: string): string {
  const num = toNumber(value);
  if (isNaN(num)) {
    return String(value);
  }

  const preset = config.currencyFormat || 'USD';

  if (preset === 'custom') {
    // Custom currency - manual formatting
    const symbol = config.currencySymbol || '$';
    const position = config.currencyPosition || 'before';
    const formattedNum = formatNumber(num, {
      valueType: 'number',
      decimalPlaces: config.decimalPlaces ?? 2,
      useGrouping: config.useGrouping ?? true
    }, locale);

    return position === 'before'
      ? `${symbol}${formattedNum}`
      : `${formattedNum}${symbol}`;
  }

  // Use Intl.NumberFormat for standard currencies
  const currencyCode = CURRENCY_CODES[preset];
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: config.decimalPlaces,
    maximumFractionDigits: config.decimalPlaces
  };

  // JPY typically has no decimal places
  if (preset === 'JPY' && config.decimalPlaces === undefined) {
    options.minimumFractionDigits = 0;
    options.maximumFractionDigits = 0;
  }

  try {
    return new Intl.NumberFormat(locale, options).format(num);
  } catch {
    return String(num);
  }
}

/**
 * Format a value as a date.
 */
function formatDate(value: unknown, config: FieldFormatConfig, locale: string): string {
  const date = toDate(value);
  if (!date || isNaN(date.getTime())) {
    return String(value);
  }

  const preset = config.dateFormat as DateFormatPreset | undefined;

  // Handle ISO format specially (not locale-dependent)
  if (preset === 'iso') {
    return date.toISOString().split('T')[0];
  }

  const options = getDateFormatOptions(preset);

  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Get Intl.DateTimeFormat options for a date preset.
 */
function getDateFormatOptions(preset?: DateFormatPreset): Intl.DateTimeFormatOptions {
  switch (preset) {
    case 'short':
      return { dateStyle: 'short' };
    case 'medium':
      return { dateStyle: 'medium' };
    case 'long':
      return { dateStyle: 'long' };
    case 'full':
      return { dateStyle: 'full' };
    case 'time-short':
      return { timeStyle: 'short' };
    case 'time-long':
      return { timeStyle: 'medium' };
    case 'datetime-short':
      return { dateStyle: 'short', timeStyle: 'short' };
    case 'datetime-long':
      return { dateStyle: 'long', timeStyle: 'short' };
    default:
      return { dateStyle: 'medium' };
  }
}

/**
 * Convert a value to a number.
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // Remove currency symbols and grouping separators for parsing
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned);
  }
  return NaN;
}

/**
 * Convert a value to a Date object.
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Check if a format config requires markdown processing.
 */
export function isMarkdownFormat(config?: FieldFormatConfig): boolean {
  return config?.valueType === 'markdown';
}

/**
 * Get display text for a format config (for UI purposes).
 */
export function getFormatDisplayName(config?: FieldFormatConfig): string {
  if (!config || !config.valueType) {
    return 'Plain Text';
  }

  switch (config.valueType) {
    case 'number':
      return config.numberFormat
        ? `Number (${config.numberFormat})`
        : 'Number';
    case 'currency':
      return config.currencyFormat
        ? `Currency (${config.currencyFormat})`
        : 'Currency';
    case 'date':
      return config.dateFormat
        ? `Date (${config.dateFormat})`
        : 'Date';
    case 'markdown':
      return 'Markdown';
    default:
      return 'Plain Text';
  }
}
