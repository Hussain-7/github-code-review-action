import { type Options, type SDKMessage, query } from '@anthropic-ai/claude-agent-sdk';
import { buildConfig, validateConfig } from '../config';
import { defaultHooks } from '../hooks';
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
import { extractPRContextFromGit, loadReviewPrompt } from '../utils/prompt-loader';

/**
 * Main Code Review Agent
 * Handles the orchestration of code reviews using Claude Agent SDK
 */
export class CodeReviewAgent {
  private config: ReviewConfig;
  private sessionId?: string;

  constructor(config: Partial<ReviewConfig> = {}) {
    this.config = buildConfig(config);
    validateConfig(this.config);
  }

  /**
   * Performs a code review on the specified files or directory
   */
  async review(target = '.'): Promise<ReviewResult> {
    const startTime = new Date().toISOString();
    logger.info(`Starting code review for: ${target}`);

    try {
      // Extract PR context from git if not provided
      if (!this.config.prContext && this.config.cwd) {
        const gitContext = await extractPRContextFromGit(this.config.cwd);
        if (gitContext) {
          this.config.prContext = gitContext;
          logger.info('Extracted PR context from git', {
            branch: gitContext.branch,
            changedFiles: gitContext.changedFiles?.length,
          });
        }
      }

      const prompt = this.buildReviewPrompt(target);
      const options = this.buildAgentOptions();

      const issues: ReviewIssue[] = [];
      const filesReviewed: string[] = [];
      const filesSkipped: string[] = [];
      let resultMessage = '';
      let totalCostUsd = 0;
      let durationMs = 0;
      let prIntent: string | undefined = undefined;
      let impactAnalysis: ImpactAnalysis | undefined = undefined;
      let edgeCases: EdgeCase[] = [];
      let missingTests: string[] = [];
      let missingDocumentation: string[] = [];
      let positives: string[] = [];
      let recommendations: string[] = [];

      // Execute the review using Claude Agent SDK
      for await (const message of query({ prompt, options })) {
        this.handleMessage(message);

        // Capture session ID
        if (message.type === 'system' && 'session_id' in message) {
          this.sessionId = message.session_id;
        }

        // Capture final result
        if (message.type === 'result') {
          if ('result' in message) {
            resultMessage = message.result;
          }
          if ('total_cost_usd' in message) {
            totalCostUsd = message.total_cost_usd;
          }
          if ('duration_ms' in message) {
            durationMs = message.duration_ms;
          }
        }
      }

      // Parse the comprehensive review results
      const parsedResults = this.parseReviewResults(resultMessage);
      issues.push(...parsedResults.issues);
      filesReviewed.push(...parsedResults.filesReviewed);
      filesSkipped.push(...parsedResults.filesSkipped);
      prIntent = parsedResults.prIntent;
      impactAnalysis = parsedResults.impactAnalysis;
      edgeCases = parsedResults.edgeCases || [];
      missingTests = parsedResults.missingTests || [];
      missingDocumentation = parsedResults.missingDocumentation || [];
      positives = parsedResults.positives || [];
      recommendations = parsedResults.recommendations || [];

      // Build the final result
      const result: ReviewResult = {
        status: this.determineStatus(issues),
        summary: this.buildSummary(issues, filesReviewed, prIntent),
        prIntent,
        impactAnalysis,
        issues: this.filterIssuesBySeverity(issues),
        edgeCases,
        missingTests,
        missingDocumentation,
        positives,
        recommendations,
        filesReviewed,
        filesSkipped,
        stats: this.buildStats(issues, filesReviewed, totalCostUsd, durationMs),
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
        prIntent: prIntent ? 'captured' : 'not found',
      });

      return result;
    } catch (error) {
      logger.error('Code review failed', { error });
      throw error;
    }
  }

  /**
   * Builds the comprehensive review prompt
   */
  private buildReviewPrompt(target: string): string {
    const rules = this.config.rules || [];

    return loadReviewPrompt(
      target,
      rules,
      this.config.prContext,
      this.config.includePatterns,
      this.config.excludePatterns,
      this.config.maxFiles
    );
  }

  /**
   * Builds the agent options for the Claude Agent SDK
   */
  private buildAgentOptions(): Options {
    return {
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      model: this.config.model,
      maxBudgetUsd: this.config.maxBudgetUsd,
      cwd: this.config.cwd,
      hooks: defaultHooks,
      includePartialMessages: false,
    };
  }

  /**
   * Handles messages from the agent
   */
  private handleMessage(message: SDKMessage): void {
    if (message.type === 'assistant' && 'message' in message) {
      const content = message.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if ('text' in block && this.config.verbose) {
            logger.debug('Agent message', { text: block.text });
          }
        }
      }
    }
  }

  /**
   * Parses the comprehensive review results from the agent's response
   */
  private parseReviewResults(resultMessage: string): {
    issues: ReviewIssue[];
    filesReviewed: string[];
    filesSkipped: string[];
    prIntent?: string;
    impactAnalysis?: ImpactAnalysis;
    edgeCases?: EdgeCase[];
    missingTests?: string[];
    missingDocumentation?: string[];
    positives?: string[];
    recommendations?: string[];
  } {
    try {
      // Try to extract JSON from the result message
      const jsonMatch = resultMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          issues: parsed.issues || [],
          filesReviewed: parsed.filesReviewed || [],
          filesSkipped: parsed.filesSkipped || [],
          prIntent: parsed.prIntent,
          impactAnalysis: parsed.impactAnalysis,
          edgeCases: parsed.edgeCases,
          missingTests: parsed.missingTests,
          missingDocumentation: parsed.missingDocumentation,
          positives: parsed.positives,
          recommendations: parsed.recommendations,
        };
      }
    } catch (_error) {
      logger.warn('Failed to parse structured results, using fallback parsing');
    }

    // Fallback: manual parsing if JSON parsing fails
    return {
      issues: [],
      filesReviewed: [],
      filesSkipped: [],
    };
  }

  /**
   * Filters issues based on severity threshold
   */
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

  /**
   * Determines the overall review status
   */
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

  /**
   * Builds a summary message
   */
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

  /**
   * Builds statistics for the review
   */
  private buildStats(
    issues: ReviewIssue[],
    filesReviewed: string[],
    totalCostUsd: number,
    durationMs: number
  ): ReviewStats {
    const issuesBySeverity: Record<IssueSeverity, number> = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
    };

    const issuesByCategory: Record<ReviewCategory, number> = {
      security: 0,
      performance: 0,
      maintainability: 0,
      'best-practices': 0,
      bugs: 0,
      style: 0,
      documentation: 0,
    };

    for (const issue of issues) {
      issuesBySeverity[issue.severity]++;
      issuesByCategory[issue.category]++;
    }

    return {
      totalFiles: filesReviewed.length,
      totalIssues: issues.length,
      issuesBySeverity,
      issuesByCategory,
      totalCostUsd,
      durationMs,
    };
  }

  /**
   * Gets the current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }
}
