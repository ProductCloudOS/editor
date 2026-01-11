# FEATURE-0018: Low-Level Unit Tests for 95% Code Coverage - Implementation Plan

## Status: PLANNED

## Overview

Implement comprehensive low-level unit tests targeting 95% code coverage across all internal components. Unlike FEATURE-0017 (API-level tests), this focuses on testing individual classes, methods, and edge cases at the implementation level. The goal is to catch bugs early, ensure refactoring safety, and document expected behavior of internal components.

## Goals

1. **95% Code Coverage**: Achieve 95% line and branch coverage across all source files
2. **Component Isolation**: Test each class/module in isolation with mocked dependencies
3. **Edge Case Coverage**: Test boundary conditions, error paths, and unusual inputs
4. **Regression Prevention**: Ensure tests catch regressions during refactoring
5. **Documentation**: Tests serve as living documentation of component behavior

## Coverage Strategy

### Coverage Metrics Target

| Metric | Target | Priority |
|--------|--------|----------|
| Line Coverage | 95% | High |
| Branch Coverage | 90% | High |
| Function Coverage | 95% | High |
| Statement Coverage | 95% | High |

### Vitest Coverage Configuration

```typescript
// vite.config.ts additions
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    exclude: [
      'node_modules/',
      'src/demo/',
      'src/test/',
      '**/*.d.ts',
      '**/types.ts',
      '**/index.ts'
    ],
    thresholds: {
      lines: 95,
      branches: 90,
      functions: 95,
      statements: 95
    }
  }
}
```

## Source Files to Test (57 files)

### Tier 1: Core Components (Critical - Test First)

| File | LOC Est. | Complexity | Priority |
|------|----------|------------|----------|
| `core/PCEditor.ts` | ~2700 | High | Critical |
| `core/Document.ts` | ~500 | Medium | Critical |
| `core/Page.ts` | ~300 | Low | Critical |
| `text/FlowingTextContent.ts` | ~1100 | High | Critical |
| `text/TextState.ts` | ~400 | Medium | Critical |
| `rendering/CanvasManager.ts` | ~1500 | High | Critical |

### Tier 2: Text System Components

| File | LOC Est. | Complexity | Priority |
|------|----------|------------|----------|
| `text/TextFormatting.ts` | ~300 | Medium | High |
| `text/ParagraphFormatting.ts` | ~250 | Medium | High |
| `text/SubstitutionFieldManager.ts` | ~350 | Medium | High |
| `text/EmbeddedObjectManager.ts` | ~300 | Medium | High |
| `text/RepeatingSectionManager.ts` | ~400 | Medium | High |
| `text/TextMeasurer.ts` | ~200 | Low | High |
| `text/TextLayout.ts` | ~300 | Medium | High |
| `text/TextPositionCalculator.ts` | ~250 | Medium | High |
| `text/EditableTextRegion.ts` | ~200 | Low | Medium |
| `text/RegionManager.ts` | ~150 | Low | Medium |
| `text/regions/BodyTextRegion.ts` | ~100 | Low | Medium |
| `text/regions/HeaderTextRegion.ts` | ~100 | Low | Medium |
| `text/regions/FooterTextRegion.ts` | ~100 | Low | Medium |

### Tier 3: Object System Components

| File | LOC Est. | Complexity | Priority |
|------|----------|------------|----------|
| `objects/BaseEmbeddedObject.ts` | ~300 | Medium | High |
| `objects/TextBoxObject.ts` | ~400 | Medium | High |
| `objects/ImageObject.ts` | ~350 | Medium | High |
| `objects/EmbeddedObjectFactory.ts` | ~200 | Low | High |
| `objects/table/TableObject.ts` | ~2100 | High | High |
| `objects/table/TableRow.ts` | ~300 | Medium | High |
| `objects/table/TableCell.ts` | ~700 | Medium | High |
| `objects/table/TableCellMerger.ts` | ~250 | Medium | Medium |
| `objects/table/TableResizeHandler.ts` | ~200 | Medium | Medium |

### Tier 4: Undo/Redo System

