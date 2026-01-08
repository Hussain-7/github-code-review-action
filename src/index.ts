/**
 * Main entry point for the Code Review Agent
 * Exports the public API for programmatic usage
 */

export { CodeReviewAgent } from './agents/code-reviewer';
export * from './types';
export * from './config';
export * from './hooks';
export { logger, Logger } from './utils/logger';
export {
  formatReviewResult,
  formatReviewResultAsJson,
  formatReviewResultAsMarkdown,
  exportResults,
} from './utils/formatter';
