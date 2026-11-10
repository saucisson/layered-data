// The layer language: parser.
//
// Analysis errors are verdicts, never exceptions — the panels display
// them, the workbench does not die of a typo. Everything below the
// tokenizer is a linear recursive descent; the language value types
// carry the acts exactly as written.

import { type LanguageToken, tokenizeLanguage } from "./tokenizer.ts";

// ---- the written forms of the language --------------------------------

export type LanguageValue =
  | { kind: "literal"; value: string | number | boolean | null }
  /** `@anchor/first/second` — cls "R" when a path follows, "LR" for a bare layer. */
  | { kind: "reference"; referenceClass: "R" | "LR"; segments: string[] }
  | { kind: "list"; items: LanguageValue[] };

// The declaration modes of the members: three gestures since
// ADR-0106 — the ones the ontology measured, nothing else.
export type DeclarationMode = "new" | "extend" | "override";

export type LanguageAct =
  | { kind: "bind"; slot: string; value: LanguageValue; line: number; notes?: string[] }
  | { kind: "check"; labels: string[]; line: number; notes?: string[] }
  | {
      /** `check name { … }` — the DEFINITION (ADR-0105): one check,
       * its level, an optional condition slot, and its judgments —
       * closed sentences in the reading language, each with its
       * message template. The act desugars into the internal
       * `check-definitions` container (the compile emits it); the
       * container itself is never addressed as a key. A definition
       * is also a pose: the name lands among the check tags. */
      kind: "check-definition";
      name: string;
      level: string;
      condition: string | null;
      judgments: { when: string | null; formula: string; message: string }[];
      line: number;
      notes?: string[];
    }
  | {
      kind: "expect";
      path: string[];
      key: string;
      value: LanguageValue | null;
      line: number;
      notes?: string[];
    }
  | {
      kind: "member";
      key: string;
      mode: "new" | "extend" | "override";
      refines: LanguageValue[] | null;
      value: LanguageValue | null;
      block: LanguageAct[] | null;
      line: number;
      notes?: string[];
    };

import { DEFAULT_LANGUAGE, parseText, type Language } from "../messages.ts";

export interface LanguageLayer {
  name: string;
  refines: LanguageValue[] | null;
  acts: LanguageAct[];
  line: number;
  notes?: string[];
}

export interface ParsedLanguage {
  layers: LanguageLayer[];
  errors: string[];
}

