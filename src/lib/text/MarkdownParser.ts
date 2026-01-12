/**
 * MarkdownParser - Basic markdown parser for field values.
 *
 * Supports a minimal subset of markdown:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - [link text](url)
 *
 * Returns parsed segments that can be used to apply formatting
 * during the merge process.
 */

import type { TextFormattingStyle } from './types';

/**
 * Type of markdown segment.
 */
export type MarkdownSegmentType = 'text' | 'bold' | 'italic' | 'bold-italic' | 'link';

/**
 * A parsed segment of markdown text.
 */
export interface MarkdownSegment {
  type: MarkdownSegmentType;
  text: string;
  url?: string;  // For links
}

/**
 * Result of parsing markdown text.
 */
export interface ParsedMarkdown {
  segments: MarkdownSegment[];
  plainText: string;  // Text with markdown syntax removed
}

/**
 * Token types for the lexer.
 */
type TokenType = 'text' | 'bold_start' | 'bold_end' | 'italic_start' | 'italic_end' | 'link';

interface Token {
  type: TokenType;
  value: string;
  url?: string;
}

/**
 * Parse markdown text into segments.
 *
 * @param text - The markdown text to parse
 * @returns Parsed markdown with segments and plain text
 */
export function parseMarkdown(text: string): ParsedMarkdown {
  const segments: MarkdownSegment[] = [];
  let plainText = '';

  // Track formatting state
  let isBold = false;
  let isItalic = false;

  // Tokenize the input
  const tokens = tokenize(text);

  for (const token of tokens) {
    switch (token.type) {
      case 'bold_start':
        isBold = true;
        break;
      case 'bold_end':
        isBold = false;
        break;
      case 'italic_start':
        isItalic = true;
        break;
      case 'italic_end':
        isItalic = false;
        break;
      case 'link':
        segments.push({
          type: 'link',
          text: token.value,
          url: token.url
        });
        plainText += token.value;
        break;
      case 'text':
        if (token.value) {
          const segmentType = getSegmentType(isBold, isItalic);
          segments.push({
            type: segmentType,
            text: token.value
          });
          plainText += token.value;
        }
        break;
    }
  }

  // Merge adjacent segments of the same type
  const mergedSegments = mergeSegments(segments);

  return {
    segments: mergedSegments,
    plainText
  };
}

/**
 * Get segment type based on bold/italic state.
 */
function getSegmentType(isBold: boolean, isItalic: boolean): MarkdownSegmentType {
  if (isBold && isItalic) return 'bold-italic';
  if (isBold) return 'bold';
  if (isItalic) return 'italic';
  return 'text';
}

/**
 * Tokenize markdown text.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let remaining = text;
  let inBold = false;
  let inItalic = false;

  while (remaining.length > 0) {
    // Check for link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push({
        type: 'link',
        value: linkMatch[1],
        url: linkMatch[2]
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Check for bold ** or __
    const boldMatch = remaining.match(/^(\*\*|__)/);
    if (boldMatch) {
      if (inBold) {
        tokens.push({ type: 'bold_end', value: '' });
        inBold = false;
      } else {
        tokens.push({ type: 'bold_start', value: '' });
        inBold = true;
      }
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for italic * or _ (but not ** or __)
    const italicMatch = remaining.match(/^(\*|_)(?!\1)/);
    if (italicMatch) {
      if (inItalic) {
        tokens.push({ type: 'italic_end', value: '' });
        inItalic = false;
      } else {
        tokens.push({ type: 'italic_start', value: '' });
        inItalic = true;
      }
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Consume text until next markdown character
    const textMatch = remaining.match(/^[^*_\[]+/);
    if (textMatch) {
      tokens.push({ type: 'text', value: textMatch[0] });
      remaining = remaining.slice(textMatch[0].length);
      continue;
    }

    // If nothing matched, consume one character as text
    tokens.push({ type: 'text', value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}

/**
 * Merge adjacent segments of the same type.
 */
function mergeSegments(segments: MarkdownSegment[]): MarkdownSegment[] {
  if (segments.length === 0) return [];

  const merged: MarkdownSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.type === current.type && segment.type !== 'link') {
      // Merge text
      current.text += segment.text;
    } else {
      merged.push(current);
      current = { ...segment };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Apply markdown formatting to a base text formatting style.
 *
 * @param baseStyle - The base text formatting style
 * @param segment - The markdown segment
 * @returns Modified formatting style
 */
export function applyMarkdownFormatting(
  baseStyle: TextFormattingStyle,
  segment: MarkdownSegment
): TextFormattingStyle {
  const style = { ...baseStyle };

  switch (segment.type) {
    case 'bold':
      style.fontWeight = 'bold';
      break;
    case 'italic':
      style.fontStyle = 'italic';
      break;
    case 'bold-italic':
      style.fontWeight = 'bold';
      style.fontStyle = 'italic';
      break;
    case 'link':
      style.color = '#0066cc';
      break;
  }

  return style;
}

/**
 * Check if text contains markdown syntax.
 */
export function containsMarkdown(text: string): boolean {
  // Check for bold, italic, or links
  return /(\*\*|__|[*_](?![*_])|\[[^\]]+\]\([^)]+\))/.test(text);
}

/**
 * Strip markdown syntax from text, returning plain text.
 */
export function stripMarkdown(text: string): string {
  return parseMarkdown(text).plainText;
}
