/**
 * Security validator for JavaScript and CSS code evaluation
 * @module puppeteer/actions/execution/evaluation/security-validator
 * @nist sc-18 "Mobile Code"
 * @nist si-10 "Information input validation"
 * @nist si-11 "Error handling"
 */

import type {
  SecurityValidator,
  SecurityValidationResult,
  SecurityIssue,
} from './types.js';
import {
  DANGEROUS_JS_PATTERNS,
  DANGEROUS_CSS_PATTERNS,
  SIZE_LIMITS,
} from './types.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:security-validator');

/**
 * Implementation of security validator for code evaluation
 * @nist sc-18 "Mobile code"
 * @nist si-10 "Information input validation"
 */
export class CodeSecurityValidator implements SecurityValidator {
  /**
   * Validate JavaScript code for security issues
   * @param code - JavaScript code to validate
   * @returns Security validation result
   * @nist sc-18 "Mobile code"
   */
  validateJavaScript(code: string): SecurityValidationResult {
    logger.debug('Validating JavaScript code', { 
      codeLength: code.length 
    });

    const issues: SecurityIssue[] = [];

    // Check size limits
    if (code.length > SIZE_LIMITS.MAX_JS_SIZE) {
      issues.push({
        type: 'size_limit',
        message: `JavaScript code exceeds maximum size limit (${SIZE_LIMITS.MAX_JS_SIZE} bytes)`,
        severity: 'high',
      });
    }

    // Check for dangerous patterns
    const patternIssues = this.checkDangerousPatterns(code, DANGEROUS_JS_PATTERNS);
    issues.push(...patternIssues);

    // Check bracket balance
    const bracketIssue = this.validateBracketBalance(code);
    if (bracketIssue) {
      issues.push(bracketIssue);
    }

    // Check for basic syntax issues
    const syntaxIssues = this.validateBasicSyntax(code);
    issues.push(...syntaxIssues);

    const isValid = issues.length === 0;
    const result: SecurityValidationResult = {
      isValid,
      issues,
    };

    if (!isValid) {
      result.error = `JavaScript validation failed: ${issues.length} issue(s) found`;
      logger.warn('JavaScript validation failed', {
        issueCount: issues.length,
        issues: issues.map(i => ({ type: i.type, severity: i.severity })),
      });
    } else {
      logger.debug('JavaScript validation passed');
    }

    return result;
  }

  /**
   * Validate CSS code for security issues
   * @param css - CSS code to validate
   * @returns Security validation result
   * @nist sc-18 "Mobile code"
   */
  validateCSS(css: string): SecurityValidationResult {
    logger.debug('Validating CSS code', { 
      cssLength: css.length 
    });

    const issues: SecurityIssue[] = [];

    // Check size limits
    if (css.length > SIZE_LIMITS.MAX_CSS_SIZE) {
      issues.push({
        type: 'size_limit',
        message: `CSS code exceeds maximum size limit (${SIZE_LIMITS.MAX_CSS_SIZE} bytes)`,
        severity: 'high',
      });
    }

    // Check for dangerous patterns
    const patternIssues = this.checkDangerousPatterns(css, DANGEROUS_CSS_PATTERNS);
    issues.push(...patternIssues);

    // Check for CSS-specific issues
    const cssIssues = this.validateCSSSpecific(css);
    issues.push(...cssIssues);

    const isValid = issues.length === 0;
    const result: SecurityValidationResult = {
      isValid,
      issues,
    };

    if (!isValid) {
      result.error = `CSS validation failed: ${issues.length} issue(s) found`;
      logger.warn('CSS validation failed', {
        issueCount: issues.length,
        issues: issues.map(i => ({ type: i.type, severity: i.severity })),
      });
    } else {
      logger.debug('CSS validation passed');
    }

    return result;
  }

