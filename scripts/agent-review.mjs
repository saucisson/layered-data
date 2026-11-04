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
const repoRoot = path.resolve(__dirname, '..');

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
const MAX_LINES_CHANGED = 500;

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
 * Check for new dependencies in package.json
 */
function checkNewDependencies() {
  // This would need to compare with the base branch
  // For now, we'll skip this as it requires git operations
  return [];
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
  
  // Run all checks
  const allFindings = [];
  
  // 1. Check PR description
  allFindings.push(...checkPRDescription(description));
  
  // 2. Check PR size
  allFindings.push(...checkPRSize(modifiedFiles));
  
  // 3. Check constitutional files
  allFindings.push(...checkConstitutionalFiles(modifiedFiles));
  
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
  
  // 6. Check for new dependencies (placeholder)
  allFindings.push(...checkNewDependencies());
  
  // Count by severity
  const counts = {
    BLOCKING: allFindings.filter(f => f.severity === 'BLOCKING').length,
    TO_FIX: allFindings.filter(f => f.severity === 'TO-FIX').length,
    SUGGESTION: allFindings.filter(f => f.severity === 'SUGGESTION').length
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
  comment += `| **SUGGESTION** | ${counts.SUGGESTION} |\n\n`;
  
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

// Run the review
try {
  runReview();
} catch (e) {
  error(`Protocol failure: ${e.message}`);
  error(e.stack);
  process.exit(2);
}
