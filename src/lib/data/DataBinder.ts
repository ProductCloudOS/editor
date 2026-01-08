import { DocumentData, DataBindingContext } from '../types';

/**
 * DataBinder handles binding data to documents.
 * Note: With the removal of regular elements, data binding for fields is now
 * handled by PCEditor.applyMergeData(). This class maintains the interface
 * for compatibility but performs minimal transformation.
 */
export class DataBinder {
  bind(document: DocumentData, _context: DataBindingContext): DocumentData {
    // With regular elements removed, data binding for placeholder elements
    // is no longer relevant. Field substitution is handled by applyMergeData().
    // Just return a copy of the document.
    return {
      version: document.version,
      settings: document.settings,
      pages: document.pages.map(page => ({ ...page })),
      headerContent: document.headerContent,
      footerContent: document.footerContent
    };
  }
}
