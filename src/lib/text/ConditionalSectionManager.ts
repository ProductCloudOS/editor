import { EventEmitter } from '../events/EventEmitter';
import { ConditionalSection } from './types';

/**
 * Manages conditional sections within text content.
 * Conditional sections define ranges of content that are shown or hidden
 * based on a boolean predicate evaluated against merge data.
 * They start and end at paragraph boundaries.
 */
export class ConditionalSectionManager extends EventEmitter {
  private sections: Map<string, ConditionalSection> = new Map();
  private nextId: number = 1;

  constructor() {
    super();
  }

  /**
   * Create a new conditional section.
   * @param startIndex Text index at paragraph start (must be 0 or immediately after a newline)
   * @param endIndex Text index at closing paragraph start (must be immediately after a newline)
   * @param predicate The predicate expression to evaluate (e.g., "isActive")
   */
  create(
    startIndex: number,
    endIndex: number,
    predicate: string
  ): ConditionalSection {
    const id = `cond-${this.nextId++}`;

    const section: ConditionalSection = {
      id,
      predicate,
      startIndex,
      endIndex
    };

    this.sections.set(id, section);
    this.emit('section-added', { section });

    return section;
  }

  /**
   * Remove a conditional section by ID.
   */
  remove(id: string): ConditionalSection | undefined {
    const section = this.sections.get(id);
    if (section) {
      this.sections.delete(id);
      this.emit('section-removed', { section });
    }
    return section;
  }

  /**
   * Get a conditional section by ID.
   */
  getSection(id: string): ConditionalSection | undefined {
    return this.sections.get(id);
  }

  /**
   * Get all conditional sections.
   */
  getSections(): ConditionalSection[] {
    return Array.from(this.sections.values());
  }

  /**
   * Get all conditional sections sorted by startIndex.
   */
  getSectionsSorted(): ConditionalSection[] {
    return this.getSections().sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Get all conditional sections sorted by startIndex in descending order.
   * Useful for processing sections end-to-start during merge.
   */
  getSectionsDescending(): ConditionalSection[] {
    return this.getSections().sort((a, b) => b.startIndex - a.startIndex);
  }

  /**
   * Find a conditional section that contains the given text index.
   */
  getSectionContaining(textIndex: number): ConditionalSection | undefined {
    for (const section of this.sections.values()) {
      if (textIndex >= section.startIndex && textIndex < section.endIndex) {
        return section;
      }
    }
    return undefined;
  }

  /**
   * Find a conditional section that has a boundary at the given text index.
   * Returns the section if textIndex matches startIndex or endIndex.
   */
  getSectionAtBoundary(textIndex: number): ConditionalSection | undefined {
    for (const section of this.sections.values()) {
      if (section.startIndex === textIndex || section.endIndex === textIndex) {
        return section;
      }
    }
    return undefined;
  }

  /**
   * Update a section's predicate.
   */
  updatePredicate(id: string, predicate: string): boolean {
    const section = this.sections.get(id);
    if (!section) {
      return false;
    }

    section.predicate = predicate;
    this.emit('section-updated', { section });
    return true;
  }

  /**
   * Update a section's visual state (called during rendering).
   */
  updateVisualState(
    id: string,
    visualState: ConditionalSection['visualState']
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
      if (fromIndex <= section.startIndex) {
        section.startIndex += delta;
        section.endIndex += delta;
        changed = true;
      } else if (fromIndex < section.endIndex) {
        section.endIndex += delta;
        changed = true;
      }
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
  handleDeletion(start: number, length: number): ConditionalSection[] {
    const end = start + length;
    const removedSections: ConditionalSection[] = [];
    const sectionsToUpdate: Array<{ id: string; newStart: number; newEnd: number }> = [];

    for (const section of this.sections.values()) {
      if (section.startIndex >= start && section.endIndex <= end) {
        removedSections.push(section);
        continue;
      }

      if (section.startIndex < end && section.endIndex > start) {
        if (start <= section.startIndex) {
          removedSections.push(section);
          continue;
        }
        if (start < section.endIndex) {
          if (end >= section.endIndex) {
            const newEnd = start;
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

      if (section.startIndex >= end) {
        sectionsToUpdate.push({
          id: section.id,
          newStart: section.startIndex - length,
          newEnd: section.endIndex - length
        });
      }
    }

    for (const section of removedSections) {
      this.sections.delete(section.id);
      this.emit('section-removed', { section });
    }

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
   * Also checks that conditionals don't partially overlap repeating sections.
   * @param start The proposed start index
   * @param end The proposed end index
   * @param content The text content to validate against
   * @returns true if valid, false otherwise
   */
  validateBoundaries(start: number, end: number, content: string): boolean {
    if (start !== 0 && content[start - 1] !== '\n') {
      return false;
    }

    if (end !== 0 && end < content.length && content[end - 1] !== '\n') {
      return false;
    }

    if (end <= start) {
      return false;
    }

    // Check for overlapping conditional sections
    for (const existing of this.sections.values()) {
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
   * Get the number of conditional sections.
   */
  get count(): number {
    return this.sections.size;
  }

  /**
   * Check if there are any conditional sections.
   */
  get isEmpty(): boolean {
    return this.sections.size === 0;
  }

  /**
   * Clear all conditional sections.
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
  toJSON(): ConditionalSection[] {
    return this.getSectionsSorted().map(section => ({
      id: section.id,
      predicate: section.predicate,
      startIndex: section.startIndex,
      endIndex: section.endIndex
    }));
  }

  /**
   * Load sections from serialized data.
   */
  fromJSON(data: ConditionalSection[]): void {
    this.clear();

    for (const sectionData of data) {
      const section: ConditionalSection = {
        id: sectionData.id,
        predicate: sectionData.predicate,
        startIndex: sectionData.startIndex,
        endIndex: sectionData.endIndex
      };

      this.sections.set(section.id, section);

      const idNum = parseInt(sectionData.id.replace('cond-', ''), 10);
      if (!isNaN(idNum) && idNum >= this.nextId) {
        this.nextId = idNum + 1;
      }
    }

    this.emit('sections-loaded', { count: this.sections.size });
  }
}
