/**
 * Unit tests for Page
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Page } from '../../../lib/core/Page';
import { DocumentSettings, PageData } from '../../../lib/types';

describe('Page', () => {
  let page: Page;
  let defaultSettings: DocumentSettings;

  beforeEach(() => {
    defaultSettings = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      units: 'mm'
    };
    page = new Page({ id: 'page-1' }, defaultSettings);
  });

  describe('constructor', () => {
    it('should create a page with provided id', () => {
      expect(page.id).toBe('page-1');
    });

    it('should create a page with provided settings', () => {
      expect(page.settings.pageSize).toBe('A4');
      expect(page.settings.pageOrientation).toBe('portrait');
    });
  });

  describe('id', () => {
    it('should return the page id', () => {
      const testPage = new Page({ id: 'test-page-123' }, defaultSettings);
      expect(testPage.id).toBe('test-page-123');
    });
  });

  describe('settings', () => {
    it('should return a copy of settings', () => {
      const settings1 = page.settings;
      const settings2 = page.settings;
      expect(settings1).toEqual(settings2);
      expect(settings1).not.toBe(settings2);
    });

    it('should not allow external modification', () => {
      const settings = page.settings;
      settings.pageSize = 'Letter';
      expect(page.settings.pageSize).toBe('A4');
    });
  });

  describe('getPageDimensions()', () => {
    describe('A4 paper', () => {
      it('should return correct dimensions for A4 portrait in mm', () => {
        const dims = page.getPageDimensions();
        // A4 is 210x297mm, converted to pixels at 96 DPI
        // 210mm * (96/25.4) = 793.7 px
        // 297mm * (96/25.4) = 1122.5 px
        expect(dims.width).toBeCloseTo(793.7, 0);
        expect(dims.height).toBeCloseTo(1122.5, 0);
      });

      it('should return correct dimensions for A4 landscape', () => {
        const landscapePage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          pageOrientation: 'landscape'
        });
        const dims = landscapePage.getPageDimensions();
        // Swapped for landscape
        expect(dims.width).toBeCloseTo(1122.5, 0);
        expect(dims.height).toBeCloseTo(793.7, 0);
      });
    });

    describe('Letter paper', () => {
      it('should return correct dimensions for Letter portrait', () => {
        const letterPage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          pageSize: 'Letter'
        });
        const dims = letterPage.getPageDimensions();
        // Letter is 215.9x279.4mm
        expect(dims.width).toBeCloseTo(816.0, 0);
        expect(dims.height).toBeCloseTo(1056.0, 0);
      });

      it('should return correct dimensions for Letter landscape', () => {
        const letterPage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          pageSize: 'Letter',
          pageOrientation: 'landscape'
        });
        const dims = letterPage.getPageDimensions();
        expect(dims.width).toBeCloseTo(1056.0, 0);
        expect(dims.height).toBeCloseTo(816.0, 0);
      });
    });

    describe('Legal paper', () => {
      it('should return correct dimensions for Legal portrait', () => {
        const legalPage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          pageSize: 'Legal'
        });
        const dims = legalPage.getPageDimensions();
        // Legal is 215.9x355.6mm
        expect(dims.width).toBeCloseTo(816.0, 0);
        expect(dims.height).toBeCloseTo(1344.0, 0);
      });
    });

    describe('A3 paper', () => {
      it('should return correct dimensions for A3 portrait', () => {
        const a3Page = new Page({ id: 'p1' }, {
          ...defaultSettings,
          pageSize: 'A3'
        });
        const dims = a3Page.getPageDimensions();
        // A3 is 297x420mm
        expect(dims.width).toBeCloseTo(1122.5, 0);
        expect(dims.height).toBeCloseTo(1587.4, 0);
      });
    });

    describe('Custom paper', () => {
      it('should use custom dimensions when provided', () => {
        const customPage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          pageSize: 'Custom',
          customPageSize: { width: 100, height: 150 }
        });
        const dims = customPage.getPageDimensions();
        expect(dims.width).toBeCloseTo(378.0, 0);
        expect(dims.height).toBeCloseTo(566.9, 0);
      });

      it('should fallback to A4 when Custom but no customPageSize', () => {
        const customPage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          pageSize: 'Custom'
        });
        const dims = customPage.getPageDimensions();
        // Should use A4 dimensions
        expect(dims.width).toBeCloseTo(793.7, 0);
        expect(dims.height).toBeCloseTo(1122.5, 0);
      });
    });

    describe('different units', () => {
      it('should convert from inches', () => {
        const inchPage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          units: 'in',
          pageSize: 'Custom',
          customPageSize: { width: 8.5, height: 11 }
        });
        const dims = inchPage.getPageDimensions();
        // 8.5in * 96 = 816px
        // 11in * 96 = 1056px
        expect(dims.width).toBe(816);
        expect(dims.height).toBe(1056);
      });

      it('should convert from points', () => {
        const ptPage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          units: 'pt',
          pageSize: 'Custom',
          customPageSize: { width: 612, height: 792 }
        });
        const dims = ptPage.getPageDimensions();
        // 612pt * (96/72) = 816px
        // 792pt * (96/72) = 1056px
        expect(dims.width).toBe(816);
        expect(dims.height).toBe(1056);
      });

      it('should use pixels directly', () => {
        const pxPage = new Page({ id: 'p1' }, {
          ...defaultSettings,
          units: 'px',
          pageSize: 'Custom',
          customPageSize: { width: 800, height: 600 }
        });
        const dims = pxPage.getPageDimensions();
        expect(dims.width).toBe(800);
        expect(dims.height).toBe(600);
      });
    });
  });

  describe('getContentBounds()', () => {
    it('should return position and size accounting for margins', () => {
      const bounds = page.getContentBounds();

      // 20mm margins converted to pixels at 96 DPI
      const marginPx = 20 * (96 / 25.4); // ~75.6px

      expect(bounds.position.x).toBeCloseTo(marginPx, 0);
      expect(bounds.position.y).toBeCloseTo(marginPx, 0);

      const pageDims = page.getPageDimensions();
      expect(bounds.size.width).toBeCloseTo(pageDims.width - 2 * marginPx, 0);
      expect(bounds.size.height).toBeCloseTo(pageDims.height - 2 * marginPx, 0);
    });

    it('should handle different margins', () => {
      const asymmetricPage = new Page({ id: 'p1' }, {
        ...defaultSettings,
        margins: { top: 10, right: 30, bottom: 20, left: 40 }
      });
      const bounds = asymmetricPage.getContentBounds();
      const factor = 96 / 25.4;

      expect(bounds.position.x).toBeCloseTo(40 * factor, 0);
      expect(bounds.position.y).toBeCloseTo(10 * factor, 0);
    });

    it('should handle zero margins', () => {
      const zeroMarginPage = new Page({ id: 'p1' }, {
        ...defaultSettings,
        margins: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      const bounds = zeroMarginPage.getContentBounds();
      const pageDims = zeroMarginPage.getPageDimensions();

      expect(bounds.position.x).toBe(0);
      expect(bounds.position.y).toBe(0);
      expect(bounds.size.width).toBe(pageDims.width);
      expect(bounds.size.height).toBe(pageDims.height);
    });
  });

  describe('getHeaderBounds()', () => {
    it('should return header bounds in top margin area', () => {
      const bounds = page.getHeaderBounds();
      const factor = 96 / 25.4;
      const pageDims = page.getPageDimensions();

      expect(bounds.position.x).toBeCloseTo(20 * factor, 0);
      expect(bounds.position.y).toBe(0);
      expect(bounds.size.width).toBeCloseTo(pageDims.width - 40 * factor, 0);
      expect(bounds.size.height).toBeCloseTo(20 * factor, 0);
    });

    it('should use left and right margins for width', () => {
      const page2 = new Page({ id: 'p1' }, {
        ...defaultSettings,
        margins: { top: 30, right: 50, bottom: 20, left: 40 }
      });
      const bounds = page2.getHeaderBounds();
      const factor = 96 / 25.4;
      const pageDims = page2.getPageDimensions();

      expect(bounds.position.x).toBeCloseTo(40 * factor, 0);
      expect(bounds.size.width).toBeCloseTo(pageDims.width - 90 * factor, 0);
      expect(bounds.size.height).toBeCloseTo(30 * factor, 0);
    });
  });

  describe('getFooterBounds()', () => {
    it('should return footer bounds in bottom margin area', () => {
      const bounds = page.getFooterBounds();
      const factor = 96 / 25.4;
      const pageDims = page.getPageDimensions();

      expect(bounds.position.x).toBeCloseTo(20 * factor, 0);
      expect(bounds.position.y).toBeCloseTo(pageDims.height - 20 * factor, 0);
      expect(bounds.size.width).toBeCloseTo(pageDims.width - 40 * factor, 0);
      expect(bounds.size.height).toBeCloseTo(20 * factor, 0);
    });

    it('should use left and right margins for width', () => {
      const page2 = new Page({ id: 'p1' }, {
        ...defaultSettings,
        margins: { top: 30, right: 50, bottom: 25, left: 40 }
      });
      const bounds = page2.getFooterBounds();
      const factor = 96 / 25.4;
      const pageDims = page2.getPageDimensions();

      expect(bounds.position.x).toBeCloseTo(40 * factor, 0);
      expect(bounds.position.y).toBeCloseTo(pageDims.height - 25 * factor, 0);
      expect(bounds.size.height).toBeCloseTo(25 * factor, 0);
    });
  });

  describe('updateSettings()', () => {
    it('should update settings', () => {
      const newSettings: DocumentSettings = {
        ...defaultSettings,
        pageSize: 'Letter',
        pageOrientation: 'landscape'
      };
      page.updateSettings(newSettings);

      expect(page.settings.pageSize).toBe('Letter');
      expect(page.settings.pageOrientation).toBe('landscape');
    });

    it('should emit settings-changed event', () => {
      const handler = vi.fn();
      page.on('settings-changed', handler);

      const newSettings: DocumentSettings = {
        ...defaultSettings,
        pageSize: 'Legal'
      };
      page.updateSettings(newSettings);

      expect(handler).toHaveBeenCalledWith({ settings: newSettings });
    });

    it('should emit change event', () => {
      const handler = vi.fn();
      page.on('change', handler);

      page.updateSettings({ ...defaultSettings, pageSize: 'A3' });

      expect(handler).toHaveBeenCalled();
    });

    it('should affect dimension calculations', () => {
      const oldDims = page.getPageDimensions();

      page.updateSettings({
        ...defaultSettings,
        pageSize: 'Letter'
      });

      const newDims = page.getPageDimensions();
      expect(newDims.width).not.toBe(oldDims.width);
      expect(newDims.height).not.toBe(oldDims.height);
    });
  });

  describe('toData()', () => {
    it('should return page data with id', () => {
      const data = page.toData();

      expect(data.id).toBe('page-1');
    });

    it('should return serializable data', () => {
      const data = page.toData();
      const json = JSON.stringify(data);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe('page-1');
    });
  });

  describe('event emission', () => {
    it('should support on/off event handlers', () => {
      const handler = vi.fn();

      page.on('change', handler);
      page.updateSettings(defaultSettings);
      expect(handler).toHaveBeenCalledTimes(1);

      page.off('change', handler);
      page.updateSettings(defaultSettings);
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should emit events to multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      page.on('change', handler1);
      page.on('change', handler2);
      page.updateSettings(defaultSettings);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });
});
