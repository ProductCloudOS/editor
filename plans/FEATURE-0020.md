# FEATURE-0020: Support Format Types for Substitution Fields

## Status: COMPLETE

## Overview

This feature extends the substitution field system to support formatted output for different data types. When merge data is applied, field values can be automatically formatted according to predefined or custom format specifications. This includes:

1. **Number formatting** - decimal places, thousands separators, padding
2. **Currency formatting** - symbol placement, locale-aware formatting
3. **Date formatting** - various date/time patterns
4. **Markdown rendering** - bold, italic, links within field values

## Current Architecture Analysis

**Key Files:**
- `/src/lib/text/types.ts` - Contains `SubstitutionField` and `SubstitutionFieldConfig` types
- `/src/lib/text/SubstitutionFieldManager.ts` - Manages substitution fields
- `/src/lib/core/PCEditor.ts` - Contains `applyMergeData()` and `substituteFieldsInContent()`
- `/src/lib/rendering/FlowingTextRenderer.ts` - Renders fields in the canvas
- `/src/lib/text/TextMeasurer.ts` - Measures field display text

**Current SubstitutionFieldConfig:**
```typescript
export interface SubstitutionFieldConfig {
  displayFormat?: string;       // Currently only used for page numbers: "Page %d"
  defaultValue?: string;        // Fallback when field not in merge data
  fieldType?: SubstitutionFieldType;  // 'data' | 'pageNumber' | 'pageCount'
  formatting?: TextFormattingStyle;   // Visual formatting
}
```

**Current Merge Process:**
1. `applyMergeData()` is called with a data object
2. For each field, `resolveFieldPath()` gets the raw value
3. The value is converted to string using `String(value)`
4. The field placeholder is replaced with the string value
5. No format transformation is applied

**Gaps:**
- No type system for values (number, date, currency)
- No format function infrastructure
- `displayFormat` only supports simple `%d` replacement
- No locale/internationalization support
- No markdown parsing or rendering

## Proposed Types

```typescript
/**
 * Type of value expected for formatting purposes.
 */
export type FieldValueType = 'string' | 'number' | 'currency' | 'date' | 'markdown';

/**
 * Predefined format patterns for numbers.
 */
export type NumberFormatPreset =
  | 'integer'           // 1234
  | 'decimal'           // 1234.56
  | 'decimal-1'         // 1234.5
  | 'decimal-3'         // 1234.567
  | 'thousands'         // 1,234
  | 'percent'           // 12.34%
  | 'scientific';       // 1.23e+3

/**
 * Predefined format patterns for currency.
 */
export type CurrencyFormatPreset =
  | 'USD'               // $1,234.56
  | 'EUR'               // €1.234,56
  | 'GBP'               // £1,234.56
  | 'JPY'               // ¥1,234
  | 'custom';           // Custom via currencySymbol

/**
 * Predefined format patterns for dates.
 */
export type DateFormatPreset =
  | 'short'             // 1/15/24
  | 'medium'            // Jan 15, 2024
  | 'long'              // January 15, 2024
  | 'full'              // Monday, January 15, 2024
  | 'iso'               // 2024-01-15
  | 'time-short'        // 3:30 PM
  | 'time-long'         // 3:30:45 PM
  | 'datetime-short'    // 1/15/24, 3:30 PM
  | 'datetime-long';    // January 15, 2024 at 3:30 PM

/**
 * Extended configuration for substitution field formatting.
 */
export interface FieldFormatConfig {
  valueType?: FieldValueType;

  // Number formatting options
  numberFormat?: NumberFormatPreset | string;
  decimalPlaces?: number;
  useGrouping?: boolean;

  // Currency formatting options
  currencyFormat?: CurrencyFormatPreset;
  currencySymbol?: string;
  currencyPosition?: 'before' | 'after';

  // Date formatting options
  dateFormat?: DateFormatPreset | string;

  // Locale settings
  locale?: string;

  // Custom format function (for advanced use cases)
  formatFunction?: (value: unknown) => string;
}
```

## Implementation Phases

### Phase 1: Core Data Model
1. Add new types to `types.ts`
2. Update `SubstitutionFieldConfig` and `SubstitutionField` interfaces
3. Update `SubstitutionFieldManager` to handle format config

### Phase 2: FieldFormatter Implementation
4. Create `FieldFormatter.ts` with number formatting using `Intl.NumberFormat`
5. Add currency formatting
6. Add date formatting using `Intl.DateTimeFormat`
7. Add unit tests for formatting

### Phase 3: Integration with Merge
8. Instantiate `FieldFormatter` in `PCEditor`
9. Update `substituteFieldsInContent()` to use formatter
10. Test with various field types and formats

### Phase 4: Markdown Support
11. Create `MarkdownParser.ts`
12. Implement basic markdown parsing (bold, italic, links)
13. Integrate with merge process for markdown fields
14. Handle hyperlink creation from markdown links

### Phase 5: Serialization
15. Update `SubstitutionFieldData` type
16. Update `toData()` and `fromData()` in `FlowingTextContent`
17. Test round-trip serialization

### Phase 6: Demo UI
18. Add format options to field insertion dialog
19. Add format display in field properties pane
20. Test all format types from UI

### Phase 7: Testing
21. Unit tests for FieldFormatter
22. Unit tests for MarkdownParser
23. Integration tests for merge with formatting

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/text/FieldFormatter.ts` | Value formatting utility |
| `src/lib/text/MarkdownParser.ts` | Basic markdown parser |
| `src/test/unit/text/FieldFormatter.test.ts` | Unit tests |
| `src/test/unit/text/MarkdownParser.test.ts` | Unit tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/text/types.ts` | Add `FieldValueType`, `FieldFormatConfig`, extend `SubstitutionField` |
| `src/lib/text/SubstitutionFieldManager.ts` | Handle format config in insert/serialize |
| `src/lib/text/FlowingTextContent.ts` | Update serialization |
| `src/lib/core/PCEditor.ts` | Use FieldFormatter in substituteFieldsInContent |
| `src/lib/types/index.ts` | Add `FieldFormatConfigData` serialization type |
| `src/demo/index.html` | Add format options UI |
| `src/demo/demo.ts` | Handle format option events |

## Test Requirements

### Unit Tests
- `FieldFormatter.test.ts`
  - Number formatting with all presets
  - Currency formatting with all currency types
  - Date formatting with all presets
  - Locale handling
  - Edge cases (NaN, null, undefined)
  - Custom format functions

- `MarkdownParser.test.ts`
  - Bold text parsing
  - Italic text parsing
  - Link parsing
  - Nested formatting
  - Mixed content

### Integration Tests
- `substitution-fields.test.ts` (extend existing)
  - Merge with number format
  - Merge with currency format
  - Merge with date format
  - Merge with markdown
  - Serialization with format config

## Potential Challenges

1. **Locale Handling**: Different locales have different number and date formats. Need to decide on default locale and how to override.

2. **Custom Format Functions**: Cannot be serialized. Document as "runtime only" configuration.

3. **Markdown Complexity**: Starting with minimal subset (bold, italic, links) and can expand later.

4. **Performance**: Consider caching for frequent merge operations.

5. **Undo/Redo**: Merge is treated as single operation.

## Estimated Complexity

- **New code**: ~400-600 lines
- **Modified files**: 8-10
- **Risk level**: Medium (extends existing system, adds new utilities)
- **Dependencies**: None (uses built-in Intl APIs)
