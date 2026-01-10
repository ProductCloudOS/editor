/**
 * FocusTracker - Captures and restores focus/cursor state.
 *
 * Tracks which content source is active (body, header, footer, table cell, textbox)
 * and the cursor/selection state within that source.
 */

import { FocusState } from './types';
import { FlowingTextContent } from '../../text/FlowingTextContent';

/**
 * Callback to get the currently active FlowingTextContent.
 */
export type GetActiveContentFn = () => {
  content: FlowingTextContent | null;
  section: 'body' | 'header' | 'footer';
  focusedObjectId: string | null;
  tableCellAddress: { row: number; col: number } | null;
};

/**
 * Callback to restore focus to a specific state.
 */
export type RestoreFocusFn = (state: FocusState) => void;

/**
 * FocusTracker captures and restores focus state for undo/redo.
 */
export class FocusTracker {
  private getActiveContent: GetActiveContentFn;
  private restoreFocus: RestoreFocusFn;

  constructor(
    getActiveContent: GetActiveContentFn,
    restoreFocus: RestoreFocusFn
  ) {
    this.getActiveContent = getActiveContent;
    this.restoreFocus = restoreFocus;
  }

  /**
   * Capture the current focus state.
   */
  capture(): FocusState {
    const active = this.getActiveContent();

    if (!active.content) {
      // No active content, return default state
      return {
        activeSection: 'body',
        focusedObjectId: null,
        tableCellAddress: null,
        cursorPosition: 0,
        selection: null
      };
    }

    const selection = active.content.getSelection();

    return {
      activeSection: active.section,
      focusedObjectId: active.focusedObjectId,
      tableCellAddress: active.tableCellAddress,
      cursorPosition: active.content.getCursorPosition(),
      selection: selection ? { start: selection.start, end: selection.end } : null
    };
  }

  /**
   * Restore focus to a previously captured state.
   */
  restore(state: FocusState): void {
    this.restoreFocus(state);
  }

  /**
   * Capture focus state for a specific FlowingTextContent.
   * Used when we know exactly which content to capture from.
   */
  captureFromContent(
    content: FlowingTextContent,
    section: 'body' | 'header' | 'footer',
    focusedObjectId: string | null = null,
    tableCellAddress: { row: number; col: number } | null = null
  ): FocusState {
    const selection = content.getSelection();

    return {
      activeSection: section,
      focusedObjectId,
      tableCellAddress,
      cursorPosition: content.getCursorPosition(),
      selection: selection ? { start: selection.start, end: selection.end } : null
    };
  }
}
