# PC Editor - Document Layout Engine

## Overview

PC Editor is a TypeScript-based WYSIWYG document editor built on HTML5 Canvas. It provides a comprehensive document layout system with text flow, element positioning, and multi-page support similar to traditional word processors.

## Key Features

### Document Structure
- **Multi-page documents** with automatic page creation/removal
- **Hierarchical layout**: Document → Pages → Sections (Header/Content/Footer) → Elements
- **Configurable page sizes**: A4, Letter, Legal, A3 with portrait/landscape orientation
- **Margin system** with form-based controls (no drag-based margins)

### Text System
- **Flowing text content** that automatically wraps and flows across pages
- **Character-by-character rendering** for precise positioning
- **Inline elements** within text flow (text boxes, images) using Unicode replacement character (U+FFFC)
- **Text cursor** with proper positioning and blinking animation
- **Keyboard support** for text editing with Enter key for line breaks

### Element System
- **Base element types**: Text, Image, Placeholder
- **Selection system** with visual feedback (blue dashed borders, resize handles)
- **Drag and drop** positioning for regular elements
- **Resize functionality** with 8-point resize handles
- **Z-index layering** support

### Rendering Engine
- **Canvas-based rendering** with pixel-perfect output
- **Event-driven architecture** using EventEmitter pattern
- **Automatic text reflow** when content or layout changes
- **Zoom controls** (zoom in/out, fit to page, fit to width)
- **Grid overlay** for design assistance

### Data Management
- **JSON-based document format** for serialization
- **Data binding system** for placeholder replacement
- **Element factory pattern** for consistent object creation
- **State preservation** during canvas rebuilds and text reflow

## Architecture

### Core Components

#### PCEditor (`src/lib/core/PCEditor.ts`)
Main editor class providing the public API:
- Document loading/saving
- Element management 
- Text flow operations
- Export functionality

#### CanvasManager (`src/lib/rendering/CanvasManager.ts`)
Handles canvas rendering and user interactions:
- Multi-canvas management (one per page)
- Mouse/keyboard event handling
- Element selection and manipulation
- Zoom and view controls

#### FlowingTextContent (`src/lib/core/FlowingTextContent.ts`)
Manages text flow and inline elements:
- Text wrapping and line breaking
- Inline element positioning within text
- Character-level text management
- Content change notifications

#### FlowingTextRenderer (`src/lib/rendering/FlowingTextRenderer.ts`)
Renders flowing text and handles text interactions:
- Line-by-line text rendering
- Inline element rendering within text
- Text cursor positioning and blinking
- Click detection for text and inline elements

### Element System

#### BaseElement (`src/lib/elements/BaseElement.ts`)
Abstract base class for all elements providing:
- Position and size management
- Selection state tracking
- Event emission for changes
- Bounds calculation and hit testing

#### Concrete Elements
- **TextElement**: Multi-line text with wrapping and formatting
- **ImageElement**: Image display with placeholder support
- **PlaceholderElement**: Data binding placeholders

### Event System
The editor uses an event-driven architecture with EventEmitter:
- `content-changed`: Text or element modifications
- `selection-change`: Element selection state changes
- `text-clicked`: Text cursor positioning
- `inline-element-clicked`: Inline element interactions
- `text-overflow`: Automatic page creation triggers

## Usage Patterns

### Basic Setup
```typescript
const editor = new PCEditor(container, {
  pageSize: 'A4',
  pageOrientation: 'portrait',
  units: 'mm',
  showGrid: true
});

await editor.initialize();
```

### Document Management
```typescript
// Set flowing text content
editor.setFlowingText('Your text content here...');

// Add regular elements
editor.addElement({
  id: 'text1',
  type: 'text',
  position: { x: 100, y: 100 },
  size: { width: 200, height: 50 },
  data: { content: 'Sample text' }
});

// Insert inline elements
editor.insertInlineElement({
  id: 'inline1',
  type: 'text',
  size: { width: 120, height: 24 },
  data: { content: 'Inline text' }
}, 'inline');
```

### Document Settings
```typescript
editor.updateDocumentSettings({
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  pageSize: 'Letter',
  pageOrientation: 'landscape'
});
```

## Recent Major Changes

### Margin System Overhaul
- **Removed**: Drag-based margin controls due to interaction conflicts
- **Added**: Form-based margin controls in demo interface
- **Fixed**: Page management issues during margin changes

### Inline Element Implementation
- **Added**: Full inline element support within flowing text
- **Fixed**: Element positioning and text reflow integration
- **Implemented**: Selection and interaction for inline elements
- **Resolved**: Canvas transformation issues affecting resize handles

### Selection System Fixes
- **Fixed**: Click handling priority (regular elements → inline elements → text)
- **Resolved**: Multiple reflow cycles clearing selection state
- **Improved**: Resize handle detection for both regular and inline elements

## Build and Development

### Commands
- `npm run build`: Build the library
- `npm run dev`: Start development server with demo
- `npm run test`: Run tests (when implemented)

### Project Structure
```
src/
├── lib/                 # Core library code
│   ├── core/           # Document and content management
│   ├── elements/       # Element implementations
│   ├── rendering/      # Canvas rendering system
│   ├── events/         # Event system
│   └── types/          # TypeScript definitions
├── demo/               # Demo application
└── test/              # Test files (future)
```

### Demo Features
The demo (`src/demo/`) includes:
- Document settings panel with margin controls
- Element addition buttons (Text, Image, Placeholder)
- Inline element insertion controls
- Zoom and view controls
- Sample data for testing data binding
- Properties panel for selected elements

## Known Limitations

1. **PDF Export**: Not yet implemented
2. **Data Binding**: Partially implemented
3. **Complex Formatting**: Limited text formatting options
4. **Performance**: Large documents may impact performance
5. **Accessibility**: Canvas-based rendering limits screen reader support

## Dependencies

### Core
- TypeScript for type safety
- HTML5 Canvas for rendering
- EventEmitter pattern for internal communication

### Build Tools
- Vite for bundling and development server
- TypeScript compiler for type checking

### Planned Additions
- pdf-lib for PDF generation
- Additional element types
- Enhanced text formatting
- Collaborative editing support

## Testing Strategy

The project is designed with testability in mind:
- **Unit tests**: For individual components and utilities
- **Integration tests**: For editor workflows and interactions
- **Visual regression tests**: For rendering consistency
- **Performance tests**: For large document handling

## Contributing

When making changes:
1. Follow existing TypeScript patterns and naming conventions
2. Maintain event-driven architecture
3. Ensure canvas rendering efficiency
4. Test with both regular and inline elements
5. Verify multi-page document behavior
6. Update this CLAUDE.md file with significant changes
7. **For features that impact document content**: Also update PDF export (`PDFGenerator.ts`) and serialization/deserialization (`FlowingTextContent.toData()/fromData()`, `Document.toData()`) to ensure round-trip fidelity