| File | LOC Est. | Complexity | Priority |
|------|----------|------------|----------|
| `undo/transaction/TransactionManager.ts` | ~550 | High | High |
| `undo/transaction/MutationUndo.ts` | ~450 | High | High |
| `undo/transaction/TextMutationObserver.ts` | ~450 | High | High |
| `undo/transaction/ObjectMutationObserver.ts` | ~800 | High | High |
| `undo/transaction/FocusTracker.ts` | ~150 | Low | Medium |
| `undo/transaction/ContentDiscovery.ts` | ~200 | Medium | Medium |

### Tier 5: Layout & Rendering

| File | LOC Est. | Complexity | Priority |
|------|----------|------------|----------|
| `layout/LayoutEngine.ts` | ~400 | High | High |
| `layout/FlowManager.ts` | ~300 | Medium | High |
| `rendering/FlowingTextRenderer.ts` | ~600 | High | High |
| `rendering/PDFGenerator.ts` | ~500 | Medium | Medium |
| `rendering/pdf-utils.ts` | ~100 | Low | Low |

### Tier 6: Infrastructure

| File | LOC Est. | Complexity | Priority |
|------|----------|------------|----------|
| `events/EventEmitter.ts` | ~100 | Low | High |
| `hit-test/HitTestManager.ts` | ~300 | Medium | Medium |
| `data/DataBinder.ts` | ~250 | Medium | Medium |
| `utils/blob-utils.ts` | ~50 | Low | Low |

## Test Directory Structure

```
src/test/
├── setup.ts                    # Global test setup (existing)
├── helpers/                    # Test utilities (existing)
│   ├── createEditor.ts
│   ├── documentFixtures.ts
│   └── index.ts
├── api/                        # API-level tests (FEATURE-0017)
│   └── *.test.ts
└── unit/                       # Low-level unit tests (FEATURE-0018)
    ├── core/
    │   ├── Document.test.ts
    │   ├── Page.test.ts
    │   └── PCEditor.test.ts
    ├── text/
    │   ├── FlowingTextContent.test.ts
    │   ├── TextState.test.ts
    │   ├── TextFormatting.test.ts
    │   ├── ParagraphFormatting.test.ts
    │   ├── SubstitutionFieldManager.test.ts
    │   ├── EmbeddedObjectManager.test.ts
    │   ├── RepeatingSectionManager.test.ts
    │   ├── TextMeasurer.test.ts
    │   ├── TextLayout.test.ts
    │   └── TextPositionCalculator.test.ts
    ├── objects/
    │   ├── BaseEmbeddedObject.test.ts
    │   ├── TextBoxObject.test.ts
    │   ├── ImageObject.test.ts
    │   ├── EmbeddedObjectFactory.test.ts
    │   └── table/
    │       ├── TableObject.test.ts
    │       ├── TableRow.test.ts
    │       ├── TableCell.test.ts
    │       └── TableCellMerger.test.ts
    ├── undo/
    │   ├── TransactionManager.test.ts
    │   ├── MutationUndo.test.ts
    │   ├── TextMutationObserver.test.ts
    │   └── ObjectMutationObserver.test.ts
    ├── layout/
    │   ├── LayoutEngine.test.ts
    │   └── FlowManager.test.ts
    ├── rendering/
    │   ├── CanvasManager.test.ts
    │   ├── FlowingTextRenderer.test.ts
    │   └── PDFGenerator.test.ts
    ├── events/
    │   └── EventEmitter.test.ts
    ├── hit-test/
    │   └── HitTestManager.test.ts
    └── data/
        └── DataBinder.test.ts
```

## Testing Patterns

### 1. Component Isolation with Mocks

```typescript
// Example: Testing TextFormatting in isolation
describe('TextFormatting', () => {
  let formatting: TextFormatting;

  beforeEach(() => {
    formatting = new TextFormatting();
  });

  describe('applyFormatting', () => {
    it('should apply bold formatting to range', () => {
      formatting.applyFormatting(0, 5, { fontWeight: 'bold' });
      expect(formatting.getFormattingAt(2)?.fontWeight).toBe('bold');
    });

    it('should merge overlapping formatting', () => {
      formatting.applyFormatting(0, 5, { fontWeight: 'bold' });
      formatting.applyFormatting(3, 8, { fontStyle: 'italic' });

      const at4 = formatting.getFormattingAt(4);
      expect(at4?.fontWeight).toBe('bold');
      expect(at4?.fontStyle).toBe('italic');
    });
  });
});
```

