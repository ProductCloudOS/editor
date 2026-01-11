/**
 * HyperlinkManager - Manages hyperlinks within flowing text content
 */
import { EventEmitter } from '../events/EventEmitter';

/**
 * Formatting options for hyperlinks
 */
export interface HyperlinkFormatting {
  color?: string;
  underline?: boolean;
}

/**
 * Options when inserting a hyperlink
 */
export interface HyperlinkOptions {
  title?: string;
  formatting?: HyperlinkFormatting;
}

/**
 * Represents a hyperlink in the text
 */
export interface Hyperlink {
  id: string;
  url: string;
  startIndex: number;
  endIndex: number;
  title?: string;
  formatting?: HyperlinkFormatting;
}

/**
 * Update payload for hyperlinks
 */
export interface HyperlinkUpdate {
  url?: string;
  title?: string;
  startIndex?: number;
  endIndex?: number;
  formatting?: HyperlinkFormatting;
}

/**
 * Serialized hyperlink data
 */
export interface HyperlinkData {
  id: string;
  url: string;
  startIndex: number;
  endIndex: number;
  title?: string;
  formatting?: HyperlinkFormatting;
}

/**
 * Manages hyperlinks within text content
 */
export class HyperlinkManager extends EventEmitter {
  private hyperlinks: Map<string, Hyperlink> = new Map();
  private nextId: number = 1;

  /**
   * Insert a new hyperlink
   */
  insert(url: string, startIndex: number, endIndex: number, options?: HyperlinkOptions): Hyperlink {
    const id = this.generateId();
    const hyperlink: Hyperlink = {
      id,
      url,
      startIndex,
      endIndex,
      title: options?.title,
      formatting: options?.formatting
    };

    this.hyperlinks.set(id, hyperlink);
    this.emit('hyperlink-added', { hyperlink });

    return hyperlink;
  }

  /**
   * Remove a hyperlink by id
   */
  remove(id: string): void {
    if (this.hyperlinks.has(id)) {
      this.hyperlinks.delete(id);
      this.emit('hyperlink-removed', { id });
    }
  }

  /**
   * Update a hyperlink's properties
   */
  update(id: string, updates: HyperlinkUpdate): void {
    const hyperlink = this.hyperlinks.get(id);
    if (!hyperlink) {
      return;
    }

    if (updates.url !== undefined) {
      hyperlink.url = updates.url;
    }
    if (updates.title !== undefined) {
      hyperlink.title = updates.title;
    }
    if (updates.startIndex !== undefined) {
      hyperlink.startIndex = updates.startIndex;
    }
    if (updates.endIndex !== undefined) {
      hyperlink.endIndex = updates.endIndex;
    }
    if (updates.formatting !== undefined) {
      hyperlink.formatting = updates.formatting;
    }

    this.emit('hyperlink-updated', { id, updates });
  }

  /**
   * Get a hyperlink by id
   */
  getHyperlinkById(id: string): Hyperlink | undefined {
    return this.hyperlinks.get(id);
  }

  /**
   * Get the hyperlink at a specific text index
   */
  getHyperlinkAt(index: number): Hyperlink | undefined {
    for (const hyperlink of this.hyperlinks.values()) {
      if (index >= hyperlink.startIndex && index < hyperlink.endIndex) {
        return hyperlink;
      }
    }
    return undefined;
  }

  /**
   * Get all hyperlinks overlapping a range
   */
  getHyperlinksInRange(startIndex: number, endIndex: number): Hyperlink[] {
    const result: Hyperlink[] = [];

    for (const hyperlink of this.hyperlinks.values()) {
      // Check if ranges overlap
      if (hyperlink.startIndex < endIndex && hyperlink.endIndex > startIndex) {
        result.push(hyperlink);
      }
    }

    return result;
  }

  /**
   * Get all hyperlinks
   */
  getAll(): Hyperlink[] {
    return Array.from(this.hyperlinks.values());
  }

  /**
   * Shift hyperlinks after text insertion
   */
  shiftHyperlinks(insertionPoint: number, delta: number): void {
    for (const hyperlink of this.hyperlinks.values()) {
      if (insertionPoint <= hyperlink.startIndex) {
        // Insertion is before hyperlink - shift both start and end
        hyperlink.startIndex += delta;
        hyperlink.endIndex += delta;
      } else if (insertionPoint < hyperlink.endIndex) {
        // Insertion is within hyperlink - only expand end
        hyperlink.endIndex += delta;
      }
      // If insertion is after hyperlink, do nothing
    }
  }

  /**
   * Handle text deletion and adjust hyperlinks accordingly
   */
  handleDeletion(startIndex: number, length: number): void {
    const endIndex = startIndex + length;
    const toRemove: string[] = [];

    for (const hyperlink of this.hyperlinks.values()) {
      const hStart = hyperlink.startIndex;
      const hEnd = hyperlink.endIndex;

      // Case 1: Deletion is completely after hyperlink - do nothing
      if (startIndex >= hEnd) {
        continue;
      }

      // Case 2: Deletion is completely before hyperlink - shift both indices
      if (endIndex <= hStart) {
        hyperlink.startIndex -= length;
        hyperlink.endIndex -= length;
        continue;
      }

      // Case 3: Deletion fully contains hyperlink - remove it
      if (startIndex <= hStart && endIndex >= hEnd) {
        toRemove.push(hyperlink.id);
        continue;
      }

      // Case 4: Deletion is fully inside hyperlink - shrink it
      if (startIndex > hStart && endIndex < hEnd) {
        hyperlink.endIndex -= length;
        continue;
      }

      // Case 5: Deletion overlaps start of hyperlink
      if (startIndex <= hStart && endIndex > hStart && endIndex < hEnd) {
        // Move start to deletion point, shrink total length
        hyperlink.startIndex = startIndex;
        hyperlink.endIndex = hEnd - endIndex + startIndex;
        continue;
      }

      // Case 6: Deletion overlaps end of hyperlink
      if (startIndex > hStart && startIndex < hEnd && endIndex >= hEnd) {
        hyperlink.endIndex = startIndex;
        continue;
      }
    }

    // Remove hyperlinks that were fully deleted
    for (const id of toRemove) {
      this.hyperlinks.delete(id);
      this.emit('hyperlink-removed', { id });
    }
  }

  /**
   * Remove all hyperlinks
   */
  clear(): void {
    this.hyperlinks.clear();
    this.emit('hyperlinks-cleared');
  }

  /**
   * Serialize hyperlinks to JSON
   */
  toJSON(): HyperlinkData[] {
    return this.getAll().map(h => ({
      id: h.id,
      url: h.url,
      startIndex: h.startIndex,
      endIndex: h.endIndex,
      title: h.title,
      formatting: h.formatting
    }));
  }

  /**
   * Load hyperlinks from JSON
   */
  fromJSON(data: HyperlinkData[]): void {
    this.hyperlinks.clear();

    for (const item of data) {
      const hyperlink: Hyperlink = {
        id: item.id,
        url: item.url,
        startIndex: item.startIndex,
        endIndex: item.endIndex,
        title: item.title,
        formatting: item.formatting
      };
      this.hyperlinks.set(item.id, hyperlink);
    }

    this.emit('hyperlinks-loaded');
  }

  /**
   * Generate a unique id
   */
  private generateId(): string {
    return `hyperlink-${this.nextId++}`;
  }
}
