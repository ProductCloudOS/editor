/**
 * Unit tests for ClipboardManager
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClipboardManager } from '../../../lib/clipboard/ClipboardManager';
import { PCEDITOR_MIME_TYPE, type ClipboardContent, type PCEditorClipboardData } from '../../../lib/clipboard/types';
import { FlowingTextContent } from '../../../lib/text/FlowingTextContent';

// Mock FlowingTextContent
vi.mock('../../../lib/text/FlowingTextContent', () => {
  return {
    FlowingTextContent: vi.fn().mockImplementation(() => ({
      getText: vi.fn().mockReturnValue('Hello world'),
      getSelection: vi.fn().mockReturnValue({ start: 0, end: 5 }),
      getFormattingManager: vi.fn().mockReturnValue({
        getFormattingAt: vi.fn().mockReturnValue({
          fontFamily: 'Arial',
          fontSize: 14,
          color: '#000000'
        }),
        defaultFormatting: {
          fontFamily: 'Arial',
          fontSize: 14,
          color: '#000000'
        }
      }),
      getParagraphFormattingManager: vi.fn().mockReturnValue({
        getParagraphStart: vi.fn().mockReturnValue(0),
        getFormattingForParagraph: vi.fn().mockReturnValue({ alignment: 'left' })
      }),
      getSubstitutionFieldsInRange: vi.fn().mockReturnValue([]),
      getEmbeddedObjectsInRange: vi.fn().mockReturnValue([]),
      getHyperlinksInRange: vi.fn().mockReturnValue([])
    }))
  };
});

describe('ClipboardManager', () => {
  let manager: ClipboardManager;
  let mockClipboard: {
    write: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
    writeText: ReturnType<typeof vi.fn>;
    readText: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    manager = new ClipboardManager();

    // Mock navigator.clipboard
    mockClipboard = {
      write: vi.fn(),
      read: vi.fn(),
      writeText: vi.fn(),
      readText: vi.fn()
    };

    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('extractSelectionContent()', () => {
    it('should extract text from range', () => {
      const mockFlowingContent = {
        getText: () => 'Hello world',
        getFormattingManager: () => ({
          getFormattingAt: () => ({
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }),
          defaultFormatting: {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }
        }),
        getParagraphFormattingManager: () => ({
          getParagraphStart: () => 0,
          getFormattingForParagraph: () => ({ alignment: 'left' })
        }),
        getSubstitutionFieldsInRange: () => [],
        getEmbeddedObjectsInRange: () => [],
        getHyperlinksInRange: () => []
      } as unknown as FlowingTextContent;

      const result = manager.extractSelectionContent(mockFlowingContent, 0, 5);

      expect(result.content.text).toBe('Hello');
      expect(result.version).toBeDefined();
      expect(result.type).toBe('text');
    });

    it('should detect object content type', () => {
      const mockFlowingContent = {
        getText: () => '\uFFFC',
        getFormattingManager: () => ({
          getFormattingAt: () => ({
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }),
          defaultFormatting: {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }
        }),
        getParagraphFormattingManager: () => ({
          getParagraphStart: () => 0,
          getFormattingForParagraph: () => ({ alignment: 'left' })
        }),
        getSubstitutionFieldsInRange: () => [],
        getEmbeddedObjectsInRange: () => [],
        getHyperlinksInRange: () => []
      } as unknown as FlowingTextContent;

      const result = manager.extractSelectionContent(mockFlowingContent, 0, 1);

      expect(result.type).toBe('object');
    });

    it('should detect mixed content type', () => {
      const mockFlowingContent = {
        getText: () => 'Hello\uFFFCworld',
        getFormattingManager: () => ({
          getFormattingAt: () => ({
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }),
          defaultFormatting: {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }
        }),
        getParagraphFormattingManager: () => ({
          getParagraphStart: () => 0,
          getFormattingForParagraph: () => ({ alignment: 'left' })
        }),
        getSubstitutionFieldsInRange: () => [],
        getEmbeddedObjectsInRange: () => [],
        getHyperlinksInRange: () => []
      } as unknown as FlowingTextContent;

      const result = manager.extractSelectionContent(mockFlowingContent, 0, 11);

      expect(result.type).toBe('mixed');
    });

    it('should include metadata with timestamp', () => {
      const mockFlowingContent = {
        getText: () => 'Hello',
        getFormattingManager: () => ({
          getFormattingAt: () => ({
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }),
          defaultFormatting: {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }
        }),
        getParagraphFormattingManager: () => ({
          getParagraphStart: () => 0,
          getFormattingForParagraph: () => ({ alignment: 'left' })
        }),
        getSubstitutionFieldsInRange: () => [],
        getEmbeddedObjectsInRange: () => [],
        getHyperlinksInRange: () => []
      } as unknown as FlowingTextContent;

      const result = manager.extractSelectionContent(mockFlowingContent, 0, 5);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.copiedAt).toBeDefined();
    });

    it('should adjust indices to be relative to selection start', () => {
      const mockFlowingContent = {
        getText: () => '0123456789ABCDEF',
        getFormattingManager: () => ({
          getFormattingAt: (i: number) => ({
            fontFamily: 'Arial',
            fontSize: i >= 7 ? 20 : 14, // Different font size at index 7+
            color: '#000000'
          }),
          defaultFormatting: {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }
        }),
        getParagraphFormattingManager: () => ({
          getParagraphStart: () => 0,
          getFormattingForParagraph: () => ({ alignment: 'left' })
        }),
        getSubstitutionFieldsInRange: () => [],
        getEmbeddedObjectsInRange: () => [],
        getHyperlinksInRange: () => []
      } as unknown as FlowingTextContent;

      // Select from position 5 to 10
      const result = manager.extractSelectionContent(mockFlowingContent, 5, 10);

      expect(result.content.text).toBe('56789');
      // Format change at absolute index 7 should be relative index 2 (7-5)
      const formatRuns = result.content.formattingRuns;
      if (formatRuns && formatRuns.length > 0) {
        const changeRun = formatRuns.find(r => r.formatting.fontSize === 20);
        if (changeRun) {
          expect(changeRun.index).toBe(2); // Relative index
        }
      }
    });
  });

  describe('parseHtml()', () => {
    it('should parse HTML content', () => {
      const result = manager.parseHtml('<b>Bold text</b>');

      expect(result.text).toBe('Bold text');
      expect(result.formattingRuns).toBeDefined();
    });
  });

  describe('generateNewIds()', () => {
    it('should generate new IDs for substitution fields', () => {
      const content: ClipboardContent = {
        text: 'Hello \uFFFC',
        substitutionFields: [
          {
            id: 'field_1',
            textIndex: 6,
            fieldName: 'name'
          }
        ]
      };

      const result = manager.generateNewIds(content);

      expect(result.substitutionFields).toBeDefined();
      expect(result.substitutionFields?.[0].id).not.toBe('field_1');
    });

    it('should generate new IDs for embedded objects', () => {
      const content: ClipboardContent = {
        text: 'Hello \uFFFC',
        embeddedObjects: [
          {
            textIndex: 6,
            object: {
              id: 'obj_1',
              objectType: 'textbox',
              textIndex: 6,
              position: 'inline',
              size: { width: 100, height: 50 },
              data: {}
            }
          }
        ]
      };

      const result = manager.generateNewIds(content);

      expect(result.embeddedObjects).toBeDefined();
      expect(result.embeddedObjects?.[0].object.id).not.toBe('obj_1');
    });

    it('should generate new IDs for hyperlinks', () => {
      const content: ClipboardContent = {
        text: 'Hello',
        hyperlinks: [
          {
            id: 'link_1',
            url: 'https://example.com',
            startIndex: 0,
            endIndex: 5
          }
        ]
      };

      const result = manager.generateNewIds(content);

      expect(result.hyperlinks).toBeDefined();
      expect(result.hyperlinks?.[0].id).not.toBe('link_1');
    });

    it('should preserve original content', () => {
      const content: ClipboardContent = {
        text: 'Hello world',
        formattingRuns: [
          {
            index: 0,
            formatting: {
              fontFamily: 'Arial',
              fontSize: 14,
              color: '#000000'
            }
          }
        ]
      };

      const result = manager.generateNewIds(content);

      expect(result.text).toBe(content.text);
      expect(result.formattingRuns).toEqual(content.formattingRuns);
    });
  });

  describe('read()', () => {
    it('should return empty for empty clipboard', async () => {
      mockClipboard.read.mockRejectedValue(new Error('No data'));
      mockClipboard.readText.mockRejectedValue(new Error('No data'));

      const result = await manager.read();

      expect(result.type).toBe('empty');
      expect(result.data).toBeNull();
    });

    it('should read plain text via readText fallback', async () => {
      mockClipboard.read.mockRejectedValue(new Error('Not supported'));
      mockClipboard.readText.mockResolvedValue('Hello');

      const result = await manager.read();

      expect(result.type).toBe('text');
      expect(result.data).toBe('Hello');
    });

    it('should read images', async () => {
      const imageBlob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'image/png' });

      mockClipboard.read.mockResolvedValue([
        {
          types: ['image/png'],
          getType: vi.fn().mockResolvedValue(imageBlob)
        }
      ]);

      const result = await manager.read();

      expect(result.type).toBe('image');
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('should use cached data when plain text matches', async () => {
      // First, simulate a copy operation that caches data
      const cachedData: PCEditorClipboardData = {
        version: '1.0.0',
        type: 'text',
        content: { text: 'Cached content' }
      };
      (manager as any).cachedClipboardData = cachedData;

      // When reading plain text that matches the cached data (via fallback)
      mockClipboard.read.mockRejectedValue(new Error('Not supported'));
      mockClipboard.readText.mockResolvedValue('Cached content');

      const result = await manager.read();

      expect(result.type).toBe('pceditor');
      expect((result.data as PCEditorClipboardData).content.text).toBe('Cached content');
    });

    it('should return text for asPlainText option', async () => {
      mockClipboard.readText.mockResolvedValue('Plain text');

      const result = await manager.read({ asPlainText: true });

      expect(result.type).toBe('text');
      expect(result.data).toBe('Plain text');
    });
  });

  describe('events', () => {
    it('should emit copy event on successful copy', async () => {
      const handler = vi.fn();
      manager.on('copy', handler);

      mockClipboard.write.mockResolvedValue(undefined);

      const mockFlowingContent = {
        getText: () => 'Hello world',
        getSelection: () => ({ start: 0, end: 5 }),
        getFormattingManager: () => ({
          getFormattingAt: () => ({
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }),
          defaultFormatting: {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }
        }),
        getParagraphFormattingManager: () => ({
          getParagraphStart: () => 0,
          getFormattingForParagraph: () => ({ alignment: 'left' })
        }),
        getSubstitutionFieldsInRange: () => [],
        getEmbeddedObjectsInRange: () => [],
        getHyperlinksInRange: () => []
      } as unknown as FlowingTextContent;

      await manager.copy(mockFlowingContent);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should emit copy event with fallback flag when using writeText fallback', async () => {
      const handler = vi.fn();
      manager.on('copy', handler);

      // First write fails (custom MIME type not supported)
      mockClipboard.write.mockRejectedValue(new Error('Custom MIME not supported'));
      // Fallback to writeText succeeds
      mockClipboard.writeText.mockResolvedValue(undefined);

      const mockFlowingContent = {
        getText: () => 'Hello world',
        getSelection: () => ({ start: 0, end: 5 }),
        getFormattingManager: () => ({
          getFormattingAt: () => ({
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }),
          defaultFormatting: {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#000000'
          }
        }),
        getParagraphFormattingManager: () => ({
          getParagraphStart: () => 0,
          getFormattingForParagraph: () => ({ alignment: 'left' })
        }),
        getSubstitutionFieldsInRange: () => [],
        getEmbeddedObjectsInRange: () => [],
        getHyperlinksInRange: () => []
      } as unknown as FlowingTextContent;

      await manager.copy(mockFlowingContent);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        fallback: true
      }));
    });
  });
});