  /**
   * Check for dangerous patterns in code
   * @param code - Code to check
   * @param patterns - Regular expression patterns to check
   * @returns Array of detected security issues
   * @nist sc-18 "Mobile code"
   */
  checkDangerousPatterns(code: string, patterns: readonly RegExp[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (const pattern of patterns) {
      if (pattern.test(code)) {
        issues.push({
          type: 'dangerous_pattern',
          message: `Potentially dangerous pattern detected: ${pattern.source}`,
          rule: pattern.source,
          severity: this.getSeverityForPattern(pattern),
        });
      }
    }

    return issues;
  }

  /**
   * Validate bracket balance in JavaScript code
   * @param code - Code to validate
   * @returns Security issue if brackets are unbalanced
   */
  private validateBracketBalance(code: string): SecurityIssue | null {
    const openBrackets = (code.match(/\{/g) ?? []).length;
    const closeBrackets = (code.match(/\}/g) ?? []).length;

    if (openBrackets !== closeBrackets) {
      return {
        type: 'structure_error',
        message: `Unbalanced brackets: ${openBrackets} opening, ${closeBrackets} closing`,
        severity: 'medium',
      };
    }

    return null;
  }

  /**
   * Validate basic JavaScript syntax
   * @param code - Code to validate
   * @returns Array of syntax issues
   */
  private validateBasicSyntax(code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check for unterminated strings (basic check)
    const singleQuotes = (code.match(/'/g) ?? []).length;
    const doubleQuotes = (code.match(/"/g) ?? []).length;

    if (singleQuotes % 2 !== 0) {
      issues.push({
        type: 'syntax_error',
        message: 'Unterminated single-quoted string detected',
        severity: 'medium',
      });
    }

    if (doubleQuotes % 2 !== 0) {
      issues.push({
        type: 'syntax_error',
        message: 'Unterminated double-quoted string detected',
        severity: 'medium',
      });
    }

    // Check for excessive nesting (potential ReDoS)
    const nestingDepth = this.calculateNestingDepth(code);
    if (nestingDepth > 20) {
      issues.push({
        type: 'structure_error',
        message: `Excessive nesting depth detected: ${nestingDepth}`,
        severity: 'medium',
      });
    }

    return issues;
  }

  /**
   * Validate CSS-specific security issues
   * @param css - CSS code to validate
   * @returns Array of CSS-specific issues
   */
  private validateCSSSpecific(css: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check for @import with potentially malicious URLs
    const importMatches = css.match(/@import\s+url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi);
    if (importMatches) {
      for (const match of importMatches) {
        const urlMatch = match.match(/url\s*\(\s*["']?([^"')]+)["']?\s*\)/i);
        const extractedUrl = urlMatch?.[1];
        if (extractedUrl && typeof extractedUrl === 'string') {
          if (this.isPotentiallyMaliciousUrl(extractedUrl)) {
            issues.push({
              type: 'dangerous_pattern',
              message: `Potentially malicious @import URL detected: ${extractedUrl}`,
              severity: 'high',
            });
          }
        }
      }
    }

    // Check for excessive CSS complexity
    const selectorCount = (css.match(/[^{}]+\{/g) ?? []).length;
    if (selectorCount > 1000) {
      issues.push({
        type: 'size_limit',
        message: `Excessive CSS complexity: ${selectorCount} selectors`,
        severity: 'medium',
      });
    }

    return issues;
  }

  /**
   * Calculate nesting depth of brackets
   * @param code - Code to analyze
   * @returns Maximum nesting depth
   */
  private calculateNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of code) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }

    return maxDepth;
  }

  /**
   * Check if URL is potentially malicious
   * @param url - URL to check
   * @returns True if potentially malicious
   */
  private isPotentiallyMaliciousUrl(url: string): boolean {
    const maliciousPatterns = [
      /^javascript:/i,
      /^data:.*script/i,
      /^vbscript:/i,
      /^file:/i,
      /^ftp:/i,
    ];

    return maliciousPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Get severity level for a specific pattern
   * @param pattern - Regular expression pattern
   * @returns Severity level
   */
  private getSeverityForPattern(pattern: RegExp): SecurityIssue['severity'] {
    const source = pattern.source.toLowerCase();

    // Critical patterns
    if (source.includes('eval') || source.includes('function')) {
      return 'critical';
    }

    // High-risk patterns
    if (source.includes('location') || source.includes('xmlhttprequest') || source.includes('fetch')) {
      return 'high';
    }

    // Medium-risk patterns
    if (source.includes('timeout') || source.includes('interval')) {
      return 'medium';
    }

    // Default to medium
    return 'medium';
  }

  /**
   * Get summary of validation results
   * @param result - Validation result to summarize
   * @returns Summary object
   */
  getValidationSummary(result: SecurityValidationResult): {
    isValid: boolean;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  } {
    if (!result.issues) {
      return {
        isValid: result.isValid,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };
    }

    const summary = {
      isValid: result.isValid,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    };

    for (const issue of result.issues) {
      switch (issue.severity) {
        case 'critical':
          summary.criticalCount++;
          break;
        case 'high':
          summary.highCount++;
          break;
        case 'medium':
          summary.mediumCount++;
          break;
        case 'low':
          summary.lowCount++;
          break;
      }
    }

    return summary;
  }
}

/**
 * Create a new security validator instance
 * @returns Security validator instance
 * @nist sc-18 "Mobile code"
 */
export function createSecurityValidator(): SecurityValidator {
  return new CodeSecurityValidator();
}