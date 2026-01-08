import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PRContext, ReviewRule } from '../types';

/**
 * Loads and processes the review prompt template
 */
export function loadReviewPrompt(
  target: string,
  rules: ReviewRule[],
  prContext?: PRContext,
  includePatterns?: string[],
  excludePatterns?: string[],
  maxFiles?: number
): string {
  // Load the prompt template
  const promptPath = path.join(__dirname, '../prompts/review-prompt.md');
  let promptTemplate = fs.readFileSync(promptPath, 'utf-8');

  // Build rules description
  const rulesDescription = rules
    .filter((r) => r.enabled)
    .map((rule) => {
      return `- **[${rule.severity.toUpperCase()}] ${rule.name}** (${rule.id})
  Category: ${rule.category}
  ${rule.description}`;
    })
    .join('\n\n');

  // Build PR context section
  let prContextSection = '';
  if (prContext) {
    prContextSection = `
## Pull Request Context

${prContext.title ? `**PR Title**: ${prContext.title}\n` : ''}
${prContext.number ? `**PR Number**: #${prContext.number}\n` : ''}
${prContext.description ? `**PR Description**:\n${prContext.description}\n` : ''}
${prContext.author ? `**Author**: ${prContext.author}\n` : ''}
${prContext.branch ? `**Branch**: ${prContext.branch} → ${prContext.baseBranch || 'main'}\n` : ''}
${
  prContext.changedFiles && prContext.changedFiles.length > 0
    ? `**Changed Files**:\n${prContext.changedFiles.map((f) => `- ${f}`).join('\n')}\n`
    : ''
}

**Important**: Use this context to understand the developer's intent and ensure your review addresses what they're trying to accomplish. Verify that the changes achieve the stated goals and handle all edge cases related to the PR's purpose.
`;
  }

  // Replace placeholders
  promptTemplate = promptTemplate.replace('{{REVIEW_RULES}}', rulesDescription);
  promptTemplate = promptTemplate.replace('{{TARGET}}', target);
  promptTemplate = promptTemplate.replace(
    '{{INCLUDE_PATTERNS}}',
    includePatterns?.join(', ') || 'All TypeScript/JavaScript files'
  );
  promptTemplate = promptTemplate.replace(
    '{{EXCLUDE_PATTERNS}}',
    excludePatterns?.join(', ') || 'Standard exclusions (node_modules, dist, etc.)'
  );
  promptTemplate = promptTemplate.replace('{{MAX_FILES}}', String(maxFiles || 50));

  // Add PR context section if available
  if (prContextSection) {
    promptTemplate = `${prContextSection}\n${promptTemplate}`;
  }

  return promptTemplate;
}

/**
 * Extracts PR context from git if in a repository
 */
export async function extractPRContextFromGit(cwd: string): Promise<PRContext | undefined> {
  try {
    const { execSync } = await import('node:child_process');

    // Check if in a git repository
    try {
      execSync('git rev-parse --git-dir', { cwd, stdio: 'ignore' });
    } catch {
      return undefined;
    }

    const prContext: PRContext = {};

    // Get current branch
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd }).toString().trim();
      prContext.branch = branch;
    } catch {
      // Ignore
    }

    // Get changed files (compared to main/master)
    try {
      const baseBranches = ['main', 'master', 'develop'];
      for (const base of baseBranches) {
        try {
          const changedFiles = execSync(`git diff --name-only ${base}...HEAD`, { cwd })
            .toString()
            .trim()
            .split('\n')
            .filter((f) => f.length > 0);

          if (changedFiles.length > 0) {
            prContext.changedFiles = changedFiles;
            prContext.baseBranch = base;
            break;
          }
        } catch {
          // Try next base branch
        }
      }
    } catch {
      // Ignore
    }

    // Get last commit message as PR description fallback
    try {
      const commitMessage = execSync('git log -1 --pretty=%B', { cwd }).toString().trim();
      if (commitMessage && !prContext.description) {
        prContext.description = commitMessage;
      }
    } catch {
      // Ignore
    }

    // Get author
    try {
      const author = execSync('git log -1 --pretty=%an', { cwd }).toString().trim();
      prContext.author = author;
    } catch {
      // Ignore
    }

    return Object.keys(prContext).length > 0 ? prContext : undefined;
  } catch {
    return undefined;
  }
}
