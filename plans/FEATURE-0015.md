# FEATURE-0015: Optional Editor Controls (Rulers)

## Status: COMPLETE

## Overview

Implement optional editor control components that work with the PCEditor via the public API only. The first implementation will be X (horizontal) and Y (vertical) rulers that connect to the editor canvas and provide visual measurement references.

**Key design principle**: Separation of concerns - these controls are optional components that remain completely decoupled from the core library. They communicate exclusively through:
1. Public PCEditor API methods
2. Event subscriptions
3. Observable document/settings state

## Design Goals

1. **API-Only Integration**: Controls must only use public PCEditor methods and events
2. **Optional Components**: Editor must function without these controls
3. **Pluggable Architecture**: Easy to add new control types in the future
4. **Framework Agnostic**: Pure TypeScript/DOM, no framework dependencies
5. **Self-Contained**: Each control manages its own rendering and lifecycle

## Architecture

```
PCEditor (Core Library)
    |
    +-- Public API (methods, getters)
    |
    +-- Events (document-change, settings-changed, selection-change, etc.)
    |
    v
EditorControls (Optional Components)
    |
    +-- BaseControl (abstract base)
    |   |
    |   +-- RulerControl (base ruler class)
    |       |
    |       +-- HorizontalRuler
    |       +-- VerticalRuler
    |
    +-- (Future: StatusBar, Minimap, etc.)
```

## New Directory Structure

```
src/lib/
└── controls/
    ├── index.ts
    ├── types.ts
    ├── BaseControl.ts
    └── rulers/
        ├── index.ts
        ├── types.ts
        ├── RulerControl.ts
        ├── HorizontalRuler.ts
        └── VerticalRuler.ts
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create `src/lib/controls/` directory structure
2. Implement `types.ts` with control interfaces
3. Implement `BaseControl.ts` abstract class
4. Add module exports

### Phase 2: Ruler Base Class
5. Create `rulers/types.ts` with ruler-specific types
6. Implement `RulerControl.ts` base class
7. Add tick mark calculation and rendering logic

### Phase 3: Ruler Implementations
8. Implement `HorizontalRuler.ts`
9. Implement `VerticalRuler.ts`
10. Add mouse tracking for cursor indicators

### Phase 4: PCEditor API Extensions
11. Add `getZoomLevel()` method
12. Add `getContainer()` method
13. Ensure `getDocumentMetrics()` returns needed data
14. Add `zoom-changed` event emission

### Phase 5: Demo Integration
15. Update `index.html` with ruler containers
16. Update `demo.ts` with ruler initialization
17. Add `styles.css` for ruler layout

### Phase 6: Testing
18. Unit tests for `BaseControl`
19. Unit tests for `RulerControl`
20. Unit tests for `HorizontalRuler` and `VerticalRuler`

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/controls/index.ts` | Module exports |
| `src/lib/controls/types.ts` | Control type definitions |
| `src/lib/controls/BaseControl.ts` | Abstract base class |
| `src/lib/controls/rulers/index.ts` | Ruler exports |
| `src/lib/controls/rulers/types.ts` | Ruler type definitions |
| `src/lib/controls/rulers/RulerControl.ts` | Base ruler class |
| `src/lib/controls/rulers/HorizontalRuler.ts` | Horizontal ruler |
| `src/lib/controls/rulers/VerticalRuler.ts` | Vertical ruler |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/core/PCEditor.ts` | Add `getZoomLevel()`, `getContainer()`, enhance `getDocumentMetrics()` |
| `src/lib/index.ts` | Export control classes and types |
| `src/demo/index.html` | Add ruler containers and toggle button |
| `src/demo/demo.ts` | Add ruler initialization and toggle logic |
| `src/demo/styles.css` | Add ruler layout styles |

## Key Types

```typescript
interface EditorControl {
  readonly id: string;
  readonly isAttached: boolean;
  attach(options: ControlAttachOptions): void;
  detach(): void;
  update(): void;
  show(): void;
  hide(): void;
  destroy(): void;
}

interface RulerOptions {
  units?: Units;
  majorTickInterval?: number;
  minorTicksPerMajor?: number;
  showLabels?: boolean;
  thickness?: number;
  backgroundColor?: string;
  tickColor?: string;
  labelColor?: string;
  activeColor?: string;
}
```

## Testing Checklist

- [ ] BaseControl attaches/detaches correctly
- [ ] BaseControl emits events on attach/detach
- [ ] RulerControl calculates tick marks correctly
- [ ] HorizontalRuler renders above canvas
- [ ] VerticalRuler renders to left of canvas
- [ ] Rulers update when document settings change
- [ ] Cursor indicator follows mouse position
- [ ] Rulers respect unit settings (mm, in, px, pt)
- [ ] Rulers can be toggled on/off

## Future Extensions

This architecture enables future optional controls:
- **StatusBar** - Shows cursor position, word count, page info
- **Minimap** - Document overview with scroll navigation
- **FindReplaceBar** - Search and replace functionality
- **ToolbarControl** - Customizable floating toolbar
