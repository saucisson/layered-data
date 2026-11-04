# Makefile for saucisson/layered-data
# Provides convenience targets for common development operations

.PHONY: help verify check typecheck test build lint format

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
	@echo "  day-report  - Generate end-of-day report"
	@echo "  smoke-test  - Run smoke tests"

# Quality gates (ADR-0008)
verify: typecheck test build

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

test-audit:
	npm run test:audit

test-specification:
	npm run test:specification

test-staging:
	npm run test:staging

# Build
build:
	npm run build

# Lint and format
lint:
	# ESLint not yet configured, placeholder
	echo "Linting not yet configured - see docs/architecture.md for style rules"

format:
	# Prettier not yet configured, placeholder
	echo "Formatting not yet configured"

# Day cycle operations (ADR-0010, docs/branching.md)
day-start:
	@echo "Tagging daily branch for new day"
	git tag daily-$(date +%Y-%m-%d)
	@echo "Daily branch tagged. Start work on issues from the morning directive."

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
