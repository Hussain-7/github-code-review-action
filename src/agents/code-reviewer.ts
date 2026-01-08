import { type Options, query } from '@anthropic-ai/claude-agent-sdk';
import { buildConfig, validateConfig } from '../config';
import type {
  EdgeCase,
  ImpactAnalysis,
  IssueSeverity,
  ReviewCategory,
  ReviewConfig,
  ReviewIssue,
  ReviewResult,
  ReviewStats,
} from '../types';
import { logger } from '../utils/logger';

/**
 * Main Code Review Agent
 * Simplified, reliable implementation based on proven working approach
 */
export class CodeReviewAgent {
  private config: ReviewConfig;
  private sessionId?: string;

  constructor(config: Partial<ReviewConfig> = {}) {
    this.config = buildConfig(config);
    validateConfig(this.config);
  }

  async review(target = '.'): Promise<ReviewResult> {
    const startTime = new Date().toISOString();
    logger.info(`Starting code review for: ${target}`);

    try {
      const prompt = this.buildPrompt(target);
      const options = this.buildOptions();

      let resultText = '';
      let totalCostUsd = 0;
      let durationMs = 0;

      for await (const message of query({ prompt, options })) {
        if (message.type === 'system' && 'session_id' in message) {
          this.sessionId = message.session_id;
        }

        if (message.type === 'result') {
          if ('result' in message) {
            resultText = message.result;
          }
          if ('total_cost_usd' in message) {
            totalCostUsd = message.total_cost_usd;
          }
          if ('duration_ms' in message) {
            durationMs = message.duration_ms;
          }
        }
      }

      const parsed = this.parseResults(resultText);

      const result: ReviewResult = {
        status: this.determineStatus(parsed.issues),
        summary: this.buildSummary(parsed.issues, parsed.filesReviewed, parsed.prIntent),
        prIntent: parsed.prIntent,
        impactAnalysis: parsed.impactAnalysis,
        issues: this.filterIssuesBySeverity(parsed.issues),
        edgeCases: parsed.edgeCases,
        missingTests: parsed.missingTests,
        missingDocumentation: parsed.missingDocumentation,
        positives: parsed.positives,
        recommendations: parsed.recommendations,
        filesReviewed: parsed.filesReviewed,
        filesSkipped: [],
        stats: {
          totalFiles: parsed.filesReviewed.length,
          totalIssues: parsed.issues.length,
          issuesBySeverity: this.countBySeverity(parsed.issues),
          issuesByCategory: this.countByCategory(parsed.issues),
          totalCostUsd,
          durationMs,
        },
        metadata: {
          startTime,
          endTime: new Date().toISOString(),
          model: this.config.model || 'claude-sonnet-4.5-20250929',
          sessionId: this.sessionId || 'unknown',
          config: this.config,
        },
      };

      logger.info('Code review completed', {
        totalIssues: result.stats.totalIssues,
        filesReviewed: result.stats.totalFiles,
      });

      return result;
    } catch (error) {
      logger.error('Code review failed', { error });
      throw error;
    }
  }

