/**
 * Sample document data for testing
 */
import type { DocumentData } from '../../lib/types';

/**
 * Minimal valid document
 */
export const minimalDocument: DocumentData = {
  version: '1.0.0',
  pages: [
    { id: 'page_1' }
  ]
};

/**
 * Document with basic text content
 */
export const documentWithText: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
    units: 'mm'
  },
  pages: [
    { id: 'page_1' }
  ],
  bodyContent: {
    text: 'Hello, World! This is a test document.'
  }
};

/**
 * Document with formatting
 */
export const documentWithFormatting: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
    units: 'mm'
  },
  pages: [
    { id: 'page_1' }
  ],
  bodyContent: {
    text: 'Bold and Italic text',
    formattingRuns: [
      {
        index: 0,
        formatting: {
          fontFamily: 'Arial',
          fontSize: 14,
          fontWeight: 'bold',
          color: '#000000'
        }
      },
      {
        index: 5,
        formatting: {
          fontFamily: 'Arial',
          fontSize: 14,
          fontStyle: 'italic',
          color: '#000000'
        }
      }
    ]
  }
};

/**
 * Document with substitution fields
 */
export const documentWithFields: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
    units: 'mm'
  },
  pages: [
    { id: 'page_1' }
  ],
  bodyContent: {
    text: 'Hello \uFFFC, welcome!',
    substitutionFields: [
      {
        id: 'field_1',
        textIndex: 6,
        fieldName: 'customerName',
        fieldType: 'data',
        defaultValue: 'Customer'
      }
    ]
  }
};

/**
 * Document with header and footer
 */
export const documentWithHeaderFooter: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
    units: 'mm'
  },
  pages: [
    { id: 'page_1' }
  ],
  headerContent: {
    text: 'Document Header'
  },
  footerContent: {
    text: 'Page Footer'
  }
};

/**
 * Document with multiple pages
 */
export const multiPageDocument: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
    units: 'mm'
  },
  pages: [
    { id: 'page_1' },
    { id: 'page_2' },
    { id: 'page_3' }
  ]
};

/**
 * Document with landscape orientation
 */
export const landscapeDocument: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    margins: { top: 20, right: 25, bottom: 20, left: 25 },
    units: 'mm'
  },
  pages: [
    { id: 'page_1' }
  ]
};

/**
 * Document with letter page size
 */
export const letterDocument: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'Letter',
    pageOrientation: 'portrait',
    margins: { top: 25, right: 25, bottom: 25, left: 25 },
    units: 'mm'
  },
  pages: [
    { id: 'page_1' }
  ]
};

/**
 * Document with repeating section
 */
export const documentWithRepeatingSection: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
    units: 'mm'
  },
  pages: [
    { id: 'page_1' }
  ],
  bodyContent: {
    text: 'Items:\nItem: \uFFFC\n',
    substitutionFields: [
      {
        id: 'field_1',
        textIndex: 13,
        fieldName: 'items.name',
        fieldType: 'data'
      }
    ],
    repeatingSections: [
      {
        id: 'section_1',
        fieldPath: 'items',
        startIndex: 7,
        endIndex: 15
      }
    ]
  }
};

/**
 * Sample merge data for testing
 */
export const sampleMergeData = {
  customerName: 'John Doe',
  companyName: 'Acme Corp',
  contact: {
    email: 'john@acme.com',
    phone: '555-1234',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345'
    }
  },
  items: [
    { name: 'Item 1', price: 10.00, quantity: 2 },
    { name: 'Item 2', price: 25.50, quantity: 1 },
    { name: 'Item 3', price: 5.00, quantity: 5 }
  ],
  orderTotal: 70.50,
  orderDate: '2024-01-15'
};

/**
 * Invalid document data for error testing
 */
export const invalidDocuments = {
  notAnObject: 'not an object',
  missingVersion: { pages: [] },
  missingPages: { version: '1.0.0' },
  invalidPages: { version: '1.0.0', pages: 'not an array' },
  pageWithoutId: { version: '1.0.0', pages: [{}] }
};