### 2. Edge Case Testing

```typescript
describe('TextState', () => {
  describe('insertText', () => {
    it('should handle empty string insertion', () => {
      const state = new TextState();
      state.setText('Hello');
      state.insertText('', 2);
      expect(state.getText()).toBe('Hello');
    });

    it('should handle insertion at position 0', () => {
      const state = new TextState();
      state.setText('World');
      state.insertText('Hello ', 0);
      expect(state.getText()).toBe('Hello World');
    });

    it('should handle insertion at end', () => {
      const state = new TextState();
      state.setText('Hello');
      state.insertText(' World', 5);
      expect(state.getText()).toBe('Hello World');
    });

    it('should handle insertion beyond text length', () => {
      const state = new TextState();
      state.setText('Hi');
      state.insertText('!', 100); // Should clamp to end
      expect(state.getText()).toBe('Hi!');
    });

    it('should handle negative position', () => {
      const state = new TextState();
      state.setText('Hello');
      expect(() => state.insertText('X', -1)).toThrow();
    });
  });
});
```

### 3. State Transition Testing

```typescript
describe('EmbeddedObjectManager', () => {
  describe('object lifecycle', () => {
    it('should track object through insert -> shift -> remove', () => {
      const manager = new EmbeddedObjectManager();
      const obj = new TextBoxObject({ id: 'tb1', size: { width: 100, height: 50 } });

      // Insert at position 5
      manager.insert(obj, 5);
      expect(manager.getObjectAt(5)).toBe(obj);

      // Shift due to text insertion at position 2
      manager.shiftObjects(2, 3);
      expect(manager.getObjectAt(5)).toBeUndefined();
      expect(manager.getObjectAt(8)).toBe(obj);

      // Remove
      manager.remove(8);
      expect(manager.getObjectAt(8)).toBeUndefined();
      expect(manager.getAll().length).toBe(0);
    });
  });
});
```

### 4. Event Emission Testing

```typescript
describe('EventEmitter', () => {
  it('should emit events to all listeners', () => {
    const emitter = new EventEmitter();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on('test', listener1);
    emitter.on('test', listener2);
    emitter.emit('test', { data: 'value' });

    expect(listener1).toHaveBeenCalledWith({ data: 'value' });
    expect(listener2).toHaveBeenCalledWith({ data: 'value' });
  });

  it('should remove listener with off()', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();

    emitter.on('test', listener);
    emitter.off('test', listener);
    emitter.emit('test', {});

    expect(listener).not.toHaveBeenCalled();
  });

  it('should handle once() listeners', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();

    emitter.once('test', listener);
    emitter.emit('test', { call: 1 });
    emitter.emit('test', { call: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ call: 1 });
  });
});
```

### 5. Serialization Round-Trip Testing

```typescript
describe('TableObject', () => {
  describe('serialization', () => {
    it('should preserve all data through toData/fromData', () => {
      const table = new TableObject({
        id: 'table1',
        rows: 3,
        columns: 4,
        size: { width: 400, height: 150 }
      });

      // Modify table
      table.setCell(0, 0, 'Header 1');
      table.mergeCells(0, 0, 0, 1);

      // Serialize and restore
      const data = table.toData();
      const restored = TableObject.fromData(data);

      // Verify
      expect(restored.rowCount).toBe(3);
      expect(restored.columnCount).toBe(4);
      expect(restored.getCell(0, 0).content).toBe('Header 1');
      expect(restored.getCell(0, 0).colspan).toBe(2);
    });
  });
});
```

## Implementation Phases

### Phase 1: Infrastructure & Core (Week 1-2)
- [ ] Set up coverage reporting with thresholds
- [ ] Create test helper utilities for unit tests
- [ ] Test `EventEmitter` (simple, validates test setup)
- [ ] Test `Document` and `Page`
- [ ] Test `TextState`

### Phase 2: Text System (Week 3-4)
- [ ] Test `TextFormatting`
- [ ] Test `ParagraphFormatting`
- [ ] Test `SubstitutionFieldManager`
- [ ] Test `EmbeddedObjectManager`
- [ ] Test `RepeatingSectionManager`
- [ ] Test `TextMeasurer`
- [ ] Test `TextLayout`
- [ ] Test `FlowingTextContent`

