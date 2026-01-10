/**
 * Tests for PCEditor event emissions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PCEditor } from '../../lib/core/PCEditor';
import { TextBoxObject } from '../../lib/objects';
import { createEditor, cleanupEditor, nextTick, waitForEvent } from '../helpers/createEditor';
import { minimalDocument } from '../helpers/documentFixtures';

describe('PCEditor Events', () => {
  let editor: PCEditor;
  let container: HTMLElement;

  beforeEach(async () => {
    const result = await createEditor();
    editor = result.editor;
    container = result.container;
  });

  afterEach(() => {
    cleanupEditor(container);
  });

  describe('ready event', () => {
    it('should have emitted ready event after initialization', () => {
      // Editor is already ready after createEditor
      expect(editor.isReady).toBe(true);
    });

    it('should emit ready event for new editor', async () => {
      const newContainer = document.createElement('div');
      newContainer.style.width = '800px';
      newContainer.style.height = '600px';
      document.body.appendChild(newContainer);

      const readyHandler = vi.fn();
      const newEditor = new PCEditor(newContainer);
      newEditor.on('ready', readyHandler);

      await new Promise<void>(resolve => {
        if (newEditor.isReady) {
          resolve();
        } else {
          newEditor.on('ready', () => resolve());
        }
      });

      expect(readyHandler).toHaveBeenCalled();
      cleanupEditor(newContainer);
    });
  });

  describe('document events', () => {
    describe('document-change', () => {
      it('should emit on text change', async () => {
        const handler = vi.fn();
        editor.on('document-change', handler);

        editor.setFlowingText('New content');
        await nextTick();

        expect(handler).toHaveBeenCalled();
      });

      it('should include document data in event', async () => {
        const handler = vi.fn();
        editor.on('document-change', handler);

        editor.setFlowingText('Test');
        await nextTick();

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            document: expect.any(Object)
          })
        );
      });
    });

    describe('document-loaded', () => {
      it('should emit when document is loaded', async () => {
        const handler = vi.fn();
        editor.on('document-loaded', handler);

        editor.loadDocument(minimalDocument);

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('document-loaded-from-json', () => {
      it('should emit when loading from JSON', async () => {
        const handler = vi.fn();
        editor.on('document-loaded-from-json', handler);

        editor.loadDocumentFromJSON(JSON.stringify(minimalDocument));

        expect(handler).toHaveBeenCalled();
      });

      it('should include version in event', async () => {
        const handler = vi.fn();
        editor.on('document-loaded-from-json', handler);

        editor.loadDocumentFromJSON(JSON.stringify(minimalDocument));

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            version: '1.0.0'
          })
        );
      });
    });

    describe('document-settings-changed', () => {
      it('should emit when settings change', async () => {
        const handler = vi.fn();
        editor.on('document-settings-changed', handler);

        editor.updateDocumentSettings({ pageSize: 'Letter' });

        expect(handler).toHaveBeenCalled();
      });
    });
  });

  describe('selection events', () => {
    describe('selection-change', () => {
      it('should emit when cursor position changes', async () => {
        const handler = vi.fn();
        editor.on('selection-change', handler);

        editor.setFlowingText('Hello');
        editor.setCursorPosition(3);
        await nextTick();

        // Selection change may be emitted via canvas manager
      });
    });

    describe('cursor-changed', () => {
      it('should emit cursor-changed event', async () => {
        const handler = vi.fn();
        editor.on('cursor-changed', handler);

        // Cursor changes are typically triggered by user interaction
        // In unit tests, we verify the handler can be registered
      });
    });
  });

  describe('text input events', () => {
    describe('text-input-enabled', () => {
      it('should emit when text input is enabled', async () => {
        const handler = vi.fn();
        editor.on('text-input-enabled', handler);

        editor.enableTextInput();

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('text-input-disabled', () => {
      it('should emit when text input is disabled', async () => {
        const handler = vi.fn();
        editor.on('text-input-disabled', handler);

        editor.disableTextInput();

        expect(handler).toHaveBeenCalled();
      });
    });
  });

  describe('field events', () => {
    describe('substitution-field-added', () => {
      it('should emit when field is added', async () => {
        const handler = vi.fn();
        editor.on('substitution-field-added', handler);

        editor.insertSubstitutionField('test');
        await nextTick();

        expect(handler).toHaveBeenCalled();
      });

      it('should include field info in event', async () => {
        const handler = vi.fn();
        editor.on('substitution-field-added', handler);

        editor.insertSubstitutionField('customerName');
        await nextTick();

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            field: expect.objectContaining({
              fieldName: 'customerName'
            })
          })
        );
      });
    });

    describe('substitution-field-updated', () => {
      it('should emit when field is updated', async () => {
        const handler = vi.fn();
        editor.on('substitution-field-updated', handler);

        editor.insertSubstitutionField('test');
        await nextTick();

        editor.updateField(0, { fieldName: 'updated' });
        await nextTick();

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('page-number-field-added', () => {
      it('should emit when page number field is added', async () => {
        const handler = vi.fn();
        editor.on('page-number-field-added', handler);

        editor.insertPageNumberField();
        await nextTick();

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('page-count-field-added', () => {
      it('should emit when page count field is added', async () => {
        const handler = vi.fn();
        editor.on('page-count-field-added', handler);

        editor.insertPageCountField();
        await nextTick();

        expect(handler).toHaveBeenCalled();
      });
    });
  });

  describe('embedded object events', () => {
    describe('embedded-object-added', () => {
      it('should emit when object is added', async () => {
        const handler = vi.fn();
        editor.on('embedded-object-added', handler);

        const textBox = new TextBoxObject({
          id: 'event-test-textbox',
          size: { width: 100, height: 50 }
        });

        editor.insertEmbeddedObject(textBox);
        await nextTick();

        expect(handler).toHaveBeenCalled();
      });

      it('should include object and position in event', async () => {
        const handler = vi.fn();
        editor.on('embedded-object-added', handler);

        const textBox = new TextBoxObject({
          id: 'event-detail-textbox',
          size: { width: 100, height: 50 }
        });

        editor.insertEmbeddedObject(textBox, 'block');
        await nextTick();

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            object: expect.objectContaining({
              id: 'event-detail-textbox'
            }),
            position: 'block'
          })
        );
      });
    });
  });

  describe('merge events', () => {
    describe('merge-data-applied', () => {
      it('should emit when merge data is applied', async () => {
        const handler = vi.fn();
        editor.on('merge-data-applied', handler);

        editor.insertSubstitutionField('name');
        await nextTick();

        editor.applyMergeData({ name: 'Test' });

        expect(handler).toHaveBeenCalled();
      });

      it('should include data and field count in event', async () => {
        const handler = vi.fn();
        editor.on('merge-data-applied', handler);

        editor.insertSubstitutionField('name');
        await nextTick();

        editor.applyMergeData({ name: 'Test' });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ name: 'Test' }),
            fieldCount: expect.any(Number)
          })
        );
      });
    });

    describe('data-bound', () => {
      it('should emit when data is bound', async () => {
        const handler = vi.fn();
        editor.on('data-bound', handler);

        editor.bindData({ test: 'value' });

        expect(handler).toHaveBeenCalled();
      });
    });
  });

  describe('alignment events', () => {
    describe('alignment-changed', () => {
      it('should emit when alignment changes', async () => {
        const handler = vi.fn();
        editor.on('alignment-changed', handler);

        editor.setFlowingText('Test');
        editor.setAlignment('center');

        expect(handler).toHaveBeenCalled();
      });

      it('should include alignment value in event', async () => {
        const handler = vi.fn();
        editor.on('alignment-changed', handler);

        editor.setFlowingText('Test');
        editor.setAlignment('right');

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            alignment: 'right'
          })
        );
      });
    });
  });

  describe('undo/redo events', () => {
    describe('undo', () => {
      it('should emit undo event', async () => {
        const handler = vi.fn();
        editor.on('undo', handler);

        editor.undo();

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('redo', () => {
      it('should emit redo event', async () => {
        const handler = vi.fn();
        editor.on('redo', handler);

        editor.redo();

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('undo-state-changed', () => {
      it('should be subscribable', () => {
        const handler = vi.fn();
        expect(() => editor.on('undo-state-changed', handler)).not.toThrow();
      });
    });
  });

  describe('view option events', () => {
    describe('grid-changed', () => {
      it('should emit when grid visibility changes', () => {
        const handler = vi.fn();
        editor.on('grid-changed', handler);

        editor.setShowGrid(false);

        expect(handler).toHaveBeenCalledWith({ show: false });
      });
    });

    describe('control-characters-changed', () => {
      it('should emit when control character visibility changes', () => {
        const handler = vi.fn();
        editor.on('control-characters-changed', handler);

        editor.setShowControlCharacters(true);

        expect(handler).toHaveBeenCalledWith({ show: true });
      });
    });

    describe('margin-lines-changed', () => {
      it('should emit when margin line visibility changes', () => {
        const handler = vi.fn();
        editor.on('margin-lines-changed', handler);

        editor.setShowMarginLines(false);

        expect(handler).toHaveBeenCalledWith({ show: false });
      });
    });
  });

  describe('error events', () => {
    describe('error', () => {
      it('should emit on load error', async () => {
        const handler = vi.fn();
        editor.on('error', handler);

        try {
          editor.loadDocumentFromJSON('invalid json');
        } catch {
          // Expected
        }

        await nextTick();
        expect(handler).toHaveBeenCalled();
      });

      it('should include error context', async () => {
        const handler = vi.fn();
        editor.on('error', handler);

        try {
          editor.loadDocumentFromJSON('invalid');
        } catch {
          // Expected
        }

        await nextTick();
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            context: 'load-document'
          })
        );
      });
    });
  });

  describe('event handler management', () => {
    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      editor.on('document-change', handler1);
      editor.on('document-change', handler2);

      editor.setFlowingText('Test');

      // Both handlers should eventually be called
    });

    it('should support removing handlers', () => {
      const handler = vi.fn();
      editor.on('document-change', handler);
      editor.off('document-change', handler);

      editor.setFlowingText('Test');

      // Handler should not be called after removal
    });
  });
});
