/**
 * Unit tests for HyperlinkManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HyperlinkManager } from '../../../lib/text/HyperlinkManager';

describe('HyperlinkManager', () => {
  let manager: HyperlinkManager;

  beforeEach(() => {
    manager = new HyperlinkManager();
  });

  describe('insert()', () => {
    it('should create a new hyperlink', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);

      expect(hyperlink).toBeDefined();
      expect(hyperlink.url).toBe('https://example.com');
      expect(hyperlink.startIndex).toBe(0);
      expect(hyperlink.endIndex).toBe(10);
      expect(hyperlink.id).toBeDefined();
    });

    it('should generate unique IDs', () => {
      const h1 = manager.insert('https://example.com', 0, 5);
      const h2 = manager.insert('https://other.com', 10, 15);

      expect(h1.id).not.toBe(h2.id);
    });

    it('should accept optional title', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10, { title: 'Click me' });

      expect(hyperlink.title).toBe('Click me');
    });

    it('should accept custom formatting', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10, {
        formatting: {
          color: '#ff0000',
          underline: false
        }
      });

      expect(hyperlink.formatting?.color).toBe('#ff0000');
      expect(hyperlink.formatting?.underline).toBe(false);
    });

    it('should emit hyperlink-added event', () => {
      const handler = vi.fn();
      manager.on('hyperlink-added', handler);

      const hyperlink = manager.insert('https://example.com', 0, 10);

      expect(handler).toHaveBeenCalledWith({ hyperlink });
    });
  });

  describe('remove()', () => {
    it('should remove hyperlink by id', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);
      manager.remove(hyperlink.id);

      expect(manager.getHyperlinkById(hyperlink.id)).toBeUndefined();
    });

    it('should emit hyperlink-removed event', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);

      const handler = vi.fn();
      manager.on('hyperlink-removed', handler);

      manager.remove(hyperlink.id);

      expect(handler).toHaveBeenCalledWith({ id: hyperlink.id });
    });

    it('should do nothing for non-existent id', () => {
      expect(() => manager.remove('non-existent')).not.toThrow();
    });
  });

  describe('update()', () => {
    it('should update hyperlink URL', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);
      manager.update(hyperlink.id, { url: 'https://updated.com' });

      expect(manager.getHyperlinkById(hyperlink.id)?.url).toBe('https://updated.com');
    });

    it('should update hyperlink title', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);
      manager.update(hyperlink.id, { title: 'New title' });

      expect(manager.getHyperlinkById(hyperlink.id)?.title).toBe('New title');
    });

    it('should update hyperlink range', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);
      manager.update(hyperlink.id, { startIndex: 5, endIndex: 15 });

      const updated = manager.getHyperlinkById(hyperlink.id);
      expect(updated?.startIndex).toBe(5);
      expect(updated?.endIndex).toBe(15);
    });

    it('should emit hyperlink-updated event', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);

      const handler = vi.fn();
      manager.on('hyperlink-updated', handler);

      manager.update(hyperlink.id, { url: 'https://updated.com' });

      expect(handler).toHaveBeenCalledWith({
        id: hyperlink.id,
        updates: { url: 'https://updated.com' }
      });
    });
  });

  describe('getHyperlinkAt()', () => {
    it('should return hyperlink containing the text index', () => {
      manager.insert('https://example.com', 5, 15);

      expect(manager.getHyperlinkAt(5)).toBeDefined();
      expect(manager.getHyperlinkAt(10)).toBeDefined();
      expect(manager.getHyperlinkAt(14)).toBeDefined();
    });

    it('should return undefined for index outside hyperlinks', () => {
      manager.insert('https://example.com', 5, 15);

      expect(manager.getHyperlinkAt(0)).toBeUndefined();
      expect(manager.getHyperlinkAt(4)).toBeUndefined();
      expect(manager.getHyperlinkAt(15)).toBeUndefined();
      expect(manager.getHyperlinkAt(20)).toBeUndefined();
    });

    it('should return undefined when no hyperlinks exist', () => {
      expect(manager.getHyperlinkAt(5)).toBeUndefined();
    });

    it('should handle multiple hyperlinks', () => {
      const h1 = manager.insert('https://first.com', 0, 5);
      const h2 = manager.insert('https://second.com', 10, 20);

      expect(manager.getHyperlinkAt(2)?.url).toBe('https://first.com');
      expect(manager.getHyperlinkAt(15)?.url).toBe('https://second.com');
      expect(manager.getHyperlinkAt(7)).toBeUndefined();
    });
  });

  describe('getHyperlinkById()', () => {
    it('should return hyperlink by id', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);

      expect(manager.getHyperlinkById(hyperlink.id)).toBe(hyperlink);
    });

    it('should return undefined for unknown id', () => {
      expect(manager.getHyperlinkById('unknown')).toBeUndefined();
    });
  });

  describe('getHyperlinksInRange()', () => {
    it('should return hyperlinks overlapping the range', () => {
      manager.insert('https://first.com', 0, 10);
      manager.insert('https://second.com', 15, 25);
      manager.insert('https://third.com', 30, 40);

      const inRange = manager.getHyperlinksInRange(5, 20);

      expect(inRange).toHaveLength(2);
      expect(inRange.map(h => h.url)).toContain('https://first.com');
      expect(inRange.map(h => h.url)).toContain('https://second.com');
    });

    it('should return empty array if no hyperlinks in range', () => {
      manager.insert('https://example.com', 0, 10);

      expect(manager.getHyperlinksInRange(20, 30)).toHaveLength(0);
    });

    it('should return hyperlink if range is fully inside it', () => {
      manager.insert('https://example.com', 0, 20);

      const inRange = manager.getHyperlinksInRange(5, 10);

      expect(inRange).toHaveLength(1);
    });

    it('should return hyperlink if it is fully inside range', () => {
      manager.insert('https://example.com', 10, 15);

      const inRange = manager.getHyperlinksInRange(0, 20);

      expect(inRange).toHaveLength(1);
    });
  });

  describe('getAll()', () => {
    it('should return empty array when no hyperlinks', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('should return all hyperlinks', () => {
      manager.insert('https://first.com', 0, 5);
      manager.insert('https://second.com', 10, 15);

      const all = manager.getAll();

      expect(all).toHaveLength(2);
    });
  });

  describe('shiftHyperlinks()', () => {
    it('should shift hyperlinks after insertion point', () => {
      const hyperlink = manager.insert('https://example.com', 10, 20);

      manager.shiftHyperlinks(5, 3);

      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(13);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(23);
    });

    it('should not shift hyperlinks before insertion point', () => {
      const hyperlink = manager.insert('https://example.com', 0, 5);

      manager.shiftHyperlinks(10, 3);

      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(0);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(5);
    });

    it('should expand hyperlink if insertion is within', () => {
      const hyperlink = manager.insert('https://example.com', 5, 15);

      manager.shiftHyperlinks(10, 3);

      // startIndex unchanged, endIndex expanded
      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(5);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(18);
    });

    it('should handle negative delta (deletion)', () => {
      const hyperlink = manager.insert('https://example.com', 10, 20);

      manager.shiftHyperlinks(5, -3);

      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(7);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(17);
    });
  });

  describe('handleDeletion()', () => {
    it('should shrink hyperlink when deletion is within', () => {
      const hyperlink = manager.insert('https://example.com', 5, 20);

      manager.handleDeletion(10, 5);

      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(5);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(15);
    });

    it('should shift hyperlink when deletion is before', () => {
      const hyperlink = manager.insert('https://example.com', 10, 20);

      manager.handleDeletion(0, 5);

      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(5);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(15);
    });

    it('should remove hyperlink when fully deleted', () => {
      const hyperlink = manager.insert('https://example.com', 5, 10);

      manager.handleDeletion(0, 15);

      expect(manager.getHyperlinkById(hyperlink.id)).toBeUndefined();
    });

    it('should truncate hyperlink when start is deleted', () => {
      const hyperlink = manager.insert('https://example.com', 5, 15);

      manager.handleDeletion(0, 8);

      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(0);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(7);
    });

    it('should truncate hyperlink when end is deleted', () => {
      const hyperlink = manager.insert('https://example.com', 5, 15);

      manager.handleDeletion(12, 5);

      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(5);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(12);
    });

    it('should do nothing if deletion is after hyperlink', () => {
      const hyperlink = manager.insert('https://example.com', 0, 10);

      manager.handleDeletion(15, 5);

      expect(manager.getHyperlinkById(hyperlink.id)?.startIndex).toBe(0);
      expect(manager.getHyperlinkById(hyperlink.id)?.endIndex).toBe(10);
    });
  });

  describe('clear()', () => {
    it('should remove all hyperlinks', () => {
      manager.insert('https://first.com', 0, 5);
      manager.insert('https://second.com', 10, 15);

      manager.clear();

      expect(manager.getAll()).toHaveLength(0);
    });

    it('should emit hyperlinks-cleared event', () => {
      manager.insert('https://example.com', 0, 10);

      const handler = vi.fn();
      manager.on('hyperlinks-cleared', handler);

      manager.clear();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('toJSON()', () => {
    it('should serialize empty manager', () => {
      expect(manager.toJSON()).toEqual([]);
    });

    it('should serialize hyperlinks', () => {
      manager.insert('https://example.com', 0, 10, { title: 'Example' });

      const json = manager.toJSON();

      expect(json).toHaveLength(1);
      expect(json[0].url).toBe('https://example.com');
      expect(json[0].startIndex).toBe(0);
      expect(json[0].endIndex).toBe(10);
      expect(json[0].title).toBe('Example');
    });
  });

  describe('fromJSON()', () => {
    it('should deserialize hyperlinks', () => {
      const data = [
        { id: 'h1', url: 'https://example.com', startIndex: 0, endIndex: 10, title: 'Example' }
      ];

      manager.fromJSON(data);

      const hyperlink = manager.getHyperlinkById('h1');
      expect(hyperlink).toBeDefined();
      expect(hyperlink?.url).toBe('https://example.com');
      expect(hyperlink?.title).toBe('Example');
    });

    it('should clear existing hyperlinks before loading', () => {
      manager.insert('https://old.com', 0, 5);

      manager.fromJSON([
        { id: 'new', url: 'https://new.com', startIndex: 0, endIndex: 10 }
      ]);

      expect(manager.getAll()).toHaveLength(1);
      expect(manager.getAll()[0].url).toBe('https://new.com');
    });

    it('should emit hyperlinks-loaded event', () => {
      const handler = vi.fn();
      manager.on('hyperlinks-loaded', handler);

      manager.fromJSON([]);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('serialization round-trip', () => {
    it('should preserve hyperlink data through round-trip', () => {
      manager.insert('https://example.com', 0, 10, {
        title: 'Example Link',
        formatting: { color: '#ff0000', underline: true }
      });
      manager.insert('https://other.com', 20, 30);

      const json = manager.toJSON();

      const newManager = new HyperlinkManager();
      newManager.fromJSON(json);

      expect(newManager.getAll()).toHaveLength(2);

      const first = newManager.getHyperlinksInRange(0, 15)[0];
      expect(first.url).toBe('https://example.com');
      expect(first.title).toBe('Example Link');
      expect(first.formatting?.color).toBe('#ff0000');

      const second = newManager.getHyperlinksInRange(20, 35)[0];
      expect(second.url).toBe('https://other.com');
    });
  });
});
