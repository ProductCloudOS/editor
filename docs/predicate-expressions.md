# Predicate Expressions

Conditional sections use predicate expressions to determine whether content is shown or hidden during merge. This page documents the full expression syntax.

## Overview

A predicate is a string expression that evaluates to `true` or `false` against merge data. When the predicate is truthy, the section content is included; when falsy, the content is removed.

```typescript
// Simple field check — include content if isActive is truthy
editor.addConditionalSection(start, end, 'isActive');

// Comparison — include content if status equals "approved"
editor.addConditionalSection(start, end, 'status == "approved"');

// Compound — include content if active AND VIP
editor.addConditionalSection(start, end, 'isActive && customer.isVIP');
```

## Supported Expressions

### Truthiness

A bare identifier resolves its value from the merge data and checks if it is truthy.

```
isActive
customer.isVIP
hasOrders
```

### Negation

Prefix `!` negates the value.

```
!isArchived
!customer.isBanned
```

### Comparisons

Binary comparison operators compare two values.

| Operator | Meaning |
|----------|---------|
| `==` | Equal (loose) |
| `!=` | Not equal (loose) |
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater than or equal |
| `<=` | Less than or equal |
| `=~` | Regex match |
| `!~` | Regex not match |

```
status == "approved"
count != 0
age > 18
score <= 100
price >= 9.99
email =~ "@example\\.com$"
status !~ "^(draft|archived)$"
```

### Logical Operators

Combine expressions with `&&` (AND) and `||` (OR).

```
isActive && isVIP
isAdmin || isModerator
isActive && status == "approved"
```

### Parentheses

Group expressions to control evaluation order.

```
(isActive || isVIP) && !isBanned
!(status == "archived" || status == "deleted")
```

### Literals

Literal values can be used on either side of comparisons.

| Type | Examples |
|------|---------|
| Strings | `"approved"`, `'pending'` |
| Numbers | `100`, `3.14`, `0` |
| Booleans | `true`, `false` |

### Regex Match

The `=~` operator tests whether the left side matches a regex pattern on the right. The `!~` operator is the inverse. The left side is coerced to a string before matching — numbers, booleans, and other types are converted via `String()`. `null` and `undefined` become an empty string.

The right side is a string containing a regular expression pattern (without delimiters):

```
email =~ "@example\\.com$"
name =~ "^(Jane|John)"
status !~ "^(draft|archived)$"
phone =~ "^\\+1"
```

If the pattern is invalid, `=~` returns `false` and `!~` returns `true`.

### Type Coercion

Comparison operators automatically coerce strings to numbers when appropriate:

- **Ordering operators** (`>`, `<`, `>=`, `<=`) always convert both sides to numbers. A string like `"49.99"` becomes `49.99`. Non-numeric strings become `NaN`, causing the comparison to return `false`.
- **Equality operators** (`==`, `!=`) convert both sides to numbers only if both sides look numeric. This means `"5" == 5` is `true`, but `"hello" == "hello"` still works as a string comparison.

This is particularly useful when merge data contains numbers stored as strings (e.g., from form inputs or CSV imports):

```
// Works even if amount is the string "49.99" in merge data
amount > 10
amount <= 100
price == 9.99
```

### Dot Notation

Access nested properties in merge data using dot notation.

```
customer.isVIP
contact.address.city == "London"
order.items.length > 0
```

## Truthiness Rules

When a value is used as a boolean (e.g., bare identifier or in `&&`/`||`), the following rules apply:

| Value | Result |
|-------|--------|
| `true` | `true` |
| `false` | `false` |
| `null` / `undefined` | `false` |
| `0` | `false` |
| Non-zero number | `true` |
| `""` (empty string) | `false` |
| Non-empty string | `true` |
| `[]` (empty array) | `false` |
| Non-empty array | `true` |
| Object | `true` |

## Operator Precedence

From highest to lowest:

1. Parentheses `()`
2. Negation `!`
3. Comparisons `==`, `!=`, `>`, `<`, `>=`, `<=`, `=~`, `!~`
4. Logical AND `&&`
5. Logical OR `||`

## Examples with Merge Data

Given this merge data:

```json
{
  "customerName": "Jane Smith",
  "isVIP": true,
  "isActive": true,
  "status": "approved",
  "orderCount": 5,
  "contact": {
    "mobile": "+1 555-1234",
    "address": {
      "city": "San Francisco"
    }
  }
}
```

| Predicate | Result |
|-----------|--------|
| `isVIP` | `true` |
| `!isVIP` | `false` |
| `status == "approved"` | `true` |
| `status != "approved"` | `false` |
| `orderCount > 3` | `true` |
| `orderCount <= 3` | `false` |
| `isActive && isVIP` | `true` |
| `isActive && status == "pending"` | `false` |
| `isVIP \|\| orderCount > 10` | `true` |
| `contact.address.city == "San Francisco"` | `true` |
| `contact.mobile =~ "^\\+1"` | `true` |
| `customerName !~ "^Admin"` | `true` |
| `missingField` | `false` (undefined is falsy) |

## Error Handling

If a predicate cannot be parsed or evaluation fails, the result is `false` and the section content is removed. This is a safe default — malformed expressions never accidentally include content.

## Usage in Table Rows

Table row conditionals use the same predicate syntax. When a table is focused and `addConditionalSection()` is called, it creates a row conditional instead of a text-flow conditional. The rows are removed during merge if the predicate evaluates to false.
