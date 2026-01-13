# FEATURE-0022: PDF Import - Implementation Plan

## Status: ✅ COMPLETED

## Overview

Implement a PDF import feature that reads PDF files and converts their content into the PC Editor document format. This feature will extract text (with formatting where possible), images, and attempt basic table detection, while clearly documenting the limitations of PDF-to-editable-document conversion.

## Research Summary

### Current Codebase Understanding

**Document Structure:**
- `Document` class manages pages, settings, and three FlowingTextContent instances (body, header, footer)
- `FlowingTextContent` coordinates text state, formatting (character and paragraph level), substitution fields, embedded objects, repeating sections, and hyperlinks
- Documents are serialized to/from `DocumentData` format with version, pages, settings, and content sections

**PDF Export (PDFGenerator.ts):**
- Uses `pdf-lib` for PDF creation
- Renders FlowedPage content line-by-line with text runs
- Handles embedded objects (ImageObject, TextBoxObject, TableObject)
- Maps standard fonts (Helvetica, Times, Courier) and filters to WinAnsi-compatible characters

**Editor Data Types:**
- `FlowingTextContentData`: text, formattingRuns, paragraphFormatting, substitutionFields, embeddedObjects, hyperlinks
- `TextFormattingStyle`: fontFamily, fontSize, fontWeight, fontStyle, color, backgroundColor
- `ParagraphFormatting`: alignment (left, center, right, justify), listFormatting
- Embedded objects: ImageObject, TextBoxObject, TableObject with serialization via EmbeddedObjectFactory

### PDF Library Analysis

Based on research, the recommended approach is to use **pdfjs-dist** (Mozilla PDF.js) for parsing because:

1. **Precise layout coordinates** - provides glyph position and font data essential for format reconstruction
2. **Image stream extraction** - can extract embedded images
3. **Layout-aware text retrieval** - maintains spatial context needed for paragraph and alignment detection
4. **Battle-tested** - most widely used PDF rendering library for JavaScript
5. **Browser compatible** - works in both Node.js and browser environments

**Alternative consideration:** `pdf2json` provides structured JSON output with coordinates and font information, which could be used as a fallback for complex documents.

## Implementation Architecture

### High-Level Design

```
PDF File
    |
    v
+-------------------+
| PDFImporter       |  <-- Main entry point
+-------------------+
    |
    v
+-------------------+
| PDFParser         |  <-- Uses pdfjs-dist to extract raw content
+-------------------+
    |   Produces: PDFExtractedContent (pages with text items, images, etc.)
    v
+-------------------+
| ContentAnalyzer   |  <-- Analyzes spatial layout to detect structure
+-------------------+
    |   Produces: AnalyzedContent (paragraphs, potential tables, etc.)
    v
+-------------------+
| DocumentBuilder   |  <-- Converts to PC Editor DocumentData format
+-------------------+
    |
    v
DocumentData
```

### Key Data Structures

```typescript
// Raw extracted content from PDF
interface PDFExtractedContent {
  pageCount: number;
  pages: PDFExtractedPage[];
  metadata?: {
    title?: string;
    author?: string;
    creationDate?: string;
  };
}

interface PDFExtractedPage {
  pageNumber: number;
  width: number;
  height: number;
  textItems: PDFTextItem[];
  images: PDFImage[];
}

interface PDFTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: { r: number; g: number; b: number };
  transform?: number[]; // 6-element transformation matrix
}

interface PDFImage {
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: Uint8Array | string; // raw data or data URL
  mimeType: 'image/png' | 'image/jpeg';
}

// Analyzed content with detected structure
interface AnalyzedContent {
  paragraphs: AnalyzedParagraph[];
  images: AnalyzedImage[];
  potentialTables: PotentialTable[];
  estimatedMargins: Margin;
  pageSize: { width: number; height: number };
}

interface AnalyzedParagraph {
  text: string;
  formattingRuns: Array<{
    startIndex: number;
    endIndex: number;
    formatting: Partial<TextFormattingStyle>;
  }>;
  alignment: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  indentation: number;
  isList?: boolean;
  listType?: 'bullet' | 'number';
  pageNumber: number;
}

interface AnalyzedImage {
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  pageNumber: number;
}

interface PotentialTable {
  rows: TableRow[];
  columnWidths: number[];
  x: number;
  y: number;
  pageNumber: number;
  confidence: number; // 0-1 score of table detection confidence
}
```

