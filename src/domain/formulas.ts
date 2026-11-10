// The checks' declarative strate: the reading language of the
// couples (ADR-0105).
//
// A couple's judgment is a closed sentence over the reading machine.
// Quantifiers range over NAMED views (collections — finite domains,
// the evaluation always terminates); terms are slash paths whose
// anchor is either a quantified variable or the judged address
// itself (`edges` reads at the carrier, `e/arrows` reads at e — the
// same slash, the same reading machine as the rest of the language);
// and a term in proposition position is the EXISTENCE predicate of
// free logic: a term may fail to denote (an abstract slot, a
// collection the closure never reaches) and the sentence says so
// instead of guessing.
//
//   forall e in edges: exists a in e/arrows: a/vertex
//   — nonempty: every edge has a visible arrow pointing a vertex
//
// The fragment is deliberately small: forall / exists (a comma list
// is sugar for nesting), =, !=, not, and, or, =>, parentheses — and
// NOTHING else. No second-order quantification, no power sets, no
// arithmetic: what the checks of the bedrock need is first-order,
// and the frontier stays honest (count and reachable are the
// declared next strate; the TC checks say so in the registry, they
// do not sneak in here).
//
// Everything is pure and measured: the interpreter counts its steps
// (one per member enumerated, one per term resolved) and a budget
// guards the walk — a judgment that overruns is EXHAUSTED, never
// silent. The witnesses are free: a failing universal ships the
// assignment that falsified it, the message template renders it
// (`{x}` — the key, `{x*}` — the address tuple), and the pose-time
// scope rule makes an out-of-scope template a verdict, never a
// runtime surprise.

import { type Address, AddressView, addressesEqual } from "./addresses.ts";
import { type LayerPath, asPathSegment } from "./identifiers.ts";
import { Space } from "./space.ts";
import { designatedAddress } from "./desugaring.ts";

// ---- the written forms ------------------------------------------------

export type Term = { variable: string; segments: string[] };

export type Formula =
  | {
      kind: "quantifier";
      quantifier: "forall" | "exists";
      variable: string;
      domain: Term;
      body: Formula;
    }
  | { kind: "binary"; operator: "and" | "or" | "=>"; left: Formula; right: Formula }
  | { kind: "not"; body: Formula }
  | { kind: "equality"; negative: boolean; left: Term; right: Term }
  | { kind: "denotes"; term: Term };

interface FormulaToken {
  text: string;
}

const IDENTIFIER = /[A-Za-z0-9_-]/;

// The tokenizer: identifiers (keys, variables — hyphens included),
// and the eight symbols. An unexpected character is an error — the
// caller turns it into a verdict, never an exception in the panels.
export function tokenizeFormula(source: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === undefined) break;
    if (/\s/.test(character)) {
      index++;
      continue;
    }
    const pair = source.slice(index, index + 2);
    if (pair === "=>" || pair === "!=") {
      tokens.push({ text: pair });
      index += 2;
      continue;
    }
    if (
      character === "=" ||
      character === "(" ||
      character === ")" ||
      character === "," ||
      character === ":" ||
      character === "/"
    ) {
      tokens.push({ text: character });
      index++;
      continue;
    }
    if (IDENTIFIER.test(character)) {
      let end = index;
      while (end < source.length && IDENTIFIER.test(source[end] ?? "")) end++;
      tokens.push({ text: source.slice(index, end) });
      index = end;
      continue;
    }
    throw new Error("unexpected character '" + character + "'");
  }
  return tokens;
}

// ---- the parser: linear recursive descent, the same discipline as
// the layer language's ----------------------------------------------

class FormulaParser {
  private readonly tokens: FormulaToken[];
  private position = 0;

  constructor(tokens: FormulaToken[]) {
    this.tokens = tokens;
  }

  private peek(): FormulaToken | undefined {
    return this.tokens[this.position];
  }

  private eat(expected?: string): FormulaToken {
    const token = this.tokens[this.position];
    if (token === undefined || (expected !== undefined && token.text !== expected)) {
      throw new Error("expected '" + (expected ?? "token") + "'");
    }
    this.position++;
    return token;
  }

  parseImplication(): Formula {
    const left = this.parseOr();
    if (this.peek()?.text === "=>") {
      this.eat("=>");
      return { kind: "binary", operator: "=>", left, right: this.parseImplication() };
    }
    return left;
  }

