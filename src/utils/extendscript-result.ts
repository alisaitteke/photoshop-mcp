/**
 * Normalize values returned from ExtendScript via AppleScript stdout.
 * Objects are serialized with toSource() (e.g. "({ok:true,summary:\"...\"})"),
 * which is not valid JSON but is valid JavaScript object literal syntax.
 */
export function parseExtendScriptPayload(raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw !== 'string') return raw;

  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Fall through to toSource parsing.
  }

  const literal = parseToSourceLiteral(trimmed);
  if (literal.ok) return literal.value;

  return trimmed;
}

// Evaluating toSource() output with `new Function` executed whatever text
// Photoshop's stdout carried as code (#90). This reader accepts only the
// literal subset toSource() emits; everything else fails to a raw string.
const MAX_LITERAL_DEPTH = 64;
const MAX_LITERAL_LENGTH = 4 * 1024 * 1024;

const KEYWORDS = new Map<string, unknown>([
  ['true', true],
  ['false', false],
  ['null', null],
  ['undefined', undefined],
]);

function parseToSourceLiteral(source: string): { ok: true; value: unknown } | { ok: false } {
  if (source.length > MAX_LITERAL_LENGTH || !looksLikeExtendScriptObjectLiteral(source)) {
    return { ok: false };
  }
  const reader = new LiteralReader(source);
  const value = reader.readRoot();
  return reader.ok ? { ok: true, value } : { ok: false };
}

function looksLikeExtendScriptObjectLiteral(value: string): boolean {
  return (
    (value.startsWith('(') && value.endsWith(')')) ||
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  );
}

class LiteralReader {
  ok = true;
  private pos = 0;

  constructor(private readonly source: string) {}

  readRoot(): unknown {
    const value = this.readValue(0);
    if (!this.ok) return undefined;
    this.skipWhitespace();
    if (this.pos !== this.source.length) this.fail();
    return value;
  }

  private readValue(depth: number): unknown {
    if (depth > MAX_LITERAL_DEPTH) return this.fail();
    this.skipWhitespace();
    const char = this.peek();
    if (char === undefined) return this.fail();
    if (char === '{') return this.readObject(depth);
    if (char === '(') return this.readGroup(depth);
    if (char === '[') return this.readArray(depth);
    if (char === '"' || char === "'") return this.readString();
    if (char === '-' || (char >= '0' && char <= '9')) return this.readNumber();
    return this.readKeyword();
  }

  private readGroup(depth: number): unknown {
    this.pos++;
    const value = this.readValue(depth + 1);
    if (!this.ok) return undefined;
    this.skipWhitespace();
    if (this.peek() !== ')') return this.fail();
    this.pos++;
    return value;
  }

