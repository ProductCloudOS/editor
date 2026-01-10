/**
 * Transaction-Based Undo/Redo System
 *
 * This module provides a transaction-based undo/redo system that works
 * across all content sources (body, header, footer, table cells, text boxes).
 */

// Types
export * from './types';

// Core components
export { TransactionManager } from './TransactionManager';
export type { GetContentFn, GetObjectFn } from './TransactionManager';

export { FocusTracker } from './FocusTracker';
export type { GetActiveContentFn, RestoreFocusFn } from './FocusTracker';

export { TextMutationObserver } from './TextMutationObserver';

export { ObjectMutationObserver } from './ObjectMutationObserver';

export { MutationUndo } from './MutationUndo';

export { ContentDiscovery } from './ContentDiscovery';
export type { DocumentProvider, FocusEventSource } from './ContentDiscovery';