  private parseOr(): Formula {
    let formula = this.parseAnd();
    while (this.peek()?.text === "or") {
      this.eat("or");
      formula = { kind: "binary", operator: "or", left: formula, right: this.parseAnd() };
    }
    return formula;
  }

  private parseAnd(): Formula {
    let formula = this.parseUnary();
    while (this.peek()?.text === "and") {
      this.eat("and");
      formula = { kind: "binary", operator: "and", left: formula, right: this.parseUnary() };
    }
    return formula;
  }

  private parseUnary(): Formula {
    const token = this.peek();
    if (token === undefined) throw new Error("unexpected end");
    if (token.text === "not") {
      this.eat("not");
      return { kind: "not", body: this.parseUnary() };
    }
    if (token.text === "(") {
      this.eat("(");
      const formula = this.parseImplication();
      this.eat(")");
      return formula;
    }
    if (token.text === "forall" || token.text === "exists") return this.parseQuantifier();
    return this.parseAtom();
  }

  // `forall e1, e2 in edges: body` — the comma list is sugar: each
  // variable nests its own quantifier over the same domain. The
  // body extends to the right (the colon's scope): a parenthesis
  // closes it, nothing else does.
  private parseQuantifier(): Formula {
    const quantifier = this.eat().text as "forall" | "exists";
    const variables = [this.eatKey().text];
    while (this.peek()?.text === ",") {
      this.eat(",");
      variables.push(this.eatKey().text);
    }
    this.eat("in");
    const domain = this.parseTerm();
    this.eat(":");
    let body = this.parseImplication();
    const firstVariable = variables[0];
    if (firstVariable === undefined) throw new Error("quantifier without variable");
    for (let index = variables.length - 1; index >= 1; index--) {
      body = {
        kind: "quantifier",
        quantifier,
        variable: variables[index] ?? firstVariable,
        domain,
        body,
      };
    }
    return { kind: "quantifier", quantifier, variable: firstVariable, domain, body };
  }

  private parseAtom(): Formula {
    const left = this.parseTerm();
    const operator = this.peek()?.text;
    if (operator === "=" || operator === "!=") {
      this.eat(operator);
      return { kind: "equality", negative: operator === "!=", left, right: this.parseTerm() };
    }
    return { kind: "denotes", term: left };
  }

  parseTerm(): Term {
    const variable = this.eatKey().text;
    const segments: string[] = [];
    while (this.peek()?.text === "/") {
      this.eat("/");
      segments.push(this.eatKey().text);
    }
    return { variable, segments };
  }

  private eatKey(): FormulaToken {
    const token = this.peek();
    if (token === undefined) throw new Error("unexpected end");
    if (!/^[A-Za-z0-9_-]+$/.test(token.text))
      throw new Error("expected a name, got '" + token.text + "'");
    this.position++;
    return token;
  }

  exhausted(): boolean {
    return this.position !== this.tokens.length;
  }
}

export type ParsedFormula = { formula: Formula } | { error: string };

export function tryParseFormula(source: string): ParsedFormula {
  try {
    const parser = new FormulaParser(tokenizeFormula(source));
    const formula = parser.parseImplication();
    if (parser.exhausted()) return { error: "formule : tokens résiduels" };
    return { formula };
  } catch (error) {
    return { error: "formule : " + (error as Error).message };
  }
}

// ---- the canonical form ----------------------------------------------

// The identity of a judgment is SYNTACTIC, up to the renaming of its
// quantified variables: the desugaring renames them in order of
// binding (v1, v2, …), everything else stays as written. Two
// mathematically equivalent judgments written differently are two
// different judgments — the doublon rule never searches for a
// proof, it reads. Root-anchored names are not renamed: they are
// the definer's vocabulary, the whole point of the identity.
export function canonicalFormula(formula: Formula): string {
  const names = new Map<string, string>();
  let counter = 0;
  const nameOf = (variable: string): string => {
    if (!names.has(variable)) names.set(variable, "v" + ++counter);
    return names.get(variable)!;
  };
  const term = (value: Term): string => {
    const head = names.has(value.variable) ? nameOf(value.variable) : value.variable;
    return [head, ...value.segments].join("/");
  };
  const walk = (value: Formula): string => {
    switch (value.kind) {
      case "quantifier":
        return (
          value.quantifier +
          " " +
          nameOf(value.variable) +
          " in " +
          term(value.domain) +
          " : (" +
          walk(value.body) +
          ")"
        );
      case "binary":
        return "(" + walk(value.left) + " " + value.operator + " " + walk(value.right) + ")";
      case "not":
        return "not (" + walk(value.body) + ")";
      case "equality":
        return term(value.left) + (value.negative ? " != " : " = ") + term(value.right);
      case "denotes":
        return term(value.term);
    }
  };
  return walk(formula);
}

