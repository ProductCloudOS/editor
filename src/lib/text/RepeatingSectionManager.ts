import { EventEmitter } from '../events/EventEmitter';
import { RepeatingSection } from './types';

/**
 * Manages repeating sections within text content.
 * Repeating sections define ranges of content that loop over array data during merge.
 * They start and end at paragraph boundaries.
 */
export class RepeatingSectionManager extends EventEmitter {
  private sections: Map<string, RepeatingSection> = new Map();
  private nextId: number = 1;

  constructor() {
    super();
  }

  /**
   * Create a new repeating section.
   * @param startIndex Text index at paragraph start (must be 0 or immediately after a newline)
   * @param endIndex Text index at closing paragraph start (must be immediately after a newline)
   * @param fieldPath The field path to the array to loop over (e.g., "items")
   */
  create(
    startIndex: number,
    endIndex: number,
    fieldPath: string
  ): RepeatingSection {
    const id = `section-${this.nextId++}`;

    const section: RepeatingSection = {
      id,
      fieldPath,
      startIndex,
      endIndex
    };

    this.sections.set(id, section);
    this.emit('section-added', { section });

    return section;
  }

  /**
   * Remove a repeating section by ID.
   */
  remove(id: string): RepeatingSection | undefined {
    const section = this.sections.get(id);
    if (section) {
      this.sections.delete(id);
      this.emit('section-removed', { section });
    }
    return section;
  }

  /**
   * Get a repeating section by ID.
   */
  getSection(id: string): RepeatingSection | undefined {
    return this.sections.get(id);
  }

  /**
   * Get all repeating sections.
   */
  getSections(): RepeatingSection[] {
    return Array.from(this.sections.values());
  }

