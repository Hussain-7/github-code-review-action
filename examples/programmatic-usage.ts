/**
 * Example: Programmatic usage of the Code Review Agent
 */

import { CodeReviewAgent, ReviewConfig, ReviewRule } from '../src';
import { exportResults } from '../src/utils/formatter';
import * as fs from 'fs';

async function basicReview() {
  console.log('Running basic code review...\n');

  const agent = new CodeReviewAgent({
    model: 'claude-sonnet-4.5-20250929',
    maxBudgetUsd: 5.0,
    severityThreshold: 'warning',
  });

  const result = await agent.review('./src');

  console.log(`Status: ${result.status}`);
  console.log(`Total Issues: ${result.stats.totalIssues}`);
  console.log(`Files Reviewed: ${result.stats.totalFiles}`);
}

async function advancedReview() {
  console.log('Running advanced code review with custom rules...\n');

  // Define custom rules
  const customRules: ReviewRule[] = [
    {
      id: 'custom-react-hooks',
      name: 'React Hooks Best Practices',
      description: 'Ensure proper React hooks usage and dependencies',
      severity: 'error',
      category: 'best-practices',
      enabled: true,
    },
    {
      id: 'custom-typescript-strict',
      name: 'TypeScript Strict Mode',
      description: 'Enforce strict TypeScript usage',
      severity: 'warning',
      category: 'best-practices',
      enabled: true,
    },
  ];

  const config: Partial<ReviewConfig> = {
    model: 'claude-opus-4.5-20251101', // Use more capable model
    maxBudgetUsd: 10.0,
    maxFiles: 100,
    includePatterns: ['**/*.tsx', '**/*.ts'],
    excludePatterns: ['**/*.test.ts', '**/*.spec.ts', 'node_modules/**'],
    severityThreshold: 'info',
    rules: customRules,
    verbose: true,
  };

  const agent = new CodeReviewAgent(config);
  const result = await agent.review('./src');

  // Export results in multiple formats
  const jsonReport = exportResults(result, 'json');
  fs.writeFileSync('review-report.json', jsonReport);

  const markdownReport = exportResults(result, 'markdown');
  fs.writeFileSync('review-report.md', markdownReport);

  console.log(`Session ID: ${agent.getSessionId()}`);
  console.log(`Reports saved to review-report.json and review-report.md`);
}

async function securityFocusedReview() {
  console.log('Running security-focused review...\n');

  const config: Partial<ReviewConfig> = {
    model: 'claude-opus-4.5-20251101',
    maxBudgetUsd: 15.0,
    includePatterns: ['**/*.ts', '**/*.js', '**/*.py'],
    severityThreshold: 'critical', // Only show critical security issues
    verbose: false,
  };

  const agent = new CodeReviewAgent(config);
  const result = await agent.review('./src');

  // Check for critical security issues
  const criticalIssues = result.issues.filter((i) => i.severity === 'critical');

  if (criticalIssues.length > 0) {
    console.error(`Found ${criticalIssues.length} critical security issues!`);
    criticalIssues.forEach((issue) => {
      console.error(`- ${issue.filePath}:${issue.line} - ${issue.message}`);
    });
    process.exit(1);
  } else {
    console.log('No critical security issues found.');
  }
}

async function continuousIntegrationReview() {
  console.log('Running CI-friendly review...\n');

  const config: Partial<ReviewConfig> = {
    model: 'claude-sonnet-4.5-20250929',
    maxBudgetUsd: 3.0, // Lower budget for frequent CI runs
    maxFiles: 30, // Limit file count
    severityThreshold: 'error', // Only fail on errors or critical
    verbose: false, // Less output for CI logs
  };

  const agent = new CodeReviewAgent(config);
  const result = await agent.review(process.env.CI_TARGET || './src');

  // Generate report
  const report = exportResults(result, 'markdown');
  fs.writeFileSync('ci-review-report.md', report);

  // Exit with appropriate code for CI
  if (result.status === 'failure') {
    console.error('Code review failed with critical issues');
    process.exit(1);
  } else if (result.status === 'partial') {
    console.warn('Code review found some issues');
    process.exit(0); // Don't fail CI on warnings
  } else {
    console.log('Code review passed successfully');
    process.exit(0);
  }
}

// Run based on command line argument
const mode = process.argv[2] || 'basic';

switch (mode) {
  case 'basic':
    basicReview().catch(console.error);
    break;
  case 'advanced':
    advancedReview().catch(console.error);
    break;
  case 'security':
    securityFocusedReview().catch(console.error);
    break;
  case 'ci':
    continuousIntegrationReview().catch(console.error);
    break;
  default:
    console.error('Unknown mode. Use: basic, advanced, security, or ci');
    process.exit(1);
}
