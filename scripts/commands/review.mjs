#!/usr/bin/env node
/**
 * Agent Review Script for saucisson/layered-data
 * 
 * This script implements the reviewer agent that checks PRs against
 * the review checklist and architecture rules. It runs as part of
 * the GitHub Actions workflow in .github/workflows/review.yml
 * 
 * Exit codes:
 *   0 - Zero BLOCKING findings (merge criteria satisfied)
 *   1 - At least one BLOCKING finding (merge blocked)
 *   2 - Protocol failure (check failed closed)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

// Get GitHub context from environment variables
const GITHUB_BASE_REF = process.env.GITHUB_BASE_REF || 'main';
const GITHUB_HEAD_REF = process.env.GITHUB_HEAD_REF || 'HEAD';
const GITHUB_REF = process.env.GITHUB_REF || '';

// Extract PR number from GITHUB_REF (format: refs/pull/123/merge)
function getPRNumber() {
  const match = GITHUB_REF.match(/refs\/pull\/(\d+)\//);
  return match ? match[1] : null;
}

// Constitutional files that require human approval
const CONSTITUTIONAL_FILES = [
  'AGENTS.md',
  'docs/agents/',
  'docs/decisions/',
  'docs/architecture.md',
  'docs/branching.md',
  'docs/review-checklist.md',
  'docs/coding-guidelines.md',
  '.github/CODEOWNERS',
  '.github/workflows/',
  'package.json',
  'tsconfig.json',
  'tsconfig.node.json'
];

// Maximum lines changed before BLOCKING
const MAX_LINES_CHANGED = 1000;

// Label that waives the human-approval gate (ADR-0011): when a human
// manually poses it on the PR, constitutional-file and pr-too-large
// findings are recorded as WAIVED instead of BLOCKING. Verify failures
// and every other rule are never waivable.
const HUMAN_APPROVED_LABEL = 'human-approved';

function log(message) {
  console.log(`[REVIEWER] ${message}`);
}

function error(message) {
  console.error(`[REVIEWER] ERROR: ${message}`);
}

/**
 * Check if a file is constitutional
 */
function isConstitutionalFile(filePath) {
  return CONSTITUTIONAL_FILES.some(cf => {
    if (cf.endsWith('/')) {
      return filePath.startsWith(cf);
    }
    return filePath === cf || filePath.includes(`${cf}/`);
  });
}

/**
 * Parse diff to get modified files and line counts
 */
function parseDiff(diff) {
  const files = [];
  const lines = diff.split('\n');
  let currentFile = null;
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      // Save previous file
      if (currentFile) {
        files.push({
          path: currentFile,
          additions,
          deletions,
          total: additions + deletions
        });
      }
      // Extract new file path
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (match) {
        currentFile = match[1]; // 'a/' path
      }
      additions = 0;
      deletions = 0;
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      // File header, ignore
      continue;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  // Save last file
  if (currentFile) {
    files.push({
      path: currentFile,
      additions,
      deletions,
      total: additions + deletions
    });
  }

  return files;
}

/**
 * Run a command and return { success, output, error }
 */
function runCommand(command, cwd = repoRoot) {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { success: true, output, error: null };
  } catch (e) {
    return { success: false, output: e.stdout || '', error: e.stderr || String(e) };
  }
}

/**
 * Check if verify passes
 */
function checkVerify() {
  log('Running npm run verify...');
  const result = runCommand('npm run verify');
  
  if (!result.success) {
    return {
      passed: false,
      findings: [{
        severity: 'BLOCKING',
        file: 'CI',
        line: '1',
        rule: 'verify-failed',
        evidence: `npm run verify failed`
      }]
    };
  }
  
  return { passed: true, findings: [] };
}

/**
 * Check PR size
 */
function checkPRSize(modifiedFiles) {
  const totalLines = modifiedFiles.reduce((sum, f) => sum + f.total, 0);
  
  if (totalLines > MAX_LINES_CHANGED) {
    return [{
      severity: 'BLOCKING',
      file: 'pull-request',
      line: '1',
      rule: 'pr-too-large',
      evidence: `PR has ${totalLines} changed lines (max: ${MAX_LINES_CHANGED})`
    }];
  }
  
  return [];
}

/**
 * Get the labels of the PR: from the review bundle (created by the
 * workflow), or from the PR_LABELS environment variable locally.
 */
