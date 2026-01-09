import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  EdgeCase,
  ImpactAnalysis,
  IssueSeverity,
  ReviewCategory,
  ReviewConfig,
  ReviewIssue,
  ReviewResult,
} from '../types';
import { logger } from '../utils/logger';

/**
 * Code Review Agent
 * Based on proven working minimal test approach
 */
export class CodeReviewAgent {
  private config: ReviewConfig;
  private sessionId?: string;

  constructor(config: Partial<ReviewConfig> = {}) {
    // Simple config - no complex buildConfig
    this.config = {
      model: config.model || 'claude-sonnet-4.5-20250929',
      maxBudgetUsd: config.maxBudgetUsd || 5.0,
      maxFiles: config.maxFiles || 50,
      severityThreshold: config.severityThreshold || 'warning',
      cwd: config.cwd || process.cwd(),
      verbose: config.verbose,
      prContext: config.prContext,
      includePatterns: config.includePatterns,
      excludePatterns: config.excludePatterns,
      rules: config.rules,
    };

    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
  }

  async review(target = '.'): Promise<ReviewResult> {
    const startTime = new Date().toISOString();
    logger.info(`Starting code review for: ${target}`);

    try {
      const prompt = this.buildPrompt(target);
      let resultText = '';
      let totalCostUsd = 0;
      let durationMs = 0;

      // Use exact same approach as working minimal test
      for await (const message of query({
        prompt,
        options: {
          allowedTools: ['Read', 'Glob', 'Grep'],
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          cwd: this.config.cwd,
          maxBudgetUsd: this.config.maxBudgetUsd,
        },
      })) {
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
        summary: this.buildSummary(parsed.issues, parsed.filesReviewed),
        issues: this.filterIssuesBySeverity(parsed.issues),
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
    let prompt =
      'You are an expert code reviewer performing a comprehensive security and quality review.\n\n';

    // Add PR context if available
    if (this.config.prContext) {
      const pr = this.config.prContext;
      prompt += '## Pull Request Context\n';
      if (pr.title) {
        prompt += `Title: ${pr.title}\n`;
      }
      if (pr.description) {
        prompt += `Description: ${pr.description}\n`;
      }
      if (pr.changedFiles && pr.changedFiles.length > 0) {
        prompt += `\nChanged files (${pr.changedFiles.length}):\n`;
        for (const file of pr.changedFiles.slice(0, 15)) {
          prompt += `- ${file}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += `Target: ${target}\n\n`;
    prompt += 'Analyze the codebase for:\n';
    prompt +=
      '1. Security vulnerabilities (SQL injection, XSS, SSRF, hardcoded secrets, authorization bypasses)\n';
    prompt += '2. Potential bugs (null references, type errors, logic errors, race conditions)\n';
    prompt += '3. Performance issues (inefficient loops, memory leaks, N+1 queries)\n';
    prompt += '4. Missing error handling and edge cases\n';
    prompt += '5. Code quality and best practices\n\n';

    if (this.config.prContext?.changedFiles) {
      prompt +=
        'PRIORITY: Focus on the changed files listed above, then analyze their impact on the project.\n\n';
    }

    prompt += `Use Glob and Read tools to explore. Review up to ${this.config.maxFiles || 50} files.\n\n`;
    prompt += 'Provide findings in JSON format:\n';
    prompt += '{\n';
    prompt += `  "summary": { "totalIssues": 0, "high": 0, "medium": 0, "low": 0, "positiveFindings": [], "recommendations": [] },\n`;
    prompt += `  "issues": [{ "severity": "HIGH|MEDIUM|LOW|INFO", "category": "Security|Performance|Bug", "file": "path.ts", "line": 1, "description": "issue", "recommendation": "fix" }],\n`;
    prompt += `  "filesReviewed": []\n`;
    prompt += '}\n\n';
    prompt += 'Begin the review now.';

    return prompt;
  }

  private parseResults(resultText: string): {
    issues: ReviewIssue[];
    filesReviewed: string[];
    positives?: string[];
    recommendations?: string[];
  } {
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const issues = (parsed.issues || []).map((issue: Record<string, unknown>) => ({
          ruleId: 'general',
          severity: this.mapSeverity((issue.severity as string) || 'INFO'),
          category: this.mapCategory((issue.category as string) || ''),
          filePath: (issue.file as string) || (issue.filePath as string) || 'unknown',
          line: issue.line as number | undefined,
          message: (issue.description as string) || (issue.message as string) || '',
          suggestion: (issue.recommendation as string) || (issue.suggestion as string),
        }));

        return {
          issues,
          filesReviewed: (parsed.filesReviewed as string[]) || [],
          positives:
            (parsed.summary?.positiveFindings as string[]) || (parsed.positiveFindings as string[]),
          recommendations:
            (parsed.summary?.recommendations as string[]) || (parsed.recommendations as string[]),
        };
      }
    } catch (_error) {
      logger.warn('Failed to parse JSON');
    }

    return { issues: [], filesReviewed: [] };
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
    const cat = (category || '').toLowerCase();
    if (cat.includes('security')) {
      return 'security';
    }
    if (cat.includes('performance')) {
      return 'performance';
    }
    if (cat.includes('bug')) {
      return 'bugs';
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

  private buildSummary(issues: ReviewIssue[], filesReviewed: string[]): string {
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    return `Reviewed ${filesReviewed.length} file(s). Found ${issues.length} issue(s): ${criticalCount} critical, ${errorCount} errors, ${warningCount} warnings.`;
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
