/**
 * ObjectMutationObserver - Intercepts object methods to capture mutations.
 *
 * Uses method wrapping to intercept object mutations (resize, move, table structure, properties)
 * without requiring changes to the object classes themselves.
 */

import { BaseEmbeddedObject, TableObject, TextBoxObject, ImageObject } from '../../objects';
import { TransactionManager } from './TransactionManager';
import {
  ObjectSourceId,
  MutationRecord,
  ResizeMutationData,
  MoveMutationData,
  PropertyMutationData,
  TableStructureMutationData,
  ObjectState,
  generateId
} from './types';
import { Size, RelativeOffset, ImageFitMode, ImageResizeMode, TextBoxBorder } from '../../objects/types';

/**
 * Stores original methods for a BaseEmbeddedObject instance.
 */
interface OriginalObjectMethods {
  resize: BaseEmbeddedObject['resize'];
  sizeSetter: (value: Size) => void;
  widthSetter: (value: number) => void;
  heightSetter: (value: number) => void;
  relativeOffsetSetter: (value: RelativeOffset) => void;
}

/**
 * Stores original methods for a TableObject instance.
 */
interface OriginalTableMethods {
  insertRow: TableObject['insertRow'];
  removeRow: TableObject['removeRow'];
  insertColumn: TableObject['insertColumn'];
  removeColumn: TableObject['removeColumn'];
  mergeCells: TableObject['mergeCells'];
  splitCell: TableObject['splitCell'];
}

/**
 * Stores original property setters for ImageObject.
 */
interface OriginalImageProperties {
  fitSetter: (value: ImageFitMode) => void;
  resizeModeSetter: (value: ImageResizeMode) => void;
  altSetter: (value: string) => void;
}

/**
 * Stores original property setters for TextBoxObject.
 */
interface OriginalTextBoxProperties {
  fontFamilySetter: (value: string) => void;
  fontSizeSetter: (value: number) => void;
  colorSetter: (value: string) => void;
  backgroundColorSetter: (value: string) => void;
  borderSetter: (value: TextBoxBorder) => void;
  paddingSetter: (value: number) => void;
}

/**
 * ObjectMutationObserver intercepts object methods to capture mutations.
 */
export class ObjectMutationObserver {
  private manager: TransactionManager;
  private observedObjects: WeakMap<BaseEmbeddedObject, {
    sourceId: ObjectSourceId;
    originalMethods: OriginalObjectMethods;
    originalTableMethods?: OriginalTableMethods;
    originalImageProperties?: OriginalImageProperties;
    originalTextBoxProperties?: OriginalTextBoxProperties;
  }> = new WeakMap();

  constructor(manager: TransactionManager) {
    this.manager = manager;
  }

  /**
   * Find a property descriptor by traversing the prototype chain.
   */
  private findPropertyDescriptor(obj: object, prop: string): PropertyDescriptor | undefined {
    let current = Object.getPrototypeOf(obj);
    while (current) {
      const descriptor = Object.getOwnPropertyDescriptor(current, prop);
      if (descriptor) {
        return descriptor;
      }
      current = Object.getPrototypeOf(current);
    }
    return undefined;
  }

  /**
   * Start observing an embedded object.
   * Wraps mutation methods to intercept changes.
   */
  observe(object: BaseEmbeddedObject): void {
    // Check if already observing
    if (this.observedObjects.has(object)) {
      return;
    }

    const sourceId: ObjectSourceId = {
      type: this.getObjectType(object),
      objectId: object.id
    };

    // Store original methods using property descriptors (traverse prototype chain)
    const sizeDescriptor = this.findPropertyDescriptor(object, 'size');
    const widthDescriptor = this.findPropertyDescriptor(object, 'width');
    const heightDescriptor = this.findPropertyDescriptor(object, 'height');
    const offsetDescriptor = this.findPropertyDescriptor(object, 'relativeOffset');

    const originalMethods: OriginalObjectMethods = {
      resize: object.resize.bind(object),
      sizeSetter: sizeDescriptor?.set?.bind(object) || (() => {}),
      widthSetter: widthDescriptor?.set?.bind(object) || (() => {}),
      heightSetter: heightDescriptor?.set?.bind(object) || (() => {}),
      relativeOffsetSetter: offsetDescriptor?.set?.bind(object) || (() => {})
    };

    const observedData: {
      sourceId: ObjectSourceId;
      originalMethods: OriginalObjectMethods;
      originalTableMethods?: OriginalTableMethods;
      originalImageProperties?: OriginalImageProperties;
      originalTextBoxProperties?: OriginalTextBoxProperties;
    } = { sourceId, originalMethods };

    // If this is a TableObject, also wrap table methods
    if (object instanceof TableObject) {
      observedData.originalTableMethods = {
        insertRow: object.insertRow.bind(object),
        removeRow: object.removeRow.bind(object),
        insertColumn: object.insertColumn.bind(object),
        removeColumn: object.removeColumn.bind(object),
        mergeCells: object.mergeCells.bind(object),
        splitCell: object.splitCell.bind(object)
      };
      this.wrapTableMethods(object, observedData.originalTableMethods);
    }

    // If this is an ImageObject, wrap image properties
    if (object instanceof ImageObject) {
      observedData.originalImageProperties = this.wrapImageProperties(object);
    }

    // If this is a TextBoxObject, wrap textbox properties
    if (object instanceof TextBoxObject) {
      observedData.originalTextBoxProperties = this.wrapTextBoxProperties(object);
    }

    this.observedObjects.set(object, observedData);

    // Wrap common methods (resize, size, width, height, relativeOffset)
    this.wrapCommonMethods(object, originalMethods, sizeDescriptor, widthDescriptor, heightDescriptor, offsetDescriptor);
  }