## Implementation Phases

### Phase 1: Core Infrastructure and Basic Text Extraction

**Files to Create:**
- `src/lib/import/PDFImporter.ts` - Main entry point and orchestrator
- `src/lib/import/PDFParser.ts` - PDF.js wrapper for content extraction
- `src/lib/import/types.ts` - Interface definitions

**Tasks:**
1. Add `pdfjs-dist` dependency to package.json
2. Create PDFParser class that wraps pdfjs-dist
3. Extract raw text items with positions from each page
4. Create PDFImporter class with public `import(file: File | ArrayBuffer): Promise<DocumentData>` method
5. Implement basic text concatenation (preserving line breaks based on Y-position changes)
6. Add to PCEditor API: `importPDF(file: File): Promise<void>`

**Implementation Details:**

```typescript
// src/lib/import/PDFParser.ts
import * as pdfjsLib from 'pdfjs-dist';

export class PDFParser {
  async parse(source: ArrayBuffer): Promise<PDFExtractedContent> {
    const loadingTask = pdfjsLib.getDocument({ data: source });
    const pdfDocument = await loadingTask.promise;

    const pages: PDFExtractedPage[] = [];

    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const textItems = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map(item => this.convertTextItem(item, viewport.height));

      // Extract images (requires iterating operator list)
      const images = await this.extractImages(page);

      pages.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        textItems,
        images
      });
    }

    return { pageCount: pdfDocument.numPages, pages };
  }

  private convertTextItem(item: TextItem, pageHeight: number): PDFTextItem {
    // PDF coordinates are bottom-left origin, convert to top-left
    const [a, b, c, d, tx, ty] = item.transform;
    const fontSize = Math.sqrt(a * a + b * b); // Extract font size from transform

    return {
      text: item.str,
      x: tx,
      y: pageHeight - ty, // Flip Y coordinate
      width: item.width,
      height: item.height,
      fontName: item.fontName,
      fontSize,
      transform: item.transform
    };
  }
}
```

### Phase 2: Content Analysis and Structure Detection

**Files to Create:**
- `src/lib/import/ContentAnalyzer.ts` - Spatial analysis and structure detection
- `src/lib/import/ParagraphDetector.ts` - Text line grouping into paragraphs
- `src/lib/import/AlignmentDetector.ts` - Detect text alignment

**Tasks:**
1. Group text items into lines based on Y-position proximity
2. Group lines into paragraphs based on spacing and indentation
3. Detect paragraph alignment by analyzing X-positions relative to margins
4. Estimate page margins from content boundaries
5. Detect font formatting changes within paragraphs

**Key Algorithms:**

```typescript
// Line detection: group items with similar Y positions
function groupIntoLines(items: PDFTextItem[], tolerance: number = 3): PDFTextItem[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PDFTextItem[][] = [];
  let currentLine: PDFTextItem[] = [];
  let currentY: number | null = null;

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= tolerance) {
      currentLine.push(item);
      currentY = item.y;
    } else {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  // Sort items within each line by X position
  return lines.map(line => line.sort((a, b) => a.x - b.x));
}

// Paragraph detection: group lines with small gaps
function groupIntoParagraphs(
  lines: PDFTextItem[][],
  normalLineSpacing: number
): AnalyzedParagraph[] {
  // Detect paragraph breaks based on:
  // 1. Large vertical gap (> 1.5x normal line spacing)
  // 2. Indentation changes
  // 3. Alignment changes
}

// Alignment detection
function detectAlignment(
  lineItems: PDFTextItem[],
  leftMargin: number,
  rightMargin: number,
  pageWidth: number,
  tolerance: number = 5
): 'left' | 'center' | 'right' | 'justify' {
  const lineStart = Math.min(...lineItems.map(i => i.x));
  const lineEnd = Math.max(...lineItems.map(i => i.x + i.width));
  const lineWidth = lineEnd - lineStart;

  const leftDist = Math.abs(lineStart - leftMargin);
  const rightDist = Math.abs((pageWidth - rightMargin) - lineEnd);
  const centerOffset = Math.abs(
    (lineStart + lineWidth / 2) - (pageWidth / 2)
  );

  // Check if both edges are near margins (justify)
  if (leftDist < tolerance && rightDist < tolerance) return 'justify';
  // Check for center alignment
  if (centerOffset < tolerance * 2) return 'center';
  // Check for right alignment
  if (rightDist < tolerance && leftDist > tolerance * 3) return 'right';
  // Default to left
  return 'left';
}
```

