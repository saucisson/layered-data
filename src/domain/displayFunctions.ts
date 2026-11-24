// Display functions (ADR-0119, issue #288): the ONE code slot of the
// language, legal only inside the `display` blocks of lenses. This
// module is the domain half: the raw form of a function value, and a
// STRICT SYNTAX CHECK of the code — the server parses but never
// executes. Execution lives only in the browser renderers
// (src/presentation/displayFunctions.ts), in a try/catch, per drawn
// node; the output is validated against the field schema or the SVG
// whitelist before it touches a pixel.
//
// The code between [[ … ]] is an EXPRESSION, never a statement: no
// assignment, no semicolon, no arrow function, no `new`. The grammar
// below accepts literals, identifiers and dotted paths, arrays,
// objects, calls, member access, unary -/!, and the binary operators
// — nothing else. Anything outside is `expression-illisible` at
// staging.

/** A display function as carried by the data: the parameter names
 * and the raw code between [[ … ]]. The raw kernel form is the
 * dictionary `{ __fn: { params, code } }`. */
export interface DisplayFn {
  params: string[];
  code: string;
}

/** The pure-data context of one drawn node, as the display functions
 * receive it (ADR-0119): the flattened element (first parameter) and
 * the flattened model (second parameter). Plain JSON-compatible data
 * only — no API method, no dereferencing. */
export interface DisplayFnContext {
  element: Record<string, unknown>;
  model: Record<string, unknown>;
}

/** Narrow a raw value to a display function — anything else is no
 * function (the field is then read as a plain literal). Accepts the
 * raw kernel form `{ __fn: { params, code } }` and the already
 * unwrapped `{ params, code }` carried by a narrowed RawGlyph. */
export function asDisplayFn(value: unknown): DisplayFn | null {
  if (typeof value !== "object" || value === null) return null;
  if (Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const inner = record["__fn"] ?? record;
  if (typeof inner !== "object" || inner === null || Array.isArray(inner)) return null;
  const fn = inner as Record<string, unknown>;
  if (!Array.isArray(fn["params"]) || !fn["params"].every((p) => typeof p === "string")) return null;
  if (typeof fn["code"] !== "string") return null;
  return { params: fn["params"] as string[], code: fn["code"] };
}

// ---- the strict expression grammar ------------------------------------
// A tiny tokenizer + recursive descent over the code between [[ … ]].
// It answers ONE question: is this a single well-formed expression?
// It never evaluates anything.

type ExprToken =
  | { kind: "num"; text: string }
  | { kind: "str"; text: string }
  | { kind: "id"; text: string }
  | { kind: "punct"; text: string };

const PUNCTS = [
  "<=",
  ">=",
  "===",
  "!==",
  "==",
  "!=",
  "&&",
  "||",
  "=>",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ":",
  ".",
  "+",
  "-",
  "*",
  "/",
  "%",
  "!",
  "<",
  ">",
];

function tokenizeExpression(code: string): ExprToken[] | null {
  const tokens: ExprToken[] = [];
  let cursor = 0;
  while (cursor < code.length) {
    const character = code[cursor] ?? "";
    if (character === " " || character === "\t" || character === "\n" || character === "\r") {
      cursor++;
      continue;
    }
    if (character === '"' || character === "'") {
      let end = cursor + 1;
      while (end < code.length && code[end] !== character) {
        if (code[end] === "\\") end++;
        end++;
      }
      if (end >= code.length) return null; // unterminated string
      tokens.push({ kind: "str", text: code.slice(cursor, end + 1) });
      cursor = end + 1;
      continue;
    }
    const punct = PUNCTS.find((candidate) => code.startsWith(candidate, cursor));
    if (punct !== undefined) {
      tokens.push({ kind: "punct", text: punct });
      cursor += punct.length;
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      let end = cursor;
      while (end < code.length && /[A-Za-z0-9_]/.test(code[end] ?? "")) end++;
      tokens.push({ kind: "id", text: code.slice(cursor, end) });
      cursor = end;
      continue;
    }
    if (/[0-9]/.test(character) || (character === "." && /[0-9]/.test(code[cursor + 1] ?? ""))) {
      let end = cursor;
      while (end < code.length && /[0-9.]/.test(code[end] ?? "")) end++;
      const text = code.slice(cursor, end);
      if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(text)) return null;
      tokens.push({ kind: "num", text });
      cursor = end;
      continue;
    }
    return null; // any other character is outside the grammar
  }
  return tokens;
}

/** Is `code` a single well-formed expression of the display-function
 * grammar? Pure syntax check — nothing is evaluated. */
