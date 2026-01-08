import type { ReviewRule } from '../types';

/**
 * Default code review rules
 * These can be extended or overridden in custom configurations
 */
export const DEFAULT_RULES: ReviewRule[] = [
  // Security Rules
  {
    id: 'security-no-hardcoded-secrets',
    name: 'No Hardcoded Secrets',
    description: 'Detect hardcoded API keys, passwords, tokens, or secrets',
    severity: 'critical',
    category: 'security',
    enabled: true,
  },
  {
    id: 'security-sql-injection',
    name: 'SQL Injection Prevention',
    description: 'Check for potential SQL injection vulnerabilities',
    severity: 'critical',
    category: 'security',
    enabled: true,
  },
  {
    id: 'security-xss',
    name: 'XSS Prevention',
    description: 'Check for potential Cross-Site Scripting vulnerabilities',
    severity: 'critical',
    category: 'security',
    enabled: true,
  },
  {
    id: 'security-command-injection',
    name: 'Command Injection Prevention',
    description: 'Check for potential command injection vulnerabilities',
    severity: 'critical',
    category: 'security',
    enabled: true,
  },

  // Performance Rules
  {
    id: 'performance-inefficient-loops',
    name: 'Inefficient Loops',
    description: 'Detect inefficient loop patterns and nested iterations',
    severity: 'warning',
    category: 'performance',
    enabled: true,
  },
  {
    id: 'performance-memory-leaks',
    name: 'Potential Memory Leaks',
    description: 'Identify patterns that could lead to memory leaks',
    severity: 'error',
    category: 'performance',
    enabled: true,
  },
  {
    id: 'performance-unnecessary-computations',
    name: 'Unnecessary Computations',
    description: 'Flag redundant or repeated computations that can be optimized',
    severity: 'info',
    category: 'performance',
    enabled: true,
  },

  // Bug Detection Rules
  {
    id: 'bugs-null-reference',
    name: 'Null Reference Errors',
    description: 'Detect potential null or undefined reference errors',
    severity: 'error',
    category: 'bugs',
    enabled: true,
  },
  {
    id: 'bugs-type-errors',
    name: 'Type Errors',
    description: 'Identify potential type mismatches and coercion issues',
    severity: 'error',
    category: 'bugs',
    enabled: true,
  },
  {
    id: 'bugs-logic-errors',
    name: 'Logic Errors',
    description: 'Detect logical errors and incorrect conditional statements',
    severity: 'error',
    category: 'bugs',
    enabled: true,
  },

  // Best Practices Rules
  {
    id: 'best-practices-error-handling',
    name: 'Proper Error Handling',
    description: 'Ensure proper error handling and exception management',
    severity: 'warning',
    category: 'best-practices',
    enabled: true,
  },
  {
    id: 'best-practices-async-await',
    name: 'Async/Await Usage',
    description: 'Check for proper async/await patterns and promise handling',
    severity: 'warning',
    category: 'best-practices',
    enabled: true,
  },
  {
    id: 'best-practices-immutability',
    name: 'Immutability',
    description: 'Prefer immutable patterns and avoid direct state mutations',
    severity: 'info',
    category: 'best-practices',
    enabled: true,
  },

  // Maintainability Rules
  {
    id: 'maintainability-complexity',
    name: 'Code Complexity',
    description: 'Flag functions with high cyclomatic complexity',
    severity: 'warning',
    category: 'maintainability',
    enabled: true,
  },
  {
    id: 'maintainability-function-length',
    name: 'Function Length',
    description: 'Identify excessively long functions that should be refactored',
    severity: 'info',
    category: 'maintainability',
    enabled: true,
  },
  {
    id: 'maintainability-duplication',
    name: 'Code Duplication',
    description: 'Detect duplicated code that should be extracted',
    severity: 'warning',
    category: 'maintainability',
    enabled: true,
  },

  // Documentation Rules
  {
    id: 'documentation-missing-comments',
    name: 'Missing Documentation',
    description: 'Flag complex functions lacking documentation',
    severity: 'info',
    category: 'documentation',
    enabled: true,
  },
  {
    id: 'documentation-outdated-comments',
    name: 'Outdated Comments',
    description: 'Identify comments that may be outdated or misleading',
    severity: 'info',
    category: 'documentation',
    enabled: true,
  },

  // Style Rules
  {
    id: 'style-naming-conventions',
    name: 'Naming Conventions',
    description: 'Ensure consistent naming conventions',
    severity: 'info',
    category: 'style',
    enabled: false, // Disabled by default as it can be noisy
  },
  {
    id: 'style-code-formatting',
    name: 'Code Formatting',
    description: 'Check for consistent code formatting',
    severity: 'info',
    category: 'style',
    enabled: false, // Disabled by default, use formatters instead
  },
];

/**
 * Get rules filtered by category
 */
export function getRulesByCategory(category: string): ReviewRule[] {
  return DEFAULT_RULES.filter((rule) => rule.category === category);
}

/**
 * Get rules filtered by severity
 */
export function getRulesBySeverity(severity: string): ReviewRule[] {
  return DEFAULT_RULES.filter((rule) => rule.severity === severity);
}

/**
 * Get enabled rules only
 */
export function getEnabledRules(): ReviewRule[] {
  return DEFAULT_RULES.filter((rule) => rule.enabled);
}

/**
 * Get rule by ID
 */
export function getRuleById(id: string): ReviewRule | undefined {
  return DEFAULT_RULES.find((rule) => rule.id === id);
}