export function parseLanguage(source: string, language: Language = DEFAULT_LANGUAGE): ParsedLanguage {
  const layers: LanguageLayer[] = [];
  const errors: string[] = [];
  let tokens: LanguageToken[] = [];
  try {
    tokens = tokenizeLanguage(source);
  } catch (error) {
    errors.push(
      parseText({ language, en: "syntax: " + (error as Error).message, fr: "syntaxe : " + (error as Error).message }),
    );
    return { layers, errors };
  }

  // ---- token stream helpers
  let position = 0;
  const peek = () => tokens[position];
  const eat = (expectedKind: string): LanguageToken => {
    const token = tokens[position];
    if (token === undefined || token.kind !== expectedKind) {
      throw new Error(
        parseText({
          language,
          en:
            "l." + (token?.line ?? 0) + " : expected '" + expectedKind + "', got '" + (token?.text ?? "end") + "'",
          fr:
            "l." + (token?.line ?? 0) + " : attendu '" + expectedKind + "' obtenu '" + (token?.text ?? "fin") + "'",
        }),
      );
    }
    position++;
    return token;
  };
  const eatKey = (): string => {
    const token = tokens[position];
    if (token === undefined || (token.kind !== "id" && token.kind !== "str")) {
      throw new Error(
        parseText({
          language,
          en: "l." + (token?.line ?? 0) + " : name expected, got '" + (token?.text ?? "end") + "'",
          fr: "l." + (token?.line ?? 0) + " : nom attendu, obtenu '" + (token?.text ?? "fin") + "'",
        }),
      );
    }
    position++;
    return token.text;
  };

  // ---- values
  const parseReference = (): LanguageValue => {
    eat("@");
    const segments = [eat("id").text];
    while (peek()?.kind === "/") {
      position++;
      segments.push(eat("id").text);
    }
    return {
      kind: "reference",
      referenceClass: segments.length > 1 ? "R" : "LR",
      segments,
    };
  };
  // The parent order IS the consultation order — the closure walks
  // the list as written and first-winner depends on it; the silent
  // comma becomes "then": the priority reads in the writing.
  const parseReferences = (): LanguageValue[] => {
    const references: LanguageValue[] = [parseReference()];
    while (peek()?.kind === "id" && peek()?.text === "then") {
      position++;
      references.push(parseReference());
    }
    return references;
  };
  const parseValue = (): LanguageValue => {
    const token = peek();
    if (token === undefined) {
      // A one-line empty layer can end the text — the end is spoken,
      // it does not break.
      throw new Error(
      parseText({ language, en: "value expected, end of text", fr: "valeur attendue, fin du texte" }),
    );
    }
    if (token.kind === "str") {
      position++;
      return { kind: "literal", value: token.text };
    }
    if (token.kind === "num") {
      position++;
      return { kind: "literal", value: Number(token.text) };
    }
    if (token.kind === "@") return parseReference();
    if (token.kind === "id") {
      // The null literal disappears — the abstract slot declares
      // itself with the "abstract" act, never with a value: one way
      // to say it.
      if (token.text === "true") {
        position++;
        return { kind: "literal", value: true };
      }
      if (token.text === "false") {
        position++;
        return { kind: "literal", value: false };
      }
    }
    if (token.kind === "[") {
      eat("[");
      const items: LanguageValue[] = [];
      if (peek()?.kind !== "]") {
        while (true) {
          items.push(parseValue());
          if (peek()?.kind === ",") {
            position++;
            continue;
          }
          break;
        }
      }
      eat("]");
      return { kind: "list", items };
    }
    throw new Error(
      parseText({
        language,
        en: "l." + token.line + " : unexpected value '" + token.text + "'",
        fr: "l." + token.line + " : valeur inattendue '" + token.text + "'",
      }),
    );
  };

  // ---- acts
  const parseActs = (): LanguageAct[] => {
    const acts: LanguageAct[] = [];
    while (peek()?.kind !== "}") {
      // The comments of a block travel with the act that follows them
      // — the compilation will store them as __note:key; orphaned at
      // the end of a block, they fall with it.
      const notes: string[] = [];
      while (peek()?.kind === "note") {
        const noteToken = tokens[position++];
        if (noteToken === undefined) break;
        notes.push(noteToken.text);
      }
      if (peek()?.kind === "}" || peek() === undefined) break;
      const token = peek()!;

      // ---- the "expect" act — the path of the scene reads as an
      // address, the expectation is a language value (number, string,
      // reference); "absent" requires the read to return null — the
      // abstract slot says absent, never "= null"
      if (token.kind === "id" && token.text === "expect") {
        position++;
        const segments = [eat("id").text];
        while (peek()?.kind === "/") {
          position++;
          segments.push(eat("id").text);
        }
        let value: LanguageValue | null = null;
        if (peek()?.kind === "id" && peek()?.text === "absent") {
          position++;
        } else {
          eat("=");
          value = parseValue();
        }
        acts.push({
          kind: "expect",
          path: segments.slice(0, -1),
          key: segments[segments.length - 1] ?? "",
          value,
          line: token.line,
        });
        const lastAct = acts[acts.length - 1];
        if (notes.length && lastAct !== undefined) lastAct.notes = notes;
        continue;
      }

      // ---- the member modes
      let mode: "new" | "extend" | "override" = "new";
      if (token.kind === "id" && token.text === "extend") {
        position++;
        mode = "extend";
      } else if (token.kind === "id" && token.text === "override") {
        position++;
        mode = "override";
      }
      // The abstract slot is an act — "abstract key" (after "override"
      // to re-cut back toward abstraction) replaces "key = null";
      // compiled to the same null value of the kernel, the semantics
      // do not move.
      if (peek()?.kind === "id" && peek()?.text === "abstract") {
        position++;
        const key = eatKey();
        acts.push({
          kind: "member",
          key,
          mode,
          refines: null,
          value: null,
          block: null,
          line: token.line,
        });
        const lastAct = acts[acts.length - 1];
        if (notes.length && lastAct !== undefined) lastAct.notes = notes;
        continue;
      }

      // ---- the remaining simple acts
      if (token.kind === "id" && token.text === "bind") {
        position++;
        const slot = eatKey();
        eat("->");
        acts.push({ kind: "bind", slot, value: parseValue(), line: token.line });
        const lastAct = acts[acts.length - 1];
        if (notes.length && lastAct !== undefined) lastAct.notes = notes;
        continue;
      }
      if (token.kind === "id" && token.text === "check") {
        position++;
        const labels = [eatKey()];
        while (peek()?.kind === ",") {
          position++;
          labels.push(eatKey());
        }
        // The block opens the DEFINITION (ADR-0105) — the sugar is
        // the only door into the check-definitions container: the
        // language poses (`check simple`) and defines (`check
        // simple { … }`); it never addresses the container itself.
        if (peek()?.kind === "{") {
          if (labels.length !== 1) {
            throw new Error(
              parseText({
                language,
                en: "l." + token.line + " : a check definition names ONE check",
                fr: "l." + token.line + " : une définition de check nomme UN seul check",
              }),
            );
          }
          position++;
          const readStringField = (field: string): string => {
            eat("=");
            const value = parseValue();
            if (value.kind !== "literal" || typeof value.value !== "string") {
              throw new Error(
                parseText({
                  language,
                  en: "l." + token.line + " : '" + field + "' expects a string",
                  fr: "l." + token.line + " : « " + field + " » attend une chaîne",
                }),
              );
            }
            return value.value;
          };
          let level = "root";
          let condition: string | null = null;
          const judgments: { when: string | null; formula: string; message: string }[] = [];
          while (peek()?.kind !== "}") {
            const field = eat("id");
            if (field.text === "level") {
              level = readStringField("level");
            } else if (field.text === "condition") {
              condition = readStringField("condition");
            } else if (field.text === "judgment") {
              eat("{");
              let when: string | null = null;
              let formula = "";
              let message = "";
              while (peek()?.kind !== "}") {
                const inner = eat("id");
                if (inner.text === "when") when = readStringField("when");
                else if (inner.text === "formula") formula = readStringField("formula");
                else if (inner.text === "message") message = readStringField("message");
                else {
                  throw new Error(
                    parseText({
                      language,
                      en: "l." + token.line + " : unknown judgment field '" + inner.text + "'",
                      fr: "l." + token.line + " : champ de jugement inconnu « " + inner.text + " »",
                    }),
                  );
                }
              }
              eat("}");
              judgments.push({ when, formula, message });
            } else {
              throw new Error(
                parseText({
                  language,
                  en: "l." + token.line + " : unknown definition field '" + field.text + "'",
                  fr: "l." + token.line + " : champ de définition inconnu « " + field.text + " »",
                }),
              );
            }
          }
          eat("}");
          acts.push({ kind: "check-definition", name: labels[0] ?? "", level, condition, judgments, line: token.line });
          const lastAct = acts[acts.length - 1];
        if (notes.length && lastAct !== undefined) lastAct.notes = notes;
          continue;
        }
        acts.push({ kind: "check", labels, line: token.line });
        const lastAct = acts[acts.length - 1];
        if (notes.length && lastAct !== undefined) lastAct.notes = notes;
        continue;
      }

      // ---- the member: [extend|override] key [refines …] { … } | [override] key = value
      const keyToken = peek()!;
      if (keyToken.kind !== "id" && keyToken.kind !== "str") {
        throw new Error(
          parseText({
            language,
            en: "l." + token.line + " : unexpected act '" + token.text + "'",
            fr: "l." + token.line + " : acte inattendu '" + token.text + "'",
          }),
        );
      }
      position++;
      let refines: LanguageValue[] | null = null;
      if (peek()?.kind === "id" && peek()?.text === "refines") {
        position++;
        refines = parseReferences();
      }
      if (peek()?.kind === "{") {
        position++;
        acts.push({
          kind: "member",
          key: keyToken.text,
          mode,
          refines,
          value: null,
          block: parseActs(),
          line: token.line,
        });
        const lastAct = acts[acts.length - 1];
        if (notes.length && lastAct !== undefined) lastAct.notes = notes;
        eat("}");
      } else if (peek()?.kind === "=") {
        position++;
        acts.push({
          kind: "member",
          key: keyToken.text,
          mode,
          refines,
          value: parseValue(),
          block: null,
          line: token.line,
        });
        const lastAct = acts[acts.length - 1];
        if (notes.length && lastAct !== undefined) lastAct.notes = notes;
      } else {
        // A member alone on its line reads as an empty block — the
        // declaration without content (record, alphabet refines
        // @collection) keeps a natural writing, one brace less.
        acts.push({
          kind: "member",
          key: keyToken.text,
          mode,
          refines,
          value: null,
          block: [],
          line: token.line,
        });
        const lastAct = acts[acts.length - 1];
        if (notes.length && lastAct !== undefined) lastAct.notes = notes;
      }
    }
    return acts;
  };

  // ---- the layers
  while (position < tokens.length) {
    // The comments preceding a layer travel with it — the note is
    // [""], then each comment line restored at the block margin
    // (+ 2), line ending included; a layer without a comment carries
    // its empty note — never mute; comments in the tribune, without a
    // layer to document, stay on the quay.
    const layerNotes: string[] = [];
    while (peek()?.kind === "note") {
      const noteToken = tokens[position++];
      if (noteToken === undefined) break;
      layerNotes.push(noteToken.text);
    }
    if (position >= tokens.length) break;
    const token = eat("id");
    if (token.text !== "layer") {
      throw new Error(
        parseText({
          language,
          en: "l." + token.line + " : expected 'layer', got '" + token.text + "'",
          fr: "l." + token.line + " : attendu 'layer' obtenu '" + token.text + "'",
        }),
      );
    }
    const name = eat("id").text;
    let refines: LanguageValue[] | null = null;
    if (peek()?.kind === "id" && peek()?.text === "refines") {
      position++;
      refines = parseReferences();
    }
    // A layer without content declares itself on one line — the
    // empty layer block keeps a writing.
    let acts: LanguageAct[] = [];
    if (peek()?.kind === "{") {
      position++;
      acts = parseActs();
      eat("}");
    }
    layers.push({ name, refines, acts, line: token.line, notes: layerNotes });
  }
  return { layers, errors };
}
