/**
 * Simple recursive-descent predicate evaluator.
 * Supports:
 * - Truthiness: `isActive`
 * - Negation: `!isActive`
 * - Comparisons: ==, !=, >, <, >=, <=
 * - Logical: &&, ||, parentheses
 * - Literals: "approved", 100, true/false
 * - Dot notation: customer.isVIP
 */

type Token =
  | { type: 'identifier'; value: string }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'operator'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'not' }
  | { type: 'eof' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    // Two-character operators
    if (i + 1 < input.length) {
      const two = input[i] + input[i + 1];
      if (two === '==' || two === '!=' || two === '>=' || two === '<=' || two === '&&' || two === '||' || two === '=~' || two === '!~') {
        tokens.push({ type: 'operator', value: two });
        i += 2;
        continue;
      }
    }

    // Single-character operators
    if (ch === '>' || ch === '<') {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // Not operator
    if (ch === '!') {
      tokens.push({ type: 'not' });
      i++;
      continue;
    }

    // String literals
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let str = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++;
          str += input[i];
        } else {
          str += input[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Numbers
    if (ch >= '0' && ch <= '9') {
      let num = '';
      while (i < input.length && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) {
        num += input[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // Identifiers (including dot notation: customer.isVIP)
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$') {
      let ident = '';
      while (
        i < input.length &&
        ((input[i] >= 'a' && input[i] <= 'z') ||
         (input[i] >= 'A' && input[i] <= 'Z') ||
         (input[i] >= '0' && input[i] <= '9') ||
         input[i] === '_' || input[i] === '$' || input[i] === '.')
      ) {
        ident += input[i];
        i++;
      }

      if (ident === 'true') {
        tokens.push({ type: 'boolean', value: true });
      } else if (ident === 'false') {
        tokens.push({ type: 'boolean', value: false });
      } else {
        tokens.push({ type: 'identifier', value: ident });
      }
      continue;
    }

    // Unknown character — skip
    i++;
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private data: Record<string, unknown>;

  constructor(tokens: Token[], data: Record<string, unknown>) {
    this.tokens = tokens;
    this.data = data;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  /**
   * Parse the full expression.
   * Grammar:
   *   expr     → or_expr
   *   or_expr  → and_expr ('||' and_expr)*
   *   and_expr → unary (('==' | '!=' | '>' | '<' | '>=' | '<=') unary)?
   *              | unary ('&&' unary_or_comparison)*
   *   unary    → '!' unary | primary
   *   primary  → '(' expr ')' | literal | identifier
   */
  parse(): unknown {
    const result = this.parseOr();
    return result;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();

    while (this.peek().type === 'operator' && (this.peek() as { type: 'operator'; value: string }).value === '||') {
      this.advance();
      const right = this.parseAnd();
      left = this.isTruthy(left) || this.isTruthy(right);
    }

    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseComparison();

    while (this.peek().type === 'operator' && (this.peek() as { type: 'operator'; value: string }).value === '&&') {
      this.advance();
      const right = this.parseComparison();
      left = this.isTruthy(left) && this.isTruthy(right);
    }

    return left;
  }

  private parseComparison(): unknown {
    const left = this.parseUnary();

    const token = this.peek();
    if (token.type === 'operator') {
      const op = (token as { type: 'operator'; value: string }).value;
      if (op === '==' || op === '!=' || op === '>' || op === '<' || op === '>=' || op === '<=' || op === '=~' || op === '!~') {
        this.advance();
        const right = this.parseUnary();
        return this.compare(left, op, right);
      }
    }

    return left;
  }

  private parseUnary(): unknown {
    if (this.peek().type === 'not') {
      this.advance();
      const value = this.parseUnary();
      return !this.isTruthy(value);
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const token = this.peek();

    if (token.type === 'paren' && token.value === '(') {
      this.advance();
      const value = this.parseOr();
      // Consume closing paren
      if (this.peek().type === 'paren' && (this.peek() as { type: 'paren'; value: string }).value === ')') {
        this.advance();
      }
      return value;
    }

    if (token.type === 'string') {
      this.advance();
      return token.value;
    }

    if (token.type === 'number') {
      this.advance();
      return token.value;
    }

    if (token.type === 'boolean') {
      this.advance();
      return token.value;
    }

    if (token.type === 'identifier') {
      this.advance();
      return this.resolveIdentifier(token.value);
    }

    // EOF or unexpected — return undefined
    this.advance();
    return undefined;
  }

  private resolveIdentifier(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private compare(left: unknown, op: string, right: unknown): boolean {
    // Regex match: left is coerced to string, right is the pattern string
    if (op === '=~' || op === '!~') {
      const str = this.toString(left);
      const pattern = this.toString(right);
      try {
        const regex = new RegExp(pattern);
        const matches = regex.test(str);
        return op === '=~' ? matches : !matches;
      } catch {
        // Invalid regex pattern — treat as no match
        return op === '!~';
      }
    }

    // For ordering operators, coerce both sides to numbers if either side is numeric
    if (op === '>' || op === '<' || op === '>=' || op === '<=') {
      const l = this.toNumber(left);
      const r = this.toNumber(right);
      switch (op) {
        case '>': return l > r;
        case '<': return l < r;
        case '>=': return l >= r;
        case '<=': return l <= r;
      }
    }

    // For equality, coerce to numbers if both sides look numeric
    const ln = this.toNumberIfNumeric(left);
    const rn = this.toNumberIfNumeric(right);

    switch (op) {
      case '==': return ln == rn; // eslint-disable-line eqeqeq
      case '!=': return ln != rn; // eslint-disable-line eqeqeq
      default: return false;
    }
  }

  /**
   * Convert a value to a string for regex matching.
   */
  private toString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return String(value);
  }

  /**
   * Convert a value to a number. Strings that look like numbers are parsed.
   * Non-numeric values become NaN.
   */
  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return isNaN(n) ? NaN : n;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return NaN;
  }

  /**
   * If a value is a string that looks like a number, convert it.
   * Otherwise return the value as-is. Used for == / != so that
   * "5" == 5 is true but "hello" == "hello" still works.
   */
  private toNumberIfNumeric(value: unknown): unknown {
    if (typeof value === 'string' && value.length > 0) {
      const n = Number(value);
      if (!isNaN(n)) return n;
    }
    return value;
  }

  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }
}

/**
 * Static predicate evaluator for conditional sections.
 */
export class PredicateEvaluator {
  /**
   * Evaluate a predicate expression against data.
   * @param predicate The predicate string (e.g., "isActive", "count > 0")
   * @param data The data context to evaluate against
   * @returns true if the predicate is truthy, false otherwise
   */
  static evaluate(predicate: string, data: Record<string, unknown>): boolean {
    if (!predicate || predicate.trim().length === 0) {
      return false;
    }

    try {
      const tokens = tokenize(predicate.trim());
      const parser = new Parser(tokens, data);
      const result = parser.parse();

      // Convert result to boolean
      if (result === null || result === undefined) return false;
      if (typeof result === 'boolean') return result;
      if (typeof result === 'number') return result !== 0;
      if (typeof result === 'string') return result.length > 0;
      if (Array.isArray(result)) return result.length > 0;
      return true;
    } catch {
      // If evaluation fails, treat as false
      return false;
    }
  }
}
