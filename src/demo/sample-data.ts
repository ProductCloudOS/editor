import { DocumentData } from '../lib';

export const sampleDocument: DocumentData = {
  version: '1.0.0',
  settings: {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    units: 'mm'
  },
  pages: [
    {
      id: 'page_1'
    }
  ],
  headerContent: {
    text: 'Sample Document Header'
  },
  footerContent: {
    text: 'Page 1'
  }
};
