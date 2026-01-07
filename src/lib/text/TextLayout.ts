import { TextMeasurer } from './TextMeasurer';
import { TextFormattingManager } from './TextFormatting';
import { ParagraphFormattingManager } from './ParagraphFormatting';
import { SubstitutionFieldManager } from './SubstitutionFieldManager';
import { EmbeddedObjectManager } from './EmbeddedObjectManager';
import {
  TextFormattingStyle,
  TextRun,
  FlowedLine,
  FlowedPage,
  FlowedSubstitutionField,
  FlowedEmbeddedObject,
  TextAlignment
} from './types';

/**
 * Context for text layout operations.
 */
export interface LayoutContext {
  availableWidth: number;
  availableHeight: number;
  measurer: TextMeasurer;
  formatting: TextFormattingManager;
  paragraphFormatting: ParagraphFormattingManager;
  substitutionFields: SubstitutionFieldManager;
  embeddedObjects: EmbeddedObjectManager;
  content: string;
}

/**
 * Internal structure for tracking line building state.
 */
interface LineBuilder {
  text: string;
  width: number;
  height: number;
  baseline: number;
  runs: TextRun[];
  substitutionFields: FlowedSubstitutionField[];
  embeddedObjects: FlowedEmbeddedObject[];
  startIndex: number;
  endIndex: number;
}

/**
 * Handles text layout: line breaking and page flow.
 * This is the core algorithm for flowing text across multiple lines and pages.
 */
export class TextLayout {
  /**
   * Flow text content into pages based on available dimensions.
   */
  flowText(content: string, context: LayoutContext): FlowedPage[] {
    if (!content) {
      return [this.createEmptyPage(context)];
    }

    // Split content by explicit newlines into logical lines
    const logicalLines = this.splitIntoLogicalLines(content);

    // Wrap each logical line and collect all visual lines
    const allLines: FlowedLine[] = [];
    let globalIndex = 0;

    for (let i = 0; i < logicalLines.length; i++) {
      const logicalLine = logicalLines[i];
      const isLastLogicalLine = i === logicalLines.length - 1;

      // Account for newline character at the end (except for last line)
      const lineEndIndex = globalIndex + logicalLine.length;

      // Get paragraph alignment for this logical line
      const paragraphFormatting = context.paragraphFormatting.getFormattingForParagraph(globalIndex);
      const alignment = paragraphFormatting.alignment;

      // Wrap this logical line into one or more visual lines
      const wrappedLines = this.wrapLogicalLine(
        logicalLine,
        globalIndex,
        context,
        alignment,
        isLastLogicalLine
      );

      // Mark the last visual line of this logical line as ending with newline
      // (unless it's the very last logical line of the document)
      if (!isLastLogicalLine && wrappedLines.length > 0) {
        wrappedLines[wrappedLines.length - 1].endsWithNewline = true;
      }

      allLines.push(...wrappedLines);

      // Move past this line plus the newline character
      globalIndex = lineEndIndex + (i < logicalLines.length - 1 ? 1 : 0);
    }

    // Paginate the lines
    return this.paginateLines(allLines, context.availableHeight);
  }

  /**
   * Split content by newline characters.
   */
  private splitIntoLogicalLines(content: string): string[] {
    return content.split('\n');
  }

