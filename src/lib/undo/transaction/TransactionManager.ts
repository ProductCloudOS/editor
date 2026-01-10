/**
 * TransactionManager - Core transaction-based undo/redo management.
 *
 * Manages transactions (groups of mutations) and provides undo/redo functionality.
 * All mutations from all content sources flow through this manager.
 */

import { EventEmitter } from '../../events/EventEmitter';
import {
  Transaction,
  MutationRecord,
  MutationType,
  ContentSourceId,
  ObjectSourceId,
  CoalesceConfig,
  DEFAULT_COALESCE_CONFIG,
  generateId,
  InsertMutationData,
  DeleteMutationData
} from './types';
import { FocusTracker } from './FocusTracker';
import { FlowingTextContent } from '../../text/FlowingTextContent';

/**
 * Callback to get a FlowingTextContent by source ID.
 */
export type GetContentFn = (sourceId: ContentSourceId) => FlowingTextContent | null;

/**
 * Callback to get an object by source ID.
 */
export type GetObjectFn = (sourceId: ObjectSourceId) => unknown | null;

/**
 * TransactionManager handles the transaction-based undo/redo system.
 */
export class TransactionManager extends EventEmitter {
  private undoStack: Transaction[] = [];
  private redoStack: Transaction[] = [];
  private maxHistory: number = 100;

  // State flags
  private isPerformingUndoRedo: boolean = false;
  private coalesceConfig: CoalesceConfig = DEFAULT_COALESCE_CONFIG;

  // Pending transaction for coalescing
  private pendingTransaction: Transaction | null = null;

  // Compound operation tracking
  private transactionStack: Transaction[] = [];

  // Dependencies
  private focusTracker: FocusTracker;
  private _getContent: GetContentFn;
  private _getObject: GetObjectFn;

  constructor(
    focusTracker: FocusTracker,
    getContent: GetContentFn,
    getObject: GetObjectFn,
    maxHistory: number = 100
  ) {
    super();
    this.focusTracker = focusTracker;
    this._getContent = getContent;
    this._getObject = getObject;
    this.maxHistory = maxHistory;
  }

  /**
   * Get content by source ID. Used by MutationUndo.
   */
  getContent(sourceId: ContentSourceId): FlowingTextContent | null {
    return this._getContent(sourceId);
  }

  /**
   * Get object by source ID. Used by MutationUndo.
   */
  getObject(sourceId: ObjectSourceId): unknown | null {
    return this._getObject(sourceId);
  }

  /**
   * Check if we're currently performing an undo or redo operation.
   */
  get isUndoRedoInProgress(): boolean {
    return this.isPerformingUndoRedo;
  }

  /**
   * Record a mutation.
   * The mutation will be added to the current transaction or start a new one.
   */
  recordMutation(mutation: MutationRecord): void {
    // Don't record during undo/redo
    if (this.isPerformingUndoRedo) {
      return;
    }

    // Assign ID if not present
    if (!mutation.id) {
      mutation.id = generateId();
    }

    // If in compound operation, add to active transaction
    if (this.transactionStack.length > 0) {
      const activeTransaction = this.transactionStack[this.transactionStack.length - 1];
      activeTransaction.mutations.push(mutation);
      activeTransaction.endTime = mutation.timestamp;
      activeTransaction.focusStateAfter = this.focusTracker.capture();
      return;
    }

    // Try to coalesce with pending transaction
    if (this.shouldCoalesce(mutation)) {
      this.coalesceMutation(mutation);
      return;
    }

    // Flush pending transaction
    this.flushPendingTransaction();

    // Check if this can start a coalesce chain
    if (this.canStartCoalesce(mutation)) {
      this.pendingTransaction = this.createTransactionFromMutation(mutation);
    } else {
      // Commit immediately
      this.commitTransaction(this.createTransactionFromMutation(mutation));
    }

    // Clear redo stack on new action
    if (this.redoStack.length > 0) {
      this.redoStack = [];
      this.emitStateChange();
    }
  }

  /**
   * Create a transaction from a single mutation.
   */
  private createTransactionFromMutation(mutation: MutationRecord): Transaction {
    const focusState = this.focusTracker.capture();
    return {
      id: generateId(),
      startTime: mutation.timestamp,
      endTime: mutation.timestamp,
      mutations: [mutation],
      focusStateBefore: focusState,
      focusStateAfter: focusState,
      description: this.getDescriptionForMutation(mutation)
    };
  }