function getPRLabels() {
  try {
    const raw = fs.readFileSync(path.join(repoRoot, '.review', 'pull-request-labels.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((label) => (typeof label === 'string' ? label : label.name));
    }
    return [];
  } catch (e) {
    if (process.env.PR_LABELS) {
      return process.env.PR_LABELS.split(',').map((label) => label.trim()).filter(Boolean);
    }
    return [];
  }
}

/**
 * Check for constitutional file modifications
 */
function checkConstitutionalFiles(modifiedFiles) {
  const findings = [];
  
  for (const file of modifiedFiles) {
    if (isConstitutionalFile(file.path)) {
      findings.push({
        severity: 'BLOCKING',
        file: file.path,
        line: '1',
        rule: 'constitutional-file-modified',
        evidence: `File ${file.path} requires human approval (ADR-0011)`
      });
    }
  }
  
  return findings;
}

/**
 * Check PR description
 */
function checkPRDescription(description) {
  if (!description || description.trim() === '') {
    return [{
      severity: 'BLOCKING',
      file: 'pull-request',
      line: '1',
      rule: 'missing-description',
      evidence: 'Pull request has no description'
    }];
  }
  
  return [];
}

/**
 * Parse the diff into added lines, each with its file and line number
 * (new-file side of the hunks).
 */
export function parseAddedLines(diff) {
  const added = [];
  let currentFile = null;
  let newLine = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = match ? match[1] : null;
      newLine = 0;
    } else if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      newLine = match ? Number(match[1]) : 0;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      added.push({ file: currentFile, line: newLine, text: line.slice(1) });
      newLine++;
    } else if (!line.startsWith('-')) {
      newLine++;
    }
  }
  return added;
}

/**
 * Check for added/removed dependencies: parse the PR diff for
 * package.json (dependency entries) and package-lock.json
 * (node_modules entries). A NEW dependency is a major escalation
 * criterion (ADR-0011) — BLOCKING unless waived by the human-approved
 * label.
 */
export function checkNewDependencies(diff) {
  const findings = [];
  const addedDeps = new Set();
  const removedDeps = new Set();

  for (const { file, line, text } of parseAddedLines(diff)) {
    if (file === 'package.json') {
      // dependency entries are indented exactly 4 spaces inside
      // "dependencies" / "devDependencies" blocks
      const entry = text.match(/^ {4}"([^"]+)":\s*"[^"]+"/);
      if (entry) addedDeps.add(entry[1]);
    } else if (file === 'package-lock.json') {
      const entry = text.match(/^ {4}"node_modules\/([^"]+)":\s*\{/);
      if (entry) addedDeps.add(entry[1]);
    }
  }

  // Removed lines: same shapes, on the '-' side
  let currentFile = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = match ? match[1] : null;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      const text = line.slice(1);
      if (currentFile === 'package.json') {
        const removed = text.match(/^ {4}"([^"]+)":\s*"[^"]+"/);
        if (removed) removedDeps.add(removed[1]);
      } else if (currentFile === 'package-lock.json') {
        const entry = text.match(/^ {4}"node_modules\/([^"]+)":\s*\{/);
        if (entry) removedDeps.add(entry[1]);
      }
    }
  }

  for (const dep of [...addedDeps].sort()) {
    findings.push({
      severity: 'BLOCKING',
      file: 'package.json',
      line: '1',
      rule: 'new-dependency',
      evidence: `Dependency "${dep}" added — new dependencies are on the escalation list (ADR-0011): label needs-human and get human approval before merge`
    });
  }
  for (const dep of [...removedDeps].sort()) {
    if (addedDeps.has(dep)) continue;
    findings.push({
      severity: 'SUGGESTION',
      file: 'package.json',
      line: '1',
      rule: 'removed-dependency',
      evidence: `Dependency "${dep}" removed — confirm nothing still imports it`
    });
  }
  return findings;
}

// The onion, mirrored from eslint.config.js: each zone may import the
// zones to its LEFT, never the ones listed here.
const ZONE_FORBIDDEN_IMPORTS = {
  'src/domain': ['application', 'presentation', 'pages', 'components', 'infrastructure', 'App.tsx', 'WorkshopContainer.tsx'],
  'src/application': ['presentation', 'pages', 'components', 'App.tsx', 'WorkshopContainer.tsx'],
  'src/presentation': ['App.tsx', 'WorkshopContainer.tsx'],
  'src/pages': ['App.tsx', 'WorkshopContainer.tsx'],
  'src/components': ['App.tsx', 'WorkshopContainer.tsx']
};

