/**
 * Helper for creating PCEditor instances in tests
 */
import { PCEditor } from '../../lib/core/PCEditor';
import type { EditorOptions } from '../../lib/types';

export interface TestEditorResult {
  editor: PCEditor;
  container: HTMLElement;
}

/**
 * Create a PCEditor instance for testing.
 * Waits for the editor to be ready before returning.
 */
export async function createEditor(
  options?: EditorOptions
): Promise<TestEditorResult> {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);

  const editor = new PCEditor(container, options);

  // Wait for ready event
  await waitForReady(editor);

  return { editor, container };
}

/**
 * Wait for the editor to emit the 'ready' event.
 */
export function waitForReady(editor: PCEditor): Promise<void> {
  return new Promise<void>((resolve) => {
    if (editor.isReady) {
      resolve();
    } else {
      editor.on('ready', () => resolve());
    }
  });
}

/**
 * Clean up an editor container after test.
 */
export function cleanupEditor(container: HTMLElement): void {
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

/**
 * Wait for a specific event to be emitted.
 */
export function waitForEvent<T = unknown>(
  editor: PCEditor,
  eventName: string,
  timeout = 1000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    editor.on(eventName, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Create multiple editors for parallel testing.
 */
export async function createEditors(
  count: number,
  options?: EditorOptions
): Promise<TestEditorResult[]> {
  const results: TestEditorResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(await createEditor(options));
  }
  return results;
}

/**
 * Run async function after a small delay to allow for event processing.
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Wait for multiple ticks to allow event propagation.
 */
export async function waitForTicks(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await nextTick();
  }
}
