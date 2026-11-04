// The layer language: the single source of the space.
//
// JSON is not a writing format here: each layer is declared in a
// grammar where inheritance (refines), transparency (defaults,
// extended by `extend`), overriding (`override`), opacity (`mask`),
// bindings (`bind`), check tags (`check`) and the signature of
// order-decided reads (`assume`) are EXPLICIT ACTS —
// verifiable before any execution. One semantics only: the compiler
// produces the exact dictionaries of the kernel, never a parallel
// semantics.

import { DEFAULT_LANGUAGE, parseText, type Language } from "../messages.ts";

export type LanguageTokenKind =
  | "str"
  | "id"
  | "num"
  | "@"
  | "/"
  | "["
  | "]"
  | ","
  | "="
  | "->"
  | "{"
  | "}"
  | "note";

export interface LanguageToken {
  kind: LanguageTokenKind;
  text: string;
  line: number;
}

// Blocks live on indentation — no braces, no near-empty lines.
// The tokenizer is layout-sensitive: each line is analyzed alone; a
// line deeper than the last structural line opens a block (synthetic
// "{" token), a return to an open margin closes it (synthetic "}") —
// the parser then consumes the same tokens as before. Empty lines
// stay transparent to the structure; a comment becomes DATA: the
// whole line travels as a "note" token, and its margin closes the
// blocks deeper than it — it never opens one; a tabulation is
// refused (indentation counts in spaces); a return to a width never
// opened is honestly refused (inconsistent indentation); the end of
// the text closes everything. A brace in the writing is refused: the
// language lives on indentation.
export function tokenizeLanguage(source: string, language: Language = DEFAULT_LANGUAGE): LanguageToken[] {
  const tokens: LanguageToken[] = [];
  const margins: number[] = [0];
  // Notes deeper than any open block wait here for the block they
  // announce.
  const heldNotes: LanguageToken[] = [];
  const lines = source.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let rawLine = lines[lineIndex];
    if (rawLine.endsWith("\r")) rawLine = rawLine.slice(0, -1);
    const lineNumber = lineIndex + 1;
    let margin = 0;
    while (margin < rawLine.length && rawLine[margin] === " ") margin++;
    if (rawLine[margin] === "\t") {
      throw new Error(
          parseText({
            language,
            en: "l." + lineNumber + " : tab — indentation counts in spaces",
            fr: "l." + lineNumber + " : tabulation — l'indentation se compte en espaces",
          }),
        );
    }
    const topMargin = () => margins[margins.length - 1];
    const body = rawLine.slice(margin);
    // A comment is data — a whole // line travels as a "note" token
    // (the raw line, margin included; the compilation restores the
    // line ending and the block margin); its margin closes the
    // blocks deeper than it, without ever opening its own: at the
    // end of a block it documents the key that follows; deeper than
    // any open block, the note is HELD — the block it announces opens
    // on the next line, and it hatches inside it, on the opening act,
    // never before the brace.
    if (body.startsWith("//")) {
      while (margins.length > 1 && topMargin() > margin) {
        margins.pop();
        tokens.push({ kind: "}", text: "}", line: lineNumber });
      }
      if (margin > topMargin()) {
        heldNotes.push({ kind: "note", text: rawLine, line: lineNumber });
      } else {
        tokens.push({ kind: "note", text: rawLine, line: lineNumber });
      }
      continue;
    }
    if (body === "") continue;
    if (margin > topMargin()) {
      margins.push(margin);
      tokens.push({ kind: "{", text: "{", line: lineNumber });
      // The announced block opens: the held notes hatch inside it.
      for (const note of heldNotes) tokens.push(note);
      heldNotes.length = 0;
    } else {
      // The announced block does not open: the note falls at the
      // current level — it documents the act that follows, or stays
      // on the quay.
      for (const note of heldNotes) tokens.push(note);
      heldNotes.length = 0;
    }
    if (margin < topMargin()) {
      while (topMargin() > margin) {
        margins.pop();
        tokens.push({ kind: "}", text: "}", line: lineNumber });
      }
      if (topMargin() !== margin) {
        throw new Error(
          parseText({
            language,
            en: "l." + lineNumber + " : inconsistent indentation — no block opens at " + margin + " space(s)",
            fr: "l." + lineNumber + " : indentation incohérente — aucun bloc ne s'ouvre à " + margin + " espace(s)",
          }),
        );
      }
    }
    let cursor = 0;
    while (cursor < body.length) {
      const character = body[cursor];
      if (character === " " || character === "\t") {
        cursor++;
        continue;
      }
      if (character === "/" && body[cursor + 1] === "/") break;
      if (character === "{" || character === "}") {
        throw new Error(
          parseText({
            language,
            en: "l." + lineNumber + " : brace — the language lives on indentation",
            fr: "l." + lineNumber + " : accolade — le langage vit de l'indentation",
          }),
        );
      }
      if (character === '"') {
        let end = cursor + 1;
        while (body[end] !== '"') {
          if (body[end] === undefined) {
            throw new Error(
            parseText({ language, en: "unterminated string l." + lineNumber, fr: "chaîne non fermée l." + lineNumber }),
          );
          }
          end++;
        }
        tokens.push({ kind: "str", text: body.slice(cursor + 1, end), line: lineNumber });
        cursor = end + 1;
        continue;
      }
      if (character === "-" && body[cursor + 1] === ">") {
        tokens.push({ kind: "->", text: "->", line: lineNumber });
        cursor += 2;
        continue;
      }
      if (character === "@" || character === "=" || character === "," || character === "/" ||
          character === "[" || character === "]") {
        tokens.push({ kind: character, text: character, line: lineNumber });
        cursor++;
        continue;
      }
      if (/[A-Za-z_]/.test(character)) {
        // The dot joins the identifier — the qualified key of a
        // citation (philo1.think1) is one identifier.
        let end = cursor;
        while (end < body.length && /[A-Za-z0-9_.-]/.test(body[end])) end++;
        tokens.push({ kind: "id", text: body.slice(cursor, end), line: lineNumber });
        cursor = end;
        continue;
      }
      // A negative number: a minus followed by digits is a number
      // (relative offsets go below zero); only at the start of a
      // token, never inside an identifier.
      if (/[0-9]/.test(character) || (character === "-" && /[0-9]/.test(body[cursor + 1] ?? ""))) {
        let end = character === "-" ? cursor + 1 : cursor;
        while (end < body.length && /[0-9.]/.test(body[end])) end++;
        tokens.push({ kind: "num", text: body.slice(cursor, end), line: lineNumber });
        cursor = end;
        continue;
      }
      throw new Error(
        parseText({
          language,
          en: "unexpected character '" + character + "' l." + lineNumber,
          fr: "caractère inattendu '" + character + "' l." + lineNumber,
        }),
      );
    }
  }
  // Notes held until the end fall before the closings — the tribune
  // stays on the quay.
  for (const note of heldNotes) tokens.push(note);
  while (margins.length > 1) {
    margins.pop();
    tokens.push({ kind: "}", text: "}", line: lines.length });
  }
  return tokens;
}
