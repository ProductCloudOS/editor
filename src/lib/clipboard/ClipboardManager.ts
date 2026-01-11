/**
 * ClipboardManager handles copy, cut, and paste operations for the PC Editor.
 *
 * Supports:
 * - Proprietary format (full fidelity)
 * - Plain text
 * - HTML (for interoperability)
 * - Image paste
 */

import { EventEmitter } from '../events/EventEmitter';
import type { FlowingTextContent } from '../text/FlowingTextContent';
import type {
  TextFormattingRunData,
  ParagraphFormattingData,
  SubstitutionFieldData,
  EmbeddedObjectReference,
  HyperlinkSerializedData
} from '../types';
import type { TextFormattingStyle } from '../text/types';
import {
  CLIPBOARD_FORMAT_VERSION,
  PCEDITOR_MIME_TYPE,
  type PCEditorClipboardData,
  type ClipboardContent,
  type ClipboardContentType,
  type ClipboardReadResult,
  type CopyOptions,
  type PasteOptions
} from './types';
import { HtmlConverter } from './HtmlConverter';

/**
 * Manages clipboard operations for the editor.
 */
export class ClipboardManager extends EventEmitter {
  private htmlConverter: HtmlConverter;

  constructor() {
    super();
    this.htmlConverter = new HtmlConverter();
  }

  /**
   * Copy the selected content from a FlowingTextContent to the clipboard.
   * Returns true if content was copied, false if nothing was selected.
   */
  async copy(
    flowingContent: FlowingTextContent,
    options: CopyOptions = {}
  ): Promise<boolean> {
    const { includePlainText = true, includeHtml = true } = options;

    const selection = flowingContent.getSelection();
    if (!selection || selection.start === selection.end) {
      return false;
    }

    // Extract content for the selection range
    const clipboardData = this.extractSelectionContent(flowingContent, selection.start, selection.end);

    // Prepare clipboard items
    const clipboardItems: Record<string, Blob> = {};

    // Primary format: proprietary JSON
    const jsonData = JSON.stringify(clipboardData);
    clipboardItems[PCEDITOR_MIME_TYPE] = new Blob([jsonData], { type: PCEDITOR_MIME_TYPE });

    // Fallback: plain text
    if (includePlainText) {
      const plainText = this.extractPlainText(clipboardData.content.text);
      clipboardItems['text/plain'] = new Blob([plainText], { type: 'text/plain' });
    }

    // Fallback: HTML
    if (includeHtml) {
      const html = this.htmlConverter.toHtml(clipboardData.content);
      clipboardItems['text/html'] = new Blob([html], { type: 'text/html' });
    }

    // Write to clipboard
    try {
      await navigator.clipboard.write([
        new ClipboardItem(clipboardItems)
      ]);
      this.emit('copy', { success: true, contentType: clipboardData.type });
      return true;
    } catch (error) {
      // Fallback for browsers that don't support ClipboardItem with custom types
      try {
        // Just write text as fallback
        const plainText = this.extractPlainText(clipboardData.content.text);
        await navigator.clipboard.writeText(plainText);

        // Store proprietary data in a module-level cache for internal paste
        this.cachedClipboardData = clipboardData;

        this.emit('copy', { success: true, contentType: clipboardData.type, fallback: true });
        return true;
      } catch (fallbackError) {
        console.error('Clipboard write failed:', fallbackError);
        this.emit('copy', { success: false, error: fallbackError });
        return false;
      }
    }
  }

  // Cache for browsers that don't support custom MIME types
  private cachedClipboardData: PCEditorClipboardData | null = null;