const SECRET_PATTERN = /(api[_-]?key|secret|passwd|password|private[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-./+]{8,}["']/i;

/**
 * Content-level checks on the added lines of the diff — the rules the
 * reviewer promises but never enforced: no console in src//server/,
 * no default exports, no explicit any in src/, no import crossing a
 * layer boundary, no possible secret.
 */
export function checkDiffContent(diff) {
  const findings = [];
  for (const { file, line, text } of parseAddedLines(diff)) {
    if (file === null) continue;

    if (SECRET_PATTERN.test(text)) {
      findings.push({
        severity: 'BLOCKING',
        file,
        line: String(line),
        rule: 'possible-secret',
        evidence: `Added line looks like a hardcoded secret — secrets are on the escalation list (ADR-0011), never commit them`
      });
    }

    if (file.startsWith('src/') || file.startsWith('server/')) {
      if (/\bconsole\.(log|warn|error|info|debug)\s*\(/.test(text)) {
        findings.push({
          severity: 'BLOCKING',
          file,
          line: String(line),
          rule: 'console-in-src',
          evidence: 'console.* is banned in src/ and server/ — logging replaces comments, DEBUG events narrate sections'
        });
      }
      if (/\bexport\s+default\b/.test(text)) {
        findings.push({
          severity: 'BLOCKING',
          file,
          line: String(line),
          rule: 'default-export',
          evidence: 'Named exports only — no default exports'
        });
      }
    }

    if (file.startsWith('src/')) {
      if (/:\s*any\b|\bas\s+any\b|<any>/.test(text)) {
        findings.push({
          severity: 'TO-FIX',
          file,
          line: String(line),
          rule: 'explicit-any',
          evidence: 'Explicit any in src/ — use unknown + narrowing (tracked as debt, do not add more)'
        });
      }
      for (const [zone, forbidden] of Object.entries(ZONE_FORBIDDEN_IMPORTS)) {
        if (!file.startsWith(zone + '/')) continue;
        for (const target of forbidden) {
          if (text.includes(`../${target}`) || text.includes(`../../${target}`)) {
            findings.push({
              severity: 'BLOCKING',
              file,
              line: String(line),
              rule: 'layer-boundary-violation',
              evidence: `${zone} must not import ${target} — the onion points inward (domain <- application <- presentation <- App)`
            });
          }
        }
      }
    }
  }
  return findings;
}

/**
 * Check Conventional Commit message
 */
function checkCommitMessage(commits) {
  const findings = [];
  const conventionalCommitPattern = /^(feat|fix|docs|style|refactor|perf|test|chore|revert|BREAKING CHANGE)(\([^)]+\))?:\s.+/;
  
  for (const commit of commits) {
    const message = commit.message.split('\n')[0]; // First line only
    if (!conventionalCommitPattern.test(message)) {
      findings.push({
        severity: 'TO-FIX',
        file: 'commit',
        line: '1',
        rule: 'non-conventional-commit',
        evidence: `Commit "${message}" does not follow Conventional Commits`
      });
    }
  }
  
  return findings;
}

/**
 * Get commits from the PR using git
 */
function getPRCommits() {
  try {
    // In GitHub Actions, GITHUB_BASE_REF is available
    const baseRef = GITHUB_BASE_REF || 'main';
    const headRef = GITHUB_HEAD_REF || 'HEAD';
    
    // Use git range syntax
    const commitsStr = execSync(
      `git log --pretty=format:"%H|%s" ${baseRef}...${headRef}`,
      { cwd: repoRoot, encoding: 'utf8' }
    );
    
    return commitsStr.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, message] = line.split('|');
        return { hash, message };
      });
  } catch (e) {
    log(`Could not get commits: ${e.message}`);
    return [];
  }
}

/**
 * Get the PR diff
 */
function getPRDiff() {
  try {
    const baseRef = GITHUB_BASE_REF || 'main';
    const headRef = GITHUB_HEAD_REF || 'HEAD';
    
    return execSync(
      `git diff --no-color ${baseRef}...${headRef}`,
      { cwd: repoRoot, encoding: 'utf8' }
    );
  } catch (e) {
    // Try simpler diff
    try {
      return execSync('git diff --no-color HEAD~1...HEAD', {
        cwd: repoRoot,
        encoding: 'utf8'
      });
    } catch {
      // Return empty diff
      return '';
    }
  }
}

