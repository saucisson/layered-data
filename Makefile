# Makefile for saucisson/layered-data
# Provides convenience targets for common development operations

.PHONY: help verify check typecheck test build lint format format:check sync-daily vscode-install

# The VS Code extension version, read from its manifest — the .vsix
# is named after it.
VERSION := $(shell node -p "require('./vscode/package.json').version")
VSIX := vscode/layered-data-$(VERSION).vsix

# Default target
help:
	@echo "Available targets:"
	@echo "  verify      - Run all quality gates (typecheck + tests + build)"
	@echo "  typecheck   - Run TypeScript type checking"
	@echo "  test        - Run all tests"
	@echo "  build       - Build the project"
	@echo "  lint        - Run linter (ESLint)"
	@echo "  format      - Format code with Prettier"
	@echo "  verify-ci   - CI-specific verify (used in workflows)"
	@echo "  day-start   - Tag daily branch for new day"
	@echo "  sync-daily  - Rebase daily onto origin/main, push with lease (ADR-0024)"
	@echo "  day-report  - Generate end-of-day report"
	@echo "  smoke-test  - Run smoke tests"
	@echo "  vscode-install - Package the VS Code extension (.vsix via vsce/npx) and install it locally"

# Quality gates (ADR-0008)
check-structure:
	npm run check:structure

verify: typecheck check-structure test build

verify-ci:
	npm run typecheck
	npm run check:structure
	npm test
	npm run build

# Type checking
typecheck:
	npm run typecheck

# Testing
test:
	npm test

test-specification:
	npm run test:specification

test-staging:
	npm run test:staging

# Build
build:
	npm run build

# Lint and format
lint:
	npm run lint

format:
	npm run format

format:check:
	npm run format:check

# VS Code extension (vscode/): package the .vsix with vsce — fetched by
# npx on the fly, no prior install, as documented in vscode/README.md —
# then install it into the local VS Code. The .vsix rebuilds when the
# extension sources change.
vscode-install: $(VSIX)
	code --install-extension $(VSIX)

$(VSIX): vscode/package.json vscode/extension.js vscode/linter.mts vscode/completion.mts vscode/language-configuration.json vscode/syntaxes/ld.tmLanguage.json
	cd vscode && npx --yes @vscode/vsce package --out layered-data-$(VERSION).vsix

# Day cycle operations (ADR-0010, docs/branching.md)
day-start:
	@echo "Tagging daily branch for new day"
	git tag daily-$(date +%Y-%m-%d)
	@echo "Daily branch tagged. Start work on issues from the morning directive."

# Rebase daily onto origin/main when main moved without daily
# (template sync, hotfix, release), early in the day (ADR-0024).
sync-daily:
	node scripts/cli.mjs sync-daily

day-report:
	@echo "=== End of Day Report ==="
	@echo "Date: $(date)"
	@echo ""
	@echo "Completed issues:"
	@git log --oneline --since="00:00" --until="now" --grep="feat/\|fix/" | head -20
	@echo ""
	@echo "Current status of daily branch:"
	@npm run verify 2>&1 | tail -5

smoke-test:
	@echo "Running smoke tests..."
	@npm run verify
	@echo "Smoke tests complete."
