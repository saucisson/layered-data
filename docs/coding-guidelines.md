# Coding guidelines

These rules are binding for every file in `src/` and `server.ts`.
They are written for two readers at once: humans and AI.

## Language

1. **English everywhere in code** — identifiers, types, comments, file
   names. The visible interface strings stay French for now (they are
   product content, not code; translating them is a separate decision).
2. **No abbreviations** — `configuration` not `config`, `repository`
   not `repo`, `layerAddress` not `lay`. If a name feels long, that is
   fine: length is cheap, opacity is not.

## Comments

3. **Comments explain what is done and why** — the intent and the
   reasoning, including non-obvious constraints. Never history: no
   version numbers, no change references, no "previously we did".
4. **Big steps are marked** — long functions are linear and readable
   top-to-bottom; their major phases are separated by comment banners
   (`// ---- phase name ----`), not by being scattered into
   micro-functions.

## Types

5. **Every business notion is a named type** — never a bare primitive.
   A layer name is a `LayerName`, an address is an `Address`, an
   expected value is an `Expectation` — not `string`, `string[]`, `any`.
6. **Identifiers are nominal (branded)** — `LayerName` is not
   assignable from an arbitrary string. The brand is declared once in
   `src/domain/identifiers.ts` and produced only by the parse boundary.
7. **Variants are discriminated unions** — every alternative carries a
   `kind` field; switches over them are exhaustive and the compiler
   proves it (`never` in the default case).

## Errors

8. **Expected errors are values** — a refused staging, an unknown
   layer, a betrayed expectation return typed values (`Result`
   patterns, optional returns). An exception means *a bug*: something
   that should be impossible, and its stack trace is the message.
   The kernel is total: it never throws.

## Functions

9. **Named parameters everywhere** — a function takes one object:
   `read({ layer, path, key })`, not `read(layer, path, key)`. One
   obvious exception: a single-parameter function whose parameter *is*
   the subject may take it directly.
10. **Linear over clever** — prefer a straight 60-line function with
    banners over a maze of five-line helpers. A function is
    over-decomposed when reading it requires jumping between files.
11. **Keep algorithms simple** — clarity may cost a *slight* loss of
    efficiency (for instance a linear scan where a hash would do).
    "Slight" means: nothing user-visible; this is a design workbench.
12. **Functional data handling** — `map`/`filter`/`reduce` and spread,
    not mutating loops. In-place mutation exists only inside the kernel
    journal (the touch log and generation counters), where it is the
    point of the mechanism and is marked as such.

## Structure

13. **One concept per file** — the file is named after its concept.
    Named exports only: no default exports, no barrel `index.ts`
    re-exporting everything.
14. **Parse, don't validate** — external input (HTTP, `.ld` files,
    browser storage) is converted into domain types at the boundary.
    Inner code trusts its types and re-checks nothing.
15. **No ports-and-adapters ceremony** — dependencies are passed as
    named parameters and assembled in the single composition root
    (`src/main.tsx`). No global singletons, no service locator.

## Testability

16. **Deterministic by construction** — the domain uses no clock, no
    randomness, no environment. Anything time- or environment-dependent
    is injected from the outside.
17. **The executable specification is the contract** — every domain
    change must keep the O/C/T properties of
    `tests/specification-properties.mts` green (`npm test`). A refactor
    is not done until they pass.

## React (presentation)

18. **Components render; hooks think** — a component is pure display
    given its props; state and orchestration live in hooks that call
    the application layer. No business logic in JSX.
