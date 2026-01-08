/**
 * GitHub Action entry point
 * Handles running the code review agent in a GitHub Actions environment
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { CodeReviewAgent } from './agents/code-reviewer';
import type { PRContext, ReviewConfig, ReviewResult } from './types';
import { exportResults } from './utils/formatter';

async function run(): Promise<void> {
  try {
    // Get inputs
    const apiKey = core.getInput('anthropic-api-key', { required: true });
    const target = core.getInput('target') || '.';
    const model = core.getInput('model') || 'claude-sonnet-4.5-20250929';
    const maxBudget = Number.parseFloat(core.getInput('max-budget') || '5.0');
    const maxFiles = Number.parseInt(core.getInput('max-files') || '50', 10);
    const severityThreshold = core.getInput('severity-threshold') || 'info';
    const includePatterns = core
      .getInput('include-patterns')
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const excludePatterns = core
      .getInput('exclude-patterns')
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const outputFormat = core.getInput('output-format') || 'markdown';
    const failOnCritical = core.getInput('fail-on-critical') === 'true';
    const failOnError = core.getInput('fail-on-error') === 'true';
    const commentOnPr = core.getInput('comment-on-pr') === 'true';

    // Set API key in environment
    process.env.ANTHROPIC_API_KEY = apiKey;

    // Extract PR context from GitHub event
    let prContext: PRContext | undefined;
    if (github.context.payload.pull_request) {
      const pr = github.context.payload.pull_request;

      core.info('Extracting PR context...');

      // Get changed files and diffs from GitHub API
      const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
      let changedFiles: string[] = [];
      let fileDiffs: Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch?: string;
      }> = [];

      if (token) {
        try {
          const octokit = github.getOctokit(token);
          const { data: files } = await octokit.rest.pulls.listFiles({
            ...github.context.repo,
            pull_number: pr.number,
          });

          changedFiles = files.map((f) => f.filename);
          fileDiffs = files.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch,
          }));

          core.info(`Extracted ${fileDiffs.length} file diffs`);
        } catch (error) {
          core.warning(`Failed to fetch changed files: ${error}`);
        }
      }

      prContext = {
        title: pr.title,
        description: pr.body || '',
        number: pr.number,
        author: pr.user?.login || '',
        branch: pr.head?.ref || '',
        baseBranch: pr.base?.ref || '',
        changedFiles,
        fileDiffs,
      };

      core.info(`PR: #${prContext.number} - ${prContext.title}`);
      core.info(
        `Changed files: ${changedFiles.length} (+${fileDiffs.reduce((sum, f) => sum + f.additions, 0)} -${fileDiffs.reduce((sum, f) => sum + f.deletions, 0)} lines)`
      );
    }

    // Build configuration with PR context
    const config: Partial<ReviewConfig> = {
      model,
      maxBudgetUsd: maxBudget,
      maxFiles,
      severityThreshold: severityThreshold as 'info' | 'warning' | 'error' | 'critical',
      includePatterns,
      verbose: false,
      prContext,
    };

    if (excludePatterns.length > 0) {
      config.excludePatterns = excludePatterns;
    }

    core.info('Starting code review...');
    core.info(`Target: ${target}`);
    core.info(`Model: ${model}`);
    core.info(`Max Budget: $${maxBudget}`);

    // Create and run the agent with PR context
    const agent = new CodeReviewAgent(config);
    const result = await agent.review(target);

    // Generate report
    const reportContent = exportResults(result, outputFormat as 'json' | 'markdown' | 'console');
    const reportPath = path.join(process.cwd(), 'code-review-report.md');
    fs.writeFileSync(reportPath, reportContent);

    core.info(`Review completed: ${result.status}`);
    core.info(`Total issues: ${result.stats.totalIssues}`);

    // Set outputs
    core.setOutput('status', result.status);
    core.setOutput('total-issues', result.stats.totalIssues);
    core.setOutput('critical-count', result.stats.issuesBySeverity.critical);
    core.setOutput('error-count', result.stats.issuesBySeverity.error);
    core.setOutput('warning-count', result.stats.issuesBySeverity.warning);
    core.setOutput('report-file', reportPath);

    // Post comment on PR if enabled
    if (commentOnPr && github.context.payload.pull_request) {
      await postPrComment(result, reportContent);
    }

    // Determine if action should fail
    const hasCritical = result.stats.issuesBySeverity.critical > 0;
    const hasErrors = result.stats.issuesBySeverity.error > 0;

    if ((failOnCritical && hasCritical) || (failOnError && hasErrors)) {
      core.setFailed(`Code review found ${hasCritical ? 'critical issues' : 'errors'}`);
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
}

/**
 * Post review results as a PR comment
 */
async function postPrComment(_result: ReviewResult, reportContent: string): Promise<void> {
  try {
    const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
    if (!token) {
      core.warning('GITHUB_TOKEN not provided, skipping PR comment');
      return;
    }

    const octokit = github.getOctokit(token);
    const context = github.context;

    if (!context.payload.pull_request) {
      core.warning('Not a pull request, skipping PR comment');
      return;
    }

    const prNumber = context.payload.pull_request.number;

    // Build comment body
    let commentBody = '## 🤖 AI Code Review Results\n\n';
    commentBody += reportContent;
    commentBody += '\n\n---\n';
    commentBody +=
      '*Review powered by [Code Review Agent](https://github.com/your-org/code-review-agent)*';

    // Post comment
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: prNumber,
      body: commentBody,
    });

    core.info('Posted review results as PR comment');
  } catch (error) {
    core.warning(`Failed to post PR comment: ${error}`);
  }
}

// Run the action
if (require.main === module) {
  run();
}

export { run };