### Phase 3: Object System (Week 5-6)
- [ ] Test `BaseEmbeddedObject`
- [ ] Test `TextBoxObject`
- [ ] Test `ImageObject`
- [ ] Test `EmbeddedObjectFactory`
- [ ] Test `TableObject`
- [ ] Test `TableRow`
- [ ] Test `TableCell`
- [ ] Test `TableCellMerger`

### Phase 4: Undo/Redo System (Week 7)
- [ ] Test `TransactionManager`
- [ ] Test `MutationUndo`
- [ ] Test `TextMutationObserver`
- [ ] Test `ObjectMutationObserver`

### Phase 5: Layout & Rendering (Week 8)
- [ ] Test `LayoutEngine`
- [ ] Test `FlowManager`
- [ ] Test `CanvasManager` (with canvas mocks)
- [ ] Test `FlowingTextRenderer`
- [ ] Test `HitTestManager`

### Phase 6: Integration & Coverage Gaps (Week 9-10)
- [ ] Test `PCEditor` internal methods
- [ ] Test `DataBinder`
- [ ] Test `PDFGenerator`
- [ ] Identify and fill coverage gaps
- [ ] Reach 95% coverage target

## Test Helper Utilities to Create

### Mock Factories

```typescript
// src/test/helpers/mocks.ts

export function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  return canvas;
}

export function createMockContext(): CanvasRenderingContext2D {
  return {
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    // ... other methods
  } as unknown as CanvasRenderingContext2D;
}

export function createMockFlowingTextContent(): FlowingTextContent {
  const content = new FlowingTextContent();
  // Pre-configure if needed
  return content;
}

export function createMockDocument(): Document {
  return new Document({
    pageSize: 'A4',
    pageOrientation: 'portrait'
  });
}
```

### Assertion Helpers

```typescript
// src/test/helpers/assertions.ts

export function expectFormattingEqual(
  actual: TextFormattingStyle | undefined,
  expected: Partial<TextFormattingStyle>
): void {
  expect(actual).toBeDefined();
  for (const [key, value] of Object.entries(expected)) {
    expect(actual![key as keyof TextFormattingStyle]).toBe(value);
  }
}

export function expectRangeEqual(
  actual: { start: number; end: number },
  expected: { start: number; end: number }
): void {
  expect(actual.start).toBe(expected.start);
  expect(actual.end).toBe(expected.end);
}
```

## Running Tests

### Commands

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Run specific file
npx vitest run src/test/unit/text/TextState.test.ts

# Run with watch mode
npx vitest watch src/test/unit/

# Generate coverage report
npx vitest run --coverage
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:unit": "vitest run src/test/unit/",
    "test:api": "vitest run src/test/api/",
    "test:coverage": "vitest run --coverage",
    "test:coverage:html": "vitest run --coverage && open coverage/index.html"
  }
}
```

## Success Criteria

1. **Coverage Targets Met**
   - Line coverage >= 95%
   - Branch coverage >= 90%
   - Function coverage >= 95%

2. **Test Quality**
   - All public methods have at least one test
   - Edge cases documented and tested
   - Error paths tested

3. **Maintainability**
   - Tests are isolated and don't depend on each other
   - Mocks are reusable and well-documented
   - Test names clearly describe expected behavior

4. **CI Integration**
   - Tests run on every commit
   - Coverage report generated automatically
   - Build fails if coverage drops below threshold

## Dependencies

- Vitest (already installed)
- @vitest/coverage-v8 (already installed)
- jsdom (already installed)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Canvas-dependent code hard to test | High | Create comprehensive canvas mocks |
| Tightly coupled components | Medium | Refactor to inject dependencies |
| Time-consuming to write all tests | High | Prioritize by complexity/risk |
| Tests become maintenance burden | Medium | Focus on behavior, not implementation |

## Notes

- Start with simpler, isolated components (EventEmitter, TextState) to build momentum
- Use TDD for bug fixes: write failing test first, then fix
- Consider property-based testing for text operations
- Document any untestable code and reasons why