### Phase 3: Text Formatting Extraction

**Files to Modify:**
- `src/lib/import/ContentAnalyzer.ts` - Add font style detection

**Tasks:**
1. Map PDF font names to standard font families (Arial, Times, etc.)
2. Detect bold/italic from font name or style attributes
3. Extract text color from PDF color space
4. Create formatting runs for each style change within paragraphs
5. Map PDF font sizes to reasonable editor font sizes

**Font Mapping Strategy:**

```typescript
// Map common PDF font names to editor fonts
const FONT_FAMILY_MAP: Record<string, string> = {
  'Helvetica': 'Arial',
  'Arial': 'Arial',
  'TimesNewRoman': 'Times New Roman',
  'Times-Roman': 'Times New Roman',
  'Courier': 'Courier New',
  'CourierNew': 'Courier New',
  // Add more mappings...
};

function mapFontName(pdfFontName: string): {
  fontFamily: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
} {
  // PDF font names often encode style: "Helvetica-BoldOblique"
  const isBold = /bold/i.test(pdfFontName);
  const isItalic = /italic|oblique/i.test(pdfFontName);

  // Extract base font name
  const baseName = pdfFontName
    .replace(/-?(bold|italic|oblique|regular|medium|light)/gi, '')
    .replace(/[^a-zA-Z]/g, '');

  const fontFamily = FONT_FAMILY_MAP[baseName] || 'Arial';

  return {
    fontFamily,
    fontWeight: isBold ? 'bold' : 'normal',
    fontStyle: isItalic ? 'italic' : 'normal'
  };
}
```

### Phase 4: Image Extraction and Embedding

**Files to Modify:**
- `src/lib/import/PDFParser.ts` - Add image extraction
- `src/lib/import/DocumentBuilder.ts` - Handle image objects

**Tasks:**
1. Extract inline images from PDF operator streams
2. Convert image data to data URLs (PNG or JPEG based on source format)
3. Calculate image positions relative to text flow
4. Create ImageObject instances for each extracted image
5. Insert image placeholders (U+FFFC) at appropriate text positions

**Image Extraction Approach:**

```typescript
async extractImages(page: PDFPageProxy): Promise<PDFImage[]> {
  const operatorList = await page.getOperatorList();
  const images: PDFImage[] = [];

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    if (operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
      const imageName = operatorList.argsArray[i][0];
      try {
        const imageData = await this.getImageData(page, imageName);
        if (imageData) {
          images.push(imageData);
        }
      } catch (e) {
        console.warn(`Failed to extract image: ${imageName}`, e);
      }
    }
  }

  return images;
}
```

### Phase 5: Table Detection (Heuristic-Based)

**Files to Create:**
- `src/lib/import/TableDetector.ts` - Heuristic table detection

**Tasks:**
1. Detect grid patterns from vertical and horizontal line segments (if vector graphics present)
2. Alternatively, detect tabular data from aligned columns of text
3. Calculate column widths and row heights
4. Create TableObject instances with TableCells containing FlowingTextContent
5. Mark detected tables with confidence scores

**Heuristic Approach:**

