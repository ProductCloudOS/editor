# Optional Modules

PC Editor provides optional controls and panes that extend the core editor functionality. These modules are separate from the main `PCEditor` class and can be used independently, allowing you to build custom UI layouts.

All optional modules:
- Interact with the editor via the public API only
- Are framework-agnostic (vanilla DOM)
- Support CSS customization via variables
- Can be shown/hidden independently
- Clean up their resources on detach/destroy

## Table of Contents

- [Controls](#controls)
  - [HorizontalRuler](#horizontalruler)
  - [VerticalRuler](#verticalruler)
- [Panes](#panes)
  - [FormattingPane](#formattingpane)
  - [DocumentSettingsPane](#documentsettingspane)
  - [DocumentInfoPane](#documentinfopane)
  - [ViewSettingsPane](#viewsettingspane)
  - [MergeDataPane](#mergedatapane)
  - [HyperlinkPane](#hyperlinkpane)
  - [SubstitutionFieldPane](#substitutionfieldpane)
  - [RepeatingSectionPane](#repeatingsectionpane)
  - [TableRowLoopPane](#tablerowlooppane)
  - [TextBoxPane](#textboxpane)
  - [ImagePane](#imagepane)
  - [TablePane](#tablepane)
- [CSS Variables](#css-variables)
  - [Pane Variables](#pane-css-variables)
  - [Ruler Variables](#ruler-options)

---

## Controls

Controls are standalone UI components that enhance the editing experience.

### HorizontalRuler

Displays a horizontal ruler above the editor with measurement ticks, margin indicators, and cursor position tracking.

```typescript
import { PCEditor, HorizontalRuler } from '@productcloudos/editor';

const editor = new PCEditor(container, options);

const ruler = new HorizontalRuler({
  units: 'mm',              // 'mm' | 'in' | 'px' | 'pt'
  majorTickInterval: 10,    // Major tick every 10 units
  minorTicksPerMajor: 10,   // 10 minor ticks between majors
  showLabels: true,         // Show numbers on major ticks
  thickness: 20,            // Height in pixels
  showMargins: true,        // Show margin indicators
  backgroundColor: '#f5f5f5',
  tickColor: '#666666',
  labelColor: '#333333',
  activeColor: '#2196f3',   // Cursor indicator color
  marginColor: '#666666',   // Areas outside page
  labelFontSize: 9
});

// Attach to a container element
ruler.attach({
  editor,
  container: document.getElementById('horizontal-ruler-container')
});

// Show/hide
ruler.show();
ruler.hide();

// Check visibility
if (ruler.isVisible) { /* ... */ }

// Clean up
ruler.destroy();
```

### VerticalRuler

Displays a vertical ruler beside the editor.

```typescript
import { PCEditor, VerticalRuler } from '@productcloudos/editor';

const ruler = new VerticalRuler({
  units: 'mm',
  majorTickInterval: 10,
  minorTicksPerMajor: 10,
  showLabels: true,
  thickness: 20,
  showMargins: true,
  backgroundColor: '#f5f5f5',
  tickColor: '#666666',
  labelColor: '#333333',
  activeColor: '#2196f3',
  marginColor: '#666666',
  labelFontSize: 9
});

ruler.attach({
  editor,
  container: document.getElementById('vertical-ruler-container')
});
```

#### Ruler Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `units` | `'mm' \| 'in' \| 'px' \| 'pt'` | `'mm'` | Measurement units |
| `majorTickInterval` | `number` | `10` | Units between major ticks |
| `minorTicksPerMajor` | `number` | `10` | Minor ticks between majors |
| `showLabels` | `boolean` | `true` | Show labels on major ticks |
| `thickness` | `number` | `20` | Ruler thickness in pixels |
| `showMargins` | `boolean` | `true` | Show margin indicators |
| `backgroundColor` | `string` | `'#f5f5f5'` | Background color |
| `tickColor` | `string` | `'#666666'` | Tick mark color |
| `labelColor` | `string` | `'#333333'` | Label text color |
| `activeColor` | `string` | `'#2196f3'` | Cursor position indicator |
| `marginColor` | `string` | `'#666666'` | Color for areas outside page |
| `labelFontSize` | `number` | `9` | Font size for labels |
| `visible` | `boolean` | `true` | Initial visibility |

---

## Panes

Panes are property editors for various document elements. They automatically update when the editor state changes and apply changes through the public API.

### Common Pattern

All panes follow a common pattern:

```typescript
import { PCEditor, SomePane } from '@productcloudos/editor';
import '@productcloudos/editor/dist/panes.css'; // Optional - for default styling

const editor = new PCEditor(container, options);

const pane = new SomePane('unique-id', {
  // Pane-specific options
});

// Attach to editor and container
pane.attach({
  editor,
  container: document.getElementById('pane-container'),
  // Optional: control a parent section's visibility
  sectionElement: document.getElementById('collapsible-section')
});

// Show/hide the pane
pane.show();
pane.hide();

// Force update from editor state
pane.update();

// Check visibility
if (pane.isVisible) { /* ... */ }

// Clean up
pane.destroy();
```

### FormattingPane

Text formatting controls including bold, italic, alignment, lists, fonts, and colors.

```typescript
import { FormattingPane } from '@productcloudos/editor';

const formattingPane = new FormattingPane('formatting', {
  fontFamilies: ['Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New'],
  fontSizes: [10, 12, 14, 16, 18, 20, 24, 28, 32, 36]
});

formattingPane.attach({ editor, container: formattingContainer });
```

**Features:**
- Bold/Italic toggle buttons
- Alignment buttons (left, center, right, justify)
- List buttons (bullet, numbered, indent, outdent)
- Font family dropdown
- Font size dropdown
- Text color picker
- Highlight color picker with clear button

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fontFamilies` | `string[]` | Common fonts | Available font families |
| `fontSizes` | `number[]` | `[10-36]` | Available font sizes |

### DocumentSettingsPane

Edit document margins, page size, and orientation.

```typescript
import { DocumentSettingsPane } from '@productcloudos/editor';

const settingsPane = new DocumentSettingsPane('doc-settings');
settingsPane.attach({ editor, container: settingsContainer });
```

**Features:**
- Margin inputs (top, right, bottom, left) in mm
- Page size dropdown (A4, Letter, Legal, A3)
- Orientation dropdown (Portrait, Landscape)
- Apply Margins button

### DocumentInfoPane

Read-only display of document information.

```typescript
import { DocumentInfoPane } from '@productcloudos/editor';

const infoPane = new DocumentInfoPane('doc-info');
infoPane.attach({ editor, container: infoContainer });
```

**Displays:**
- Page count
- Page size
- Page orientation

### ViewSettingsPane

Toggle buttons for view options.

```typescript
import { ViewSettingsPane } from '@productcloudos/editor';

const viewPane = new ViewSettingsPane('view-settings', {
  onToggleRulers: () => {
    // Custom ruler toggle logic
    horizontalRuler.toggle();
    verticalRuler.toggle();
  },
  rulersVisible: true
});

viewPane.attach({ editor, container: viewContainer });

// Update ruler button state externally
viewPane.setRulersVisible(false);
```

**Features:**
- Rulers toggle (optional, requires callback)
- Control characters toggle
- Margin lines toggle
- Grid toggle

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onToggleRulers` | `() => void` | - | Callback for rulers toggle |
| `rulersVisible` | `boolean` | `true` | Initial rulers state |

### MergeDataPane

JSON data input for mail merge/substitution.

```typescript
import { MergeDataPane } from '@productcloudos/editor';

const mergePane = new MergeDataPane('merge-data', {
  initialData: {
    customerName: 'John Doe',
    items: [
      { name: 'Widget', price: 9.99 }
    ]
  },
  placeholder: '{"key": "value"}',
  rows: 10,
  onApply: (success, error) => {
    if (success) {
      console.log('Merge data applied');
    } else {
      console.error('Error:', error?.message);
    }
  }
});

mergePane.attach({ editor, container: mergeContainer });

// Get current data
const data = mergePane.getData();

// Set data programmatically
mergePane.setData({ customerName: 'Jane Doe' });
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialData` | `Record<string, unknown>` | - | Initial JSON data |
| `placeholder` | `string` | Example JSON | Textarea placeholder |
| `rows` | `number` | `10` | Textarea rows |
| `onApply` | `(success, error?) => void` | - | Apply callback |

### HyperlinkPane

Edit hyperlink URL and title. Automatically shows when cursor is in a hyperlink.

```typescript
import { HyperlinkPane } from '@productcloudos/editor';

const hyperlinkPane = new HyperlinkPane('hyperlink', {
  onApply: (success, error) => {
    if (success) updateStatus('Hyperlink updated');
  },
  onRemove: (success) => {
    if (success) updateStatus('Hyperlink removed');
  }
});

hyperlinkPane.attach({ editor, container: hyperlinkContainer });

// Check if a hyperlink is selected
if (hyperlinkPane.hasHyperlink()) {
  const link = hyperlinkPane.getCurrentHyperlink();
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onApply` | `(success, error?) => void` | - | Apply callback |
| `onRemove` | `(success) => void` | - | Remove callback |

### SubstitutionFieldPane

Edit substitution field properties including name, default value, and format configuration.

```typescript
import { SubstitutionFieldPane } from '@productcloudos/editor';

const fieldPane = new SubstitutionFieldPane('field', {
  onApply: (success, error) => {
    if (success) updateStatus('Field updated');
  }
});

fieldPane.attach({ editor, container: fieldContainer });

// Manually show for a specific field
fieldPane.showField(field);

// Hide
fieldPane.hideField();
```

**Features:**
- Field name input
- Default value input
- Value type dropdown (None, Number, Currency, Date)
- Format-specific options (number format, currency, date format)

### RepeatingSectionPane

Edit repeating section (loop) properties.

```typescript
import { RepeatingSectionPane } from '@productcloudos/editor';

const loopPane = new RepeatingSectionPane('loop', {
  onApply: (success, error) => {
    if (success) updateStatus('Loop updated');
  },
  onRemove: (success) => {
    if (success) updateStatus('Loop removed');
  }
});

loopPane.attach({ editor, container: loopContainer });

// Manually show for a section
loopPane.showSection(section);

// Hide
loopPane.hideSection();
```

**Features:**
- Array field path input
- Apply Changes button
- Remove Loop button
- Position hint

### TableRowLoopPane

Edit table row loop properties for repeating table rows.

```typescript
import { TableRowLoopPane } from '@productcloudos/editor';

const rowLoopPane = new TableRowLoopPane('row-loop', {
  onApply: (success, error) => {
    if (success) updateStatus('Row loop updated');
  },
  onRemove: (success) => {
    if (success) updateStatus('Row loop removed');
  }
});

rowLoopPane.attach({ editor, container: rowLoopContainer });

// Manually show for a table's row loop
rowLoopPane.showLoop(table, loop);

// Hide
rowLoopPane.hideLoop();
```

### TextBoxPane

Edit text box properties.

```typescript
import { TextBoxPane } from '@productcloudos/editor';

const textBoxPane = new TextBoxPane('textbox', {
  onApply: (success, error) => {
    if (success) updateStatus('Text box updated');
  }
});

textBoxPane.attach({ editor, container: textBoxContainer });

// Check if a text box is selected
if (textBoxPane.hasTextBox()) {
  const textBox = textBoxPane.getCurrentTextBox();
}
```

**Features:**
- Position type (inline, block, relative)
- Relative offset (X, Y) for relative positioning
- Background color picker
- Border controls (width, color, style)
- Padding input

### ImagePane

Edit image properties.

```typescript
import { ImagePane } from '@productcloudos/editor';

const imagePane = new ImagePane('image', {
  maxImageWidth: 400,
  maxImageHeight: 400,
  onApply: (success, error) => {
    if (success) updateStatus('Image updated');
  }
});

imagePane.attach({ editor, container: imageContainer });

// Check if an image is selected
if (imagePane.hasImage()) {
  const image = imagePane.getCurrentImage();
}
```

**Features:**
- Position type (inline, block, relative)
- Relative offset (X, Y) for relative positioning
- Fit mode (contain, cover, fill, none, tile)
- Resize mode (lock aspect ratio, free)
- Alt text input
- Change image button (file picker)

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxImageWidth` | `number` | `400` | Max width for auto-sizing |
| `maxImageHeight` | `number` | `400` | Max height for auto-sizing |
| `onApply` | `(success, error?) => void` | - | Apply callback |

### TablePane

Edit table properties including structure, headers, and cell formatting.

```typescript
import { TablePane } from '@productcloudos/editor';

const tablePane = new TablePane('table', {
  onApply: (success, error) => {
    if (success) updateStatus('Table updated');
  }
});

tablePane.attach({ editor, container: tableContainer });

// Check if a table is focused
if (tablePane.hasTable()) {
  const table = tablePane.getCurrentTable();
}
```

**Features:**
- Structure info (row/column count)
- Add/remove row and column buttons
- Header rows and columns inputs
- Default padding and border color
- Cell formatting section:
  - Background color
  - Border side checkboxes (top, right, bottom, left)
  - Border width, color, and style
  - Apply to selected cells

---

## CSS Variables

### Pane CSS Variables

Import the default pane styles and customize via CSS variables:

```css
/* Import default styles */
@import '@productcloudos/editor/dist/panes.css';

/* Customize via CSS variables */
:root {
  --pc-pane-spacing: 0.5rem;
  --pc-pane-spacing-sm: 0.25rem;
  --pc-pane-font-size: 13px;
  --pc-pane-text-color: #222;
  --pc-pane-label-color: #666;
  --pc-pane-background: white;
  --pc-pane-input-height: 28px;
  --pc-pane-button-height: 28px;
  --pc-pane-button-icon-width: 28px;
  --pc-pane-border-radius: 4px;
  --pc-pane-border-color: #ccc;
  --pc-pane-focus-color: #0066cc;

  /* Alignment icons (SVG data URIs - can be customized) */
  --pc-pane-icon-align-left: url("data:image/svg+xml,...");
  --pc-pane-icon-align-center: url("data:image/svg+xml,...");
  --pc-pane-icon-align-right: url("data:image/svg+xml,...");
  --pc-pane-icon-align-justify: url("data:image/svg+xml,...");
}
```

#### All Pane CSS Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--pc-pane-spacing` | `0.5rem` | Standard spacing between elements |
| `--pc-pane-spacing-sm` | `0.25rem` | Small spacing |
| `--pc-pane-font-size` | `13px` | Base font size |
| `--pc-pane-text-color` | `#222` | Text color for inputs and content |
| `--pc-pane-label-color` | `#666` | Label and hint text color |
| `--pc-pane-background` | `white` | Background color for inputs/buttons |
| `--pc-pane-input-height` | `28px` | Height of text inputs and selects |
| `--pc-pane-button-height` | `28px` | Height of buttons |
| `--pc-pane-button-icon-width` | `28px` | Width of icon buttons |
| `--pc-pane-border-radius` | `4px` | Border radius for inputs/buttons |
| `--pc-pane-border-color` | `#ccc` | Border color |
| `--pc-pane-focus-color` | `#0066cc` | Focus ring and primary button color |
| `--pc-pane-icon-align-left` | SVG | Left alignment icon (black) |
| `--pc-pane-icon-align-center` | SVG | Center alignment icon (black) |
| `--pc-pane-icon-align-right` | SVG | Right alignment icon (black) |
| `--pc-pane-icon-align-justify` | SVG | Justify alignment icon (black) |

#### Dark Theme Example

```css
[data-theme="dark"] {
  --pc-pane-text-color: #eee;
  --pc-pane-label-color: #aaa;
  --pc-pane-background: #2a2a2a;
  --pc-pane-border-color: #444;
  --pc-pane-focus-color: #4da6ff;
}
```

### Pane CSS Classes

You can also override styles directly:

```css
/* Container */
.pc-pane { }

/* Form elements */
.pc-pane-form-group { }
.pc-pane-form-group--inline { }
.pc-pane-label { }
.pc-pane-input { }
.pc-pane-input--number { }
.pc-pane-select { }
.pc-pane-textarea { }
.pc-pane-color { }
.pc-pane-checkbox { }

/* Buttons */
.pc-pane-button { }
.pc-pane-button--primary { }
.pc-pane-button--danger { }
.pc-pane-button--active { }
.pc-pane-button-group { }
.pc-pane-toggle { }
.pc-pane-toggle--active { }

/* Layout */
.pc-pane-section { }
.pc-pane-section-label { }
.pc-pane-row { }
.pc-pane-hint { }

/* Info display */
.pc-pane-info { }
.pc-pane-info-label { }
.pc-pane-info-value { }
.pc-pane-info-list { }

/* Specific panes */
.pc-pane-view-toggles { }
.pc-pane-margins-grid { }
.pc-pane-merge-data-input { }
.pc-pane-formatting { }
```

---

## Complete Example

Here's a complete example showing how to set up an editor with optional modules:

```typescript
import {
  PCEditor,
  HorizontalRuler,
  VerticalRuler,
  FormattingPane,
  DocumentSettingsPane,
  DocumentInfoPane,
  ViewSettingsPane,
  MergeDataPane,
  TextBoxPane,
  ImagePane,
  TablePane
} from '@productcloudos/editor';

// Import pane styles
import '@productcloudos/editor/dist/panes.css';

// Create editor
const editor = new PCEditor(document.getElementById('editor'), {
  pageSize: 'A4',
  pageOrientation: 'portrait'
});

// Create rulers
const hRuler = new HorizontalRuler({ units: 'mm' });
const vRuler = new VerticalRuler({ units: 'mm' });

hRuler.attach({
  editor,
  container: document.getElementById('h-ruler')
});

vRuler.attach({
  editor,
  container: document.getElementById('v-ruler')
});

// Create panes
const formattingPane = new FormattingPane();
const docSettingsPane = new DocumentSettingsPane();
const docInfoPane = new DocumentInfoPane();
const mergeDataPane = new MergeDataPane('merge', {
  initialData: { customerName: 'John Doe' }
});
const textBoxPane = new TextBoxPane();
const imagePane = new ImagePane();
const tablePane = new TablePane();

const viewSettingsPane = new ViewSettingsPane('view', {
  onToggleRulers: () => {
    if (hRuler.isVisible) {
      hRuler.hide();
      vRuler.hide();
    } else {
      hRuler.show();
      vRuler.show();
    }
  },
  rulersVisible: true
});

// Attach panes to containers
formattingPane.attach({
  editor,
  container: document.getElementById('formatting-pane')
});

docSettingsPane.attach({
  editor,
  container: document.getElementById('doc-settings-pane')
});

viewSettingsPane.attach({
  editor,
  container: document.getElementById('view-settings-pane')
});

// Object panes with section elements for auto-hide
textBoxPane.attach({
  editor,
  container: document.getElementById('textbox-pane'),
  sectionElement: document.getElementById('textbox-section')
});

imagePane.attach({
  editor,
  container: document.getElementById('image-pane'),
  sectionElement: document.getElementById('image-section')
});

tablePane.attach({
  editor,
  container: document.getElementById('table-pane'),
  sectionElement: document.getElementById('table-section')
});

// Clean up on unmount
function cleanup() {
  hRuler.destroy();
  vRuler.destroy();
  formattingPane.destroy();
  docSettingsPane.destroy();
  docInfoPane.destroy();
  viewSettingsPane.destroy();
  mergeDataPane.destroy();
  textBoxPane.destroy();
  imagePane.destroy();
  tablePane.destroy();
  editor.destroy();
}
```

---

## Section Element Pattern

Panes can control a parent section's visibility using the `sectionElement` option. This is useful for collapsible panels:

```html
<div class="collapsible-section" id="textbox-section" style="display: none;">
  <h3>Text Box Settings</h3>
  <div id="textbox-pane">
    <!-- TextBoxPane renders here -->
  </div>
</div>
```

```typescript
textBoxPane.attach({
  editor,
  container: document.getElementById('textbox-pane'),
  sectionElement: document.getElementById('textbox-section')
});

// When a text box is selected, both the pane AND section become visible
// When no text box is selected, both are hidden
```