// The quantified variables of a sentence, in binding order — the
// template's scope. The canonical string of an ill-formed formula
// is marked, never guessed: the caller refuses it as a verdict.
export function quantifiedVariablesOf(formula: Formula): string[] {
  const variables: string[] = [];
  const walk = (value: Formula): void => {
    switch (value.kind) {
      case "quantifier":
        if (!variables.includes(value.variable)) variables.push(value.variable);
        walkTerm(value.domain);
        walk(value.body);
        return;
      case "binary":
        walk(value.left);
        walk(value.right);
        return;
      case "not":
        walk(value.body);
        return;
      case "equality":
        walkTerm(value.left);
        walkTerm(value.right);
        return;
      case "denotes":
        walkTerm(value.term);
    }
  };
  const walkTerm = (value: Term): void => {
    void value;
  };
  walk(formula);
  return variables;
}

// ---- the message templates --------------------------------------------

export interface TemplateTerm {
  term: Term;
  /** `{x*}` — render the address tuple instead of the key */
  address: boolean;
}

// The template's grammar: `{term}` — the member's key; `{term*}` —
// the address tuple the check messages quote. Anything else between
// braces is an error, read as a verdict by the pose-time scope rule.
export function templateTermsOf(message: string): TemplateTerm[] | null {
  const terms: TemplateTerm[] = [];
  const pattern = /\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    let body = match[1] ?? "";
    let address = false;
    if (body.endsWith("*")) {
      address = true;
      body = body.slice(0, -1);
    }
    try {
      const parser = new FormulaParser(tokenizeFormula(body));
      const term = parser.parseTerm();
      if (parser.exhausted()) return null;
      terms.push({ term, address });
    } catch {
      return null;
    }
  }
  return terms;
}

// ---- the interpreter ---------------------------------------------------

export interface Evaluation {
  ok: boolean;
  /** one full assignment per falsified universal — the free witnesses */
  failures: Record<string, AddressView>[];
  steps: number;
  exhausted: boolean;
}

/** The reading of one term — the same machine the kernel reads with:
 * a bound variable, or a key read at the judged address, then one
 * key read per segment. A term that fails to denote reads null. */
export type TermResolver = (
  term: Term,
  assignment: Record<string, AddressView>,
) => AddressView | null;

export function makeTermResolver({ space, view }: { space: Space; view: AddressView }): {
  resolve: TermResolver;
  steps: () => number;
} {
  let steps = 0;
  const resolve: TermResolver = (term, assignment) => {
    steps++;
    let current = assignment[term.variable] ?? null;
    if (current === null) {
      const read = space.read({ layer: view.layer, path: view.path, key: term.variable });
      if (read instanceof AddressView) current = read;
      else return null;
    }
    for (const segment of term.segments) {
      steps++;
      const read = space.read({ layer: current.layer, path: current.path, key: segment });
      if (!(read instanceof AddressView)) return null;
      current = read;
    }
    return current;
  };
  return { resolve, steps: () => steps };
}

/** The concrete node a view designates — the checks' own reading:
 * the designated address, or the view's own when nothing is
 * designated. Mirrors `concreteNodeOf` (checks.ts). */
function concreteNodeOf({ space, view }: { space: Space; view: AddressView }): Address {
  const designated = designatedAddress({ space, layer: view.layer, path: view.path });
  return designated !== null ? designated : [view.layer, view.path];
}