export function isParsableDisplayExpression(code: string): boolean {
  const tokens = tokenizeExpression(code);
  if (tokens === null || tokens.length === 0) return false;
  let position = 0;
  const peek = () => tokens[position];
  const peekPunct = (text: string) => {
    const token = tokens[position];
    return token !== undefined && token.kind === "punct" && token.text === text;
  };
  const eatPunct = (text: string): boolean => {
    if (!peekPunct(text)) return false;
    position++;
    return true;
  };

  // precedence climbing for the binary operators
  const BINARY: Record<string, number> = {
    "||": 1,
    "&&": 2,
    "==": 3,
    "!=": 3,
    "===": 3,
    "!==": 3,
    "<": 4,
    "<=": 4,
    ">": 4,
    ">=": 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
    "%": 6,
  };
  const isBinary = () => {
    const token = peek();
    return token !== undefined && token.kind === "punct" && token.text in BINARY;
  };

  // An arrow function `(a, b) => body` or `a => body` — still an
  // EXPRESSION (no statements, no block body), the iteration idiom
  // the display functions need (map/filter over pure data).
  const parseArrow = (): boolean => {
    const saved = position;
    let params: string[] | null = null;
    const first = peek();
    if (first !== undefined && first.kind === "id" && tokens[position + 1]?.kind === "punct" && tokens[position + 1]?.text === "=>") {
      params = [first.text];
      position += 2;
    } else if (peekPunct("(")) {
      // scan to the matching close, then require =>
      let depth = 0;
      let scan = position;
      let closesAt = -1;
      while (scan < tokens.length) {
        const token = tokens[scan];
        if (token === undefined) break;
        if (token.kind === "punct" && token.text === "(") depth++;
        if (token.kind === "punct" && token.text === ")") {
          depth--;
          if (depth === 0) {
            closesAt = scan;
            break;
          }
        }
        scan++;
      }
      const after = closesAt >= 0 ? tokens[closesAt + 1] : undefined;
      if (
        closesAt >= 0 &&
        after !== undefined &&
        after.kind === "punct" &&
        after.text === "=>"
      ) {
        const names: string[] = [];
        for (let index = position + 1; index < closesAt; index++) {
          const token = tokens[index];
          if (token === undefined) return false;
          if (token.kind === "id") names.push(token.text);
          else if (!(token.kind === "punct" && token.text === ",")) return false;
        }
        params = names;
        position = closesAt + 2;
      }
    }
    if (params === null) {
      position = saved;
      return false;
    }
    if (!params.every((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) return false;
    return parseBinary(0); // the body is an expression
  };

  // member access / call chain after any atom: .id, [expr], (args)
  const parseChain = (): boolean => {
    while (true) {
      if (eatPunct(".")) {
        const member = peek();
        if (member === undefined || member.kind !== "id") return false;
        position++;
        continue;
      }
      if (peekPunct("[")) {
        position++;
        if (!parseBinary(0)) return false;
        if (!eatPunct("]")) return false;
        continue;
      }
      if (peekPunct("(")) {
        position++;
        if (!eatPunct(")")) {
          if (!parseBinary(0)) return false;
          while (eatPunct(",")) {
            if (!parseBinary(0)) return false;
          }
          if (!eatPunct(")")) return false;
        }
        continue;
      }
      break;
    }
    return true;
  };

  const parsePrimary = (): boolean => {
    if (parseArrow()) return true;
    const token = peek();
    if (token === undefined) return false;
    if (token.kind === "num" || token.kind === "str") {
      position++;
      return parseChain();
    }
    if (token.kind === "id") {
      // true/false/null are literals, but member access still chains
      // on them syntactically (null.x parses; it throws at run time,
      // which the renderer's try/catch turns into the fallback)
      position++;
      return parseChain();
    }
    if (peekPunct("(")) {
      position++;
      if (!parseBinary(0)) return false;
      if (!eatPunct(")")) return false;
      return parseChain();
    }
    if (peekPunct("[")) {
      position++;
      if (!eatPunct("]")) {
        if (!parseBinary(0)) return false;
        while (eatPunct(",")) {
          if (peekPunct("]")) break;
          if (!parseBinary(0)) return false;
        }
        if (!eatPunct("]")) return false;
      }
      return parseChain();
    }
    if (peekPunct("{")) {
      position++;
      if (!eatPunct("}")) {
        while (true) {
          const key = peek();
          if (key === undefined || (key.kind !== "id" && key.kind !== "str")) return false;
          position++;
          if (!eatPunct(":")) return false;
          if (!parseBinary(0)) return false;
          if (eatPunct(",")) {
            if (peekPunct("}")) break;
            continue;
          }
          break;
        }
        if (!eatPunct("}")) return false;
      }
      return parseChain();
    }
    return false;
  };

  const parseUnary = (): boolean => {
    if (eatPunct("-") || eatPunct("!")) return parseUnary();
    return parsePrimary();
  };

  const parseBinary = (minPrecedence: number): boolean => {
    if (!parseUnary()) return false;
    while (isBinary()) {
      const operator = (peek() as { text: string }).text;
      const precedence = BINARY[operator] ?? 0;
      if (precedence < minPrecedence) break;
      position++;
      if (!parseBinary(precedence + 1)) return false;
    }
    return true;
  };

  if (!parseBinary(0)) return false;
  return position === tokens.length; // one expression, nothing after
}