/**
 * Main review function
 */
function runReview() {
  log('Starting reviewer agent...');
  log(`GITHUB_BASE_REF: ${GITHUB_BASE_REF}`);
  log(`GITHUB_HEAD_REF: ${GITHUB_HEAD_REF}`);
  
  // Ensure review directory exists
  const reviewDir = path.join(repoRoot, '.review');
  if (!fs.existsSync(reviewDir)) {
    fs.mkdirSync(reviewDir, { recursive: true });
  }
  
  let diff = '';
  let description = '';
  let commits = [];
  
  // Try to read from review bundle (created by workflow)
  try {
    diff = fs.readFileSync(path.join(reviewDir, 'pull-request.diff'), 'utf8');
    description = fs.readFileSync(path.join(reviewDir, 'pull-request-description.md'), 'utf8');
    log('Loaded diff and description from review bundle');
  } catch (e) {
    log('Review bundle not found, generating from git...');
    // Generate diff from git
    diff = getPRDiff();
    
    // Try to get description from environment (set by workflow)
    if (process.env.PR_DESCRIPTION) {
      description = process.env.PR_DESCRIPTION;
    } else {
      description = 'Description not available (running locally)';
    }
  }
  
  // Get commits
  commits = getPRCommits();
  
  // Parse diff
  const modifiedFiles = parseDiff(diff);
  
  log(`Found ${modifiedFiles.length} modified files`);
  const totalLines = modifiedFiles.reduce((s, f) => s + f.total, 0);
  log(`Total lines changed: ${totalLines}`);
  
  // Human-approval gate: the label is posed manually by a human, it
  // waives the constitutional-file and pr-too-large rules — never
  // verify failures.
  const prLabels = getPRLabels();
  const humanApproved = prLabels.includes(HUMAN_APPROVED_LABEL);
  if (humanApproved) {
    log(`Label '${HUMAN_APPROVED_LABEL}' present: constitutional-file and size gates waived (ADR-0011)`);
  }

  // Waive a BLOCKING finding when the human-approved label is present.
  const waive = (finding) => ({
    ...finding,
    severity: 'WAIVED',
    evidence: `${finding.evidence} — waived by label '${HUMAN_APPROVED_LABEL}' (human approval, ADR-0011)`
  });

  // Run all checks
  const allFindings = [];

  // 1. Check PR description
  allFindings.push(...checkPRDescription(description));

  // 2. Check PR size
  let sizeFindings = checkPRSize(modifiedFiles);
  if (humanApproved) {
    sizeFindings = sizeFindings.map(waive);
  }
  allFindings.push(...sizeFindings);
  
  // 3. Check constitutional files
  let constitutionalFindings = checkConstitutionalFiles(modifiedFiles);
  if (humanApproved) {
    constitutionalFindings = constitutionalFindings.map(waive);
  }
  allFindings.push(...constitutionalFindings);
  
  // 4. Check verify (only if we have dependencies installed)
  if (fs.existsSync(path.join(repoRoot, 'node_modules'))) {
    const verifyResult = checkVerify();
    if (!verifyResult.passed) {
      allFindings.push(...verifyResult.findings);
    }
  } else {
    log('Skipping npm run verify (node_modules not found)');
  }
  
  // 5. Check commit messages
  allFindings.push(...checkCommitMessage(commits));
  
  // 6. Check for new/removed dependencies in the diff (escalation
  //    list, ADR-0011) — waivable by the human-approved label, like
  //    the constitutional-file gate
  let dependencyFindings = checkNewDependencies(diff);
  if (humanApproved) {
    dependencyFindings = dependencyFindings.map((finding) =>
      finding.severity === 'BLOCKING' ? waive(finding) : finding
    );
  }
  allFindings.push(...dependencyFindings);

  // 7. Content-level checks on the added lines of the diff
  allFindings.push(...checkDiffContent(diff));
  
  // Count by severity
  const counts = {
    BLOCKING: allFindings.filter(f => f.severity === 'BLOCKING').length,
    TO_FIX: allFindings.filter(f => f.severity === 'TO-FIX').length,
    SUGGESTION: allFindings.filter(f => f.severity === 'SUGGESTION').length,
    WAIVED: allFindings.filter(f => f.severity === 'WAIVED').length
  };
  
  // Generate report
  const prNumber = getPRNumber();
  const report = {
    findings: allFindings,
    counts,
    timestamp: new Date().toISOString(),
    prNumber
  };
  
  // Write report
  fs.writeFileSync(
    path.join(reviewDir, 'review-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  // Generate comment
  let comment = `## 🤖 Review Report\n\n`;
  comment += `| Severity | Count |\n`;
  comment += `|----------|-------|\n`;
  comment += `| **BLOCKING** | ${counts.BLOCKING} |\n`;
  comment += `| **TO-FIX** | ${counts.TO_FIX} |\n`;
  comment += `| **SUGGESTION** | ${counts.SUGGESTION} |\n`;
  comment += `| **WAIVED** (label \`${HUMAN_APPROVED_LABEL}\`) | ${counts.WAIVED} |\n\n`;
  
  if (counts.BLOCKING > 0) {
    comment += `### ❌ **BLOCKING Findings** (Merge blocked)\n\n`;
    comment += `These must be fixed before this PR can be merged.\n\n`;
    for (const finding of allFindings.filter(f => f.severity === 'BLOCKING')) {
      comment += `- **\[${finding.rule}\]** \`${finding.file}:${finding.line}\`\n`;
      comment += `  > ${finding.evidence}\n\n`;
    }
  } else {
    comment += `### ✅ **No BLOCKING Findings**\n\n`;
    comment += `Merge criteria satisfied! ✨\n\n`;
  }
  
  if (counts.TO_FIX > 0) {
    comment += `### ⚠️ **TO-FIX Findings** (Can merge if trivial)\n\n`;
    for (const finding of allFindings.filter(f => f.severity === 'TO-FIX')) {
      comment += `- **\[${finding.rule}\]** \`${finding.file}:${finding.line}\`\n`;
      comment += `  > ${finding.evidence}\n\n`;
    }
  }
  
  if (counts.SUGGESTION > 0) {
    comment += `### 💡 **SUGGESTION Findings** (Advisory)\n\n`;
    for (const finding of allFindings.filter(f => f.severity === 'SUGGESTION')) {
      comment += `- **\[${finding.rule}\]** \`${finding.file}:${finding.line}\`\n`;
      comment += `  > ${finding.evidence}\n\n`;
    }
  }
  
  if (counts.WAIVED > 0) {
    comment += `### 🏷️ **WAIVED Findings** (label \`${HUMAN_APPROVED_LABEL}\` posed by a human)\n\n`;
    for (const finding of allFindings.filter(f => f.severity === 'WAIVED')) {
      comment += `- **\[${finding.rule}\\]** \`${finding.file}:${finding.line}\`\n`;
      comment += `  > ${finding.evidence}\n\n`;
    }
  }
  
  comment += `---\n`;
  comment += `*Review performed at ${new Date().toISOString()}*\n`;
  comment += `*Agent protocol: [ADR-0011](docs/decisions/adr-0011-agent-protocol.md) | Review checklist: [docs/review-checklist.md](docs/review-checklist.md)*\n`;
  
  // Write comment
  fs.writeFileSync(
    path.join(reviewDir, 'review-comment.md'),
    comment
  );
  
  log(`\nReview Summary:`);
  log(`  BLOCKING: ${counts.BLOCKING}`);
  log(`  TO-FIX: ${counts.TO_FIX}`);
  log(`  SUGGESTION: ${counts.SUGGESTION}`);
  log(`  WAIVED: ${counts.WAIVED}`);
  
  // Print findings for debugging
  if (allFindings.length > 0) {
    log('\nFindings:');
    for (const finding of allFindings) {
      log(`  [${finding.severity}] ${finding.rule} at ${finding.file}:${finding.line}`);
      log(`    ${finding.evidence}`);
    }
  }
  
  // Exit with appropriate code
  if (counts.BLOCKING > 0) {
    log('\n❌ BLOCKING findings detected - Merge blocked');
    process.exit(1);
  } else {
    log('\n✅ No BLOCKING findings - Merge criteria satisfied');
    process.exit(0);
  }
}

/** Entry point of the `review` subcommand (ADR-0025). */
export function run() {
  try {
    runReview();
  } catch (e) {
    error(`Protocol failure: ${e.message}`);
    error(e.stack);
    process.exit(2);
  }
}