  private buildPrompt(target: string): string {
    let prompt = 'You are an expert code reviewer. ';

    // Add PR context if available
    if (this.config.prContext) {
      const pr = this.config.prContext;
      prompt += '\n\n## Pull Request Context\n';
      if (pr.title) {
        prompt += `**Title**: ${pr.title}\n`;
      }
      if (pr.description) {
        prompt += `**Description**: ${pr.description}\n`;
      }
      if (pr.number) {
        prompt += `**PR #**: ${pr.number}\n`;
      }
      if (pr.author) {
        prompt += `**Author**: ${pr.author}\n`;
      }
      if (pr.branch && pr.baseBranch) {
        prompt += `**Branch**: ${pr.branch} → ${pr.baseBranch}\n`;
      }

      // Include file diffs showing exact changes
      if (pr.fileDiffs && pr.fileDiffs.length > 0) {
        prompt += `\n**Changes Made** (${pr.fileDiffs.length} files):\n`;

        for (const diff of pr.fileDiffs.slice(0, 15)) {
          prompt += `\n### ${diff.filename} (${diff.status})\n`;
          prompt += `+${diff.additions} -${diff.deletions} lines\n`;

          if (diff.patch) {
            prompt += '```diff\n';
            prompt += diff.patch.substring(0, 2000);
            if (diff.patch.length > 2000) {
              prompt += '\n... (diff truncated, use Read tool to see full file)';
            }
            prompt += '\n```\n';
          }
        }

        if (pr.fileDiffs.length > 15) {
          prompt += `\n... and ${pr.fileDiffs.length - 15} more files (use Glob/Read to explore)\n`;
        }
      } else if (pr.changedFiles) {
        prompt += `\n**Changed Files**: ${pr.changedFiles.join(', ')}\n`;
      }

      prompt +=
        '\n**Your Task**: Review the diffs above. Understand what this PR is trying to achieve, verify it works correctly, and check for:\n';
      prompt += '- Security vulnerabilities in the changed lines\n';
      prompt += '- Bugs or logic errors in the modifications\n';
      prompt += '- Impact on files that import/use the changed code\n';
      prompt += '- Missing tests for the new/changed functionality\n';
      prompt += '- Edge cases not handled by the changes\n\n';
    }

    const rules = this.config.rules || [];
    const enabledRules = rules.filter((r) => r.enabled);

    prompt += `\n## Review Task

Perform a comprehensive code review of: ${target}

Focus on:
1. Security vulnerabilities (SQL injection, XSS, SSRF, authorization bypasses, hardcoded secrets)
2. Potential bugs (null references, type errors, logic errors, race conditions)
3. Performance issues (inefficient loops, memory leaks, N+1 queries)
4. Missing error handling and edge cases
5. Code quality and best practices

${
  enabledRules.length > 0
    ? `\nApply these rules:\n${enabledRules.map((r) => `- [${r.severity.toUpperCase()}] ${r.name}: ${r.description}`).join('\n')}`
    : ''
}

${
  this.config.prContext?.changedFiles
    ? `\n**Priority**: Focus on changed files: ${this.config.prContext.changedFiles.join(', ')}, but also analyze their impact on the project.`
    : ''
}

Use Glob and Read tools to explore the codebase. Review up to ${this.config.maxFiles || 30} files.

Provide findings in JSON format:
\`\`\`json
{
  "prIntent": "What this PR aims to achieve (if applicable)",
  "summary": "Overall assessment",
  "impactAnalysis": {
    "breakingChanges": [],
    "affectedFiles": [],
    "integrationImpact": "description",
    "performanceImpact": "description",
    "securityImpact": "description"
  },
  "issues": [
    {
      "severity": "HIGH|MEDIUM|LOW|INFO",
      "category": "Security|Performance|Bug|Code Quality",
      "file": "path/to/file.ts",
      "line": 42,
      "description": "Issue description",
      "recommendation": "How to fix"
    }
  ],
  "edgeCases": [{"scenario": "edge case", "handled": false, "recommendation": "fix"}],
  "missingTests": ["test scenarios needed"],
  "missingDocumentation": ["docs to add"],
  "positives": ["good practices found"],
  "recommendations": ["prioritized improvements"],
  "filesReviewed": ["files", "reviewed"]
}
\`\`\`

Begin the review now.`;

    return prompt;
  }