  private readObject(depth: number): Record<string, unknown> {
    const object: Record<string, unknown> = {};
    this.pos++;
    this.skipWhitespace();
    if (this.peek() === '}') {
      this.pos++;
      return object;
    }
    while (this.ok) {
      this.skipWhitespace();
      const key = this.readKey();
      if (!this.ok) break;
      this.skipWhitespace();
      if (this.peek() !== ':') {
        this.fail();
        break;
      }
      this.pos++;
      const value = this.readValue(depth + 1);
      if (!this.ok) break;
      // defineProperty keeps "__proto__" a plain key instead of setting the prototype.
      Object.defineProperty(object, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      this.skipWhitespace();
      const next = this.peek();
      if (next === ',') {
        this.pos++;
        this.skipWhitespace();
        if (this.peek() === '}') {
          this.fail();
          break;
        }
      } else if (next === '}') {
        this.pos++;
        return object;
      } else {
        this.fail();
        break;
      }
    }
    return object;
  }

  private readArray(depth: number): unknown[] {
    const array: unknown[] = [];
    this.pos++;
    this.skipWhitespace();
    if (this.peek() === ']') {
      this.pos++;
      return array;
    }
    while (this.ok) {
      const value = this.readValue(depth + 1);
      if (!this.ok) break;
      array.push(value);
      this.skipWhitespace();
      const next = this.peek();
      if (next === ',') {
        this.pos++;
        this.skipWhitespace();
        if (this.peek() === ']') {
          this.fail();
          break;
        }
      } else if (next === ']') {
        this.pos++;
        return array;
      } else {
        this.fail();
        break;
      }
    }
    return array;
  }

  private readKey(): string {
    const char = this.peek();
    if (char === '"' || char === "'") {
      const key = this.readString();
      return this.ok ? key : '';
    }
    const identifier = this.readIdentifier();
    if (identifier !== '') return identifier;
    const number = this.readNumberToken();
    if (number !== null) return number;
    this.fail();
    return '';
  }

  private readString(): string {
    const quote = this.source[this.pos];
    this.pos++;
    let value = '';
    while (this.pos < this.source.length) {
      const char = this.source[this.pos];
      if (char === quote) {
        this.pos++;
        return value;
      }
      if (char === '\\') {
        this.pos++;
        const escaped = this.source[this.pos];
        this.pos++;
        switch (escaped) {
          case '"':
          case "'":
          case '\\':
          case '/':
            value += escaped;
            break;
          case 'b':
            value += '\b';
            break;
          case 'f':
            value += '\f';
            break;
          case 'n':
            value += '\n';
            break;
          case 'r':
            value += '\r';
            break;
          case 't':
            value += '\t';
            break;
          case 'u': {
            const hex = this.source.slice(this.pos, this.pos + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              this.fail();
              return '';
            }
            value += String.fromCharCode(parseInt(hex, 16));
            this.pos += 4;
            break;
          }
          default:
            this.fail();
            return '';
        }
      } else if (char < ' ') {
        this.fail();
        return '';
      } else {
        value += char;
        this.pos++;
      }
    }
    this.fail();
    return '';
  }

  private readNumber(): number {
    const token = this.readNumberToken();
    if (token === null) {
      this.fail();
      return 0;
    }
    return Number(token);
  }

  private readNumberToken(): string | null {
    const start = this.pos;
    if (this.peek() === '-') this.pos++;
    let digits = 0;
    while (this.isDigit(this.peek())) {
      this.pos++;
      digits++;
    }
    if (digits === 0) {
      this.pos = start;
      return null;
    }
    if (this.peek() === '.') {
      this.pos++;
      while (this.isDigit(this.peek())) this.pos++;
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      const exponentStart = this.pos;
      this.pos++;
      if (this.peek() === '+' || this.peek() === '-') this.pos++;
      if (!this.isDigit(this.peek())) {
        this.pos = exponentStart;
      } else {
        while (this.isDigit(this.peek())) this.pos++;
      }
    }
    return this.source.slice(start, this.pos);
  }

  private readKeyword(): unknown {
    const identifier = this.readIdentifier();
    if (identifier === '' || !KEYWORDS.has(identifier)) return this.fail();
    return KEYWORDS.get(identifier);
  }

  private readIdentifier(): string {
    if (!isIdentifierStart(this.peek() ?? '')) return '';
    const start = this.pos;
    this.pos++;
    while (isIdentifierChar(this.peek() ?? '')) this.pos++;
    return this.source.slice(start, this.pos);
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && isWhitespace(this.source[this.pos])) this.pos++;
  }

  private peek(): string | undefined {
    return this.pos < this.source.length ? this.source[this.pos] : undefined;
  }

  private isDigit(char: string | undefined): boolean {
    return char !== undefined && char >= '0' && char <= '9';
  }

  private fail(): undefined {
    this.ok = false;
    return undefined;
  }
}

function isWhitespace(char: string): boolean {
  return (
    char === ' ' ||
    char === '\t' ||
    char === '\n' ||
    char === '\r' ||
    char === '\f' ||
    char === '\v'
  );
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierChar(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}