  /**
   * Check if a mutation should be coalesced with the pending transaction.
   */
  private shouldCoalesce(mutation: MutationRecord): boolean {
    if (!this.pendingTransaction) {
      return false;
    }

    const pending = this.pendingTransaction;
    const lastMutation = pending.mutations[pending.mutations.length - 1];

    // Same source?
    if (!this.sameSource(mutation.sourceId, lastMutation.sourceId)) {
      return false;
    }

    // Same type?
    if (mutation.type !== lastMutation.type) {
      return false;
    }

    // Time gap check
    if (mutation.timestamp - lastMutation.timestamp > this.coalesceConfig.maxTimeGap) {
      return false;
    }

    // For inserts: consecutive position?
    if (mutation.type === 'insert') {
      const lastData = lastMutation.data as InsertMutationData;
      const newData = mutation.data as InsertMutationData;
      if (newData.position !== lastData.position + lastData.text.length) {
        return false;
      }
      // Max character limit
      const totalChars = pending.mutations.reduce((sum, m) => {
        if (m.type === 'insert') {
          return sum + ((m.data as InsertMutationData).text?.length || 0);
        }
        return sum;
      }, 0);
      if (totalChars + newData.text.length > this.coalesceConfig.maxCharacters) {
        return false;
      }
    }

    // For deletes: consecutive position (backspace or forward delete)?
    if (mutation.type === 'delete') {
      const lastData = lastMutation.data as DeleteMutationData;
      const newData = mutation.data as DeleteMutationData;
      // Backspace: new position is one less than last position
      const isBackspace = newData.position === lastData.position - 1;
      // Forward delete: same position
      const isForwardDelete = newData.position === lastData.position;
      if (!isBackspace && !isForwardDelete) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if two source IDs refer to the same source.
   */
  private sameSource(a: ContentSourceId | ObjectSourceId, b: ContentSourceId | ObjectSourceId): boolean {
    // Check if both are content sources
    if ('type' in a && 'type' in b) {
      const aContent = a as ContentSourceId;
      const bContent = b as ContentSourceId;

      if (aContent.type !== bContent.type) return false;
      if (aContent.objectId !== bContent.objectId) return false;

      if (aContent.cellAddress && bContent.cellAddress) {
        return aContent.cellAddress.row === bContent.cellAddress.row &&
               aContent.cellAddress.col === bContent.cellAddress.col;
      }

      return aContent.cellAddress === bContent.cellAddress;
    }

    return false;
  }

  /**
   * Check if a mutation can start a coalesce chain.
   */
  private canStartCoalesce(mutation: MutationRecord): boolean {
    // Only text insert/delete operations can start coalescing
    return mutation.type === 'insert' || mutation.type === 'delete';
  }

  /**
   * Coalesce a mutation into the pending transaction.
   */
  private coalesceMutation(mutation: MutationRecord): void {
    if (!this.pendingTransaction) return;

    this.pendingTransaction.mutations.push(mutation);
    this.pendingTransaction.endTime = mutation.timestamp;
    this.pendingTransaction.focusStateAfter = this.focusTracker.capture();
  }

  /**
   * Flush the pending transaction to the undo stack.
   */
  flushPendingTransaction(): void {
    if (this.pendingTransaction) {
      this.commitTransaction(this.pendingTransaction);
      this.pendingTransaction = null;
    }
  }

  /**
   * Commit a transaction to the undo stack.
   */
  private commitTransaction(transaction: Transaction): void {
    if (transaction.mutations.length === 0) {
      return;
    }

    this.undoStack.push(transaction);

    // Trim history if needed
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.emit('transaction-committed', { transaction });
    this.emitStateChange();
  }

  /**
   * Create a boundary - flush pending transaction.
   * Call this when navigation occurs or context changes.
   */
  createBoundary(): void {
    this.flushPendingTransaction();
  }

  /**
   * Begin a compound operation.
   * All mutations until endCompoundOperation are grouped into one transaction.
   */
  beginCompoundOperation(description?: string): void {
    this.flushPendingTransaction();

    const transaction: Transaction = {
      id: generateId(),
      startTime: Date.now(),
      endTime: 0,
      mutations: [],
      focusStateBefore: this.focusTracker.capture(),
      focusStateAfter: this.focusTracker.capture(),
      description: description || 'Multiple Changes'
    };

    this.transactionStack.push(transaction);
  }

  /**
   * End a compound operation.
   */
  endCompoundOperation(description?: string): void {
    if (this.transactionStack.length === 0) return;

    const transaction = this.transactionStack.pop()!;
    transaction.endTime = Date.now();
    transaction.focusStateAfter = this.focusTracker.capture();

    if (description) {
      transaction.description = description;
    }

    // If this was a nested transaction, merge into parent
    if (this.transactionStack.length > 0) {
      const parent = this.transactionStack[this.transactionStack.length - 1];
      parent.mutations.push(...transaction.mutations);
    } else {
      // Top-level transaction - commit it
      if (transaction.mutations.length > 0) {
        this.commitTransaction(transaction);
        // Clear redo stack
        if (this.redoStack.length > 0) {
          this.redoStack = [];
          this.emitStateChange();
        }
      }
    }
  }

  /**
   * Perform an undo operation.
   * Returns true if undo was performed.
   */
  undo(): boolean {
    this.flushPendingTransaction();

    if (this.undoStack.length === 0) {
      return false;
    }

    const transaction = this.undoStack.pop()!;

    this.isPerformingUndoRedo = true;
    try {
      // Undo mutations in reverse order
      for (let i = transaction.mutations.length - 1; i >= 0; i--) {
        this.undoMutation(transaction.mutations[i]);
      }

      // Restore focus state
      this.focusTracker.restore(transaction.focusStateBefore);

      // Move to redo stack
      this.redoStack.push(transaction);

      this.emit('undo-performed', { transaction });
      this.emitStateChange();

      return true;
    } finally {
      this.isPerformingUndoRedo = false;
    }
  }

  /**
   * Perform a redo operation.
   * Returns true if redo was performed.
   */
  redo(): boolean {
    if (this.redoStack.length === 0) {
      return false;
    }

    const transaction = this.redoStack.pop()!;

    this.isPerformingUndoRedo = true;
    try {
      // Redo mutations in forward order
      for (const mutation of transaction.mutations) {
        this.redoMutation(mutation);
      }

      // Restore focus state
      this.focusTracker.restore(transaction.focusStateAfter);

      // Move back to undo stack
      this.undoStack.push(transaction);

      this.emit('redo-performed', { transaction });
      this.emitStateChange();

      return true;
    } finally {
      this.isPerformingUndoRedo = false;
    }
  }

  /**
   * Undo a single mutation.
   */
  private undoMutation(mutation: MutationRecord): void {
    // This will be implemented based on mutation type
    // For now, delegate to specialized undo logic
    this.emit('undo-mutation', { mutation });
  }

  /**
   * Redo a single mutation.
   */
  private redoMutation(mutation: MutationRecord): void {
    // This will be implemented based on mutation type
    // For now, delegate to specialized redo logic
    this.emit('redo-mutation', { mutation });
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.undoStack.length > 0 || this.pendingTransaction !== null;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get description of the next undo operation.
   */
  getUndoDescription(): string | null {
    if (this.pendingTransaction) {
      return this.pendingTransaction.description;
    }

    if (this.undoStack.length === 0) {
      return null;
    }

    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Get description of the next redo operation.
   */
  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) {
      return null;
    }

    return this.redoStack[this.redoStack.length - 1].description;
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.pendingTransaction = null;
    this.transactionStack = [];
    this.emit('history-cleared', undefined);
    this.emitStateChange();
  }

  /**
   * Get a description for a mutation type.
   */
  private getDescriptionForMutation(mutation: MutationRecord): string {
    const descriptions: Record<MutationType, string> = {
      'insert': 'Typing',
      'delete': 'Delete',
      'format': 'Format',
      'alignment': 'Alignment',
      'field-insert': 'Insert Field',
      'field-delete': 'Delete Field',
      'field-update': 'Update Field',
      'object-insert': 'Insert Object',
      'object-delete': 'Delete Object',
      'object-resize': 'Resize',
      'object-move': 'Move',
      'object-property': 'Change Property',
      'table-add-row': 'Add Row',
      'table-add-column': 'Add Column',
      'table-delete-row': 'Delete Row',
      'table-delete-column': 'Delete Column',
      'table-merge': 'Merge Cells',
      'table-split': 'Split Cell'
    };

    return descriptions[mutation.type] || 'Change';
  }

  /**
   * Emit state change event.
   */
  private emitStateChange(): void {
    this.emit('state-changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }

  /**
   * Set coalesce configuration.
   */
  setCoalesceConfig(config: Partial<CoalesceConfig>): void {
    this.coalesceConfig = { ...this.coalesceConfig, ...config };
  }

  /**
   * Set maximum history size.
   */
  setMaxHistory(max: number): void {
    this.maxHistory = max;
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }
}
