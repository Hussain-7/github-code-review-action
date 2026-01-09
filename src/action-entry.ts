/**
 * GitHub Action Entry Point
 * This file is bundled into dist/index.js for the GitHub Action
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { CodeReviewAgent } from './agents/code-reviewer';
import { exportResults } from './utils/formatter';

async function run(): Promise<void> {
  try {
    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      core.setFailed('ANTHROPIC_API_KEY environment variable is required');
      return;
    }

    core.info('✅ API key verified');

    // Get GitHub context
    const context = github.context;
    const pr = context.payload.pull_request;

    if (!pr) {
      core.setFailed('This action only works on pull requests');
      return;
    }

    core.info(`🚀 Starting AI Code Review for PR #${pr.number}`);

    // Get inputs
    const githubToken = core.getInput('github-token', { required: true });
    const maxBudget = Number.parseFloat(core.getInput('max-budget') || '5.0');
    const severityThreshold = core.getInput('severity-threshold') || 'warning';
    const failOn = core.getInput('fail-on') || 'critical';

    // Get PR details and changed files from GitHub API
    const octokit = github.getOctokit(githubToken);

    const { data: prData } = await octokit.rest.pulls.get({
      ...context.repo,
      pull_number: pr.number,
    });

    const { data: files } = await octokit.rest.pulls.listFiles({
      ...context.repo,
      pull_number: pr.number,
    });

    // Build PR context with changed files (PR diff only for speed)
    const changedFiles = files.map((f) => f.filename);

    const prContext = {
      title: prData.title,
      description: prData.body || '',
      number: prData.number,
      author: prData.user.login,
      branch: prData.head.ref,
      baseBranch: prData.base.ref,
      changedFiles,
    };

    core.info(`📋 PR: "${prContext.title}"`);
    core.info(`📝 Changed files: ${changedFiles.length}`);
    core.info(
      `📊 Total changes: +${files.reduce((sum, f) => sum + f.additions, 0)} -${files.reduce((sum, f) => sum + f.deletions, 0)} lines`
    );

    // Run review focusing on changed files (PR diff analysis)
    core.info('⚙️  Running code review...');

    const agent = new CodeReviewAgent({
      prContext,
      maxBudgetUsd: maxBudget,
      maxFiles: 50,
      severityThreshold: severityThreshold as 'info' | 'warning' | 'error' | 'critical',
      cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
    });

    const result = await agent.review('.');

    core.info('✅ Review completed');
    core.info(`   Status: ${result.status}`);
    core.info(`   Issues: ${result.stats.totalIssues}`);
    core.info(`   Critical: ${result.stats.issuesBySeverity.critical}`);
    core.info(`   Cost: $${result.stats.totalCostUsd.toFixed(4)}`);

    // Generate markdown report
    const markdown = exportResults(result, 'markdown');

    // Post PR comment
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: pr.number,
      body: `## 🤖 AI Code Review Results\n\n${markdown}\n\n---\n*Powered by [Code Review Agent](https://github.com/Hussain-7/github-code-review-action) • Found ${result.stats.totalIssues} issue(s) • Cost: $${result.stats.totalCostUsd.toFixed(4)}*`,
    });

    core.info('💬 Posted review comment on PR');

    // Set outputs
    core.setOutput('status', result.status);
    core.setOutput('total-issues', result.stats.totalIssues);
    core.setOutput('critical-count', result.stats.issuesBySeverity.critical);
    core.setOutput('error-count', result.stats.issuesBySeverity.error);
    core.setOutput('warning-count', result.stats.issuesBySeverity.warning);

    // Fail based on configured severity threshold
    const shouldFail =
      (failOn === 'critical' && result.stats.issuesBySeverity.critical > 0) ||
      (failOn === 'error' &&
        (result.stats.issuesBySeverity.critical > 0 || result.stats.issuesBySeverity.error > 0)) ||
      (failOn === 'warning' && result.stats.totalIssues > 0);

    if (shouldFail) {
      core.setFailed(
        `Found ${result.stats.issuesBySeverity.critical} critical, ${result.stats.issuesBySeverity.error} error issue(s)`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Code review failed: ${message}`);
    throw error;
  }
}

run();