```typescript
// Column detection: Find consistent X-positions across multiple lines
function detectColumns(lines: PDFTextItem[][]): number[] | null {
  // Build histogram of starting X positions
  const xPositions: Map<number, number> = new Map();

  for (const line of lines) {
    for (const item of line) {
      const roundedX = Math.round(item.x / 5) * 5; // Round to 5px
      xPositions.set(roundedX, (xPositions.get(roundedX) || 0) + 1);
    }
  }

  // Find X positions that appear consistently (potential column boundaries)
  const threshold = lines.length * 0.5;
  const columnStarts = Array.from(xPositions.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([x, _]) => x)
    .sort((a, b) => a - b);

  // Need at least 2 columns for a table
  if (columnStarts.length < 2) return null;

  return columnStarts;
}

// Determine if a region contains tabular data
function isTabularRegion(
  lines: PDFTextItem[][],
  columnStarts: number[]
): boolean {
  // Check if most lines have content in multiple columns
  let tabularLineCount = 0;

  for (const line of lines) {
    const columnsWithContent = new Set<number>();
    for (const item of line) {
      const col = columnStarts.findIndex(
        (start, i) => item.x >= start &&
          (i === columnStarts.length - 1 || item.x < columnStarts[i + 1])
      );
      if (col >= 0) columnsWithContent.add(col);
    }
    if (columnsWithContent.size >= 2) tabularLineCount++;
  }

  return tabularLineCount / lines.length >= 0.7;
}
```

### Phase 6: Document Building and Integration

**Files to Create:**
- `src/lib/import/DocumentBuilder.ts` - Build DocumentData from analyzed content

**Files to Modify:**
- `src/lib/core/PCEditor.ts` - Add importPDF method
- `src/lib/index.ts` - Export new classes

**Tasks:**
1. Create DocumentBuilder that converts AnalyzedContent to DocumentData
2. Handle multi-page documents correctly
3. Insert page breaks at appropriate positions
4. Position embedded objects (images, tables) within text flow
5. Add `importPDF` method to PCEditor API
6. Emit appropriate events during import

**PCEditor API Addition:**

```typescript
// In PCEditor.ts
async importPDF(file: File, options?: PDFImportOptions): Promise<void> {
  if (!this._isReady) {
    throw new Error('Editor is not ready');
  }

  try {
    this.emit('import-started', { type: 'pdf' });

    const importer = new PDFImporter(options);
    const documentData = await importer.import(await file.arrayBuffer());

    this.loadDocument(documentData);

    this.emit('import-completed', {
      type: 'pdf',
      pageCount: documentData.pages.length
    });
  } catch (error) {
    this.emit('import-error', { type: 'pdf', error });
    throw error;
  }
}
```

## Limitations and Edge Cases

### Known Limitations

1. **Text Accuracy**
   - PDFs store text as positioned glyphs, not semantic paragraphs
   - Complex layouts (multi-column, text boxes) may not import correctly
   - Ligatures and special characters may not be preserved
   - Text in rotated or non-standard orientations may fail

2. **Formatting Fidelity**
   - Font substitution is approximate (PDF fonts map to limited editor fonts)
   - Exact font sizes may differ due to PDF transform matrices
   - Background colors and advanced text effects are not extracted
   - Character spacing and word spacing adjustments are lost

3. **Images**
   - Only embedded raster images (PNG, JPEG) are supported
   - Vector graphics are not converted
   - Images may lose quality or be approximated
   - Masked or layered images may not import correctly

4. **Tables**
   - Table detection is heuristic-based and may fail on complex layouts
   - Merged cells are not reliably detected
   - Table borders/styles are not preserved
   - Nested tables are not supported

5. **Unsupported Features**
   - Annotations and comments are not imported
   - Form fields are not converted
   - Bookmarks and internal links are lost
   - JavaScript and interactive elements are ignored
   - Encrypted PDFs require a password (may not be supported initially)

### Error Handling