// The measured evaluation. One step per member enumerated (counted
// here) and per term resolved (counted by the resolver); the budget
// bounds the walk — an overrunning judgment is exhausted and never
// judges silently. The assignment is threaded through the recursion;
// a failing universal captures it whole: the witness is free.
export function evaluateFormula({
  space,
  view,
  formula,
  budget = 200000,
}: {
  space: Space;
  view: AddressView;
  formula: Formula;
  budget?: number;
}): Evaluation {
  const { resolve, steps: resolverSteps } = makeTermResolver({ space, view });
  let memberSteps = 0;
  let exhausted = false;

  const members = (term: Term, assignment: Record<string, AddressView>): AddressView[] => {
    const domain = resolve(term, assignment);
    if (domain === null) return [];
    const keys = space.keys({ layer: domain.layer, path: domain.path });
    return keys.map(
      (key) => new AddressView(domain.layer, [...domain.path, asPathSegment(key)] as LayerPath),
    );
  };

  const equal = (left: Term, right: Term, assignment: Record<string, AddressView>): boolean => {
    const first = resolve(left, assignment);
    const second = resolve(right, assignment);
    if (first === null || second === null) return false;
    return addressesEqual(
      concreteNodeOf({ space, view: first }),
      concreteNodeOf({ space, view: second }),
    );
  };

  const evaluate = (
    value: Formula,
    assignment: Record<string, AddressView>,
  ): { ok: boolean; failures: Record<string, AddressView>[] } => {
    if (resolverSteps() + memberSteps > budget) {
      exhausted = true;
      return { ok: true, failures: [] };
    }
    switch (value.kind) {
      case "quantifier": {
        const domain = members(value.domain, assignment);
        if (value.quantifier === "forall") {
          let ok = true;
          const failures: Record<string, AddressView>[] = [];
          for (const member of domain) {
            memberSteps++;
            const inner = evaluate(value.body, { ...assignment, [value.variable]: member });
            if (!inner.ok) {
              ok = false;
              for (const failure of inner.failures)
                failures.push({ [value.variable]: member, ...failure });
            }
          }
          return { ok, failures };
        }
        for (const member of domain) {
          memberSteps++;
          if (evaluate(value.body, { ...assignment, [value.variable]: member }).ok)
            return { ok: true, failures: [] };
        }
        return { ok: false, failures: [{ ...assignment }] };
      }
      case "binary": {
        const left = evaluate(value.left, assignment);
        if (value.operator === "and") {
          if (!left.ok) return { ok: false, failures: left.failures };
          const right = evaluate(value.right, assignment);
          return { ok: right.ok, failures: right.failures };
        }
        if (value.operator === "or") {
          if (left.ok) return { ok: true, failures: [] };
          const right = evaluate(value.right, assignment);
          if (right.ok) return { ok: true, failures: [] };
          return { ok: false, failures: [...left.failures, ...right.failures] };
        }
        // implication: a false antecedent satisfies, a true one
        // inherits the consequent's verdict
        if (!left.ok) return { ok: true, failures: [] };
        return evaluate(value.right, assignment);
      }
      case "not": {
        const inner = evaluate(value.body, assignment);
        return { ok: !inner.ok, failures: inner.failures };
      }
      case "equality": {
        const equal_ = equal(value.left, value.right, assignment);
        return { ok: value.negative ? !equal_ : equal_, failures: [{ ...assignment }] };
      }
      case "denotes":
        return { ok: resolve(value.term, assignment) !== null, failures: [{ ...assignment }] };
    }
  };

  const outcome = evaluate(formula, {});
  return {
    ok: outcome.ok,
    failures: outcome.failures,
    steps: resolverSteps() + memberSteps,
    exhausted,
  };
}

// ---- the message rendering --------------------------------------------

// The rendering of a (layer, path) tuple — the checks' own quoting
// (mirror of `addressTupleRepr`, checks.ts; the messages keep one
// format across the two strates).
function addressTupleRepr(address: Address): string {
  return (
    "('" +
    address[0] +
    "', (" +
    address[1].map((segment) => "'" + segment + "'").join(", ") +
    (address[1].length === 1 ? "," : "") +
    "))"
  );
}

/** Render a judgment's message on a failing assignment: `{x}` — the
 * member's key; `{x*}` — the address tuple. A term that fails to
 * denote renders `?` — the witness speaks what it read. */
export function renderJudgmentMessage({
  space,
  view,
  message,
  assignment,
}: {
  space: Space;
  view: AddressView;
  message: string;
  assignment: Record<string, AddressView>;
}): string {
  const { resolve } = makeTermResolver({ space, view });
  return message.replace(/\{([^{}]*)\}/g, (_whole: string, body: string) => {
    let name = body;
    let address = false;
    if (name.endsWith("*")) {
      address = true;
      name = name.slice(0, -1);
    }
    try {
      const parser = new FormulaParser(tokenizeFormula(name));
      const term = parser.parseTerm();
      if (parser.exhausted()) return "?";
      const value = resolve(term, assignment);
      if (value === null) return "?";
      if (address) return addressTupleRepr(concreteNodeOf({ space, view: value }));
      return value.path.length ? (value.path[value.path.length - 1] ?? value.layer) : value.layer;
    } catch {
      return "?";
    }
  });
}
