import { ElementData } from '../types';
import { BaseElement } from './BaseElement';
import { TextElement } from './TextElement';
import { ImageElement } from './ImageElement';
import { PlaceholderElement } from './PlaceholderElement';

export class ElementFactory {
  static createElement(data: ElementData): BaseElement {
    switch (data.type) {
      case 'text':
        return new TextElement(data);
      case 'image':
        return new ImageElement(data);
      case 'placeholder':
        return new PlaceholderElement(data);
      default:
        throw new Error(`Unknown element type: ${data.type}`);
    }
  }
}