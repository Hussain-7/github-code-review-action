/**
 * Core type definitions for the code review agent
 */

export interface ReviewConfig {
  /** Maximum number of files to review in a single session */
  maxFiles?: number;
  /** Maximum budget in USD for the review */
  maxBudgetUsd?: number;
  /** Claude model to use */
  model?: string;
  /** Files or patterns to exclude from review */
  excludePatterns?: string[];
  /** Files or patterns to include in review */
  includePatterns?: string[];
  /** Working directory */
  cwd?: string;
  /** Enable detailed logging */
  verbose?: boolean;
  /** Custom review rules to apply */
  rules?: ReviewRule[];
  /** Severity level threshold (only report issues at or above this level) */
  severityThreshold?: IssueSeverity;
  /** PR context for better review */
  prContext?: PRContext;
}

export interface PRContext {
  /** PR title/name */
  title?: string;
  /** PR description with intent and details */
  description?: string;
  /** PR number or identifier */
  number?: string | number;
  /** Branch name */
  branch?: string;
  /** Author information */
  author?: string;
  /** List of changed files (if available) */
  changedFiles?: string[];
  /** Base branch (e.g., 'main', 'develop') */
  baseBranch?: string;
}

export type IssueSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface ReviewRule {
  /** Unique identifier for the rule */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the rule checks */
  description: string;
  /** Severity level if violated */
  severity: IssueSeverity;
  /** Category of the rule */
  category: ReviewCategory;
  /** Whether the rule is enabled */
  enabled: boolean;
}

export type ReviewCategory =
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'best-practices'
  | 'bugs'
  | 'style'
  | 'documentation';

export interface ReviewIssue {
  /** Rule that was violated */
  ruleId: string;
  /** Severity of the issue */
  severity: IssueSeverity;
  /** Category of the issue */
  category: ReviewCategory;
  /** File path where the issue was found */
  filePath: string;
  /** Line number (if applicable) */
  line?: number;
  /** Column number (if applicable) */
  column?: number;
  /** Description of the issue */
  message: string;
  /** Suggested fix (if available) */
  suggestion?: string;
  /** Code snippet showing the issue */
  snippet?: string;
  /** Impact on the project */
  impact?: string;
}

export interface EdgeCase {
  /** Description of the edge case scenario */
  scenario: string;
  /** Whether this edge case is handled */
  handled: boolean;
  /** Recommendation if not handled */
  recommendation?: string;
}

export interface ImpactAnalysis {
  /** Breaking changes identified */
  breakingChanges: string[];
  /** Files affected by the changes */
  affectedFiles: string[];
  /** Integration impact description */
  integrationImpact: string;
  /** Performance impact description */
  performanceImpact: string;
  /** Security impact description */
  securityImpact: string;
}

export interface ReviewResult {
  /** Overall status of the review */
  status: 'success' | 'failure' | 'partial';
  /** Summary message */
  summary: string;
  /** PR intent (what the PR is trying to achieve) */
  prIntent?: string;
  /** Impact analysis */
  impactAnalysis?: ImpactAnalysis;
  /** List of issues found */
  issues: ReviewIssue[];
  /** Edge cases identified */
  edgeCases?: EdgeCase[];
  /** Missing test scenarios */
  missingTests?: string[];
  /** Missing documentation */
  missingDocumentation?: string[];
  /** Positive aspects of the PR */
  positives?: string[];
  /** Recommendations for improvement */
  recommendations?: string[];
  /** Files that were reviewed */
  filesReviewed: string[];
  /** Files that were skipped */
  filesSkipped: string[];
  /** Statistics about the review */
  stats: ReviewStats;
  /** Execution metadata */
  metadata: ReviewMetadata;
}

export interface ReviewStats {
  /** Total number of files reviewed */
  totalFiles: number;
  /** Total number of issues found */
  totalIssues: number;
  /** Issues by severity */
  issuesBySeverity: Record<IssueSeverity, number>;
  /** Issues by category */
  issuesByCategory: Record<ReviewCategory, number>;
  /** Total cost in USD */
  totalCostUsd: number;
  /** Total duration in milliseconds */
  durationMs: number;
}

export interface ReviewMetadata {
  /** Timestamp when review started */
  startTime: string;
  /** Timestamp when review ended */
  endTime: string;
  /** Model used for the review */
  model: string;
  /** Session ID */
  sessionId: string;
  /** Configuration used */
  config: ReviewConfig;
}

export interface AgentMessage {
  type: 'system' | 'assistant' | 'user' | 'result';
  content: string;
  timestamp: string;
}

export interface AuditLogEntry {
  timestamp: string;
  sessionId: string;
  event: string;
  toolName?: string;
  filePath?: string;
  details: Record<string, unknown>;
}