  /**
   * Get all repeating sections sorted by startIndex.
   */
  getSectionsSorted(): RepeatingSection[] {
    return this.getSections().sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Get all repeating sections sorted by startIndex in descending order.
   * Useful for processing sections end-to-start during merge.
   */
  getSectionsDescending(): RepeatingSection[] {
    return this.getSections().sort((a, b) => b.startIndex - a.startIndex);
  }

  /**
   * Find a repeating section that contains the given text index.
   */
  getSectionContaining(textIndex: number): RepeatingSection | undefined {
    for (const section of this.sections.values()) {
      if (textIndex >= section.startIndex && textIndex < section.endIndex) {
        return section;
      }
    }
    return undefined;
  }

  /**
   * Find a repeating section that has a boundary at the given text index.
   * Returns the section if textIndex matches startIndex or endIndex.
   */
  getSectionAtBoundary(textIndex: number): RepeatingSection | undefined {
    for (const section of this.sections.values()) {
      if (section.startIndex === textIndex || section.endIndex === textIndex) {
        return section;
      }
    }
    return undefined;
  }

  /**
   * Update a section's field path.
   */
  updateFieldPath(id: string, fieldPath: string): boolean {
    const section = this.sections.get(id);
    if (!section) {
      return false;
    }

    section.fieldPath = fieldPath;
    this.emit('section-updated', { section });
    return true;
  }

  /**
   * Update a section's visual state (called during rendering).
   */
  updateVisualState(
    id: string,
    visualState: RepeatingSection['visualState']
  ): boolean {
    const section = this.sections.get(id);
    if (!section) {
      return false;
    }

    section.visualState = visualState;
    return true;
  }

  /**
   * Shift section positions when text is inserted.
   * @param fromIndex The position where text was inserted
   * @param delta The number of characters inserted (positive)
   */
  shiftSections(fromIndex: number, delta: number): void {
    let changed = false;

    for (const section of this.sections.values()) {
      // If insertion is before section start, shift both indices
      if (fromIndex <= section.startIndex) {
        section.startIndex += delta;
        section.endIndex += delta;
        changed = true;
      }
      // If insertion is between start and end, only shift end
      else if (fromIndex < section.endIndex) {
        section.endIndex += delta;
        changed = true;
      }
      // If insertion is at or after end, no change needed
    }

    if (changed) {
      this.emit('sections-shifted', { fromIndex, delta });
    }
  }

  /**
   * Handle deletion of text range.
   * Sections entirely within the deleted range are removed.
   * Sections partially overlapping are adjusted or removed.
   * @returns Array of removed sections
   */
  handleDeletion(start: number, length: number): RepeatingSection[] {
    const end = start + length;
    const removedSections: RepeatingSection[] = [];
    const sectionsToUpdate: Array<{ id: string; newStart: number; newEnd: number }> = [];

    for (const section of this.sections.values()) {
      // Section is entirely within deleted range - remove it
      if (section.startIndex >= start && section.endIndex <= end) {
        removedSections.push(section);
        continue;
      }

      // Section overlaps with deleted range - complex cases
      if (section.startIndex < end && section.endIndex > start) {
        // Deletion starts before section and ends within/after it
        if (start <= section.startIndex) {
          // Section start is deleted, can't maintain valid boundaries
          removedSections.push(section);
          continue;
        }
        // Deletion starts within section
        if (start < section.endIndex) {
          // Deletion ends within or at section end
          if (end >= section.endIndex) {
            // Section end is deleted, adjust end to deletion start
            const newEnd = start;
            // If section becomes empty or invalid, remove it
            if (newEnd <= section.startIndex) {
              removedSections.push(section);
              continue;
            }
            sectionsToUpdate.push({
              id: section.id,
              newStart: section.startIndex,
              newEnd: newEnd
            });
          } else {
            // Deletion is entirely within section, shrink section
            const newEnd = section.endIndex - length;
            sectionsToUpdate.push({
              id: section.id,
              newStart: section.startIndex,
              newEnd: newEnd
            });
          }
          continue;
        }
      }

      // Section is entirely after deleted range - shift both indices
      if (section.startIndex >= end) {
        sectionsToUpdate.push({
          id: section.id,
          newStart: section.startIndex - length,
          newEnd: section.endIndex - length
        });
      }
    }

    // Remove deleted sections
    for (const section of removedSections) {
      this.sections.delete(section.id);
      this.emit('section-removed', { section });
    }

    // Update remaining sections
    for (const update of sectionsToUpdate) {
      const section = this.sections.get(update.id);
      if (section) {
        section.startIndex = update.newStart;
        section.endIndex = update.newEnd;
      }
    }

    if (removedSections.length > 0 || sectionsToUpdate.length > 0) {
      this.emit('sections-changed');
    }

    return removedSections;
  }

  /**
   * Validate that the given boundaries are at paragraph boundaries.
   * @param start The proposed start index
   * @param end The proposed end index
   * @param content The text content to validate against
   * @returns true if valid, false otherwise
   */
  validateBoundaries(start: number, end: number, content: string): boolean {
    // Start must be 0 or immediately after a newline
    if (start !== 0 && content[start - 1] !== '\n') {
      return false;
    }

    // End must be immediately after a newline (or could be at content end)
    if (end !== 0 && end < content.length && content[end - 1] !== '\n') {
      return false;
    }

    // End must be after start with at least one character between
    if (end <= start) {
      return false;
    }

    // Check for overlapping sections
    for (const existing of this.sections.values()) {
      // Check if new section would overlap with existing
      if (
        (start >= existing.startIndex && start < existing.endIndex) ||
        (end > existing.startIndex && end <= existing.endIndex) ||
        (start <= existing.startIndex && end >= existing.endIndex)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the number of repeating sections.
   */
  get count(): number {
    return this.sections.size;
  }

  /**
   * Check if there are any repeating sections.
   */
  get isEmpty(): boolean {
    return this.sections.size === 0;
  }

  /**
   * Clear all repeating sections.
   */
  clear(): void {
    const hadSections = this.sections.size > 0;
    this.sections.clear();
    if (hadSections) {
      this.emit('sections-cleared');
    }
  }

  /**
   * Serialize all sections to JSON.
   */
  toJSON(): RepeatingSection[] {
    return this.getSectionsSorted().map(section => ({
      id: section.id,
      fieldPath: section.fieldPath,
      startIndex: section.startIndex,
      endIndex: section.endIndex
      // visualState is not serialized as it's computed during render
    }));
  }

  /**
   * Load sections from serialized data.
   */
  fromJSON(data: RepeatingSection[]): void {
    this.clear();

    for (const sectionData of data) {
      const section: RepeatingSection = {
        id: sectionData.id,
        fieldPath: sectionData.fieldPath,
        startIndex: sectionData.startIndex,
        endIndex: sectionData.endIndex
      };

      this.sections.set(section.id, section);

      // Update nextId to avoid collisions
      const idNum = parseInt(sectionData.id.replace('section-', ''), 10);
      if (!isNaN(idNum) && idNum >= this.nextId) {
        this.nextId = idNum + 1;
      }
    }

    this.emit('sections-loaded', { count: this.sections.size });
  }
}
