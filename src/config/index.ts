import * as dotenv from 'dotenv';
import type { ReviewConfig } from '../types';
import { DEFAULT_RULES, getEnabledRules } from './default-rules';

// Load environment variables
dotenv.config();

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<ReviewConfig, 'rules'>> = {
  maxFiles: Number.parseInt(process.env.MAX_FILES_PER_REVIEW || '50', 10),
  maxBudgetUsd: Number.parseFloat(process.env.MAX_BUDGET_USD || '5.0'),
  model: process.env.MODEL || 'claude-sonnet-4.5-20250929',
  excludePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    '*.min.js',
    '*.bundle.js',
    'coverage/**',
    '.git/**',
    '*.log',
  ],
  includePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
  cwd: process.cwd(),
  verbose: process.env.LOG_LEVEL === 'debug',
  severityThreshold: 'info',
};

/**
 * Merges user config with defaults
 */
export function buildConfig(userConfig: Partial<ReviewConfig> = {}): ReviewConfig {
  const config: ReviewConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  };

  // Merge rules: user rules override defaults
  if (userConfig.rules) {
    config.rules = mergeRules(DEFAULT_RULES, userConfig.rules);
  } else {
    config.rules = getEnabledRules();
  }

  // Merge exclude patterns
  if (userConfig.excludePatterns) {
    config.excludePatterns = [...DEFAULT_CONFIG.excludePatterns, ...userConfig.excludePatterns];
  }

  return config;
}

/**
 * Merges user-defined rules with default rules
 * User rules with matching IDs override defaults
 */
function mergeRules(
  defaultRules: typeof DEFAULT_RULES,
  userRules: typeof DEFAULT_RULES
): typeof DEFAULT_RULES {
  const rulesMap = new Map(defaultRules.map((rule) => [rule.id, rule]));

  // Override or add user rules
  for (const rule of userRules) {
    rulesMap.set(rule.id, rule);
  }

  // Return only enabled rules
  return Array.from(rulesMap.values()).filter((rule) => rule.enabled);
}

/**
 * Validates the configuration
 */
export function validateConfig(config: ReviewConfig): void {
  if (config.maxFiles && config.maxFiles <= 0) {
    throw new Error('maxFiles must be greater than 0');
  }

  if (config.maxBudgetUsd && config.maxBudgetUsd <= 0) {
    throw new Error('maxBudgetUsd must be greater than 0');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
}

/**
 * Gets API key from environment
 */
export function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  return apiKey;
}

export { DEFAULT_RULES } from './default-rules';
