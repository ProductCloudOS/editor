import { SectionData, ElementData } from '../types';
import { EventEmitter } from '../events/EventEmitter';
import { BaseElement } from '../elements/BaseElement';
import { ElementFactory } from '../elements/ElementFactory';

export type SectionType = 'header' | 'content' | 'footer';

export class Section extends EventEmitter {
  private _type: SectionType;
  private _height?: number;
  private _elements: Map<string, BaseElement> = new Map();

  constructor(type: SectionType, data: SectionData) {
    super();
    this._type = type;
    this._height = data.height;
    
    // Load existing elements
    if (data.elements) {
      data.elements.forEach(elementData => {
        const element = ElementFactory.createElement(elementData);
        this._elements.set(element.id, element);
        element.on('change', () => this.handleElementChange(element));
      });
    }
  }

  get type(): SectionType {
    return this._type;
  }

  get height(): number | undefined {
    return this._height;
  }

  set height(value: number | undefined) {
    this._height = value;
    this.emit('change', { property: 'height', value });
  }

  addElement(element: BaseElement): void {
    this._elements.set(element.id, element);
    element.on('change', () => this.handleElementChange(element));
    this.emit('element-added', { element });
    this.emit('change');
  }

  removeElement(elementId: string): BaseElement | null {
    const element = this._elements.get(elementId);
    if (!element) return null;

    this._elements.delete(elementId);
    element.removeAllListeners();
    
    this.emit('element-removed', { element });
    this.emit('change');
    
    return element;
  }

  getElement(elementId: string): BaseElement | undefined {
    return this._elements.get(elementId);
  }

  getElements(): ElementData[] {
    return Array.from(this._elements.values()).map(element => element.toData());
  }

  getAllElements(): BaseElement[] {
    return Array.from(this._elements.values());
  }

  getElementsByType(type: string): BaseElement[] {
    return Array.from(this._elements.values()).filter(
      element => element.toData().type === type
    );
  }

  clear(): void {
    this._elements.forEach(element => element.removeAllListeners());
    this._elements.clear();
    this.emit('cleared');
    this.emit('change');
  }

  private handleElementChange(element: BaseElement): void {
    this.emit('element-changed', { element });
    this.emit('change');
  }

  toData(): SectionData {
    const data: SectionData = {
      elements: this.getElements()
    };

    if (this._height !== undefined) {
      data.height = this._height;
    }

    return data;
  }
}