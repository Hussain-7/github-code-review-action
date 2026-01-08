import { type IssueSeverity, ReviewIssue, type ReviewResult } from '../types';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Get color for severity level
 */
function getSeverityColor(severity: IssueSeverity): string {
  switch (severity) {
    case 'critical':
      return colors.red;
    case 'error':
      return colors.red;
    case 'warning':
      return colors.yellow;
    case 'info':
      return colors.blue;
    default:
      return colors.reset;
  }
}

/**
 * Get icon for severity level
 */
function getSeverityIcon(severity: IssueSeverity): string {
  switch (severity) {
    case 'critical':
      return '\u2718'; // ✘
    case 'error':
      return '\u2718'; // ✘
    case 'warning':
      return '\u26A0'; // ⚠
    case 'info':
      return '\u2139'; // ℹ
    default:
      return '\u2022'; // •
  }
}

/**
 * Format review result for console output
 */
export function formatReviewResult(result: ReviewResult): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${colors.bright}${'='.repeat(80)}${colors.reset}`);
  lines.push(`${colors.bright}${colors.cyan}  CODE REVIEW RESULTS${colors.reset}`);
  lines.push(`${colors.bright}${'='.repeat(80)}${colors.reset}`);
  lines.push('');

  // Summary
  const statusColor =
    result.status === 'success'
      ? colors.green
      : result.status === 'failure'
        ? colors.red
        : colors.yellow;

  lines.push(
    `${colors.bright}Status:${colors.reset} ${statusColor}${result.status.toUpperCase()}${colors.reset}`
  );
  lines.push(`${colors.bright}Summary:${colors.reset} ${result.summary}`);
  lines.push('');

  // Statistics
  lines.push(`${colors.bright}Statistics:${colors.reset}`);
  lines.push(`  Files Reviewed: ${result.stats.totalFiles}`);
  lines.push(`  Total Issues: ${result.stats.totalIssues}`);
  lines.push(`  Duration: ${(result.stats.durationMs / 1000).toFixed(2)}s`);
  lines.push(`  Cost: $${result.stats.totalCostUsd.toFixed(4)}`);
  lines.push('');

  // Issues by severity
  if (result.stats.totalIssues > 0) {
    lines.push(`${colors.bright}Issues by Severity:${colors.reset}`);
    lines.push(`  ${colors.red}Critical: ${result.stats.issuesBySeverity.critical}${colors.reset}`);
    lines.push(`  ${colors.red}Errors: ${result.stats.issuesBySeverity.error}${colors.reset}`);
    lines.push(
      `  ${colors.yellow}Warnings: ${result.stats.issuesBySeverity.warning}${colors.reset}`
    );
    lines.push(`  ${colors.blue}Info: ${result.stats.issuesBySeverity.info}${colors.reset}`);
    lines.push('');
  }

  // Detailed issues
  if (result.issues.length > 0) {
    lines.push(`${colors.bright}Detailed Issues:${colors.reset}`);
    lines.push('');

    result.issues.forEach((issue, index) => {
      const color = getSeverityColor(issue.severity);
      const icon = getSeverityIcon(issue.severity);

      lines.push(`${color}${icon} Issue #${index + 1}${colors.reset}`);
      lines.push(`  ${colors.bright}Rule:${colors.reset} ${issue.ruleId}`);
      lines.push(
        `  ${colors.bright}Severity:${colors.reset} ${color}${issue.severity.toUpperCase()}${colors.reset}`
      );
      lines.push(`  ${colors.bright}File:${colors.reset} ${issue.filePath}`);
      if (issue.line) {
        lines.push(`  ${colors.bright}Line:${colors.reset} ${issue.line}`);
      }
      lines.push(`  ${colors.bright}Message:${colors.reset} ${issue.message}`);
      if (issue.suggestion) {
        lines.push(
          `  ${colors.bright}Suggestion:${colors.reset} ${colors.green}${issue.suggestion}${colors.reset}`
        );
      }
      if (issue.snippet) {
        lines.push(`  ${colors.bright}Code:${colors.reset}`);
        lines.push(`    ${colors.gray}${issue.snippet}${colors.reset}`);
      }
      lines.push('');
    });
  } else {
    lines.push(`${colors.green}No issues found!${colors.reset}`);
    lines.push('');
  }

  // Footer
  lines.push(`${colors.bright}${'='.repeat(80)}${colors.reset}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format review result as JSON
 */
export function formatReviewResultAsJson(result: ReviewResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format review result as Markdown
 */
export function formatReviewResultAsMarkdown(result: ReviewResult): string {
  const lines: string[] = [];

  lines.push('# Code Review Results');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Status**: ${result.status.toUpperCase()}`);
  lines.push(`- **Summary**: ${result.summary}`);
  lines.push(`- **Files Reviewed**: ${result.stats.totalFiles}`);
  lines.push(`- **Total Issues**: ${result.stats.totalIssues}`);
  lines.push(`- **Duration**: ${(result.stats.durationMs / 1000).toFixed(2)}s`);
  lines.push(`- **Cost**: $${result.stats.totalCostUsd.toFixed(4)}`);
  lines.push('');

  // Issues by severity
  if (result.stats.totalIssues > 0) {
    lines.push('## Issues by Severity');
    lines.push('');
    lines.push(`- Critical: ${result.stats.issuesBySeverity.critical}`);
    lines.push(`- Errors: ${result.stats.issuesBySeverity.error}`);
    lines.push(`- Warnings: ${result.stats.issuesBySeverity.warning}`);
    lines.push(`- Info: ${result.stats.issuesBySeverity.info}`);
    lines.push('');
  }

  // Detailed issues
  if (result.issues.length > 0) {
    lines.push('## Detailed Issues');
    lines.push('');

    result.issues.forEach((issue, index) => {
      lines.push(`### Issue #${index + 1}`);
      lines.push('');
      lines.push(`- **Rule**: ${issue.ruleId}`);
      lines.push(`- **Severity**: ${issue.severity.toUpperCase()}`);
      lines.push(`- **Category**: ${issue.category}`);
      lines.push(`- **File**: \`${issue.filePath}\``);
      if (issue.line) {
        lines.push(`- **Line**: ${issue.line}`);
      }
      lines.push(`- **Message**: ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`- **Suggestion**: ${issue.suggestion}`);
      }
      if (issue.snippet) {
        lines.push('');
        lines.push('**Code:**');
        lines.push('```');
        lines.push(issue.snippet);
        lines.push('```');
      }
      lines.push('');
    });
  } else {
    lines.push('No issues found!');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export results to a file
 */
export function exportResults(
  result: ReviewResult,
  format: 'json' | 'markdown' | 'console' = 'json'
): string {
  switch (format) {
    case 'json':
      return formatReviewResultAsJson(result);
    case 'markdown':
      return formatReviewResultAsMarkdown(result);
    case 'console':
      return formatReviewResult(result);
    default:
      return formatReviewResultAsJson(result);
  }
}
