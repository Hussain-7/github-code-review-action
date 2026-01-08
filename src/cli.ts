#!/usr/bin/env node

/**
 * CLI interface for the Code Review Agent
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { CodeReviewAgent } from './agents/code-reviewer';
import type { ReviewConfig } from './types';
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
  .action(async (target: string, options: any) => {
    try {
      logger.info('Initializing code review agent...');

      // Build configuration from CLI options
      const config: Partial<ReviewConfig> = {
        verbose: options.verbose,
      };

      if (options.model) {
        config.model = options.model;
      }
      if (options.budget) {
        config.maxBudgetUsd = options.budget;
      }
      if (options.maxFiles) {
        config.maxFiles = options.maxFiles;
      }
      if (options.severity) {
        config.severityThreshold = options.severity;
      }
      if (options.include) {
        config.includePatterns = options.include;
      }
      if (options.exclude) {
        config.excludePatterns = options.exclude;
      }

      // Create and run the agent
      const agent = new CodeReviewAgent(config);
      const result = await agent.review(target);

      // Format output
      const output = exportResults(result, options.format);

      // Write to file or console
      if (options.output) {
        fs.writeFileSync(options.output, output);
        logger.success(`Review results saved to: ${options.output}`);
      } else {
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
  .action(async (options: any) => {
    const { DEFAULT_RULES } = await import('./config/default-rules');

    let rules = DEFAULT_RULES;

    if (options.category) {
      rules = rules.filter((r) => r.category === options.category);
    }

    if (options.severity) {
      rules = rules.filter((r) => r.severity === options.severity);
    }

    if (options.enabled) {
      rules = rules.filter((r) => r.enabled);
    }

    console.log(`\nAvailable Rules (${rules.length}):\n`);
    // biome-ignore lint/complexity/noForEach: Simple output loop, performance not a concern
    rules.forEach((rule) => {
      console.log(`ID: ${rule.id}`);
      console.log(`Name: ${rule.name}`);
      console.log(`Description: ${rule.description}`);
      console.log(`Severity: ${rule.severity}`);
      console.log(`Category: ${rule.category}`);
      console.log(`Enabled: ${rule.enabled}`);
      console.log('---');
    });
  });

program
  .command('config')
  .description('Display current configuration')
  .action(() => {
    console.log('\nEnvironment Configuration:\n');
    console.log(`API Key: ${process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not Set'}`);
    console.log(`Model: ${process.env.MODEL || 'claude-sonnet-4.5-20250929'}`);
    console.log(`Max Files: ${process.env.MAX_FILES_PER_REVIEW || '50'}`);
    console.log(`Max Budget: $${process.env.MAX_BUDGET_USD || '5.0'}`);
    console.log(`Log Level: ${process.env.LOG_LEVEL || 'info'}`);
    console.log(`Audit Log: ${process.env.ENABLE_AUDIT_LOG === 'true' ? 'Enabled' : 'Disabled'}`);
  });

program.parse(process.argv);
