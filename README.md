# AI Code Review Agent

A scalable, extensible code review agent powered by Claude Agent SDK. Performs automated code reviews for security, performance, bugs, best practices, and more.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Add to Your Repository](#add-to-your-repository)
- [Installation](#installation)
- [Usage](#usage)
  - [CLI](#cli)
  - [Programmatic](#programmatic)
  - [GitHub Action](#github-action)
- [Configuration](#configuration)
- [Custom Rules](#custom-rules)
- [Extending with Hooks](#extending-with-hooks)
- [Examples](#examples)
- [Development](#development)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Features

- **Holistic PR Review**: Analyzes not just changed files, but project-wide impact, breaking changes, and edge cases
- **PR Context Aware**: Understands PR intent from title/description to ensure changes achieve their goals
- **Comprehensive Analysis**: Security, performance, bugs, best practices, maintainability, documentation
- **Impact Analysis**: Identifies breaking changes, affected files, integration impacts, and security implications
- **Extensible Rules**: 20+ default rules, easy to add custom rules
- **Multiple Interfaces**: CLI, Node.js library, GitHub Action
- **GitHub Integration**: Auto-review PRs, trigger with `@agent-review` comment
- **Cost Control**: Budget limits and file count restrictions
- **Flexible Filtering**: Include/exclude patterns, severity thresholds
- **Multiple Outputs**: Console, JSON, Markdown formats with detailed insights
- **Audit Logging**: Track all changes and tool usage
- **Type Safe**: Full TypeScript support

## Quick Start

### Local Review (Fastest Way)

```bash
# Clone this repository
git clone https://github.com/your-org/code-review-agent.git
cd code-review-agent

# Install dependencies
pnpm install

# Set API key in .env file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Review any repository
pnpm review /path/to/your/repo

# Review with custom budget
pnpm review /path/to/repo --budget 10

# Review current directory
pnpm review .
```

### CLI Tool

```bash
# Install Claude Code CLI (required)
npm install -g @anthropic-ai/claude-code

# Install globally
npm install -g code-review-agent

# Set API key
export ANTHROPIC_API_KEY=your-api-key

# Review code
code-review-agent review ./src
```

## Add to Your Repository

Want to add AI code review to your project? Here's how:

### 3-Step Setup

#### Step 1: Add API Key Secret

1. Go to your repository on GitHub
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. Add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your API key from https://console.anthropic.com/

#### Step 2: Create Workflow File

Create `.github/workflows/ai-code-review.yml`:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

jobs:
  review:
    if: |
      github.event_name == 'pull_request' ||
      (github.event.issue.pull_request && contains(github.event.comment.body, '@agent-review'))

    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        run: |
          npm install -g @anthropic-ai/claude-code
          npm install -g code-review-agent

      - name: Run AI Code Review
        uses: your-org/code-review-agent@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          target: './src'
          severity-threshold: 'warning'
          fail-on-critical: 'true'
          comment-on-pr: 'true'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: code-review-report
          path: review-report.md
```

#### Step 3: Push and Test

```bash
git add .github/workflows/ai-code-review.yml
git commit -m "Add AI code review workflow"
git push
```

Create a test PR to see it in action!

### How It Works

1. **Automatic Reviews**: Runs on every PR open/update
2. **Manual Trigger**: Comment `@agent-review` on any PR
3. **Automatic PR Context Extraction**: The action automatically extracts:
   - ✅ PR title and description
   - ✅ PR number and author
   - ✅ Changed files list (via GitHub API)
   - ✅ Branch information
4. **Full Context**: Agent understands PR intent, changed files, and project impact
5. **Smart Analysis**: Reviews not just the changes, but how they affect the entire project
6. **PR Comments**: Posts detailed review results as a comment
7. **Artifacts**: Saves reports for later reference

**Note**: The GitHub Action automatically passes full PR context to the agent, so it knows exactly what changed and what the PR is trying to achieve!

### What the Agent Reviews

- **Changed files** - Direct modifications in the PR
- **Impact on project** - How changes affect other files
- **Breaking changes** - API changes, signature modifications
- **Edge cases** - Scenarios that need handling
- **Security** - Vulnerabilities introduced
- **Tests** - Missing test coverage
- **Documentation** - Required doc updates
- **Overall quality** - Code quality, best practices

## Installation

### Prerequisites

- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/)

### Install Claude Code CLI

```bash
# npm
npm install -g @anthropic-ai/claude-code

# Homebrew (macOS)
brew install --cask claude-code

# Direct install
curl -fsSL https://claude.ai/install.sh | bash
```

### Install Code Review Agent

```bash
# Global installation
npm install -g code-review-agent

# Project dependency
npm install code-review-agent

# From source
git clone https://github.com/your-org/code-review-agent.git
cd code-review-agent
npm install
npm run build
```

### Configure

Create `.env` file:

```bash
ANTHROPIC_API_KEY=your-api-key-here
MODEL=claude-sonnet-4.5-20250929
MAX_FILES_PER_REVIEW=50
MAX_BUDGET_USD=5.0
LOG_LEVEL=info
ENABLE_AUDIT_LOG=true
```

Or set environment variable:

```bash
export ANTHROPIC_API_KEY=your-api-key-here
```

## Usage

### CLI

#### Basic Commands

```bash
# Review current directory
code-review-agent review

# Review specific directory
code-review-agent review ./src

# Review with options
code-review-agent review ./src \
  --model claude-opus-4.5-20251101 \
  --budget 10.0 \
  --severity error \
  --format markdown \
  --output review.md

# List available rules
code-review-agent rules

# Filter rules by category
code-review-agent rules --category security

# View configuration
code-review-agent config
```

#### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-m, --model <model>` | Claude model to use | `claude-sonnet-4.5-20250929` |
| `-b, --budget <amount>` | Max budget in USD | `5.0` |
| `-f, --format <format>` | Output format (console, json, markdown) | `console` |
| `-o, --output <file>` | Output file path | stdout |
| `-s, --severity <level>` | Min severity (info, warning, error, critical) | `info` |
| `--max-files <number>` | Max files to review | `50` |
| `--include <patterns...>` | File patterns to include | `**/*.ts`, `**/*.js` |
| `--exclude <patterns...>` | File patterns to exclude | `node_modules/**` |
| `-v, --verbose` | Enable verbose logging | `false` |

### Programmatic

#### Basic Usage

```typescript
import { CodeReviewAgent } from 'code-review-agent';

const agent = new CodeReviewAgent();
const result = await agent.review('./src');

console.log(result.summary);
console.log(`Found ${result.stats.totalIssues} issues`);
```

#### Advanced Configuration

```typescript
import { CodeReviewAgent, ReviewConfig } from 'code-review-agent';

const config: Partial<ReviewConfig> = {
  model: 'claude-sonnet-4.5-20250929',
  maxBudgetUsd: 5.0,
  maxFiles: 50,
  severityThreshold: 'warning',
  includePatterns: ['**/*.ts', '**/*.tsx'],
  excludePatterns: ['**/*.test.ts', 'node_modules/**'],
  verbose: true,
};

const agent = new CodeReviewAgent(config);
const result = await agent.review('./src');

// Filter critical issues
const critical = result.issues.filter(i => i.severity === 'critical');

// Export results
import { exportResults } from 'code-review-agent';
const markdown = exportResults(result, 'markdown');
fs.writeFileSync('review.md', markdown);
```

#### Custom Rules

```typescript
import { ReviewRule } from 'code-review-agent';

const customRules: ReviewRule[] = [
  {
    id: 'react-hooks-deps',
    name: 'React Hooks Dependencies',
    description: 'Ensure proper dependency arrays in hooks',
    severity: 'error',
    category: 'best-practices',
    enabled: true,
  },
];

const agent = new CodeReviewAgent({ rules: customRules });
```

### GitHub Action

#### Basic Setup

1. Add `ANTHROPIC_API_KEY` to repository secrets (Settings → Secrets → Actions)

2. Create `.github/workflows/code-review.yml`:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - name: AI Code Review
        uses: your-org/code-review-agent@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          comment-on-pr: 'true'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Trigger with Comment

Add `@agent-review` comment to any PR to trigger a review:

```yaml
name: Comment-Triggered Review

on:
  issue_comment:
    types: [created]

jobs:
  review:
    if: |
      github.event.issue.pull_request &&
      contains(github.event.comment.body, '@agent-review')

    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: refs/pull/${{ github.event.issue.number }}/head

      - uses: your-org/code-review-agent@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          comment-on-pr: 'true'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `anthropic-api-key` | Anthropic API key (required) | - |
| `target` | Target directory to review | `.` |
| `model` | Claude model | `claude-sonnet-4.5-20250929` |
| `max-budget` | Max budget in USD | `5.0` |
| `max-files` | Max files to review | `50` |
| `severity-threshold` | Min severity level | `info` |
| `include-patterns` | File patterns to include | `**/*.ts,**/*.js` |
| `exclude-patterns` | Additional patterns to exclude | - |
| `fail-on-critical` | Fail if critical issues found | `true` |
| `fail-on-error` | Fail if errors found | `false` |
| `comment-on-pr` | Post results as PR comment | `true` |
| `output-format` | Output format | `markdown` |

#### Action Outputs

| Output | Description |
|--------|-------------|
| `status` | Review status (success/partial/failure) |
| `total-issues` | Total number of issues |
| `critical-count` | Number of critical issues |
| `error-count` | Number of errors |
| `warning-count` | Number of warnings |
| `report-file` | Path to generated report |

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your-api-key

# Optional
MODEL=claude-sonnet-4.5-20250929
MAX_FILES_PER_REVIEW=50
MAX_BUDGET_USD=5.0
LOG_LEVEL=info
ENABLE_AUDIT_LOG=true
```

### Configuration Object

```typescript
interface ReviewConfig {
  model?: string;                    // Claude model
  maxBudgetUsd?: number;             // Max cost in USD
  maxFiles?: number;                 // Max files to review
  includePatterns?: string[];        // Files to include
  excludePatterns?: string[];        // Files to exclude
  severityThreshold?: IssueSeverity; // Min severity to report
  rules?: ReviewRule[];              // Custom rules
  cwd?: string;                      // Working directory
  verbose?: boolean;                 // Verbose logging
}
```

### Default Rules

The agent includes 20+ default rules across categories:

- **Security**: SQL injection, XSS, command injection, hardcoded secrets
- **Performance**: Inefficient loops, memory leaks, unnecessary computations
- **Bugs**: Null references, type errors, logic errors
- **Best Practices**: Error handling, async/await, immutability
- **Maintainability**: Code complexity, function length, duplication
- **Documentation**: Missing or outdated comments
- **Style**: Naming conventions, formatting (disabled by default)

View all rules:

```bash
code-review-agent rules
```

## Custom Rules

### Creating Rules

```typescript
import { ReviewRule } from 'code-review-agent';

const myRule: ReviewRule = {
  id: 'my-custom-rule',
  name: 'My Custom Rule',
  description: 'Description of what this rule checks',
  severity: 'error', // 'critical' | 'error' | 'warning' | 'info'
  category: 'best-practices', // security | performance | bugs | etc.
  enabled: true,
};
```

### Using Custom Rules

```typescript
import { CodeReviewAgent, DEFAULT_RULES } from 'code-review-agent';

const customRules = [
  ...DEFAULT_RULES,
  {
    id: 'no-console-production',
    name: 'No Console in Production',
    description: 'Prevent console.log in production code',
    severity: 'warning',
    category: 'best-practices',
    enabled: true,
  },
];

const agent = new CodeReviewAgent({ rules: customRules });
```

## Extending with Hooks

Hooks allow you to extend the agent's behavior at key lifecycle points.

### Built-in Hooks

```typescript
import { defaultHooks } from 'code-review-agent';

// Available hooks:
// - PreToolUse: Before any tool is used
// - PostToolUse: After tool execution
// - PostToolUseFailure: On tool failure
// - SessionStart: When review starts
// - SessionEnd: When review ends
```

### Custom Hooks

```typescript
import { createCustomHook, HookCallback } from 'code-review-agent';

const logHook: HookCallback = async (input) => {
  console.log('Tool used:', input);
  return {};
};

const customHook = createCustomHook(async (input) => {
  // Your custom logic
  console.log('Custom hook triggered');
});
```

## Examples

### Security-Focused Review

```typescript
const agent = new CodeReviewAgent({
  model: 'claude-opus-4.5-20251101', // Most capable model
  severityThreshold: 'critical',      // Only critical issues
  maxBudgetUsd: 10.0,                 // Higher budget
  rules: getRulesByCategory('security'),
});

const result = await agent.review('./src');

if (result.stats.issuesBySeverity.critical > 0) {
  console.error('Critical security issues found!');
  process.exit(1);
}
```

### CI/CD Integration

```typescript
const agent = new CodeReviewAgent({
  model: 'claude-sonnet-4.5-20250929',
  maxBudgetUsd: 3.0,              // Lower budget for frequent runs
  maxFiles: 30,                    // Limit file count
  severityThreshold: 'error',      // Only fail on errors
  verbose: false,                  // Less output
});

const result = await agent.review(process.env.CI_TARGET || './src');

// Exit with appropriate code
process.exit(result.status === 'failure' ? 1 : 0);
```

### Review Changed Files Only

```typescript
// Get changed files from git
const changedFiles = execSync('git diff --name-only HEAD~1')
  .toString()
  .split('\n')
  .filter(f => f.endsWith('.ts') || f.endsWith('.js'));

const agent = new CodeReviewAgent({
  includePatterns: changedFiles,
});

const result = await agent.review('.');
```

## Local Development & Testing

### Quick Review of Any Repository

```bash
# Review any repository locally
pnpm review /path/to/repository

# Review specific directory
pnpm review ./src

# Review with higher budget for deeper analysis
pnpm review /path/to/repo --budget 10

# Examples:
pnpm review .                                    # Current directory
pnpm review ../polaris                          # Another project
pnpm review /absolute/path/to/project          # Absolute path
```

The review generates:
- Detailed JSON report in `reports/review-{timestamp}.json`
- Markdown report in `reports/review-{timestamp}.md`
- Console output with top issues and recommendations

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/code-review-agent.git
cd code-review-agent

# Install dependencies
pnpm install

# Build
pnpm build
```

### Code Quality

We use Biome for linting and formatting:

```bash
# Check code
pnpm check

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# CI checks (no auto-fix)
pnpm ci
```

### Project Structure

```
code-review-agent/
├── src/
│   ├── agents/          # Core agent implementation
│   ├── config/          # Configuration and rules
│   ├── hooks/           # Extensible hooks system
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilities
│   ├── action.ts        # GitHub Action entry
│   ├── cli.ts           # CLI entry
│   └── index.ts         # Main export
├── examples/            # Usage examples
├── .github/workflows/   # GitHub workflows
├── biome.json           # Biome configuration
├── action.yml           # Action metadata
└── package.json
```

### Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run quality checks: `npm run check`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Create Pull Request

## API Reference

### CodeReviewAgent

```typescript
class CodeReviewAgent {
  constructor(config?: Partial<ReviewConfig>);
  review(target?: string): Promise<ReviewResult>;
  getSessionId(): string | undefined;
}
```

### ReviewResult

```typescript
interface ReviewResult {
  status: 'success' | 'failure' | 'partial';
  summary: string;
  issues: ReviewIssue[];
  filesReviewed: string[];
  filesSkipped: string[];
  stats: ReviewStats;
  metadata: ReviewMetadata;
}
```

### ReviewIssue

```typescript
interface ReviewIssue {
  ruleId: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: ReviewCategory;
  filePath: string;
  line?: number;
  column?: number;
  message: string;
  suggestion?: string;
  snippet?: string;
}
```

### Utility Functions

```typescript
// Export results in different formats
exportResults(result: ReviewResult, format: 'json' | 'markdown' | 'console'): string;

// Format for console output
formatReviewResult(result: ReviewResult): string;

// Format as JSON
formatReviewResultAsJson(result: ReviewResult): string;

// Format as Markdown
formatReviewResultAsMarkdown(result: ReviewResult): string;
```

## Troubleshooting

### API Key Not Found

```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY

# Set if missing
export ANTHROPIC_API_KEY=your-key-here

# Or add to .env file
echo "ANTHROPIC_API_KEY=your-key" >> .env
```

### Command Not Found

```bash
# Check npm global bin path
npm config get prefix

# Add to PATH (macOS/Linux)
export PATH="$(npm config get prefix)/bin:$PATH"

# Windows
set PATH=%PATH%;%APPDATA%\npm
```

### Budget Exceeded

```typescript
// Reduce budget or file count
const agent = new CodeReviewAgent({
  maxBudgetUsd: 10.0,  // Increase budget
  maxFiles: 20,         // Or reduce file count
});
```

### No Files Reviewed

```typescript
// Check patterns
const agent = new CodeReviewAgent({
  includePatterns: ['**/*.ts'],
  excludePatterns: [],
  verbose: true, // See which files are matched
});
```

### GitHub Action Not Triggering

Verify:
- `ANTHROPIC_API_KEY` is set in repository secrets
- Workflow has correct permissions
- Workflow file is in `.github/workflows/`
- Branch protection rules don't block the action

## Resources

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [TypeScript SDK Reference](https://platform.claude.com/docs/en/api/agent-sdk/typescript)
- [Example Workflows](./examples/workflows/)
- [GitHub Issues](https://github.com/your-org/code-review-agent/issues)

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with Claude Agent SDK** | [Documentation](https://platform.claude.com/docs) | [Examples](./examples/)