  /**
   * Wrap a single logical line into one or more visual lines.
   * Handles per-character formatting by creating separate runs when formatting changes.
   * Uses a segment-based approach for more robust line breaking.
   */
  private wrapLogicalLine(
    lineText: string,
    startIndex: number,
    context: LayoutContext,
    alignment: TextAlignment,
    _isLastParagraph: boolean
  ): FlowedLine[] {
    const { availableWidth, formatting } = context;
    const lines: FlowedLine[] = [];

    // Handle empty lines (just newlines)
    if (lineText.length === 0) {
      lines.push(this.createEmptyLine(startIndex, formatting, alignment));
      return lines;
    }

    // First, split into segments at whitespace boundaries
    const segments = this.splitIntoSegments(lineText, startIndex, context);

    let currentLine = this.createLineBuilder(startIndex, formatting);
    let currentX = 0;

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const segment = segments[segIdx];
      const isWhitespace = segment.text.length > 0 && /^\s+$/.test(segment.text);

      // Check if segment fits on current line
      if (currentLine.width + segment.width > availableWidth && currentLine.text.length > 0) {
        if (isWhitespace) {
          // Whitespace that overflows: add it to current line anyway (trailing whitespace)
          // It will visually overflow but text remains logically on this line
          this.addSegmentToLine(currentLine, segment, currentX);
          currentX += segment.width;

          // If there's a next segment (a word), start a new line for it
          if (segIdx + 1 < segments.length) {
            // This is not the last line of the paragraph
            lines.push(this.finalizeLineBuilder(currentLine, alignment, false, availableWidth));
            const nextSegment = segments[segIdx + 1];
            currentLine = this.createLineBuilder(nextSegment.startIndex, formatting);
            currentX = 0;
          }
          continue;
        } else {
          // Non-whitespace segment doesn't fit, start a new line
          // This is not the last line of the paragraph
          lines.push(this.finalizeLineBuilder(currentLine, alignment, false, availableWidth));
          currentLine = this.createLineBuilder(segment.startIndex, formatting);
          currentX = 0;
        }
      }

      // Add segment to current line
      this.addSegmentToLine(currentLine, segment, currentX);
      currentX += segment.width;
    }

    // Finalize the last line (this IS the last line of the paragraph)
    if (currentLine.text.length > 0 || lines.length === 0) {
      lines.push(this.finalizeLineBuilder(currentLine, alignment, true, availableWidth));
    }

