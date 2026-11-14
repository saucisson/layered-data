# Review checklist

Used by the reviewer agent for every pull request, and available to the
developer agent as a self-check before reporting work. **Every item is
binary**: yes or no, with `file:line` evidence for every "no".

## 1. Architecture and imports

- [ ] All dependencies point strictly inward (`domain` -> nothing,
      `application` -> `domain`, `presentation` -> inner layers, `App.tsx` -> all).
- [ ] `domain` contains no I/O, no React, no Node APIs, no orchestration.
- [ ] I/O happens only in `infrastructure` adapters or passed as named parameters.
- [ ] No adapter is constructed outside the composition root (`App.tsx`).
- [ ] Import boundaries verified: no cross-layer imports.

## 2. Style

- [ ] All parameters passed as named object parameters (exceptions: 
      single obvious primitive).
- [ ] No abbreviations (allowed: `id`, `url`, `http`).
- [ ] Every literal with meaning is a named `UPPER_CASE` constant.
- [ ] Functions are linear and flat: no arbitrary extraction; extracted
      blocks are reused >= 2x or intention-named.
- [ ] Complexity kept reasonable, nesting <= 4.
- [ ] JSDoc/TSDoc comments on public functions.
- [ ] English everywhere in code (identifiers, comments, file names).

## 3. Typing

- [ ] Every signature fully annotated; `tsc --noEmit --strict` passes.
- [ ] Domain primitives (branded types) used at boundaries - no bare `string`
      for identifiers, layer names, addresses.
- [ ] Closed sets: union types with exhaustive `switch` + `never` guard.
- [ ] Variant data: explicit discriminated unions with `kind` field.
- [ ] No `any` without an inline justification comment.
- [ ] Type narrowing uses proper type guards.

## 4. Error handling

- [ ] Expected errors are values (Result patterns, optional returns).
- [ ] An exception means a bug: something that should be impossible.
- [ ] Errors carry full structured context.
- [ ] Nothing swallowed: no empty catch blocks, no ignored promises.

## 5. Tests

- [ ] Every new behavior is covered by an assertion that **fails if the
      behavior regresses** (not just "executes without crashing").
- [ ] The executable specification tests pass (`npm run test:specification`).
- [ ] No test weakened or deleted to make CI pass.
- [ ] New tests added for new functionality.

## 6. Security and autonomy

- [ ] No new dependency without an approved escalation (ADR-0009, ADR-0011).
- [ ] No constitutional file touched: `AGENTS.md`, `docs/agents/`,
      `docs/decisions/`, `docs/architecture.md`, `docs/branching.md`,
      lint/type/coverage configuration.
- [ ] Pull request under ~1000 changed lines, or split proposed.
- [ ] Conventional Commit message matching the actual change.
- [ ] No `console.log` outside `main.ts` / `scripts/`.
- [ ] No secrets in code or logs.

## 7. React/TypeScript frontend

- [ ] Components render; hooks think - a component is pure display given
      its props; state and orchestration live in hooks.
- [ ] No business logic in JSX.
- [ ] Dependencies point strictly inward (`domain` -> nothing, `application` ->
      `domain`, `presentation` -> inner layers, `App.tsx` -> all).
- [ ] `tsc` strict passes on the diff; no `any` - `unknown` with narrowing
      instead.
- [ ] Closed sets are union types (never `enum`), with an exhaustive
      `switch` guarded by `never`.
- [ ] Named exports only; no default exports.
- [ ] No `console`, no `alert` anywhere in application code.
- [ ] Files kebab-case; `UPPER_CASE` constants at module top; no
      abbreviations (`id`, `url`, `http` excepted).

## 8. Versioning and schema (ADR-0116, ADR-0114)

- [ ] New verdicts (`version-conflict`, `drift`, `formalism-frozen`,
      `kernel-shadowing`) are emitted with structured diagnostics naming
      the formalism, the conflicting versions, and both diamond paths.
- [ ] The version classifier (`src/domain/versionClassifier.ts`) assigns
      PATCH/MINOR/MAJOR structurally — the author never declares a level.
- [ ] `refines` pins the major (`@user/name@2`); bare names resolve to the
      latest frozen version of the latest major; drafts never resolve.
- [ ] Single major per formalism name per closure; diamond conflicts are
      diagnosed, never silently resolved.
- [ ] Drift policing: a minor lift that changes the measured dump of a
      host assembly emits a `drift` verdict requiring explicit re-certification.
- [ ] Schema changes (PostgreSQL: `users`, `user_layers`, versions tables)
      include a migration SQL file in `docker-entrypoint-initdb.d/` and
      are backward-compatible (additive columns, no destructive drops).
- [ ] Resolution rules: private layers are 404 for other users (existence
      not leaked); public layers are read-only for non-owners (PUT → 403).

## Verdict

Every finding is reported as **BLOCKING** (violates a rule above; no merge),
**TO-FIX** (should be fixed; merge can proceed if trivial and tracked) or
**SUGGESTION** (advisory, never blocks). The reviewer never fixes code, and
never merges - the report ends with a recommendation only.
