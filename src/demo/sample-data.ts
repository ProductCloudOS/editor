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
      id: 'page_1',
      header: {
        height: 50,
        elements: [
          {
            id: 'header_logo',
            type: 'image',
            position: { x: 20, y: 10 },
            size: { width: 60, height: 30 },
            data: {
              src: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iMzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjMzQ5OGRiIiByeD0iNCIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkxPR088L3RleHQ+Cjwvc3ZnPg==',
              alt: 'Company Logo'
            }
          },
          {
            id: 'header_title',
            type: 'text',
            position: { x: 90, y: 15 },
            size: { width: 100, height: 20 },
            data: {
              content: 'INVOICE',
              fontFamily: 'Arial',
              fontSize: 20,
              fontWeight: 'bold',
              color: '#2c3e50'
            }
          }
        ]
      },
      content: {
        elements: [
          {
            id: 'invoice_info',
            type: 'text',
            position: { x: 20, y: 20 },
            size: { width: 170, height: 60 },
            data: {
              content: 'Invoice Details\n\nInvoice Number: INV-2024-001\nDate: January 15, 2024',
              fontFamily: 'Arial',
              fontSize: 12,
              lineHeight: 1.5,
              color: '#333333'
            }
          },
          {
            id: 'customer_placeholder',
            type: 'placeholder',
            position: { x: 20, y: 90 },
            size: { width: 170, height: 30 },
            data: {
              key: 'customerName',
              displayText: '{{customerName}}',
              defaultValue: 'Customer Name'
            }
          },
          {
            id: 'items_header',
            type: 'text',
            position: { x: 20, y: 140 },
            size: { width: 170, height: 20 },
            data: {
              content: 'Items',
              fontFamily: 'Arial',
              fontSize: 16,
              fontWeight: 'bold',
              color: '#2c3e50'
            }
          }
        ]
      },
      footer: {
        height: 30,
        elements: [
          {
            id: 'footer_text',
            type: 'text',
            position: { x: 20, y: 5 },
            size: { width: 170, height: 20 },
            data: {
              content: 'Thank you for your business!',
              fontFamily: 'Arial',
              fontSize: 10,
              textAlign: 'center',
              color: '#666666'
            }
          }
        ]
      }
    }
  ]
};