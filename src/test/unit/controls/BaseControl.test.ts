/**
 * Unit tests for BaseControl
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseControl } from '../../../lib/controls/BaseControl';
import type { ControlAttachOptions } from '../../../lib/controls/types';

// Concrete implementation for testing
class TestControl extends BaseControl {
  public createElementCalled = false;
  public setupEventListenersCalled = false;
  public updateCalled = false;

  constructor(id: string = 'test-control') {
    super(id, {});
  }

  protected createElement(): HTMLElement {
    this.createElementCalled = true;
    const div = document.createElement('div');
    div.className = 'test-control';
    return div;
  }

  protected setupEventListeners(): void {
    super.setupEventListeners();
    this.setupEventListenersCalled = true;
  }

  update(): void {
    this.updateCalled = true;
  }
}

describe('BaseControl', () => {
  let control: TestControl;
  let container: HTMLElement;
  let mockEditor: any;

  beforeEach(() => {
    control = new TestControl();
    container = document.createElement('div');
    document.body.appendChild(container);

    mockEditor = {
      on: vi.fn(),
      off: vi.fn(),
      getZoomLevel: vi.fn().mockReturnValue(1),
      getContainer: vi.fn().mockReturnValue(document.createElement('div')),
      getDocumentMetrics: vi.fn().mockReturnValue({
        pageWidth: 210,
        pageHeight: 297,
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        totalPages: 1
      })
    };
  });

  afterEach(() => {
    if (control.isAttached) {
      control.detach();
    }
    document.body.removeChild(container);
  });

  describe('constructor', () => {
    it('should create a control with the given id', () => {
      const ctrl = new TestControl('my-control');
      expect(ctrl.id).toBe('my-control');
    });

    it('should not be attached initially', () => {
      expect(control.isAttached).toBe(false);
    });

    it('should be visible initially', () => {
      expect(control.isVisible).toBe(true);
    });
  });

  describe('attach()', () => {
    it('should attach the control to the container', () => {
      control.attach({ editor: mockEditor, container });

      expect(control.isAttached).toBe(true);
      expect(container.children.length).toBe(1);
    });

    it('should call createElement', () => {
      control.attach({ editor: mockEditor, container });

      expect(control.createElementCalled).toBe(true);
    });

    it('should call setupEventListeners', () => {
      control.attach({ editor: mockEditor, container });

      expect(control.setupEventListenersCalled).toBe(true);
    });

    it('should call update after attaching', () => {
      control.attach({ editor: mockEditor, container });

      expect(control.updateCalled).toBe(true);
    });

    it('should throw if already attached', () => {
      control.attach({ editor: mockEditor, container });

      expect(() => {
        control.attach({ editor: mockEditor, container });
      }).toThrow(/Control .* is already attached/);
    });

    it('should add the element to the container', () => {
      control.attach({ editor: mockEditor, container });

      const element = container.querySelector('.test-control');
      expect(element).not.toBeNull();
    });
  });

  describe('detach()', () => {
    it('should detach the control', () => {
      control.attach({ editor: mockEditor, container });
      control.detach();

      expect(control.isAttached).toBe(false);
    });

    it('should remove the element from the container', () => {
      control.attach({ editor: mockEditor, container });
      control.detach();

      expect(container.children.length).toBe(0);
    });

    it('should not throw if not attached', () => {
      expect(() => control.detach()).not.toThrow();
    });

    it('should clean up event listeners', () => {
      control.attach({ editor: mockEditor, container });
      control.detach();

      // After detach, editorListenerCleanup should be called
      // We can verify this by checking that re-attaching works
      expect(() => {
        control.attach({ editor: mockEditor, container });
      }).not.toThrow();
    });
  });

  describe('show()', () => {
    it('should make the control visible', () => {
      control.attach({ editor: mockEditor, container });
      control.hide();
      control.show();

      expect(control.isVisible).toBe(true);
    });

    it('should update the element display style', () => {
      control.attach({ editor: mockEditor, container });
      control.hide();
      control.show();

      const element = container.querySelector('.test-control') as HTMLElement;
      expect(element.style.display).toBe('');
    });

    it('should call update when showing', () => {
      control.attach({ editor: mockEditor, container });
      control.updateCalled = false;
      control.hide();
      control.show();

      expect(control.updateCalled).toBe(true);
    });
  });

  describe('hide()', () => {
    it('should hide the control', () => {
      control.attach({ editor: mockEditor, container });
      control.hide();

      expect(control.isVisible).toBe(false);
    });

    it('should set the element display to none', () => {
      control.attach({ editor: mockEditor, container });
      control.hide();

      const element = container.querySelector('.test-control') as HTMLElement;
      expect(element.style.display).toBe('none');
    });
  });

  describe('toggle()', () => {
    it('should toggle visibility from visible to hidden', () => {
      control.attach({ editor: mockEditor, container });
      control.toggle();

      expect(control.isVisible).toBe(false);
    });

    it('should toggle visibility from hidden to visible', () => {
      control.attach({ editor: mockEditor, container });
      control.hide();
      control.toggle();

      expect(control.isVisible).toBe(true);
    });
  });

  describe('destroy()', () => {
    it('should detach and clean up', () => {
      control.attach({ editor: mockEditor, container });
      control.destroy();

      expect(control.isAttached).toBe(false);
      expect(container.children.length).toBe(0);
    });

    it('should work even if not attached', () => {
      expect(() => control.destroy()).not.toThrow();
    });
  });

  describe('addEditorListener()', () => {
    it('should register listeners that get cleaned up on detach', () => {
      // Create a control that adds a listener in setupEventListeners
      class ListeningControl extends TestControl {
        protected setupEventListeners(): void {
          super.setupEventListeners();
          this.addEditorListener('test-event', () => {});
        }
      }

      const listeningControl = new ListeningControl();
      listeningControl.attach({ editor: mockEditor, container });

      // Should have registered the listener
      expect(mockEditor.on).toHaveBeenCalledWith('test-event', expect.any(Function));

      listeningControl.detach();

      // After detach, off should have been called for cleanup
      expect(mockEditor.off).toHaveBeenCalledWith('test-event', expect.any(Function));
    });

    it('should not register listener if editor is null', () => {
      // Access the protected method through our test control
      class ExposingControl extends TestControl {
        public testAddListener(): void {
          // Called before attach, so editor is null
          this.addEditorListener('test-event', () => {});
        }
      }

      const exposingControl = new ExposingControl();
      exposingControl.testAddListener();

      // Should not throw and on should not be called
      expect(mockEditor.on).not.toHaveBeenCalled();
    });
  });
});
