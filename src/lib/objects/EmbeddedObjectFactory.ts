import { BaseEmbeddedObject } from './BaseEmbeddedObject';
import { ImageObject } from './ImageObject';
import { TextBoxObject } from './TextBoxObject';
import { TableObject, TableObjectData } from './table';
import { EmbeddedObjectData } from './types';

/**
 * Factory function type for creating embedded objects.
 */
type ObjectFactory = (data: EmbeddedObjectData) => BaseEmbeddedObject;

/**
 * Factory for creating embedded objects from serialized data.
 * Supports registration of custom object types.
 */
export class EmbeddedObjectFactory {
  private static registry: Map<string, ObjectFactory> = new Map();
  private static initialized: boolean = false;

  /**
   * Register an object type factory.
   * @param objectType The type identifier (e.g., 'image', 'textbox')
   * @param factory Function that creates an object from serialized data
   */
  static register(objectType: string, factory: ObjectFactory): void {
    this.registry.set(objectType, factory);
  }

  /**
   * Unregister an object type.
   */
  static unregister(objectType: string): boolean {
    return this.registry.delete(objectType);
  }

  /**
   * Check if an object type is registered.
   */
  static isRegistered(objectType: string): boolean {
    this.ensureInitialized();
    return this.registry.has(objectType);
  }

  /**
   * Get all registered object types.
   */
  static getRegisteredTypes(): string[] {
    this.ensureInitialized();
    return Array.from(this.registry.keys());
  }

  /**
   * Create an object from serialized data.
   * @throws Error if the object type is not registered
   */
  static create(data: EmbeddedObjectData): BaseEmbeddedObject {
    this.ensureInitialized();

    const factory = this.registry.get(data.objectType);
    if (!factory) {
      throw new Error(`Unknown object type: ${data.objectType}. Registered types: ${this.getRegisteredTypes().join(', ')}`);
    }

    return factory(data);
  }

  /**
   * Try to create an object, returning null if the type is unknown.
   */
  static tryCreate(data: EmbeddedObjectData): BaseEmbeddedObject | null {
    try {
      return this.create(data);
    } catch {
      return null;
    }
  }

  /**
   * Initialize with built-in object types.
   * Called automatically on first use.
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register image object
    this.register('image', (data) => new ImageObject({
      id: data.id,
      textIndex: data.textIndex,
      position: data.position,
      size: data.size,
      src: data.data.src as string,
      fit: data.data.fit as 'contain' | 'cover' | 'fill' | 'none' | undefined,
      alt: data.data.alt as string | undefined
    }));

    // Register text box object
    this.register('textbox', (data) => {
      const textBox = new TextBoxObject({
        id: data.id,
        textIndex: data.textIndex,
        position: data.position,
        size: data.size,
        content: data.data.content as string | undefined,
        fontFamily: data.data.fontFamily as string | undefined,
        fontSize: data.data.fontSize as number | undefined,
        color: data.data.color as string | undefined,
        backgroundColor: data.data.backgroundColor as string | undefined,
        borderColor: data.data.borderColor as string | undefined,
        border: data.data.border as any,
        padding: data.data.padding as number | undefined
      });

      // Restore formatting runs if present
      if (data.data.formattingRuns && Array.isArray(data.data.formattingRuns)) {
        const formattingManager = textBox.flowingContent.getFormattingManager();
        const formattingMap = new Map<number, any>();
        for (const [index, style] of data.data.formattingRuns as Array<[number, Record<string, unknown>]>) {
          formattingMap.set(index, style);
        }
        formattingManager.setAllFormatting(formattingMap);
      }

      // Restore substitution fields if present
      if (data.data.substitutionFields && Array.isArray(data.data.substitutionFields)) {
        const fieldManager = textBox.flowingContent.getSubstitutionFieldManager();
        for (const field of data.data.substitutionFields as any[]) {
          if (field.textIndex !== undefined && field.fieldName) {
            fieldManager.insert(field.fieldName, field.textIndex, {
              defaultValue: field.defaultValue,
              displayFormat: field.displayFormat
            });
          }
        }
      }

      return textBox;
    });

    // Register table object
    this.register('table', (data) => {
      return TableObject.fromData(data as TableObjectData);
    });

    this.initialized = true;
  }

  /**
   * Ensure the factory is initialized before use.
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  /**
   * Reset the factory to its initial state.
   * Useful for testing.
   */
  static reset(): void {
    this.registry.clear();
    this.initialized = false;
  }
}