  /**
   * Wrap common object methods (resize, size setters, offset).
   */
  private wrapCommonMethods(
    object: BaseEmbeddedObject,
    originalMethods: OriginalObjectMethods,
    sizeDescriptor: PropertyDescriptor | undefined,
    widthDescriptor: PropertyDescriptor | undefined,
    heightDescriptor: PropertyDescriptor | undefined,
    offsetDescriptor: PropertyDescriptor | undefined
  ): void {
    // Wrap resize method
    object.resize = (newSize: Size) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.resize(newSize);
      }

      const previousSize = { ...object.size };
      originalMethods.resize(newSize);
      const actualNewSize = { ...object.size };

      if (previousSize.width !== actualNewSize.width || previousSize.height !== actualNewSize.height) {
        this.recordResizeMutation(object, previousSize, actualNewSize);
      }
    };

    // Wrap size setter
    Object.defineProperty(object, 'size', {
      get: sizeDescriptor?.get?.bind(object),
      set: (value: Size) => {
        if (this.manager.isUndoRedoInProgress) {
          originalMethods.sizeSetter(value);
          return;
        }

        const previousSize = { ...object.size };
        originalMethods.sizeSetter(value);

        if (previousSize.width !== value.width || previousSize.height !== value.height) {
          this.recordResizeMutation(object, previousSize, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap width setter
    Object.defineProperty(object, 'width', {
      get: widthDescriptor?.get?.bind(object),
      set: (value: number) => {
        if (this.manager.isUndoRedoInProgress) {
          originalMethods.widthSetter(value);
          return;
        }

        const previousSize = { ...object.size };
        originalMethods.widthSetter(value);

        if (previousSize.width !== value) {
          this.recordResizeMutation(object, previousSize, { width: value, height: object.height });
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap height setter
    Object.defineProperty(object, 'height', {
      get: heightDescriptor?.get?.bind(object),
      set: (value: number) => {
        if (this.manager.isUndoRedoInProgress) {
          originalMethods.heightSetter(value);
          return;
        }

        const previousSize = { ...object.size };
        originalMethods.heightSetter(value);

        if (previousSize.height !== value) {
          this.recordResizeMutation(object, previousSize, { width: object.width, height: value });
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap relativeOffset setter
    Object.defineProperty(object, 'relativeOffset', {
      get: offsetDescriptor?.get?.bind(object),
      set: (value: RelativeOffset) => {
        if (this.manager.isUndoRedoInProgress) {
          originalMethods.relativeOffsetSetter(value);
          return;
        }

        const previousOffset = { ...object.relativeOffset };
        originalMethods.relativeOffsetSetter(value);

        if (previousOffset.x !== value.x || previousOffset.y !== value.y) {
          this.recordMoveMutation(object, previousOffset, value);
        }
      },
      configurable: true,
      enumerable: true
    });
  }

  /**
   * Wrap ImageObject property setters.
   */
  private wrapImageProperties(image: ImageObject): OriginalImageProperties {
    const fitDescriptor = this.findPropertyDescriptor(image, 'fit');
    const resizeModeDescriptor = this.findPropertyDescriptor(image, 'resizeMode');
    const altDescriptor = this.findPropertyDescriptor(image, 'alt');

    const originalProperties: OriginalImageProperties = {
      fitSetter: fitDescriptor?.set?.bind(image) || (() => {}),
      resizeModeSetter: resizeModeDescriptor?.set?.bind(image) || (() => {}),
      altSetter: altDescriptor?.set?.bind(image) || (() => {})
    };

    // Wrap fit setter
    Object.defineProperty(image, 'fit', {
      get: fitDescriptor?.get?.bind(image),
      set: (value: ImageFitMode) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.fitSetter(value);
          return;
        }

        const previousValue = image.fit;
        originalProperties.fitSetter(value);

        if (previousValue !== value) {
          this.recordPropertyMutation(image, 'fit', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap resizeMode setter
    Object.defineProperty(image, 'resizeMode', {
      get: resizeModeDescriptor?.get?.bind(image),
      set: (value: ImageResizeMode) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.resizeModeSetter(value);
          return;
        }

        const previousValue = image.resizeMode;
        originalProperties.resizeModeSetter(value);

        if (previousValue !== value) {
          this.recordPropertyMutation(image, 'resizeMode', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap alt setter
    Object.defineProperty(image, 'alt', {
      get: altDescriptor?.get?.bind(image),
      set: (value: string) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.altSetter(value);
          return;
        }

        const previousValue = image.alt;
        originalProperties.altSetter(value);

        if (previousValue !== value) {
          this.recordPropertyMutation(image, 'alt', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    return originalProperties;
  }

  /**
   * Wrap TextBoxObject property setters.
   */
  private wrapTextBoxProperties(textBox: TextBoxObject): OriginalTextBoxProperties {
    const fontFamilyDescriptor = this.findPropertyDescriptor(textBox, 'fontFamily');
    const fontSizeDescriptor = this.findPropertyDescriptor(textBox, 'fontSize');
    const colorDescriptor = this.findPropertyDescriptor(textBox, 'color');
    const backgroundColorDescriptor = this.findPropertyDescriptor(textBox, 'backgroundColor');
    const borderDescriptor = this.findPropertyDescriptor(textBox, 'border');
    const paddingDescriptor = this.findPropertyDescriptor(textBox, 'padding');

    const originalProperties: OriginalTextBoxProperties = {
      fontFamilySetter: fontFamilyDescriptor?.set?.bind(textBox) || (() => {}),
      fontSizeSetter: fontSizeDescriptor?.set?.bind(textBox) || (() => {}),
      colorSetter: colorDescriptor?.set?.bind(textBox) || (() => {}),
      backgroundColorSetter: backgroundColorDescriptor?.set?.bind(textBox) || (() => {}),
      borderSetter: borderDescriptor?.set?.bind(textBox) || (() => {}),
      paddingSetter: paddingDescriptor?.set?.bind(textBox) || (() => {})
    };

    // Wrap fontFamily setter
    Object.defineProperty(textBox, 'fontFamily', {
      get: fontFamilyDescriptor?.get?.bind(textBox),
      set: (value: string) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.fontFamilySetter(value);
          return;
        }

        const previousValue = textBox.fontFamily;
        originalProperties.fontFamilySetter(value);

        if (previousValue !== value) {
          this.recordPropertyMutation(textBox, 'fontFamily', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap fontSize setter
    Object.defineProperty(textBox, 'fontSize', {
      get: fontSizeDescriptor?.get?.bind(textBox),
      set: (value: number) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.fontSizeSetter(value);
          return;
        }

        const previousValue = textBox.fontSize;
        originalProperties.fontSizeSetter(value);

        if (previousValue !== value) {
          this.recordPropertyMutation(textBox, 'fontSize', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap color setter
    Object.defineProperty(textBox, 'color', {
      get: colorDescriptor?.get?.bind(textBox),
      set: (value: string) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.colorSetter(value);
          return;
        }

        const previousValue = textBox.color;
        originalProperties.colorSetter(value);

        if (previousValue !== value) {
          this.recordPropertyMutation(textBox, 'color', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap backgroundColor setter
    Object.defineProperty(textBox, 'backgroundColor', {
      get: backgroundColorDescriptor?.get?.bind(textBox),
      set: (value: string) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.backgroundColorSetter(value);
          return;
        }

        const previousValue = textBox.backgroundColor;
        originalProperties.backgroundColorSetter(value);

        if (previousValue !== value) {
          this.recordPropertyMutation(textBox, 'backgroundColor', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap border setter
    Object.defineProperty(textBox, 'border', {
      get: borderDescriptor?.get?.bind(textBox),
      set: (value: TextBoxBorder) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.borderSetter(value);
          return;
        }

        const previousValue = { ...textBox.border };
        originalProperties.borderSetter(value);

        // Deep comparison for border object
        if (JSON.stringify(previousValue) !== JSON.stringify(value)) {
          this.recordPropertyMutation(textBox, 'border', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Wrap padding setter
    Object.defineProperty(textBox, 'padding', {
      get: paddingDescriptor?.get?.bind(textBox),
      set: (value: number) => {
        if (this.manager.isUndoRedoInProgress) {
          originalProperties.paddingSetter(value);
          return;
        }

        const previousValue = textBox.padding;
        originalProperties.paddingSetter(value);

        if (previousValue !== value) {
          this.recordPropertyMutation(textBox, 'padding', previousValue, value);
        }
      },
      configurable: true,
      enumerable: true
    });

    return originalProperties;
  }

  /**
   * Wrap TableObject-specific methods.
   */
  private wrapTableMethods(table: TableObject, originalMethods: OriginalTableMethods): void {
    // Wrap insertRow
    table.insertRow = (rowIndex: number, config?: any) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.insertRow(rowIndex, config);
      }

      const beforeSnapshot = this.captureTableSnapshot(table);
      const result = originalMethods.insertRow(rowIndex, config);
      const afterSnapshot = this.captureTableSnapshot(table);

      this.recordTableStructureMutation(table, 'table-add-row', beforeSnapshot, afterSnapshot);
      return result;
    };

    // Wrap removeRow
    table.removeRow = (rowIndex: number) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.removeRow(rowIndex);
      }

      const beforeSnapshot = this.captureTableSnapshot(table);
      const result = originalMethods.removeRow(rowIndex);
      const afterSnapshot = this.captureTableSnapshot(table);

      this.recordTableStructureMutation(table, 'table-delete-row', beforeSnapshot, afterSnapshot);
      return result;
    };

    // Wrap insertColumn
    table.insertColumn = (colIndex: number, width?: number) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.insertColumn(colIndex, width);
      }

      const beforeSnapshot = this.captureTableSnapshot(table);
      originalMethods.insertColumn(colIndex, width);
      const afterSnapshot = this.captureTableSnapshot(table);

      this.recordTableStructureMutation(table, 'table-add-column', beforeSnapshot, afterSnapshot);
    };

    // Wrap removeColumn
    table.removeColumn = (colIndex: number) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.removeColumn(colIndex);
      }

      const beforeSnapshot = this.captureTableSnapshot(table);
      originalMethods.removeColumn(colIndex);
      const afterSnapshot = this.captureTableSnapshot(table);

      this.recordTableStructureMutation(table, 'table-delete-column', beforeSnapshot, afterSnapshot);
    };

    // Wrap mergeCells
    table.mergeCells = (range?: any) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.mergeCells(range);
      }

      const beforeSnapshot = this.captureTableSnapshot(table);
      const result = originalMethods.mergeCells(range);

      if (result.success) {
        const afterSnapshot = this.captureTableSnapshot(table);
        this.recordTableStructureMutation(table, 'table-merge', beforeSnapshot, afterSnapshot);
      }

      return result;
    };

    // Wrap splitCell
    table.splitCell = (row: number, col: number) => {
      if (this.manager.isUndoRedoInProgress) {
        return originalMethods.splitCell(row, col);
      }

      const beforeSnapshot = this.captureTableSnapshot(table);
      const result = originalMethods.splitCell(row, col);

      if (result.success) {
        const afterSnapshot = this.captureTableSnapshot(table);
        this.recordTableStructureMutation(table, 'table-split', beforeSnapshot, afterSnapshot);
      }

      return result;
    };
  }

  /**
   * Stop observing an embedded object.
   * Restores original methods.
   */
  unobserve(object: BaseEmbeddedObject): void {
    const observed = this.observedObjects.get(object);
    if (!observed) return;

    const { originalMethods, originalTableMethods, originalImageProperties, originalTextBoxProperties } = observed;

    // Restore resize method
    object.resize = originalMethods.resize;

    // Restore property descriptors from prototype
    const proto = Object.getPrototypeOf(object);

    // Restore common properties
    const commonProps = ['size', 'width', 'height', 'relativeOffset'];
    for (const prop of commonProps) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
      if (descriptor) {
        Object.defineProperty(object, prop, descriptor);
      }
    }

    // Restore table methods
    if (originalTableMethods && object instanceof TableObject) {
      object.insertRow = originalTableMethods.insertRow;
      object.removeRow = originalTableMethods.removeRow;
      object.insertColumn = originalTableMethods.insertColumn;
      object.removeColumn = originalTableMethods.removeColumn;
      object.mergeCells = originalTableMethods.mergeCells;
      object.splitCell = originalTableMethods.splitCell;
    }

    // Restore image properties
    if (originalImageProperties && object instanceof ImageObject) {
      const imageProps = ['fit', 'resizeMode', 'alt'];
      for (const prop of imageProps) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
        if (descriptor) {
          Object.defineProperty(object, prop, descriptor);
        }
      }
    }

    // Restore textbox properties
    if (originalTextBoxProperties && object instanceof TextBoxObject) {
      const textBoxProps = ['fontFamily', 'fontSize', 'color', 'backgroundColor', 'border', 'padding'];
      for (const prop of textBoxProps) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
        if (descriptor) {
          Object.defineProperty(object, prop, descriptor);
        }
      }
    }

    this.observedObjects.delete(object);
  }

  /**
   * Check if an object is being observed.
   */
  isObserving(object: BaseEmbeddedObject): boolean {
    return this.observedObjects.has(object);
  }

  /**
   * Get the object type for an ObjectSourceId.
   */
  private getObjectType(object: BaseEmbeddedObject): 'textbox' | 'image' | 'table' {
    if (object instanceof TableObject) return 'table';
    if (object instanceof TextBoxObject) return 'textbox';
    if (object instanceof ImageObject) return 'image';
    return 'textbox';
  }

  /**
   * Create an ObjectState from current object data.
   */
  private createObjectState(object: BaseEmbeddedObject): ObjectState {
    return { data: object.toData() };
  }

  /**
   * Record a resize mutation.
   */
  private recordResizeMutation(
    object: BaseEmbeddedObject,
    previousSize: Size,
    newSize: Size
  ): void {
    this.manager.createBoundary();

    const mutation: MutationRecord = {
      id: generateId(),
      sourceId: { type: this.getObjectType(object), objectId: object.id },
      type: 'object-resize',
      timestamp: Date.now(),
      beforeState: this.createObjectState(object),
      afterState: this.createObjectState(object),
      data: {
        previousSize,
        newSize
      } as ResizeMutationData
    };

    this.manager.recordMutation(mutation);
  }

  /**
   * Record a move mutation.
   */
  private recordMoveMutation(
    object: BaseEmbeddedObject,
    previousOffset: RelativeOffset,
    newOffset: RelativeOffset
  ): void {
    this.manager.createBoundary();

    const mutation: MutationRecord = {
      id: generateId(),
      sourceId: { type: this.getObjectType(object), objectId: object.id },
      type: 'object-move',
      timestamp: Date.now(),
      beforeState: this.createObjectState(object),
      afterState: this.createObjectState(object),
      data: {
        previousOffset,
        newOffset
      } as MoveMutationData
    };

    this.manager.recordMutation(mutation);
  }

  /**
   * Record a property mutation.
   */
  private recordPropertyMutation(
    object: BaseEmbeddedObject,
    propertyName: string,
    previousValue: unknown,
    newValue: unknown
  ): void {
    this.manager.createBoundary();

    const mutation: MutationRecord = {
      id: generateId(),
      sourceId: { type: this.getObjectType(object), objectId: object.id },
      type: 'object-property',
      timestamp: Date.now(),
      beforeState: this.createObjectState(object),
      afterState: this.createObjectState(object),
      data: {
        propertyName,
        previousValue,
        newValue
      } as PropertyMutationData
    };

    this.manager.recordMutation(mutation);
  }

  /**
   * Record a table structure mutation.
   */
  private recordTableStructureMutation(
    table: TableObject,
    type: 'table-add-row' | 'table-delete-row' | 'table-add-column' | 'table-delete-column' | 'table-merge' | 'table-split',
    beforeSnapshot: unknown,
    afterSnapshot: unknown
  ): void {
    this.manager.createBoundary();

    const mutation: MutationRecord = {
      id: generateId(),
      sourceId: { type: 'table', objectId: table.id },
      type,
      timestamp: Date.now(),
      beforeState: { data: beforeSnapshot },
      afterState: { data: afterSnapshot },
      data: {
        beforeSnapshot,
        afterSnapshot
      } as TableStructureMutationData
    };

    this.manager.recordMutation(mutation);
  }

  /**
   * Capture a snapshot of table state for undo/redo.
   */
  private captureTableSnapshot(table: TableObject): unknown {
    return table.toData();
  }
}
