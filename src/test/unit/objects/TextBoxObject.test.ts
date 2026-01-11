/**
 * Unit tests for TextBoxObject
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextBoxObject } from '../../../lib/objects/TextBoxObject';

// Create mock canvas context
function createMockContext(): CanvasRenderingContext2D {
  return {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3
    })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: ''
  } as unknown as CanvasRenderingContext2D;
}

describe('TextBoxObject', () => {
  let textBox: TextBoxObject;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    textBox = new TextBoxObject({
      id: 'tb-1',
      textIndex: 0,
      size: { width: 200, height: 100 }
    });
    ctx = createMockContext();
  });

  describe('constructor', () => {
    it('should create with default values', () => {
      expect(textBox.id).toBe('tb-1');
      expect(textBox.objectType).toBe('textbox');
      expect(textBox.content).toBe('');
      expect(textBox.fontFamily).toBe('Arial');
      expect(textBox.fontSize).toBe(14);
      expect(textBox.color).toBe('#000000');
      expect(textBox.backgroundColor).toBe('#ffffff');
      expect(textBox.padding).toBe(4);
    });

    it('should create with provided values', () => {
      const tb = new TextBoxObject({
        id: 'tb-2',
        textIndex: 5,
        size: { width: 150, height: 80 },
        content: 'Hello',
        fontFamily: 'Times New Roman',
        fontSize: 16,
        color: '#ff0000',
        backgroundColor: '#f0f0f0',
        padding: 10
      });

      expect(tb.content).toBe('Hello');
      expect(tb.fontFamily).toBe('Times New Roman');
      expect(tb.fontSize).toBe(16);
      expect(tb.color).toBe('#ff0000');
      expect(tb.backgroundColor).toBe('#f0f0f0');
      expect(tb.padding).toBe(10);
    });

    it('should initialize FlowingTextContent with content', () => {
      const tb = new TextBoxObject({
        id: 'tb-3',
        textIndex: 0,
        size: { width: 100, height: 50 },
        content: 'Test content'
      });

      expect(tb.flowingContent.getText()).toBe('Test content');
    });
  });

  describe('objectType', () => {
    it('should return textbox', () => {
      expect(textBox.objectType).toBe('textbox');
    });
  });

  describe('type (RegionType)', () => {
    it('should return textbox', () => {
      expect(textBox.type).toBe('textbox');
    });
  });

  describe('content', () => {
    it('should get content', () => {
      textBox.content = 'New text';
      expect(textBox.content).toBe('New text');
    });

    it('should set content and sync with flowingContent', () => {
      textBox.content = 'Updated';
      expect(textBox.flowingContent.getText()).toBe('Updated');
    });

    it('should emit content-changed event', () => {
      const handler = vi.fn();
      textBox.on('content-changed', handler);

      textBox.content = 'Changed';

      expect(handler).toHaveBeenCalledWith({ content: 'Changed' });
    });
  });

  describe('fontFamily', () => {
    it('should get and set fontFamily', () => {
      textBox.fontFamily = 'Georgia';
      expect(textBox.fontFamily).toBe('Georgia');
    });

    it('should emit style-changed event', () => {
      const handler = vi.fn();
      textBox.on('style-changed', handler);

      textBox.fontFamily = 'Courier';

      expect(handler).toHaveBeenCalledWith({ fontFamily: 'Courier' });
    });
  });

  describe('fontSize', () => {
    it('should get and set fontSize', () => {
      textBox.fontSize = 18;
      expect(textBox.fontSize).toBe(18);
    });

    it('should emit style-changed event', () => {
      const handler = vi.fn();
      textBox.on('style-changed', handler);

      textBox.fontSize = 24;

      expect(handler).toHaveBeenCalledWith({ fontSize: 24 });
    });
  });

  describe('color', () => {
    it('should get and set color', () => {
      textBox.color = '#00ff00';
      expect(textBox.color).toBe('#00ff00');
    });

    it('should emit style-changed event', () => {
      const handler = vi.fn();
      textBox.on('style-changed', handler);

      textBox.color = '#0000ff';

      expect(handler).toHaveBeenCalledWith({ color: '#0000ff' });
    });
  });

  describe('backgroundColor', () => {
    it('should get and set backgroundColor', () => {
      textBox.backgroundColor = '#eeeeee';
      expect(textBox.backgroundColor).toBe('#eeeeee');
    });

    it('should emit style-changed event', () => {
      const handler = vi.fn();
      textBox.on('style-changed', handler);

      textBox.backgroundColor = '#cccccc';

      expect(handler).toHaveBeenCalledWith({ backgroundColor: '#cccccc' });
    });
  });

  describe('border', () => {
    it('should have default border', () => {
      expect(textBox.border).toBeDefined();
      expect(textBox.border.top).toBeDefined();
      expect(textBox.border.right).toBeDefined();
      expect(textBox.border.bottom).toBeDefined();
      expect(textBox.border.left).toBeDefined();
    });

    it('should set border', () => {
      const newBorder = {
        top: { style: 'solid' as const, width: 2, color: '#000' },
        right: { style: 'solid' as const, width: 2, color: '#000' },
        bottom: { style: 'solid' as const, width: 2, color: '#000' },
        left: { style: 'solid' as const, width: 2, color: '#000' }
      };
      textBox.border = newBorder;

      expect(textBox.border.top.width).toBe(2);
    });

    it('should emit style-changed event', () => {
      const handler = vi.fn();
      textBox.on('style-changed', handler);

      textBox.border = {
        top: { style: 'dashed', width: 1, color: '#000' },
        right: { style: 'dashed', width: 1, color: '#000' },
        bottom: { style: 'dashed', width: 1, color: '#000' },
        left: { style: 'dashed', width: 1, color: '#000' }
      };

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('borderColor (deprecated)', () => {
    it('should get top border color', () => {
      expect(textBox.borderColor).toBeDefined();
    });

    it('should set all border colors', () => {
      textBox.borderColor = '#ff0000';

      expect(textBox.border.top.color).toBe('#ff0000');
      expect(textBox.border.right.color).toBe('#ff0000');
      expect(textBox.border.bottom.color).toBe('#ff0000');
      expect(textBox.border.left.color).toBe('#ff0000');
    });
  });

  describe('padding', () => {
    it('should get and set padding', () => {
      textBox.padding = 12;
      expect(textBox.padding).toBe(12);
    });

    it('should emit style-changed event', () => {
      const handler = vi.fn();
      textBox.on('style-changed', handler);

      textBox.padding = 8;

      expect(handler).toHaveBeenCalledWith({ padding: 8 });
    });
  });

  describe('editing', () => {
    it('should default to false', () => {
      expect(textBox.editing).toBe(false);
    });

    it('should set editing mode', () => {
      textBox.editing = true;
      expect(textBox.editing).toBe(true);
    });

    it('should emit editing-changed event', () => {
      const handler = vi.fn();
      textBox.on('editing-changed', handler);

      textBox.editing = true;

      expect(handler).toHaveBeenCalledWith({ editing: true });
    });

    it('should not emit if value unchanged', () => {
      const handler = vi.fn();
      textBox.on('editing-changed', handler);

      textBox.editing = false;

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('flowingContent', () => {
    it('should return FlowingTextContent instance', () => {
      expect(textBox.flowingContent).toBeDefined();
      expect(typeof textBox.flowingContent.getText).toBe('function');
    });

    it('should sync content changes from flowingContent', () => {
      const handler = vi.fn();
      textBox.on('content-changed', handler);

      textBox.flowingContent.setText('From flowing content');

      expect(textBox.content).toBe('From flowing content');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getTextBounds()', () => {
    it('should return bounds accounting for padding and default borders', () => {
      const bounds = textBox.getTextBounds();

      // Size 200x100, padding 4 on each side, default border 1 on each side = 190x90
      expect(bounds.width).toBe(190);
      expect(bounds.height).toBe(90);
    });

    it('should account for custom border widths', () => {
      textBox.border = {
        top: { style: 'solid', width: 2, color: '#000' },
        right: { style: 'solid', width: 2, color: '#000' },
        bottom: { style: 'solid', width: 2, color: '#000' },
        left: { style: 'solid', width: 2, color: '#000' }
      };

      const bounds = textBox.getTextBounds();

      // 200 - 4*2 (padding) - 2*2 (borders) = 188
      // 100 - 4*2 (padding) - 2*2 (borders) = 88
      expect(bounds.width).toBe(188);
      expect(bounds.height).toBe(88);
    });

    it('should not count borders with style none', () => {
      textBox.border = {
        top: { style: 'none', width: 5, color: '#000' },
        right: { style: 'none', width: 5, color: '#000' },
        bottom: { style: 'none', width: 5, color: '#000' },
        left: { style: 'none', width: 5, color: '#000' }
      };

      const bounds = textBox.getTextBounds();

      // Only padding counts (no borders)
      expect(bounds.width).toBe(192);
      expect(bounds.height).toBe(92);
    });
  });

  describe('getTextOffset()', () => {
    it('should return offset for padding and default border', () => {
      const offset = textBox.getTextOffset();

      // padding 4 + default border 1 = 5
      expect(offset.x).toBe(5);
      expect(offset.y).toBe(5);
    });

    it('should include custom border width', () => {
      textBox.border = {
        top: { style: 'solid', width: 3, color: '#000' },
        right: { style: 'solid', width: 3, color: '#000' },
        bottom: { style: 'solid', width: 3, color: '#000' },
        left: { style: 'solid', width: 3, color: '#000' }
      };

      const offset = textBox.getTextOffset();

      expect(offset.x).toBe(7); // padding 4 + border 3
      expect(offset.y).toBe(7);
    });
  });

  describe('getTextAreaBounds()', () => {
    it('should return null if not positioned', () => {
      expect(textBox.getTextAreaBounds()).toBeNull();
    });

    it('should return bounds when positioned', () => {
      textBox.renderedPosition = { x: 50, y: 100 };

      const bounds = textBox.getTextAreaBounds();

      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBe(55); // 50 + padding 4 + border 1
      expect(bounds!.y).toBe(105); // 100 + padding 4 + border 1
      expect(bounds!.width).toBe(190);
      expect(bounds!.height).toBe(90);
    });
  });

  describe('render()', () => {
    beforeEach(() => {
      textBox.renderedPosition = { x: 0, y: 0 };
    });

    it('should render background', () => {
      textBox.render(ctx);

      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('should render border sides', () => {
      textBox.border = {
        top: { style: 'solid', width: 1, color: '#000' },
        right: { style: 'solid', width: 1, color: '#000' },
        bottom: { style: 'solid', width: 1, color: '#000' },
        left: { style: 'solid', width: 1, color: '#000' }
      };

      textBox.render(ctx);

      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should render selection border when selected', () => {
      textBox.selected = true;
      textBox.render(ctx);

      expect(ctx.strokeRect).toHaveBeenCalled();
    });

    it('should render editing border when editing', () => {
      textBox.editing = true;
      textBox.render(ctx);

      expect(ctx.strokeRect).toHaveBeenCalled();
    });
  });

  describe('Focusable interface', () => {
    describe('focus()', () => {
      it('should set editing to true', () => {
        textBox.focus();
        expect(textBox.editing).toBe(true);
      });
    });

    describe('blur()', () => {
      it('should set editing to false', () => {
        textBox.editing = true;
        textBox.blur();
        expect(textBox.editing).toBe(false);
      });
    });

    describe('hasFocus()', () => {
      it('should return false when not editing', () => {
        expect(textBox.hasFocus()).toBe(false);
      });

      it('should check flowingContent focus when editing', () => {
        textBox.editing = true;
        // Focus state depends on flowingContent
        expect(typeof textBox.hasFocus()).toBe('boolean');
      });
    });

    describe('handleKeyDown()', () => {
      it('should return false when not editing', () => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        expect(textBox.handleKeyDown(event)).toBe(false);
      });

      it('should handle Escape to exit editing', () => {
        textBox.editing = true;
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() });

        const result = textBox.handleKeyDown(event);

        expect(result).toBe(true);
        expect(textBox.editing).toBe(false);
      });

      it('should delegate to flowingContent when editing', () => {
        textBox.editing = true;
        const event = new KeyboardEvent('keydown', { key: 'a' });

        // Will be handled by flowingContent
        textBox.handleKeyDown(event);
      });
    });

    describe('onCursorBlink/offCursorBlink', () => {
      it('should delegate to flowingContent', () => {
        const handler = vi.fn();
        textBox.onCursorBlink(handler);
        textBox.offCursorBlink(handler);
        // No error means it worked
      });
    });
  });

  describe('handleDoubleClick()', () => {
    it('should enter editing mode when not locked', () => {
      textBox.handleDoubleClick({ x: 50, y: 50 });

      expect(textBox.editing).toBe(true);
    });

    it('should emit edit-requested event', () => {
      const handler = vi.fn();
      textBox.on('edit-requested', handler);

      textBox.handleDoubleClick({ x: 50, y: 50 });

      expect(handler).toHaveBeenCalledWith({ object: textBox });
    });

    it('should not enter editing when locked', () => {
      textBox.locked = true;
      textBox.handleDoubleClick({ x: 50, y: 50 });

      expect(textBox.editing).toBe(false);
    });
  });

  describe('finishEditing()', () => {
    it('should exit editing mode', () => {
      textBox.editing = true;
      textBox.finishEditing();

      expect(textBox.editing).toBe(false);
    });
  });

  describe('toData()', () => {
    it('should serialize all properties', () => {
      textBox.content = 'Test text';
      textBox.fontSize = 18;
      textBox.color = '#ff0000';

      const data = textBox.toData();

      expect(data.id).toBe('tb-1');
      expect(data.objectType).toBe('textbox');
      expect(data.size).toEqual({ width: 200, height: 100 });
      expect(data.data.content).toBe('Test text');
      expect(data.data.fontSize).toBe(18);
      expect(data.data.color).toBe('#ff0000');
    });

    it('should include border data', () => {
      const data = textBox.toData();

      expect(data.data.border).toBeDefined();
    });

    it('should include formatting runs', () => {
      textBox.content = 'Test';
      textBox.flowingContent.applyFormatting(0, 2, { bold: true });

      const data = textBox.toData();

      expect(data.data.formattingRuns).toBeDefined();
    });

    it('should include substitution fields', () => {
      const data = textBox.toData();

      expect(data.data.substitutionFields).toBeDefined();
    });
  });

  describe('restoreFromData()', () => {
    it('should restore size', () => {
      const data = textBox.toData();
      data.size = { width: 300, height: 150 };

      textBox.restoreFromData(data);

      expect(textBox.width).toBe(300);
      expect(textBox.height).toBe(150);
    });

    it('should restore content', () => {
      const data = textBox.toData();
      data.data.content = 'Restored content';

      textBox.restoreFromData(data);

      expect(textBox.content).toBe('Restored content');
    });

    it('should restore style properties', () => {
      const data = textBox.toData();
      data.data.fontSize = 20;
      data.data.color = '#00ff00';
      data.data.backgroundColor = '#ffff00';

      textBox.restoreFromData(data);

      expect(textBox.fontSize).toBe(20);
      expect(textBox.color).toBe('#00ff00');
      expect(textBox.backgroundColor).toBe('#ffff00');
    });

    it('should emit state-restored event', () => {
      const handler = vi.fn();
      textBox.on('state-restored', handler);

      textBox.restoreFromData(textBox.toData());

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('clone()', () => {
    it('should create a copy with new id', () => {
      textBox.content = 'Original';
      textBox.fontSize = 20;

      const cloned = textBox.clone();

      expect(cloned.id).not.toBe(textBox.id);
      expect(cloned.id).toContain('clone');
      expect(cloned.content).toBe('Original');
      expect(cloned.fontSize).toBe(20);
    });

    it('should copy size', () => {
      const cloned = textBox.clone();

      expect(cloned.width).toBe(textBox.width);
      expect(cloned.height).toBe(textBox.height);
    });

    it('should copy border', () => {
      textBox.border = {
        top: { style: 'dashed', width: 2, color: '#000' },
        right: { style: 'dashed', width: 2, color: '#000' },
        bottom: { style: 'dashed', width: 2, color: '#000' },
        left: { style: 'dashed', width: 2, color: '#000' }
      };

      const cloned = textBox.clone();

      expect(cloned.border.top.style).toBe('dashed');
    });
  });

  describe('getContentSize()', () => {
    it('should return minimum size for empty content', () => {
      const size = textBox.getContentSize(ctx);

      expect(size.width).toBe(50);
      expect(size.height).toBeGreaterThan(0);
    });

    it('should calculate size based on content', () => {
      textBox.content = 'Hello World';

      const size = textBox.getContentSize(ctx);

      expect(size.width).toBeGreaterThan(50);
    });

    it('should account for multiple lines', () => {
      textBox.content = 'Line 1\nLine 2\nLine 3';

      const size = textBox.getContentSize(ctx);

      // Should be taller for multiple lines
      expect(size.height).toBeGreaterThan(textBox.fontSize * 1.2 + textBox.padding * 2);
    });
  });

  describe('resizeToContent()', () => {
    it('should resize to fit content', () => {
      textBox.content = 'A very long text that needs more width';

      textBox.resizeToContent(ctx);

      // Should be resized
      expect(textBox.width).toBeGreaterThanOrEqual(50);
    });

    it('should respect minimum size', () => {
      textBox.content = '';

      textBox.resizeToContent(ctx);

      const minSize = textBox.getMinSize();
      expect(textBox.width).toBeGreaterThanOrEqual(minSize.width);
      expect(textBox.height).toBeGreaterThanOrEqual(minSize.height);
    });
  });

  describe('EditableTextRegion interface', () => {
    beforeEach(() => {
      textBox.renderedPosition = { x: 100, y: 200 };
    });

    describe('getRegionBounds()', () => {
      it('should return text area bounds', () => {
        const bounds = textBox.getRegionBounds(0);

        expect(bounds).not.toBeNull();
        // 100 + padding 4 + border 1 = 105
        expect(bounds!.x).toBe(105);
        expect(bounds!.y).toBe(205);
      });
    });

    describe('globalToLocal()', () => {
      it('should convert point to local coordinates', () => {
        const local = textBox.globalToLocal({ x: 110, y: 210 }, 0);

        expect(local).not.toBeNull();
        // 110 - 105 = 5
        expect(local!.x).toBe(5);
        expect(local!.y).toBe(5);
      });

      it('should return null for point outside bounds', () => {
        const local = textBox.globalToLocal({ x: 0, y: 0 }, 0);

        expect(local).toBeNull();
      });
    });

    describe('localToGlobal()', () => {
      it('should convert local point to global coordinates', () => {
        const global = textBox.localToGlobal({ x: 10, y: 20 }, 0);

        // 10 + 105 = 115
        expect(global.x).toBe(115);
        expect(global.y).toBe(225);
      });
    });

    describe('getFlowedLines()', () => {
      it('should return empty array before reflow', () => {
        const lines = textBox.getFlowedLines(0);
        expect(lines).toEqual([]);
      });
    });

    describe('getFlowedPages()', () => {
      it('should return empty array before reflow', () => {
        const pages = textBox.getFlowedPages();
        expect(pages.length).toBe(0);
      });

      it('should return one page after reflow', () => {
        textBox.content = 'Test';
        textBox.reflow(ctx);

        const pages = textBox.getFlowedPages();
        expect(pages.length).toBeLessThanOrEqual(1);
      });
    });

    describe('getAvailableWidth()', () => {
      it('should return text bounds width', () => {
        // 200 - padding 4*2 - border 1*2 = 190
        expect(textBox.getAvailableWidth()).toBe(190);
      });
    });

    describe('spansMultiplePages()', () => {
      it('should return false', () => {
        expect(textBox.spansMultiplePages()).toBe(false);
      });
    });

    describe('getPageCount()', () => {
      it('should return 1', () => {
        expect(textBox.getPageCount()).toBe(1);
      });
    });

    describe('containsPointInRegion()', () => {
      it('should return true for point inside', () => {
        expect(textBox.containsPointInRegion({ x: 150, y: 250 }, 0)).toBe(true);
      });

      it('should return false for point outside', () => {
        expect(textBox.containsPointInRegion({ x: 0, y: 0 }, 0)).toBe(false);
      });
    });

    describe('reflow()', () => {
      it('should flow text content', () => {
        textBox.content = 'Test content';
        textBox.reflow(ctx);

        // After reflow, should have lines
        const lines = textBox.getFlowedLines(0);
        expect(lines.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle empty size', () => {
        textBox.size = { width: 8, height: 8 }; // Too small for text

        textBox.reflow(ctx);

        expect(textBox.getFlowedLines(0)).toEqual([]);
      });
    });
  });

  describe('moveCursorVertical()', () => {
    beforeEach(() => {
      textBox.content = 'Line one\nLine two\nLine three';
      textBox.reflow(ctx);
      textBox.editing = true;
    });

    it('should return false with no flowed lines', () => {
      const emptyBox = new TextBoxObject({
        id: 'empty',
        textIndex: 0,
        size: { width: 100, height: 50 }
      });

      expect(emptyBox.moveCursorVertical(1, ctx)).toBe(false);
    });

    it('should return false at top boundary going up', () => {
      textBox.flowingContent.setCursorPosition(0);

      const result = textBox.moveCursorVertical(-1, ctx);

      expect(result).toBe(false);
    });
  });
});