```typescript
export class PDFImportError extends Error {
  constructor(
    message: string,
    public readonly code: PDFImportErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'PDFImportError';
  }
}

export enum PDFImportErrorCode {
  INVALID_PDF = 'INVALID_PDF',
  ENCRYPTED_PDF = 'ENCRYPTED_PDF',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  IMAGE_EXTRACTION_FAILED = 'IMAGE_EXTRACTION_FAILED',
  PARSING_ERROR = 'PARSING_ERROR',
  OUT_OF_MEMORY = 'OUT_OF_MEMORY'
}
```

## Testing Strategy

### Unit Tests

1. **PDFParser tests**
   - Parse simple single-page PDF
   - Parse multi-page PDF
   - Extract text items with correct positions
   - Handle encrypted PDF (error case)

2. **ContentAnalyzer tests**
   - Detect paragraphs from line groups
   - Detect text alignment
   - Map fonts correctly
   - Generate formatting runs

3. **TableDetector tests**
   - Detect simple grid table
   - Handle non-tabular aligned text
   - Calculate column widths

4. **DocumentBuilder tests**
   - Build DocumentData with correct structure
   - Handle page breaks
   - Position embedded objects

### Integration Tests

1. **Round-trip test**: Export a document to PDF, import it back, verify content preserved (within limitations)
2. **Sample PDF tests**: Import various sample PDFs and verify expected output
3. **Error handling tests**: Verify appropriate errors for invalid/encrypted PDFs

## Files Summary

### Files to Create

| File | Description |
|------|-------------|
| `src/lib/import/PDFImporter.ts` | Main entry point and orchestrator |
| `src/lib/import/PDFParser.ts` | PDF.js wrapper for content extraction |
| `src/lib/import/ContentAnalyzer.ts` | Spatial analysis and structure detection |
| `src/lib/import/ParagraphDetector.ts` | Text line grouping into paragraphs |
| `src/lib/import/AlignmentDetector.ts` | Detect text alignment |
| `src/lib/import/FontMapper.ts` | Map PDF fonts to editor fonts |
| `src/lib/import/TableDetector.ts` | Heuristic table detection |
| `src/lib/import/DocumentBuilder.ts` | Build DocumentData from analyzed content |
| `src/lib/import/types.ts` | Interface definitions |
| `src/lib/import/index.ts` | Public exports |
| `src/test/import/PDFParser.test.ts` | Parser unit tests |
| `src/test/import/ContentAnalyzer.test.ts` | Analyzer unit tests |
| `src/test/import/integration.test.ts` | Integration tests |

### Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add pdfjs-dist dependency |
| `src/lib/core/PCEditor.ts` | Add importPDF method |
| `src/lib/index.ts` | Export PDFImporter |
| `src/lib/types/index.ts` | Add PDFImportOptions type |
| `CLAUDE.md` | Document PDF import feature |

## Dependencies

```json
{
  "dependencies": {
    "pdfjs-dist": "^4.0.0"
  }
}
```

Note: pdfjs-dist requires worker setup. The implementation should configure the worker path appropriately for both development and production builds.

## Implementation Priority

1. **Phase 1** (Core): Basic text extraction - Essential foundation
2. **Phase 2** (Structure): Paragraph and alignment detection - Critical for usability
3. **Phase 3** (Formatting): Font and style mapping - Important for fidelity
4. **Phase 4** (Images): Image extraction - High value feature
5. **Phase 5** (Tables): Table detection - Nice to have, complex
6. **Phase 6** (Integration): API and events - Required for completion

Estimated effort: 3-4 weeks for Phases 1-4, 2-3 additional weeks for Phase 5 (tables).

## Critical Files for Implementation

- `/Users/james/code/pc/pc-editor/src/lib/core/PCEditor.ts` - Add importPDF public API method
- `/Users/james/code/pc/pc-editor/src/lib/types/index.ts` - Add PDFImportOptions and related types
- `/Users/james/code/pc/pc-editor/src/lib/text/FlowingTextContent.ts` - Reference for building document content
- `/Users/james/code/pc/pc-editor/src/lib/rendering/PDFGenerator.ts` - Reference for understanding PDF structure expectations
- `/Users/james/code/pc/pc-editor/src/lib/objects/EmbeddedObjectFactory.ts` - Pattern for creating embedded objects during import
