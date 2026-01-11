/**
 * HtmlConverter handles conversion between PC Editor content and HTML.
 * Used for clipboard interoperability with external applications.
 */

import type { ClipboardContent } from './types';
import type { TextFormattingRunData } from '../types';

/**
 * Converts between PC Editor content format and HTML.
 */
export class HtmlConverter {
  /**
   * Convert clipboard content to HTML string.
   */
  toHtml(content: ClipboardContent): string {
    const { text, formattingRuns } = content;

    if (!text) {
      return '';
    }

    // If no formatting, just wrap in a simple container
    if (!formattingRuns || formattingRuns.length === 0) {
      return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    // Build HTML with formatting spans
    let html = '';
    let currentRun = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Check if we need to start a new run
      if (currentRun < formattingRuns.length && formattingRuns[currentRun].index === i) {
        // Close previous span if any
        if (i > 0) {
          html += '</span>';
        }

        // Start new span with formatting
        const formatting = formattingRuns[currentRun].formatting;
        html += this.createStyledSpan(formatting);
        currentRun++;
      } else if (i === 0 && (formattingRuns.length === 0 || formattingRuns[0].index > 0)) {
        // No formatting at start, use default span
        html += '<span>';
      }

      // Handle special characters
      if (char === '\n') {
        html += '<br>';
      } else if (char === '\uFFFC') {
        // Object replacement character - insert placeholder
        html += '<span data-object="true">[Object]</span>';
      } else {
        html += this.escapeHtml(char);
      }
    }

    // Close final span
    if (text.length > 0) {
      html += '</span>';
    }

    return html;
  }

  /**
   * Parse HTML string into clipboard content format.
   */
  fromHtml(html: string): ClipboardContent {
    // Create a temporary DOM element to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    // Extract text and formatting
    const result: { text: string; runs: TextFormattingRunData[] } = {
      text: '',
      runs: []
    };

    this.processNode(body, result, null);

    return {
      text: result.text,
      formattingRuns: result.runs.length > 0 ? result.runs : undefined
    };
  }

  /**
   * Process a DOM node and extract text with formatting.
   */
  private processNode(
    node: Node,
    result: { text: string; runs: TextFormattingRunData[] },
    inheritedFormatting: TextFormattingRunData['formatting'] | null
  ): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text && inheritedFormatting) {
        // Add formatting run at current position if different from last
        const lastRun = result.runs[result.runs.length - 1];
        if (!lastRun || !this.formattingEquals(lastRun.formatting, inheritedFormatting)) {
          result.runs.push({
            index: result.text.length,
            formatting: inheritedFormatting
          });
        }
      }
      result.text += text;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    // Handle block elements - add newlines
    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
      if (result.text.length > 0 && !result.text.endsWith('\n')) {
        result.text += '\n';
      }
    }

    // Handle line breaks
    if (tagName === 'br') {
      result.text += '\n';
      return;
    }

    // Extract formatting from this element
    const formatting = this.extractFormatting(element, inheritedFormatting);

    // Process children
    for (const child of Array.from(node.childNodes)) {
      this.processNode(child, result, formatting);
    }

    // Add newline after block elements
    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr'].includes(tagName)) {
      if (!result.text.endsWith('\n')) {
        result.text += '\n';
      }
    }
  }

  /**
   * Extract formatting from an HTML element.
   */
  private extractFormatting(
    element: HTMLElement,
    inherited: TextFormattingRunData['formatting'] | null
  ): TextFormattingRunData['formatting'] {
    const tagName = element.tagName.toLowerCase();
    const style = element.style;

    // Start with inherited or default formatting
    const formatting: TextFormattingRunData['formatting'] = inherited ? { ...inherited } : {
      fontFamily: 'Arial',
      fontSize: 12,
      color: '#000000'
    };

    // Apply tag-based formatting
    if (tagName === 'b' || tagName === 'strong') {
      formatting.fontWeight = 'bold';
    }
    if (tagName === 'i' || tagName === 'em') {
      formatting.fontStyle = 'italic';
    }

    // Apply inline styles
    if (style.fontFamily) {
      formatting.fontFamily = style.fontFamily.replace(/['"]/g, '').split(',')[0].trim();
    }
    if (style.fontSize) {
      const size = parseFloat(style.fontSize);
      if (!isNaN(size)) {
        // Convert from px to pt (approximate)
        formatting.fontSize = style.fontSize.includes('pt') ? size : Math.round(size * 0.75);
      }
    }
    if (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700) {
      formatting.fontWeight = 'bold';
    }
    if (style.fontStyle === 'italic') {
      formatting.fontStyle = 'italic';
    }
    if (style.color) {
      formatting.color = this.normalizeColor(style.color);
    }
    if (style.backgroundColor) {
      formatting.backgroundColor = this.normalizeColor(style.backgroundColor);
    }

    return formatting;
  }

  /**
   * Compare two formatting objects for equality.
   */
  private formattingEquals(
    a: TextFormattingRunData['formatting'],
    b: TextFormattingRunData['formatting']
  ): boolean {
    return a.fontFamily === b.fontFamily &&
           a.fontSize === b.fontSize &&
           a.fontWeight === b.fontWeight &&
           a.fontStyle === b.fontStyle &&
           a.color === b.color &&
           a.backgroundColor === b.backgroundColor;
  }

  /**
   * Create an HTML span with inline styles from formatting.
   */
  private createStyledSpan(formatting: TextFormattingRunData['formatting']): string {
    const styles: string[] = [];

    if (formatting.fontFamily) {
      styles.push(`font-family: ${formatting.fontFamily}`);
    }
    if (formatting.fontSize) {
      styles.push(`font-size: ${formatting.fontSize}pt`);
    }
    if (formatting.fontWeight) {
      styles.push(`font-weight: ${formatting.fontWeight}`);
    }
    if (formatting.fontStyle) {
      styles.push(`font-style: ${formatting.fontStyle}`);
    }
    if (formatting.color) {
      styles.push(`color: ${formatting.color}`);
    }
    if (formatting.backgroundColor) {
      styles.push(`background-color: ${formatting.backgroundColor}`);
    }

    return `<span style="${styles.join('; ')}">`;
  }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Normalize a color value to hex format.
   */
  private normalizeColor(color: string): string {
    // Handle rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    // Already hex or named color
    return color;
  }
}