  private buildOptions(): Options {
    return {
      allowedTools: ['Read', 'Glob', 'Grep'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      model: this.config.model,
      maxBudgetUsd: this.config.maxBudgetUsd,
      cwd: this.config.cwd,
    };
  }

  private parseResults(resultText: string): {
    summary?: string;
    prIntent?: string;
    impactAnalysis?: ImpactAnalysis;
    issues: ReviewIssue[];
    filesReviewed: string[];
    edgeCases?: EdgeCase[];
    missingTests?: string[];
    missingDocumentation?: string[];
    positives?: string[];
    recommendations?: string[];
  } {
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const issues = (parsed.issues || []).map((issue: Record<string, unknown>) => ({
          ruleId: (issue.ruleId as string) || 'general',
          severity: this.mapSeverity((issue.severity as string) || 'INFO'),
          category: this.mapCategory((issue.category as string) || ''),
          filePath: (issue.file as string) || (issue.filePath as string) || 'unknown',
          line: issue.line as number | undefined,
          message: (issue.description as string) || (issue.message as string),
          suggestion: (issue.recommendation as string) || (issue.suggestion as string),
          impact: issue.impact as string | undefined,
        }));

        return {
          summary: parsed.summary as string | undefined,
          prIntent: parsed.prIntent as string | undefined,
          impactAnalysis: parsed.impactAnalysis as ImpactAnalysis | undefined,
          issues,
          filesReviewed: (parsed.filesReviewed as string[]) || [],
          edgeCases: parsed.edgeCases as EdgeCase[] | undefined,
          missingTests: parsed.missingTests as string[] | undefined,
          missingDocumentation: parsed.missingDocumentation as string[] | undefined,
          positives: (parsed.positiveFindings as string[]) || (parsed.positives as string[]),
          recommendations: parsed.recommendations as string[] | undefined,
        };
      }
    } catch (_error) {
      logger.warn('Failed to parse JSON, returning empty results');
    }

    return {
      issues: [],
      filesReviewed: [],
    };
  }

  private mapSeverity(severity: string): IssueSeverity {
    const s = severity.toUpperCase();
    if (s === 'HIGH' || s === 'CRITICAL') {
      return 'critical';
    }
    if (s === 'MEDIUM' || s === 'ERROR') {
      return 'error';
    }
    if (s === 'LOW' || s === 'WARNING') {
      return 'warning';
    }
    return 'info';
  }

  private mapCategory(category: string): ReviewCategory {
    if (!category) {
      return 'best-practices';
    }
    const cat = category.toLowerCase();
    if (cat.includes('security')) {
      return 'security';
    }
    if (cat.includes('performance')) {
      return 'performance';
    }
    if (cat.includes('bug')) {
      return 'bugs';
    }
    if (cat.includes('maintain')) {
      return 'maintainability';
    }
    if (cat.includes('doc')) {
      return 'documentation';
    }
    if (cat.includes('style')) {
      return 'style';
    }
    return 'best-practices';
  }

  private filterIssuesBySeverity(issues: ReviewIssue[]): ReviewIssue[] {
    if (!this.config.severityThreshold) {
      return issues;
    }

    const severityLevels: IssueSeverity[] = ['info', 'warning', 'error', 'critical'];
    const thresholdIndex = severityLevels.indexOf(this.config.severityThreshold);

    return issues.filter((issue) => {
      const issueIndex = severityLevels.indexOf(issue.severity);
      return issueIndex >= thresholdIndex;
    });
  }

  private determineStatus(issues: ReviewIssue[]): 'success' | 'failure' | 'partial' {
    const hasCritical = issues.some((i) => i.severity === 'critical');
    const hasErrors = issues.some((i) => i.severity === 'error');
    if (hasCritical) {
      return 'failure';
    }
    if (hasErrors) {
      return 'partial';
    }
    return 'success';
  }

  private buildSummary(issues: ReviewIssue[], filesReviewed: string[], prIntent?: string): string {
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    let summary = '';

    if (prIntent) {
      summary += `PR Intent: ${prIntent}\n\n`;
    }

    summary += `Reviewed ${filesReviewed.length} file(s). `;
    summary += `Found ${issues.length} issue(s): `;
    summary += `${criticalCount} critical, ${errorCount} errors, ${warningCount} warnings.`;

    return summary;
  }

  private countBySeverity(issues: ReviewIssue[]): Record<IssueSeverity, number> {
    return {
      critical: issues.filter((i) => i.severity === 'critical').length,
      error: issues.filter((i) => i.severity === 'error').length,
      warning: issues.filter((i) => i.severity === 'warning').length,
      info: issues.filter((i) => i.severity === 'info').length,
    };
  }

  private countByCategory(issues: ReviewIssue[]): Record<ReviewCategory, number> {
    const counts: Record<ReviewCategory, number> = {
      security: 0,
      performance: 0,
      bugs: 0,
      'best-practices': 0,
      maintainability: 0,
      documentation: 0,
      style: 0,
    };

    for (const issue of issues) {
      counts[issue.category] = (counts[issue.category] || 0) + 1;
    }

    return counts;
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }
}
