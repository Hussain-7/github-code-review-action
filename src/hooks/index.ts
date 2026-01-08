import * as fs from 'node:fs';
import * as path from 'node:path';
import type { HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '../utils/logger';

/**
 * Hook that logs all file changes to audit log
 */
// biome-ignore lint/suspicious/useAwait: Hook callback must be async to match type signature
export const fileChangeAuditHook: HookCallback = async (input) => {
  if ('tool_input' in input && input.tool_input && typeof input.tool_input === 'object') {
    const toolInput = input.tool_input as Record<string, unknown>;
    const filePath = toolInput.file_path as string;

    logger.audit({
      event: 'file_change',
      sessionId: input.session_id,
      toolName: input.hook_event_name,
      filePath,
      timestamp: new Date().toISOString(),
    });
  }

  return {};
};

/**
 * Hook that validates file operations
 */
// biome-ignore lint/suspicious/useAwait: Hook callback must be async to match type signature
export const fileValidationHook: HookCallback = async (input) => {
  if (
    input.hook_event_name === 'PreToolUse' &&
    'tool_name' in input &&
    (input.tool_name === 'Edit' || input.tool_name === 'Write')
  ) {
    const toolInput = input.tool_input as Record<string, unknown>;
    const filePath = toolInput.file_path as string;

    // Prevent editing node_modules or other protected directories
    if (filePath.includes('node_modules') || filePath.includes('.git')) {
      logger.warn(`Blocked attempt to modify protected file: ${filePath}`);
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Cannot modify protected directories',
        },
      };
    }
  }

  return {};
};

/**
 * Hook that tracks tool usage statistics
 */
// biome-ignore lint/suspicious/useAwait: Hook callback must be async to match type signature
export const toolUsageStatsHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'PostToolUse') {
    const stats = {
      sessionId: input.session_id,
      toolName: 'tool_name' in input ? input.tool_name : 'unknown',
      timestamp: new Date().toISOString(),
    };

    logger.debug('Tool used', stats);
    logger.audit({
      event: 'tool_usage',
      ...stats,
    });
  }

  return {};
};

/**
 * Hook that logs session lifecycle events
 */
// biome-ignore lint/suspicious/useAwait: Hook callback must be async to match type signature
export const sessionLifecycleHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'SessionStart') {
    logger.info(`Review session started: ${input.session_id}`);
    logger.audit({
      event: 'session_start',
      sessionId: input.session_id,
      source: 'source' in input ? input.source : 'unknown',
    });
  }

  if (input.hook_event_name === 'SessionEnd') {
    logger.info(`Review session ended: ${input.session_id}`);
    logger.audit({
      event: 'session_end',
      sessionId: input.session_id,
      reason: 'reason' in input ? input.reason : 'unknown',
    });
  }

  return {};
};

/**
 * Hook that monitors agent errors
 */
// biome-ignore lint/suspicious/useAwait: Hook callback must be async to match type signature
export const errorMonitoringHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'PostToolUseFailure') {
    const errorDetails = {
      sessionId: input.session_id,
      toolName: 'tool_name' in input ? input.tool_name : 'unknown',
      error: 'error' in input ? input.error : 'Unknown error',
      timestamp: new Date().toISOString(),
    };

    logger.error('Tool execution failed', errorDetails);
    logger.audit({
      event: 'tool_error',
      ...errorDetails,
    });
  }

  return {};
};

/**
 * Hook that saves review progress
 */
// biome-ignore lint/suspicious/useAwait: Hook callback must be async to match type signature
export const progressSaveHook: HookCallback = async (input) => {
  if (input.hook_event_name === 'PostToolUse') {
    const progressDir = path.join(input.cwd, 'logs', 'progress');
    const progressFile = path.join(progressDir, `${input.session_id}.json`);

    try {
      if (!fs.existsSync(progressDir)) {
        fs.mkdirSync(progressDir, { recursive: true });
      }

      const progress = {
        sessionId: input.session_id,
        lastUpdate: new Date().toISOString(),
        toolName: 'tool_name' in input ? input.tool_name : 'unknown',
      };

      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    } catch (error) {
      logger.debug('Failed to save progress', { error });
    }
  }

  return {};
};

/**
 * Creates a custom hook that executes a callback function
 */
export function createCustomHook(callback: (input: unknown) => Promise<void> | void): HookCallback {
  return async (input) => {
    try {
      await callback(input);
    } catch (error) {
      logger.error('Custom hook failed', { error });
    }
    return {};
  };
}

/**
 * Default hooks configuration
 */
export const defaultHooks = {
  PreToolUse: [{ hooks: [fileValidationHook] }],
  PostToolUse: [
    { matcher: 'Edit|Write', hooks: [fileChangeAuditHook, progressSaveHook] },
    { hooks: [toolUsageStatsHook] },
  ],
  PostToolUseFailure: [{ hooks: [errorMonitoringHook] }],
  SessionStart: [{ hooks: [sessionLifecycleHook] }],
  SessionEnd: [{ hooks: [sessionLifecycleHook] }],
};
