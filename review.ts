#!/usr/bin/env tsx
/**
 * Local Code Review Script
 *
 * Usage:
 *   pnpm tsx review.ts <path-to-repo> [options]
 *
 * Examples:
 *   pnpm tsx review.ts .
 *   pnpm tsx review.ts ./src
 *   pnpm tsx review.ts /path/to/another/repo
 *   pnpm tsx review.ts /path/to/repo --budget 10
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config();

// Parse command line arguments
const targetPath = process.argv[2] || '.';
const budgetArg = process.argv.indexOf('--budget');
const maxBudget = budgetArg > -1 ? Number.parseFloat(process.argv[budgetArg + 1]) : 5.0;

const targetRepo = path.resolve(targetPath);

async function reviewCode() {
  console.log('🚀 AI Code Review Agent');
  console.log('='.repeat(80));
  console.log(`Target: ${targetRepo}`);
  console.log(`Budget: $${maxBudget.toFixed(2)}`);
  console.log('='.repeat(80));
  console.log('\n⚙️  Analyzing codebase...\n');

  const prompt = `You are an expert code reviewer performing a comprehensive security and quality review.

## Review Task
Target: ${targetRepo}

Analyze the codebase for:

### 1. Security Vulnerabilities (HIGH PRIORITY)
- SQL injection, XSS, SSRF, command injection
- Authorization bypasses (users accessing others' data without permission)
- Hardcoded secrets, API keys, or credentials
- Timing attack vulnerabilities in authentication/authorization
- Missing input validation or size limits
- Missing rate limiting on expensive/AI-powered endpoints
- Insecure direct object references
- Path traversal vulnerabilities

### 2. Bugs & Edge Cases
- Null/undefined reference errors
- Type errors and incorrect type coercions
- Logic errors in conditionals or loops
- Race conditions in async code
- Missing or incorrect error handling
- Unhandled edge cases: empty arrays, null values, large inputs, concurrent access
- Off-by-one errors
- Incomplete TODO items that affect functionality

### 3. Performance Issues
- Inefficient loops or algorithms
- N+1 query problems
- Memory leaks or unbounded growth
- Unnecessary synchronous operations
- Missing pagination or limits

### 4. Code Quality
- Missing tests for critical functionality
- Missing or outdated documentation
- Code complexity issues (functions too long/complex)
- Violations of DRY principle
- Inconsistent error handling patterns

## Instructions

1. Use **Glob** to find TypeScript/JavaScript files (prioritize src/, lib/, app/ directories)
2. Use **Read** to examine code in detail
3. Use **Grep** to find patterns, imports, and dependencies
4. Review up to 25 important files
5. Focus on security-critical code: authentication, authorization, API routes, data access

## Output Format

Provide comprehensive findings in JSON format:

\`\`\`json
{
  "summary": {
    "totalIssues": 21,
    "critical": 0,
    "high": 3,
    "medium": 11,
    "low": 5,
    "info": 2,
    "positiveFindings": ["Good practices found"],
    "recommendations": ["Prioritized improvements - most critical first"]
  },
  "issues": [
    {
      "severity": "HIGH|MEDIUM|LOW|INFO",
      "category": "Security|Performance|Bug|Code Quality",
      "file": "path/to/file.ts",
      "line": 42,
      "description": "Clear, detailed description of the issue and its impact",
      "recommendation": "Specific, actionable fix with code example if applicable"
    }
  ],
  "filesReviewed": ["list", "of", "reviewed", "files"]
}
\`\`\`

**Important**: Be thorough but focus on real issues. Prioritize security and correctness. Provide specific, actionable recommendations.

Begin the comprehensive review now.`;

  let resultText = '';
  let cost = 0;
  let duration = 0;

  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        cwd: targetRepo,
        maxBudgetUsd: maxBudget,
      },
    })) {
      if (message.type === 'result') {
        if ('result' in message) resultText = message.result;
        if ('total_cost_usd' in message) cost = message.total_cost_usd;
        if ('duration_ms' in message) duration = message.duration_ms;
      }
    }

    // Parse results
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('\n📄 Review Results:\n');
      console.log(resultText);
      return;
    }

    const result = JSON.parse(jsonMatch[0]);

    // Display summary
    console.log('\n📊 Review Complete!');
    console.log('='.repeat(80));
    console.log(`Files Reviewed: ${result.filesReviewed?.length || 0}`);
    console.log(`Total Issues: ${result.summary?.totalIssues || result.issues?.length || 0}`);
    if (result.summary) {
      console.log(`  Critical: ${result.summary.critical || 0}`);
      console.log(`  High: ${result.summary.high || 0}`);
      console.log(`  Medium: ${result.summary.medium || 0}`);
      console.log(`  Low: ${result.summary.low || 0}`);
      console.log(`  Info: ${result.summary.info || 0}`);
    }
    console.log(`Cost: $${cost.toFixed(4)}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(80));

    // Save reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(process.cwd(), 'reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Save JSON report
    const jsonPath = path.join(reportsDir, `review-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    // Save markdown report
    const mdPath = path.join(reportsDir, `review-${timestamp}.md`);
    const markdown = generateMarkdown(result, targetRepo, cost, duration);
    fs.writeFileSync(mdPath, markdown);

    console.log(`\n📄 Reports saved:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   Markdown: ${mdPath}`);

    // Display top issues
    if (result.issues && result.issues.length > 0) {
      console.log('\n🔍 Top Issues:\n');
      const topIssues = result.issues
        .sort((a: any, b: any) => {
          const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
          return (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999);
        })
        .slice(0, 10);

      topIssues.forEach((issue: any, idx: number) => {
        const icon = issue.severity === 'HIGH' ? '🔴' : issue.severity === 'MEDIUM' ? '🟡' : '🔵';
        console.log(`${icon} ${idx + 1}. [${issue.severity}] ${issue.description}`);
        console.log(`   File: ${issue.file}`);
        if (issue.recommendation) {
          console.log(`   Fix: ${issue.recommendation.substring(0, 100)}${issue.recommendation.length > 100 ? '...' : ''}`);
        }
        console.log('');
      });

      if (result.issues.length > 10) {
        console.log(`   ... and ${result.issues.length - 10} more issues (see full report)\n`);
      }
    } else {
      console.log('\n✅ No issues found! Code looks great!\n');
    }

    // Display recommendations
    if (result.summary?.recommendations?.length > 0 || result.recommendations?.length > 0) {
      const recs = result.summary?.recommendations || result.recommendations;
      console.log('💡 Top Recommendations:\n');
      recs.slice(0, 5).forEach((rec: string, idx: number) => {
        console.log(`${idx + 1}. ${rec}`);
      });
      console.log('');
    }

    console.log('🎉 Review completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Review failed:', error);
    process.exit(1);
  }
}

function generateMarkdown(
  result: any,
  targetRepo: string,
  cost: number,
  duration: number
): string {
  let md = `# Code Review Report\n\n`;
  md += `**Target**: ${targetRepo}\n`;
  md += `**Date**: ${new Date().toISOString()}\n`;
  md += `**Cost**: $${cost.toFixed(4)}\n`;
  md += `**Duration**: ${(duration / 1000).toFixed(2)}s\n\n`;

  md += `## Summary\n\n`;
  md += `- **Files Reviewed**: ${result.filesReviewed?.length || 0}\n`;
  md += `- **Total Issues**: ${result.summary?.totalIssues || result.issues?.length || 0}\n`;

  if (result.summary) {
    md += `  - Critical: ${result.summary.critical || 0}\n`;
    md += `  - High: ${result.summary.high || 0}\n`;
    md += `  - Medium: ${result.summary.medium || 0}\n`;
    md += `  - Low: ${result.summary.low || 0}\n`;
    md += `  - Info: ${result.summary.info || 0}\n`;
  }

  if (result.issues && result.issues.length > 0) {
    md += `\n## Issues Found\n\n`;
    result.issues.forEach((issue: any, idx: number) => {
      md += `### ${idx + 1}. [${issue.severity}] ${issue.category}\n\n`;
      md += `**File**: \`${issue.file}\`${issue.line ? ` (Line ${issue.line})` : ''}\n\n`;
      md += `**Issue**: ${issue.description}\n\n`;
      if (issue.recommendation) {
        md += `**Recommendation**: ${issue.recommendation}\n\n`;
      }
      md += `---\n\n`;
    });
  }

  if (result.summary?.positiveFindings?.length > 0) {
    md += `## ✅ Positive Findings\n\n`;
    result.summary.positiveFindings.forEach((positive: string) => {
      md += `- ${positive}\n`;
    });
    md += `\n`;
  }

  if (result.summary?.recommendations?.length > 0 || result.recommendations?.length > 0) {
    const recs = result.summary?.recommendations || result.recommendations;
    md += `## 💡 Recommendations\n\n`;
    recs.forEach((rec: string, idx: number) => {
      md += `${idx + 1}. ${rec}\n`;
    });
    md += `\n`;
  }

  if (result.filesReviewed && result.filesReviewed.length > 0) {
    md += `## Files Reviewed\n\n`;
    result.filesReviewed.forEach((file: string) => {
      md += `- ${file}\n`;
    });
  }

  return md;
}

reviewCode();
