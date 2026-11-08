#!/usr/bin/env node
// Command-line entry point: `node scripts/cli.mjs <command> [args...]`
// (ADR-0025).
//
// Make and the npm scripts stay THE agent surface: every subcommand
// below matches a make target or an npm script one-to-one (ADR-0025).
// This dispatcher only wires the subcommands to their domain modules
// in scripts/commands/; it owns no protocol of its own.
//
// Exit-code contract, shared by every subcommand: 0 success,
// 1 criteria unmet (refused, nothing written), 2 protocol failure.

import { run as review } from './commands/review.mjs';
import { run as serve } from './commands/serve.mjs';
import { run as checkStructure } from './commands/check-structure.mjs';
import { run as syncDaily } from './commands/sync-daily.mjs';

const COMMANDS = {
  review,
  serve,
  'check-structure': checkStructure,
  'sync-daily': syncDaily,
};

const [command, ...args] = process.argv.slice(2);

if (!command || !COMMANDS[command]) {
  console.error('Usage: node scripts/cli.mjs <command> [args...]');
  console.error(`Commands: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(2);
}

const exitCode = command === 'check-structure' ? checkStructure({ args }) : COMMANDS[command]();
// Subcommands either exit themselves (review, check-structure) or
// return their exit code (sync-daily): propagate it either way.
if (typeof exitCode === 'number') process.exit(exitCode);
