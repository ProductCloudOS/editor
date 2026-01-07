import { DocumentData, DataBindingContext, ElementData, PlaceholderElementData } from '../types';

export class DataBinder {
  bind(document: DocumentData, context: DataBindingContext): DocumentData {
    const boundDocument: DocumentData = {
      version: document.version,
      settings: document.settings,
      pages: []
    };

    document.pages.forEach(page => {
      const boundPage = { ...page };
      
      boundPage.header = this.bindSection(page.header, context);
      boundPage.content = this.bindSection(page.content, context);
      boundPage.footer = this.bindSection(page.footer, context);
      
      boundDocument.pages.push(boundPage);
    });

    return boundDocument;
  }

  private bindSection(section: any, context: DataBindingContext): any {
    return {
      ...section,
      elements: section.elements.map((element: ElementData) => 
        this.bindElement(element, context)
      )
    };
  }

  private bindElement(element: ElementData, context: DataBindingContext): ElementData {
    if (element.type !== 'placeholder') {
      return element;
    }

    const placeholderData = element.data as PlaceholderElementData;
    const value = this.resolveValue(placeholderData.key, context);

    return {
      ...element,
      type: 'text',
      data: {
        content: this.formatValue(value, placeholderData.format),
        fontFamily: 'Arial',
        fontSize: 12,
        color: '#000000'
      }
    };
  }

  private resolveValue(key: string, context: DataBindingContext): any {
    const keys = key.split('.');
    let value: any = context;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return value;
  }

  private formatValue(value: any, format?: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (!format) {
      return String(value);
    }

    return String(value);
  }
}