    return lines;
  }

  /**
   * Split text into segments at whitespace boundaries, measuring each segment.
   */
  private splitIntoSegments(
    lineText: string,
    startIndex: number,
    context: LayoutContext
  ): Array<{
    text: string;
    startIndex: number;
    width: number;
    height: number;
    baseline: number;
    runs: TextRun[];
    substitutionFields: FlowedSubstitutionField[];
    embeddedObjects: FlowedEmbeddedObject[];
  }> {
    const segments: Array<{
      text: string;
      startIndex: number;
      width: number;
      height: number;
      baseline: number;
      runs: TextRun[];
      substitutionFields: FlowedSubstitutionField[];
      embeddedObjects: FlowedEmbeddedObject[];
    }> = [];

    let i = 0;

    while (i < lineText.length) {
      const char = lineText[i];
      const isWhitespace = /\s/.test(char);

      // Find the end of this segment (word or whitespace run)
      let segmentEnd = i + 1;
      while (segmentEnd < lineText.length) {
        const nextChar = lineText[segmentEnd];
        const nextIsWhitespace = /\s/.test(nextChar);
        if (nextIsWhitespace !== isWhitespace) {
          break;
        }
        segmentEnd++;
      }

      // Measure and build the segment
      const segment = this.measureSegment(
        lineText.substring(i, segmentEnd),
        startIndex + i,
        context
      );
      segments.push(segment);

      i = segmentEnd;
    }

    return segments;
  }

  /**
   * Measure a segment of text, creating runs for formatting changes.
   */
  private measureSegment(
    text: string,
    startIndex: number,
    context: LayoutContext
  ): {
    text: string;
    startIndex: number;
    width: number;
    height: number;
    baseline: number;
    runs: TextRun[];
    substitutionFields: FlowedSubstitutionField[];
    embeddedObjects: FlowedEmbeddedObject[];
  } {
    const { formatting, substitutionFields, embeddedObjects, measurer } = context;

    let width = 0;
    let height = 0;
    let baseline = 0;
    const runs: TextRun[] = [];
    const fields: FlowedSubstitutionField[] = [];
    const objects: FlowedEmbeddedObject[] = [];

    let currentRun: { text: string; formatting: TextFormattingStyle; startIndex: number } | null = null;

    for (let i = 0; i < text.length; i++) {
      const charIndex = startIndex + i;
      const char = text[i];
      const charFormatting = formatting.getFormattingAt(charIndex);

      // Check for embedded content
      const field = substitutionFields.getFieldAt(charIndex);
      const object = embeddedObjects.getObjectAt(charIndex);

      if (field) {
        // Finalize current run
        if (currentRun && currentRun.text.length > 0) {
          runs.push({
            text: currentRun.text,
            formatting: currentRun.formatting,
            startIndex: currentRun.startIndex,
            endIndex: currentRun.startIndex + currentRun.text.length
          });
          currentRun = null;
        }

        const fieldMeasure = measurer.measureSubstitutionField(field, charFormatting);
        fields.push({
          field,
          textIndex: charIndex,
          x: width,
          width: fieldMeasure.width
        });
        runs.push({
          text: char,
          formatting: charFormatting,
          startIndex: charIndex,
          endIndex: charIndex + 1
        });
        width += fieldMeasure.width;
        height = Math.max(height, fieldMeasure.height);
        baseline = Math.max(baseline, charFormatting.fontSize * 0.8);

      } else if (object) {
        // Finalize current run
        if (currentRun && currentRun.text.length > 0) {
          runs.push({
            text: currentRun.text,
            formatting: currentRun.formatting,
            startIndex: currentRun.startIndex,
            endIndex: currentRun.startIndex + currentRun.text.length
          });
          currentRun = null;
        }

        const objWidth = object.width + 2;
        objects.push({
          object,
          textIndex: charIndex,
          x: width
        });
        runs.push({
          text: char,
          formatting: charFormatting,
          startIndex: charIndex,
          endIndex: charIndex + 1
        });
        width += objWidth;
        if (object.position === 'inline') {
          height = Math.max(height, object.height);
        }
        baseline = Math.max(baseline, charFormatting.fontSize * 0.8);

      } else if (char === '\uFFFC') {
        // Orphaned replacement character - skip
        continue;

      } else {
        // Regular character
        const charWidth = measurer.measureCharacter(char, charFormatting);
        const charHeight = measurer.getLineHeight(charFormatting);

        // Check if formatting changed
        if (!currentRun || !this.formattingEquals(currentRun.formatting, charFormatting)) {
          if (currentRun && currentRun.text.length > 0) {
            runs.push({
              text: currentRun.text,
              formatting: currentRun.formatting,
              startIndex: currentRun.startIndex,
              endIndex: currentRun.startIndex + currentRun.text.length
            });
          }
          currentRun = { text: '', formatting: charFormatting, startIndex: charIndex };
        }

        currentRun.text += char;
        width += charWidth;
        height = Math.max(height, charHeight);
        baseline = Math.max(baseline, charFormatting.fontSize * 0.8);
      }
    }

    // Finalize last run
    if (currentRun && currentRun.text.length > 0) {
      runs.push({
        text: currentRun.text,
        formatting: currentRun.formatting,
        startIndex: currentRun.startIndex,
        endIndex: currentRun.startIndex + currentRun.text.length
      });
    }

    // Set default height/baseline if empty
    if (height === 0) {
      const defaultFormat = formatting.getFormattingAt(startIndex);
      height = defaultFormat.fontSize * 1.2;
      baseline = defaultFormat.fontSize * 0.8;
    }

    return {
      text,
      startIndex,
      width,
      height,
      baseline,
      runs,
      substitutionFields: fields,
      embeddedObjects: objects
    };
  }

  /**
   * Add a segment to a line, adjusting x positions.
   */
  private addSegmentToLine(
    line: LineBuilder,
    segment: {
      text: string;
      startIndex: number;
      width: number;
      height: number;
      baseline: number;
      runs: TextRun[];
      substitutionFields: FlowedSubstitutionField[];
      embeddedObjects: FlowedEmbeddedObject[];
    },
    currentX: number
  ): void {
    line.text += segment.text;
    line.width += segment.width;
    line.height = Math.max(line.height, segment.height);
    line.baseline = Math.max(line.baseline, segment.baseline);
    line.endIndex = segment.startIndex + segment.text.length;

    // Add runs
    for (const run of segment.runs) {
      line.runs.push(run);
    }

    // Add fields with adjusted x position
    for (const field of segment.substitutionFields) {
      line.substitutionFields.push({
        ...field,
        x: currentX + field.x
      });
    }

    // Add objects with adjusted x position
    for (const obj of segment.embeddedObjects) {
      line.embeddedObjects.push({
        ...obj,
        x: currentX + obj.x
      });
    }
  }

  /**
   * Compare two formatting objects for equality.
   */
  private formattingEquals(a: TextFormattingStyle, b: TextFormattingStyle): boolean {
    return (
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.fontStyle === b.fontStyle &&
      a.color === b.color &&
      a.backgroundColor === b.backgroundColor
    );
  }

  /**
   * Create a new line builder with default values.
   */
  private createLineBuilder(
    startIndex: number,
    formatting: TextFormattingManager
  ): LineBuilder {
    const defaultFormat = formatting.getFormattingAt(startIndex);
    const lineHeight = defaultFormat.fontSize * 1.2;
    const baseline = defaultFormat.fontSize * 0.8;

    return {
      text: '',
      width: 0,
      height: lineHeight,
      baseline,
      runs: [],
      substitutionFields: [],
      embeddedObjects: [],
      startIndex,
      endIndex: startIndex
    };
  }

  /**
   * Finalize a line builder into a FlowedLine.
   */
  private finalizeLineBuilder(
    builder: LineBuilder,
    alignment: TextAlignment,
    isLastLineOfParagraph: boolean,
    availableWidth: number
  ): FlowedLine {
    const line: FlowedLine = {
      text: builder.text,
      width: builder.width,
      height: builder.height,
      baseline: builder.baseline,
      runs: builder.runs,
      substitutionFields: builder.substitutionFields,
      embeddedObjects: builder.embeddedObjects,
      startIndex: builder.startIndex,
      endIndex: builder.endIndex,
      alignment
    };

    // Calculate extra word spacing for justify mode (only for non-last lines of paragraph)
    if (alignment === 'justify' && !isLastLineOfParagraph && line.text.length > 0) {
      const wordGaps = this.countWordGaps(line.text);
      if (wordGaps > 0) {
        // Calculate the extra space needed, using the actual text width (not including trailing whitespace)
        const trimmedWidth = this.getTrimmedLineWidth(builder);
        const extraSpace = availableWidth - trimmedWidth;
        if (extraSpace > 0) {
          line.extraWordSpacing = extraSpace / wordGaps;
        }
      }
    }

    return line;
  }

  /**
   * Count word gaps in text (transitions from word to whitespace).
   */
  private countWordGaps(text: string): number {
    const trimmed = text.trimEnd();
    let gaps = 0;
    let inWord = false;

    for (const char of trimmed) {
      const isWhitespace = /\s/.test(char);
      if (!isWhitespace && !inWord) {
        inWord = true;
      } else if (isWhitespace && inWord) {
        gaps++;
        inWord = false;
      }
    }

    return gaps;
  }

  /**
   * Get the width of a line excluding trailing whitespace.
   */
  private getTrimmedLineWidth(builder: LineBuilder): number {
    const trimmedText = builder.text.trimEnd();
    const trailingWhitespace = builder.text.length - trimmedText.length;

    if (trailingWhitespace === 0) {
      return builder.width;
    }

    // We need to subtract the width of trailing whitespace
    // Estimate based on average space width from the runs
    // This is approximate but should work for most cases
    let trailingWidth = 0;
    let charsToRemove = trailingWhitespace;

    // Go through runs backwards to find trailing whitespace width
    for (let i = builder.runs.length - 1; i >= 0 && charsToRemove > 0; i--) {
      const run = builder.runs[i];
      const runTrailing = Math.min(charsToRemove, run.text.length);
      // Approximate: each trailing char is about fontSize * 0.3 wide (for space)
      trailingWidth += runTrailing * run.formatting.fontSize * 0.3;
      charsToRemove -= runTrailing;
    }

    return Math.max(0, builder.width - trailingWidth);
  }

  /**
   * Create an empty line for newline-only content.
   */
  private createEmptyLine(
    index: number,
    formatting: TextFormattingManager,
    alignment: TextAlignment
  ): FlowedLine {
    const defaultFormat = formatting.getFormattingAt(index);
    const lineHeight = defaultFormat.fontSize * 1.2;

    return {
      text: '',
      width: 0,
      height: lineHeight,
      baseline: defaultFormat.fontSize * 0.8,
      runs: [],
      substitutionFields: [],
      embeddedObjects: [],
      startIndex: index,
      endIndex: index,
      alignment
    };
  }

  /**
   * Create an empty page with one empty line.
   */
  private createEmptyPage(context: LayoutContext): FlowedPage {
    // Get alignment for the first paragraph (index 0)
    const alignment = context.paragraphFormatting.getFormattingForParagraph(0).alignment;

    const emptyLine: FlowedLine = {
      text: '',
      width: 0,
      height: context.formatting.defaultFormatting.fontSize * 1.2,
      baseline: context.formatting.defaultFormatting.fontSize * 0.8,
      runs: [],
      substitutionFields: [],
      embeddedObjects: [],
      startIndex: 0,
      endIndex: 0,
      alignment
    };
    return {
      lines: [emptyLine],
      height: emptyLine.height,
      startIndex: 0,
      endIndex: 0
    };
  }

  /**
   * Split lines into pages based on available height.
   */
  private paginateLines(lines: FlowedLine[], availableHeight: number): FlowedPage[] {
    const pages: FlowedPage[] = [];
    let currentPage: FlowedPage = {
      lines: [],
      height: 0,
      startIndex: lines.length > 0 ? lines[0].startIndex : 0,
      endIndex: 0
    };

    for (const line of lines) {
      // Check if adding this line would exceed page height
      if (currentPage.height + line.height > availableHeight && currentPage.lines.length > 0) {
        // Finalize current page
        currentPage.endIndex = currentPage.lines[currentPage.lines.length - 1].endIndex;
        pages.push(currentPage);

        // Start new page
        currentPage = {
          lines: [],
          height: 0,
          startIndex: line.startIndex,
          endIndex: 0
        };
      }

      // Add line to current page
      currentPage.lines.push(line);
      currentPage.height += line.height;
    }

    // Finalize last page
    if (currentPage.lines.length > 0) {
      currentPage.endIndex = currentPage.lines[currentPage.lines.length - 1].endIndex;
      pages.push(currentPage);
    }

    // Ensure at least one page exists
    if (pages.length === 0) {
      pages.push({
        lines: [],
        height: 0,
        startIndex: 0,
        endIndex: 0
      });
    }

    return pages;
  }

  /**
   * Find which page and line contains a given text index.
   */
  findPositionForIndex(
    pages: FlowedPage[],
    textIndex: number
  ): { pageIndex: number; lineIndex: number } | null {
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      for (let lineIndex = 0; lineIndex < page.lines.length; lineIndex++) {
        const line = page.lines[lineIndex];
        if (textIndex >= line.startIndex && textIndex <= line.endIndex) {
          return { pageIndex, lineIndex };
        }
      }
    }

    // Default to end of last page
    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      return {
        pageIndex: pages.length - 1,
        lineIndex: Math.max(0, lastPage.lines.length - 1)
      };
    }

    return null;
  }

  /**
   * Get all paragraph boundaries in the content.
   * Returns indices that are valid start points for repeating sections:
   * - Index 0 (start of content)
   * - Index immediately after each newline character
   */
  getParagraphBoundaries(content: string): number[] {
    const boundaries: number[] = [0]; // Start of content is always a boundary

    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') {
        // The index after the newline is a paragraph boundary
        boundaries.push(i + 1);
      }
    }

    return boundaries;
  }
}