  /**
   * Read content from the clipboard.
   * Returns the best available format.
   */
  async read(options: PasteOptions = {}): Promise<ClipboardReadResult> {
    const { preferredFormat, asPlainText = false } = options;

    // If requesting plain text only, just get text
    if (asPlainText) {
      try {
        const text = await navigator.clipboard.readText();
        return { type: 'text', data: text };
      } catch {
        return { type: 'empty', data: null };
      }
    }

    try {
      const items = await navigator.clipboard.read();

      for (const item of items) {
        // Check for proprietary format first (unless preferring something else)
        if (item.types.includes(PCEDITOR_MIME_TYPE) && preferredFormat !== 'html' && preferredFormat !== 'text') {
          const blob = await item.getType(PCEDITOR_MIME_TYPE);
          const text = await blob.text();
          const data = JSON.parse(text) as PCEditorClipboardData;
          return { type: 'pceditor', data };
        }

        // Check for images
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            return { type: 'image', data: blob };
          }
        }

        // Check for HTML
        if (item.types.includes('text/html') && preferredFormat !== 'text') {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          return { type: 'html', data: html };
        }

        // Fallback to plain text
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();

          // Check if we have cached proprietary data that matches
          if (this.cachedClipboardData &&
              this.extractPlainText(this.cachedClipboardData.content.text) === text) {
            return { type: 'pceditor', data: this.cachedClipboardData };
          }

          return { type: 'text', data: text };
        }
      }

      return { type: 'empty', data: null };
    } catch (error) {
      // Fallback to readText for browsers with limited clipboard API
      try {
        const text = await navigator.clipboard.readText();

        // Check if we have cached proprietary data that matches
        if (this.cachedClipboardData &&
            this.extractPlainText(this.cachedClipboardData.content.text) === text) {
          return { type: 'pceditor', data: this.cachedClipboardData };
        }

        return { type: 'text', data: text };
      } catch {
        return { type: 'empty', data: null };
      }
    }
  }

  /**
   * Extract content from a FlowingTextContent for a given range.
   * All indices in the result are relative to the start of the selection (0-based).
   */
  extractSelectionContent(
    flowingContent: FlowingTextContent,
    start: number,
    end: number
  ): PCEditorClipboardData {
    const text = flowingContent.getText().substring(start, end);

    // Determine content type
    let type: ClipboardContentType = 'text';
    const hasObjects = text.includes('\uFFFC'); // OBJECT_REPLACEMENT_CHAR
    if (hasObjects && text.replace(/\uFFFC/g, '').trim() === '') {
      type = 'object';
    } else if (hasObjects) {
      type = 'mixed';
    }

    // Extract formatting runs for the range
    const formattingRuns = this.extractFormattingRuns(flowingContent, start, end);

    // Extract paragraph formatting for the range
    const paragraphFormatting = this.extractParagraphFormatting(flowingContent, start, end);

    // Extract substitution fields in the range
    const substitutionFields = this.extractSubstitutionFields(flowingContent, start, end);

    // Extract embedded objects in the range
    const embeddedObjects = this.extractEmbeddedObjects(flowingContent, start, end);

    // Extract hyperlinks in the range
    const hyperlinks = this.extractHyperlinks(flowingContent, start, end);

    const content: ClipboardContent = {
      text,
      formattingRuns: formattingRuns.length > 0 ? formattingRuns : undefined,
      paragraphFormatting: paragraphFormatting.length > 0 ? paragraphFormatting : undefined,
      substitutionFields: substitutionFields.length > 0 ? substitutionFields : undefined,
      embeddedObjects: embeddedObjects.length > 0 ? embeddedObjects : undefined,
      hyperlinks: hyperlinks.length > 0 ? hyperlinks : undefined
    };

    return {
      version: CLIPBOARD_FORMAT_VERSION,
      type,
      content,
      metadata: {
        copiedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Extract formatting runs for a range, adjusting indices to be 0-based.
   */
  private extractFormattingRuns(
    flowingContent: FlowingTextContent,
    start: number,
    end: number
  ): TextFormattingRunData[] {
    const runs: TextFormattingRunData[] = [];
    const formattingManager = flowingContent.getFormattingManager();
    const defaultFormat = formattingManager.defaultFormatting;
    let lastFormat: TextFormattingStyle | null = null;

    for (let i = start; i < end; i++) {
      const currentFormat = formattingManager.getFormattingAt(i);

      const formatChanged = lastFormat === null ||
        currentFormat.fontFamily !== lastFormat.fontFamily ||
        currentFormat.fontSize !== lastFormat.fontSize ||
        currentFormat.fontWeight !== lastFormat.fontWeight ||
        currentFormat.fontStyle !== lastFormat.fontStyle ||
        currentFormat.color !== lastFormat.color ||
        currentFormat.backgroundColor !== lastFormat.backgroundColor;

      if (formatChanged) {
        const isDefault =
          currentFormat.fontFamily === defaultFormat.fontFamily &&
          currentFormat.fontSize === defaultFormat.fontSize &&
          currentFormat.fontWeight === defaultFormat.fontWeight &&
          currentFormat.fontStyle === defaultFormat.fontStyle &&
          currentFormat.color === defaultFormat.color &&
          currentFormat.backgroundColor === defaultFormat.backgroundColor;

        if (!isDefault || runs.length > 0) {
          runs.push({
            index: i - start, // Make index relative to selection start
            formatting: {
              fontFamily: currentFormat.fontFamily,
              fontSize: currentFormat.fontSize,
              fontWeight: currentFormat.fontWeight,
              fontStyle: currentFormat.fontStyle,
              color: currentFormat.color,
              backgroundColor: currentFormat.backgroundColor
            }
          });
        }
        lastFormat = currentFormat;
      }
    }

    return runs;
  }

  /**
   * Extract paragraph formatting for a range, adjusting indices to be 0-based.
   */
  private extractParagraphFormatting(
    flowingContent: FlowingTextContent,
    start: number,
    end: number
  ): ParagraphFormattingData[] {
    const text = flowingContent.getText();
    const paragraphManager = flowingContent.getParagraphFormattingManager();
    const result: ParagraphFormattingData[] = [];
    const seen = new Set<number>();

    for (let i = start; i < end; i++) {
      const paragraphStart = paragraphManager.getParagraphStart(i, text);

      if (!seen.has(paragraphStart) && paragraphStart >= start) {
        seen.add(paragraphStart);
        const formatting = paragraphManager.getFormattingForParagraph(paragraphStart);
        result.push({
          paragraphStart: paragraphStart - start, // Make relative
          formatting: {
            alignment: formatting.alignment
          }
        });
      }
    }

    // Also handle the first paragraph if it starts before the selection
    const firstParagraphStart = paragraphManager.getParagraphStart(start, text);
    if (firstParagraphStart < start && !seen.has(firstParagraphStart)) {
      const formatting = paragraphManager.getFormattingForParagraph(firstParagraphStart);
      result.unshift({
        paragraphStart: 0, // Starts at beginning of selection
        formatting: {
          alignment: formatting.alignment
        }
      });
    }

    return result;
  }

  /**
   * Extract substitution fields in a range, adjusting indices to be 0-based.
   */
  private extractSubstitutionFields(
    flowingContent: FlowingTextContent,
    start: number,
    end: number
  ): SubstitutionFieldData[] {
    const fields = flowingContent.getSubstitutionFieldsInRange(start, end);
    return fields.map(field => ({
      id: field.id,
      textIndex: field.textIndex - start, // Make relative
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      displayFormat: field.displayFormat,
      defaultValue: field.defaultValue,
      formatting: field.formatting ? {
        fontFamily: field.formatting.fontFamily,
        fontSize: field.formatting.fontSize,
        fontWeight: field.formatting.fontWeight,
        fontStyle: field.formatting.fontStyle,
        color: field.formatting.color,
        backgroundColor: field.formatting.backgroundColor
      } : undefined
    }));
  }

  /**
   * Extract embedded objects in a range, adjusting indices to be 0-based.
   */
  private extractEmbeddedObjects(
    flowingContent: FlowingTextContent,
    start: number,
    end: number
  ): EmbeddedObjectReference[] {
    const objects = flowingContent.getEmbeddedObjectsInRange(start, end);
    return objects.map(({ textIndex, object }) => ({
      textIndex: textIndex - start, // Make relative
      object: object.toData()
    }));
  }

  /**
   * Extract hyperlinks in a range, adjusting indices to be 0-based.
   */
  private extractHyperlinks(
    flowingContent: FlowingTextContent,
    start: number,
    end: number
  ): HyperlinkSerializedData[] {
    const hyperlinks = flowingContent.getHyperlinksInRange(start, end);
    return hyperlinks.map(link => {
      // Clamp hyperlink bounds to selection range
      const clampedStart = Math.max(link.startIndex, start) - start;
      const clampedEnd = Math.min(link.endIndex, end) - start;

      return {
        id: link.id,
        url: link.url,
        startIndex: clampedStart,
        endIndex: clampedEnd,
        title: link.title,
        formatting: link.formatting
      };
    });
  }

  /**
   * Extract plain text from content, replacing embedded objects with placeholders.
   */
  private extractPlainText(text: string): string {
    // Replace OBJECT_REPLACEMENT_CHAR with a space or empty string
    return text.replace(/\uFFFC/g, ' ').replace(/\s+/g, ' ').trim() || text.replace(/\uFFFC/g, '');
  }

  /**
   * Parse HTML content into clipboard data format.
   */
  parseHtml(html: string): ClipboardContent {
    return this.htmlConverter.fromHtml(html);
  }

  /**
   * Generate new IDs for all items in clipboard content.
   * This is needed when pasting to avoid ID conflicts.
   */
  generateNewIds(content: ClipboardContent): ClipboardContent {
    const idMap = new Map<string, string>();

    const generateId = (prefix: string): string => {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Clone content with new IDs
    const result: ClipboardContent = {
      text: content.text,
      formattingRuns: content.formattingRuns,
      paragraphFormatting: content.paragraphFormatting
    };

    if (content.substitutionFields) {
      result.substitutionFields = content.substitutionFields.map(field => {
        const newId = generateId('field');
        idMap.set(field.id, newId);
        return { ...field, id: newId };
      });
    }

    if (content.embeddedObjects) {
      result.embeddedObjects = content.embeddedObjects.map(ref => {
        const newId = generateId('obj');
        idMap.set(ref.object.id, newId);
        return {
          textIndex: ref.textIndex,
          object: { ...ref.object, id: newId }
        };
      });
    }

    if (content.hyperlinks) {
      result.hyperlinks = content.hyperlinks.map(link => {
        const newId = generateId('link');
        idMap.set(link.id, newId);
        return { ...link, id: newId };
      });
    }

    return result;
  }

  /**
   * Create an ImageObject data from a Blob.
   */
  async createImageFromBlob(blob: Blob): Promise<{ dataUrl: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        // Load image to get dimensions
        const img = new Image();
        img.onload = () => {
          resolve({
            dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        };
        img.onerror = reject;
        img.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
