#!/usr/bin/env tsx
/**
 * GitHub Action Review Script
 * Run via: pnpm run github-review
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { CodeReviewAgent, exportResults } from '../dist';
import * as fs from 'node:fs';

async function runGitHubReview() {
  try {
    const context = github.context;
    const pr = context.payload.pull_request;

    if (!pr) {
      core.setFailed('This action only works on pull requests');
      return;
    }

    core.info('🚀 Starting AI Code Review');

    // Get GitHub token
    const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
    if (!token) {
      core.setFailed('GITHUB_TOKEN is required');
      return;
    }

    const octokit = github.getOctokit(token);

    // Fetch PR details and diffs
    const { data: prData } = await octokit.rest.pulls.get({
      ...context.repo,
      pull_number: pr.number,
    });

    const { data: files } = await octokit.rest.pulls.listFiles({
      ...context.repo,
      pull_number: pr.number,
    });

    // Build PR context with diffs
    const prContext = {
      title: prData.title,
      description: prData.body || '',
      number: prData.number,
      author: prData.user.login,
      branch: prData.head.ref,
      baseBranch: prData.base.ref,
      changedFiles: files.map((f) => f.filename),
      fileDiffs: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
    };

    core.info(`📋 PR #${prContext.number}: ${prContext.title}`);
    core.info(`📝 Changed files: ${prContext.changedFiles.length}`);
    core.info(
      `📊 Changes: +${files.reduce((sum, f) => sum + f.additions, 0)} -${files.reduce((sum, f) => sum + f.deletions, 0)} lines`
    );

    // Get configuration
    const maxBudget = Number.parseFloat(core.getInput('max-budget') || '5.0');
    const severityThreshold = core.getInput('severity-threshold') || 'warning';
    const target = core.getInput('target') || '.'; // Default: review entire repo

    // Get the PR repository directory (where the code to review is)
    const prRepoDir = process.env.GITHUB_WORKSPACE || process.cwd();

    core.info(`📂 Reviewing code in: ${prRepoDir}`);

    // Run review on the PR code (not the review agent code!)
    core.info('⚙️  Running comprehensive code review...');
    const agent = new CodeReviewAgent({
      prContext,
      maxBudgetUsd: maxBudget,
      maxFiles: 50,
      severityThreshold: severityThreshold as 'info' | 'warning' | 'error' | 'critical',
      cwd: prRepoDir, // Point to the PR repository, not /tmp/review-agent
    });

    const result = await agent.review(target);

    core.info('✅ Review completed');
    core.info(`   Status: ${result.status}`);
    core.info(`   Issues: ${result.stats.totalIssues}`);
    core.info(`   Cost: $${result.stats.totalCostUsd.toFixed(4)}`);

    // Generate and save reports in the PR repo directory (for artifact upload)
    const markdown = exportResults(result, 'markdown');
    const json = exportResults(result, 'json');

    const reportMdPath = `${prRepoDir}/review-report.md`;
    const reportJsonPath = `${prRepoDir}/review-result.json`;

    fs.writeFileSync(reportMdPath, markdown);
    fs.writeFileSync(reportJsonPath, json);

    core.info(`📄 Reports saved to: ${prRepoDir}/`);

    // Set outputs
    core.setOutput('status', result.status);
    core.setOutput('total-issues', result.stats.totalIssues);
    core.setOutput('critical-count', result.stats.issuesBySeverity.critical);
    core.setOutput('error-count', result.stats.issuesBySeverity.error);
    core.setOutput('warning-count', result.stats.issuesBySeverity.warning);
    core.setOutput('report-file', reportMdPath);

    // Post comment
    const commentOnPr = core.getInput('comment-on-pr') !== 'false';
    if (commentOnPr) {
      await octokit.rest.issues.createComment({
        ...context.repo,
        issue_number: pr.number,
        body: `## 🤖 AI Code Review\n\n${markdown}\n\n---\n*Powered by [Code Review Agent](https://github.com/Hussain-7/code-review-agent)*`,
      });
      core.info('💬 Posted review comment');
    }

    // Fail on critical
    const failOnCritical = core.getInput('fail-on-critical') !== 'false';
    if (failOnCritical && result.stats.issuesBySeverity.critical > 0) {
      core.setFailed(`Found ${result.stats.issuesBySeverity.critical} critical issue(s)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Review failed: ${message}`);
    throw error;
  }
}

runGitHubReview();
