/**
 * Base configuration parser utilities
 * @module core/config/base-parsers
 * @nist cm-7 "Least functionality"
 */

/**
 * Parse boolean environment variable
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Parse integer environment variable
 */
export function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float environment variable
 */
export function parseFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse array environment variable (comma-separated)
 */
export function parseArray(value: string | undefined, defaultValue: string[]): string[] {
  if (value === undefined || value === '') return defaultValue;
  return value.split(',').map(item => item.trim());
}

/**
 * Parse JSON environment variable
 */
export function parseJSON<T>(value: string | undefined, defaultValue: T): T {
  if (value === undefined || value === '') return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}