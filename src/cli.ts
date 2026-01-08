#!/usr/bin/env node

/**
 * CLI interface for the Code Review Agent
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { CodeReviewAgent } from './agents/code-reviewer';
import type { IssueSeverity, ReviewConfig } from './types';
import { exportResults, formatReviewResult } from './utils/formatter';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('code-review-agent')
  .description('AI-powered code review agent using Claude')
  .version('1.0.0');

program
  .command('review')
  .description('Perform a code review on the specified target')
  .argument('[target]', 'Target file or directory to review', '.')
  .option('-m, --model <model>', 'Claude model to use')
  .option('-b, --budget <amount>', 'Maximum budget in USD', Number.parseFloat)
  .option('-f, --format <format>', 'Output format (console, json, markdown)', 'console')
  .option('-o, --output <file>', 'Output file path')
  .option('-s, --severity <level>', 'Minimum severity level (info, warning, error, critical)')
  .option('--max-files <number>', 'Maximum number of files to review', Number.parseInt)
  .option('--include <patterns...>', 'File patterns to include')
  .option('--exclude <patterns...>', 'File patterns to exclude')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (target: string, options: Record<string, unknown>) => {
    try {
      logger.info('Initializing code review agent...');

      // Build configuration from CLI options
      const config: Partial<ReviewConfig> = {
        verbose: options.verbose as boolean | undefined,
      };

      if (options.model) {
        config.model = options.model as string;
      }
      if (options.budget) {
        config.maxBudgetUsd = options.budget as number;
      }
      if (options.maxFiles) {
        config.maxFiles = options.maxFiles as number;
      }
      if (options.severity) {
        config.severityThreshold = options.severity as IssueSeverity;
      }
      if (options.include) {
        config.includePatterns = options.include as string[];
      }
      if (options.exclude) {
        config.excludePatterns = options.exclude as string[];
      }

      // Create and run the agent
      const agent = new CodeReviewAgent(config);
      const result = await agent.review(target);

      // Format output
      const output = exportResults(
        result,
        (options.format as 'console' | 'json' | 'markdown') || 'console'
      );

      // Write to file or console
      if (options.output) {
        fs.writeFileSync(options.output as string, output);
        logger.success(`Review results saved to: ${options.output}`);
      } else {
        // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
        console.log(formatReviewResult(result));
      }

      // Exit with appropriate code
      process.exit(result.status === 'success' ? 0 : 1);
    } catch (error) {
      logger.error('Review failed', { error });
      process.exit(1);
    }
  });

program
  .command('rules')
  .description('List all available review rules')
  .option('-c, --category <category>', 'Filter by category')
  .option('-s, --severity <severity>', 'Filter by severity')
  .option('--enabled', 'Show only enabled rules')
  .action(async (options: Record<string, unknown>) => {
    const { DEFAULT_RULES } = await import('./config/default-rules');

    let rules = DEFAULT_RULES;

    if (options.category) {
      rules = rules.filter((r) => r.category === (options.category as string));
    }

    if (options.severity) {
      rules = rules.filter((r) => r.severity === (options.severity as string));
    }

    if (options.enabled) {
      rules = rules.filter((r) => r.enabled);
    }

    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log(`\nAvailable Rules (${rules.length}):\n`);
    // biome-ignore lint/complexity/noForEach: Simple output loop, performance not a concern
    rules.forEach((rule) => {
      // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
      console.log(`ID: ${rule.id}`);
      // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
      console.log(`Name: ${rule.name}`);
      // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
      console.log(`Description: ${rule.description}`);
      // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
      console.log(`Severity: ${rule.severity}`);
      // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
      console.log(`Category: ${rule.category}`);
      // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
      console.log(`Enabled: ${rule.enabled}`);
      // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
      console.log('---');
    });
  });

program
  .command('config')
  .description('Display current configuration')
  .action(() => {
    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log('\nEnvironment Configuration:\n');
    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log(`API Key: ${process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not Set'}`);
    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log(`Model: ${process.env.MODEL || 'claude-sonnet-4.5-20250929'}`);
    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log(`Max Files: ${process.env.MAX_FILES_PER_REVIEW || '50'}`);
    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log(`Max Budget: $${process.env.MAX_BUDGET_USD || '5.0'}`);
    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log(`Log Level: ${process.env.LOG_LEVEL || 'info'}`);
    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log(`Audit Log: ${process.env.ENABLE_AUDIT_LOG === 'true' ? 'Enabled' : 'Disabled'}`);
  });

program.parse(process.argv);
