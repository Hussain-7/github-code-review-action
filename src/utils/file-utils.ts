import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Check if a file matches any of the exclude patterns
 */
export function shouldExcludeFile(filePath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((pattern) => {
    const regex = globToRegex(pattern);
    return regex.test(filePath);
  });
}

/**
 * Check if a file matches any of the include patterns
 */
export function shouldIncludeFile(filePath: string, includePatterns: string[]): boolean {
  if (includePatterns.length === 0) {
    return true;
  }

  return includePatterns.some((pattern) => {
    const regex = globToRegex(pattern);
    return regex.test(filePath);
  });
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regexPattern}$`);
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Read file content safely
 */
export function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (_error) {
    return null;
  }
}

/**
 * Get relative path from cwd
 */
export function getRelativePath(filePath: string, cwd: string = process.cwd()): string {
  return path.relative(cwd, filePath);
}

/**
 * Ensure directory exists
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * Check if path is a directory
 */
export function isDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}
