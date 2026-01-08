import * as fs from 'node:fs';
import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private logLevel: LogLevel;
  private auditLogPath?: string;

  constructor(logLevel: LogLevel = 'info', enableAuditLog = false) {
    this.logLevel = logLevel;

    if (enableAuditLog) {
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      this.auditLogPath = path.join(logsDir, `audit-${Date.now()}.log`);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  audit(entry: Record<string, unknown>): void {
    if (!this.auditLogPath) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    fs.appendFileSync(this.auditLogPath, `${JSON.stringify(logEntry)}\n`);
  }

  success(message: string): void {
    // biome-ignore lint/suspicious/noConsoleLog: CLI output is intentional
    console.log(`\u2713 ${message}`);
  }

  getAuditLogPath(): string | undefined {
    return this.auditLogPath;
  }
}

// Default logger instance
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'info',
  process.env.ENABLE_AUDIT_LOG === 'true'
);
