# ADR-0025: Driver commands as one CLI package

- Status: proposed (ported from the project template, awaiting the human owner's acceptance)
- Date: 2026-11-08

## Context

The template accumulated one standalone script per driver verb: flat
files in `scripts/`, each opened by its own `make` recipe or npm
script. Three forces pushed against that layout:

1. **Duplicated plumbing.** Every script re-implemented the same
   repository-root resolution, git runners and exit-code constants,
   with divergent copies of the same logic. A fix to one copy never
   reached the others.
2. **File proliferation.** Each new driver verb added a new flat
   file, and a flat directory of near-twins is the layout where
   copy-paste drift thrives.
3. **One stable surface.** Agents and prompts call `make` and the npm
   scripts, not the files: any reorganization must keep those working,
   unchanged.

## Options considered

1. **Replace the drivers with documentation** (a list of allowed
   commands per context). Rejected: documentation verifies nothing.
   The drivers exist to mechanically enforce the criteria (review
   before merge, CI green, fail-closed sync); a checklist re-reads
   the same rules with no gate.
2. **Keep the flat files, share nothing.** Rejected as-is: the
   duplication above is structural, and re-implementing the plumbing
   in every new driver is an invitation to diverge.
3. **One CLI package with subcommands.** `scripts/cli.mjs` dispatches
   to per-domain modules in `scripts/commands/`; the shared plumbing
   lives once. Chosen.

## Decision

- `scripts/` is a package. Each driver runs as one subcommand of
  `node scripts/cli.mjs` (`review`, `serve`, `check-structure`,
  `sync-daily`), and each domain module in `scripts/commands/`
  exports its own `run` entry point: one module, one driver domain.
- **Subcommands mirror the make targets and npm scripts one-to-one.**
  `make` and `npm run` stay THE agent surface; the recipes simply
  call `node scripts/cli.mjs <command>`. No target name, no script
  name, no help line changes.
- **One exit-code contract**, shared: 0 success, 1 criteria unmet
  (refused, nothing written), 2 protocol failure.

## Consequences

- A new driver verb is one subcommand on the existing CLI - a module
  in `scripts/commands/`, a registration in `cli.mjs`, a make recipe
  or npm script - instead of another look-alike flat file.
- Agents must not call `node scripts/commands/<name>.mjs` directly:
  the flat entry files are gone, and `node scripts/cli.mjs <command>`
  (or the make target / npm script) is the only entry point.
- The stale `scripts/<name>.mjs` paths in the historical documents
  were updated to the new entry point in this same change: this
  repository inherits from a template, and a project instantiated
  from it would inherit dead paths on day one. The decisions
  themselves are untouched; only the paths they cite moved with the
  layout.
