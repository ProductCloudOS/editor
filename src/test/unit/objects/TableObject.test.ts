/**
 * Unit tests for TableObject
 */
import { describe, expect, it } from 'vitest';
import { TableObject } from '../../../lib/objects/table/TableObject';

describe('TableObject', () => {
  describe('calculatePageLayout', () => {
    it('should split an oversized data row across page slices', () => {
      const table = new TableObject({
        id: 'split-row-table',
        columns: 1,
        rowData: [
          { height: 20, isHeader: true, cells: [{ content: 'Header' }] },
          { height: 120, cells: [{ content: 'Long row' }] }
        ]
      });

      table.calculateLayout({} as CanvasRenderingContext2D, true);

      const layout = table.calculatePageLayout(70, 70);

      expect(layout.slices).toHaveLength(3);
      expect(layout.slices[0]).toMatchObject({
        startRow: 0,
        endRow: 2,
        startRowOffset: 0,
        endRowOffset: 50,
        height: 70,
        yOffset: 0
      });
      expect(layout.slices[1]).toMatchObject({
        startRow: 1,
        endRow: 2,
        startRowOffset: 50,
        endRowOffset: 100,
        height: 70,
        yOffset: 70,
        isContinuation: true
      });
      expect(layout.slices[2]).toMatchObject({
        startRow: 1,
        endRow: 2,
        startRowOffset: 100,
        endRowOffset: 0,
        height: 40,
        yOffset: 120,
        isContinuation: true
      });
    });

    it('should keep the first split row fragment within first page height', () => {
      const table = new TableObject({
        id: 'split-row-first-page-table',
        columns: 1,
        rowData: [
          { height: 20, isHeader: true, cells: [{ content: 'Header' }] },
          { height: 120, cells: [{ content: 'Long row' }] }
        ]
      });

      table.calculateLayout({} as CanvasRenderingContext2D, true);

      const layout = table.calculatePageLayout(50, 200);

      expect(layout.slices[0]).toMatchObject({
        startRow: 0,
        endRow: 2,
        startRowOffset: 0,
        endRowOffset: 30,
        height: 50,
        yOffset: 0
      });
    });

    it('should preserve whole-row behavior for merged rows', () => {
      const table = new TableObject({
        id: 'merged-row-table',
        columns: 1,
        rowData: [
          { height: 20, isHeader: true, cells: [{ content: 'Header' }] },
          { height: 120, cells: [{ content: 'Merged', rowSpan: 2 }] },
          { height: 20, cells: [{ content: 'Covered' }] }
        ]
      });

      table.calculateLayout({} as CanvasRenderingContext2D, true);

      const layout = table.calculatePageLayout(70, 70);

      expect(layout.slices[0].endRowOffset).toBe(0);
      expect(layout.slices[0].height).toBeGreaterThan(70);
    });
  });
});
