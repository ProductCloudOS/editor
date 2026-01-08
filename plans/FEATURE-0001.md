# FEATURE-0001: Remove Regular Elements

**Status: COMPLETE**

## Overview

Remove the "regular elements" system from the PC Editor project entirely. Regular elements are **positioned elements placed directly on the page at absolute x,y coordinates** within header, content, or footer sections. These are distinct from:

- **Inline/Embedded objects**: Objects (images, text boxes, tables) that flow within text content
- **Substitution fields**: Data placeholders within flowing text

The regular elements system is legacy code that is no longer needed since the editor now uses inline/embedded objects exclusively.

## What Are Regular Elements?

The regular elements system consists of:
1. `BaseElement` (abstract class) - Base for all positioned elements
2. `TextElement` - A text block at a fixed position
3. `ImageElement` - An image at a fixed position
4. `PlaceholderElement` - A data binding placeholder at a fixed position
5. `ElementFactory` - Creates regular elements from data
6. `Section` class - Stores elements in a Map with add/remove/get operations

## Files to DELETE

### Element Classes (entire directory)
- `src/lib/elements/BaseElement.ts`
- `src/lib/elements/TextElement.ts`
- `src/lib/elements/ImageElement.ts`
- `src/lib/elements/PlaceholderElement.ts`
- `src/lib/elements/ElementFactory.ts`
- `src/lib/elements/index.ts` (if exists)

## Files to MODIFY

### Core Files

| File | Changes Required |
|------|------------------|
| `src/lib/core/Section.ts` | Remove `_elements` Map and all element management methods (addElement, removeElement, getElement, getAllElements, etc.) |
| `src/lib/core/Page.ts` | Remove element-related methods and references |
| `src/lib/core/PCEditor.ts` | Remove addElement, removeElement, updateElement, selectElement APIs and related event handling |

### Rendering Files

| File | Changes Required |
|------|------------------|
| `src/lib/rendering/CanvasManager.ts` | Remove regular element click detection, drag handling, resize handling, selection rendering |

### Layout Files

| File | Changes Required |
|------|------------------|
| `src/lib/layout/LayoutEngine.ts` | Remove element flow/layout logic |
| `src/lib/layout/FlowManager.ts` | Remove element overflow handling |

### Data Files

| File | Changes Required |
|------|------------------|
| `src/lib/data/DataBinder.ts` | Remove element binding logic |

### Type Definitions

| File | Changes Required |
|------|------------------|
| `src/lib/types/index.ts` | Remove ElementType, ElementData, TextElementData, ImageElementData, PlaceholderElementData, ShapeElementData types |

### Export Files

| File | Changes Required |
|------|------------------|
| `src/lib/index.ts` | Remove BaseElement and related exports |

### Demo Files

| File | Changes Required |
|------|------------------|
| `src/demo/demo.ts` | Remove regular element buttons, event handlers, and UI for adding/managing regular elements |
| `src/demo/sample-data.ts` | Remove elements from sample document data |
| `src/demo/index.html` | Remove UI controls for regular elements (Add Text, Add Image, Add Placeholder buttons in the "Add Elements" section) |

## Implementation Steps

### Phase 1: Remove Demo UI (Low Risk)
1. Remove "Add Elements" section from `index.html` (Add Text, Add Image, Add Placeholder buttons)
2. Remove corresponding event handlers from `demo.ts`
3. Remove sample elements from `sample-data.ts`
4. Test that demo still works without these features

### Phase 2: Remove Public API (Medium Risk)
1. Remove from `PCEditor.ts`:
   - `addElement()` method
   - `removeElement()` method
   - `updateElement()` method
   - `selectElement()` method
   - Related event emissions
2. Update `src/lib/index.ts` exports

### Phase 3: Remove Rendering Support (Medium Risk)
1. In `CanvasManager.ts`:
   - Remove `renderPageElements()` or modify to only handle inline elements
   - Remove regular element click detection in `handleClick()`
   - Remove regular element drag handling in `handleMouseMove()`
   - Remove regular element resize handle detection and handling
   - Remove regular element selection rendering

### Phase 4: Remove Core Classes (High Risk)
1. Remove `Section.ts` element management:
   - Remove `_elements` Map
   - Remove `addElement()`, `removeElement()`, `getElement()`, `getAllElements()`
2. Remove `Page.ts` element methods
3. Remove layout engine element handling

### Phase 5: Delete Element Files
1. Delete entire `src/lib/elements/` directory
2. Remove related type definitions from `src/lib/types/index.ts`

### Phase 6: Cleanup
1. Remove any remaining imports of deleted files
2. Run TypeScript compiler to find any remaining references
3. Run build to ensure no errors
4. Test all functionality

## Risks and Considerations

1. **Breaking Changes**: This removes public API methods. Any external code using `addElement()` etc. will break.

2. **Inline Elements Dependency**: Ensure inline/embedded objects (TextBoxObject, TableObject, ImageObject) are NOT affected - they use a different system.

3. **Selection System**: The selection system is shared between regular elements and inline elements. Care must be taken to not break inline element selection.

4. **Event System**: Some events may be shared. Verify that removing element events doesn't break other functionality.

## Testing Strategy

1. **After each phase**: Run `npm run build` and `npm run type-check`
2. **Manual testing**:
   - Create and edit text in body, header, footer
   - Insert and interact with text boxes
   - Insert and interact with tables
   - Insert substitution fields
   - Create and manipulate loops
   - Test selection, resize, drag for inline elements
3. **Regression testing**: Ensure no existing functionality is broken

## Estimated Complexity

- **Lines of code to remove**: ~1500-2000
- **Files to delete**: 5-6
- **Files to modify**: 10-12
- **Risk level**: Medium (core functionality removal)
