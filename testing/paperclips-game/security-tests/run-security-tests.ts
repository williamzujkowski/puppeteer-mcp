#!/usr/bin/env node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  suite: string;
  passed: boolean;
  tests: number;
  failures: number;
  errors: string[];
  duration: number;
  vulnerabilities: string[];
}

interface SecurityReport {
  timestamp: string;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalDuration: number;
  criticalVulnerabilities: string[];
  highVulnerabilities: string[];
  mediumVulnerabilities: string[];
  lowVulnerabilities: string[];
  recommendations: string[];
  testResults: TestResult[];
}

const TEST_FILES = [
  'xss-prevention.test.ts',
  'path-traversal.test.ts',
  'command-injection.test.ts',
  'ssrf-prevention.test.ts',
  'csp-bypass.test.ts',
  'cookie-security.test.ts',
  'auth-bypass.test.ts',
  'resource-exhaustion.test.ts',
  'prototype-pollution.test.ts',
  'unsafe-js-execution.test.ts'
];

async function runSecurityTests(): Promise<SecurityReport> {
  console.log('🔒 Running Comprehensive Security Tests for puppeteer-mcp...\n');

  const report: SecurityReport = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalDuration: 0,
    criticalVulnerabilities: [],
    highVulnerabilities: [],
    mediumVulnerabilities: [],
    lowVulnerabilities: [],
    recommendations: [],
    testResults: []
  };

  const testDir = path.dirname(__filename);

  // Run each test suite
  for (const testFile of TEST_FILES) {
    const testPath = path.join(testDir, testFile);
    console.log(`\n📋 Running ${testFile}...`);

    const startTime = Date.now();
    const result: TestResult = {
      suite: testFile,
      passed: false,
      tests: 0,
      failures: 0,
      errors: [],
      duration: 0,
      vulnerabilities: []
    };

    try {
      // Run Jest for the specific test file
      const output = execSync(
        `npx jest ${testPath} --json --outputFile=/tmp/jest-output.json`,
        { 
          encoding: 'utf8',
          stdio: 'pipe'
        }
      );

      // Parse Jest output
      const jestResults = JSON.parse(fs.readFileSync('/tmp/jest-output.json', 'utf8'));
      
      result.passed = jestResults.success;
      result.tests = jestResults.numTotalTests;
      result.failures = jestResults.numFailedTests;
      result.duration = Date.now() - startTime;

      // Extract vulnerability information from test results
      analyzeTestResults(jestResults, result, report);

    } catch (error: any) {
      result.passed = false;
      result.errors.push(error.message);
      result.duration = Date.now() - startTime;

      // Try to parse partial results
      try {
        if (fs.existsSync('/tmp/jest-output.json')) {
          const jestResults = JSON.parse(fs.readFileSync('/tmp/jest-output.json', 'utf8'));
          analyzeTestResults(jestResults, result, report);
        }
      } catch {}
    }

    report.testResults.push(result);
    report.totalTests += result.tests;
    report.totalDuration += result.duration;

    if (result.passed) {
      report.totalPassed += result.tests - result.failures;
      report.totalFailed += result.failures;
    } else {
      report.totalFailed += result.tests;
    }

    // Clean up
    if (fs.existsSync('/tmp/jest-output.json')) {
      fs.unlinkSync('/tmp/jest-output.json');
    }
  }

  // Generate recommendations based on findings
  generateRecommendations(report);

  return report;
}

function analyzeTestResults(jestResults: any, result: TestResult, report: SecurityReport) {
  if (!jestResults.testResults) return;

  for (const testSuite of jestResults.testResults) {
    for (const test of testSuite.assertionResults || []) {
      if (test.status === 'failed') {
        // Analyze failure message for vulnerability indicators
        const message = test.failureMessages?.join(' ') || '';
        
        if (message.includes('XSS') || message.includes('script injection')) {
          const vuln = 'XSS vulnerability: Script injection possible';
          result.vulnerabilities.push(vuln);
          report.criticalVulnerabilities.push(vuln);
        }
        
        if (message.includes('SQL injection')) {
          const vuln = 'SQL Injection vulnerability detected';
          result.vulnerabilities.push(vuln);
          report.criticalVulnerabilities.push(vuln);
        }
        
        if (message.includes('path traversal') || message.includes('directory traversal')) {
          const vuln = 'Path Traversal vulnerability: File system access possible';
          result.vulnerabilities.push(vuln);
          report.highVulnerabilities.push(vuln);
        }
        
        if (message.includes('SSRF') || message.includes('internal network')) {
          const vuln = 'SSRF vulnerability: Internal network access possible';
          result.vulnerabilities.push(vuln);
          report.highVulnerabilities.push(vuln);
        }
        
        if (message.includes('command injection') || message.includes('command execution')) {
          const vuln = 'Command Injection vulnerability detected';
          result.vulnerabilities.push(vuln);
          report.criticalVulnerabilities.push(vuln);
        }
        
        if (message.includes('prototype pollution')) {
          const vuln = 'Prototype Pollution vulnerability detected';
          result.vulnerabilities.push(vuln);
          report.highVulnerabilities.push(vuln);
        }
        
        if (message.includes('CSP') || message.includes('Content Security Policy')) {
          const vuln = 'CSP bypass possible or missing CSP headers';
          result.vulnerabilities.push(vuln);
          report.mediumVulnerabilities.push(vuln);
        }
        
        if (message.includes('cookie') && message.includes('secure')) {
          const vuln = 'Insecure cookie configuration detected';
          result.vulnerabilities.push(vuln);
          report.mediumVulnerabilities.push(vuln);
        }
        
        if (message.includes('authentication') || message.includes('authorization')) {
          const vuln = 'Authentication/Authorization bypass possible';
          result.vulnerabilities.push(vuln);
          report.criticalVulnerabilities.push(vuln);
        }
        
        if (message.includes('rate limit') || message.includes('brute force')) {
          const vuln = 'Missing rate limiting: Brute force attacks possible';
          result.vulnerabilities.push(vuln);
          report.mediumVulnerabilities.push(vuln);
        }
        
        if (message.includes('resource exhaustion') || message.includes('DoS')) {
          const vuln = 'Resource exhaustion/DoS vulnerability detected';
          result.vulnerabilities.push(vuln);
          report.highVulnerabilities.push(vuln);
        }
      }
    }
  }
}

function generateRecommendations(report: SecurityReport) {
  // Critical recommendations
  if (report.criticalVulnerabilities.length > 0) {
    report.recommendations.push('🚨 CRITICAL: Address all critical vulnerabilities immediately before production deployment');
    
    if (report.criticalVulnerabilities.some(v => v.includes('XSS'))) {
      report.recommendations.push('• Implement strict input validation and output encoding');
      report.recommendations.push('• Enable Content Security Policy (CSP) with restrictive directives');
      report.recommendations.push('• Use DOMPurify or similar libraries for HTML sanitization');
    }
    
    if (report.criticalVulnerabilities.some(v => v.includes('SQL'))) {
      report.recommendations.push('• Use parameterized queries or prepared statements');
      report.recommendations.push('• Implement input validation and escaping');
      report.recommendations.push('• Apply principle of least privilege for database access');
    }
    
    if (report.criticalVulnerabilities.some(v => v.includes('Command'))) {
      report.recommendations.push('• Never pass user input directly to system commands');
      report.recommendations.push('• Use safe APIs instead of shell commands where possible');
      report.recommendations.push('• Implement strict input validation and sanitization');
    }
    
    if (report.criticalVulnerabilities.some(v => v.includes('Authentication'))) {
      report.recommendations.push('• Implement proper session management');
      report.recommendations.push('• Use secure authentication mechanisms (JWT with proper validation)');
      report.recommendations.push('• Enable rate limiting on authentication endpoints');
    }
  }

  // High severity recommendations
  if (report.highVulnerabilities.length > 0) {
    report.recommendations.push('\n⚠️ HIGH: Address high severity issues before production');
    
    if (report.highVulnerabilities.some(v => v.includes('SSRF'))) {
      report.recommendations.push('• Implement URL allowlisting for external requests');
      report.recommendations.push('• Block requests to internal IP ranges and metadata endpoints');
      report.recommendations.push('• Validate and sanitize all URLs before making requests');
    }
    
    if (report.highVulnerabilities.some(v => v.includes('Path Traversal'))) {
      report.recommendations.push('• Validate and sanitize all file paths');
      report.recommendations.push('• Use path.resolve() and ensure paths stay within allowed directories');
      report.recommendations.push('• Implement access controls for file operations');
    }
    
    if (report.highVulnerabilities.some(v => v.includes('Prototype Pollution'))) {
      report.recommendations.push('• Freeze Object.prototype and other built-in prototypes');
      report.recommendations.push('• Validate object keys before assignment');
      report.recommendations.push('• Use Map instead of objects for user-controlled keys');
    }
    
    if (report.highVulnerabilities.some(v => v.includes('DoS'))) {
      report.recommendations.push('• Implement resource limits and timeouts');
      report.recommendations.push('• Add rate limiting for resource-intensive operations');
      report.recommendations.push('• Monitor and alert on abnormal resource usage');
    }
  }

  // Medium severity recommendations
  if (report.mediumVulnerabilities.length > 0) {
    report.recommendations.push('\n⚡ MEDIUM: Improve security posture with these enhancements');
    
    if (report.mediumVulnerabilities.some(v => v.includes('CSP'))) {
      report.recommendations.push('• Implement strict Content Security Policy headers');
      report.recommendations.push('• Remove unsafe-inline and unsafe-eval from CSP');
      report.recommendations.push('• Use nonces or hashes for inline scripts if needed');
    }
    
    if (report.mediumVulnerabilities.some(v => v.includes('cookie'))) {
      report.recommendations.push('• Set Secure, HttpOnly, and SameSite flags on all cookies');
      report.recommendations.push('• Implement proper session management');
      report.recommendations.push('• Use short session timeouts and regenerate session IDs');
    }
    
    if (report.mediumVulnerabilities.some(v => v.includes('rate limit'))) {
      report.recommendations.push('• Implement rate limiting on all endpoints');
      report.recommendations.push('• Use progressive delays for failed authentication attempts');
      report.recommendations.push('• Monitor and alert on suspicious patterns');
    }
  }

  // General security recommendations
  report.recommendations.push('\n✅ GENERAL: Security best practices');
  report.recommendations.push('• Keep all dependencies up to date');
  report.recommendations.push('• Implement security headers (X-Frame-Options, X-Content-Type-Options, etc.)');
  report.recommendations.push('• Use HTTPS everywhere with HSTS');
  report.recommendations.push('• Implement proper logging and monitoring');
  report.recommendations.push('• Conduct regular security audits and penetration testing');
  report.recommendations.push('• Follow OWASP guidelines and security best practices');
  report.recommendations.push('• Implement defense in depth - multiple layers of security');
  report.recommendations.push('• Train developers on secure coding practices');
}

function generateReport(report: SecurityReport) {
  console.log('\n' + '='.repeat(80));
  console.log('🔒 SECURITY TEST REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📅 Timestamp: ${report.timestamp}`);
  console.log(`⏱️ Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
  console.log(`\n📊 Test Summary:`);
  console.log(`   Total Tests: ${report.totalTests}`);
  console.log(`   ✅ Passed: ${report.totalPassed}`);
  console.log(`   ❌ Failed: ${report.totalFailed}`);
  console.log(`   Success Rate: ${((report.totalPassed / report.totalTests) * 100).toFixed(2)}%`);

  console.log('\n🚨 Vulnerability Summary:');
  console.log(`   Critical: ${report.criticalVulnerabilities.length}`);
  console.log(`   High: ${report.highVulnerabilities.length}`);
  console.log(`   Medium: ${report.mediumVulnerabilities.length}`);
  console.log(`   Low: ${report.lowVulnerabilities.length}`);

  if (report.criticalVulnerabilities.length > 0) {
    console.log('\n🔴 CRITICAL Vulnerabilities:');
    report.criticalVulnerabilities.forEach((vuln, i) => {
      console.log(`   ${i + 1}. ${vuln}`);
    });
  }

  if (report.highVulnerabilities.length > 0) {
    console.log('\n🟠 HIGH Vulnerabilities:');
    report.highVulnerabilities.forEach((vuln, i) => {
      console.log(`   ${i + 1}. ${vuln}`);
    });
  }

  if (report.mediumVulnerabilities.length > 0) {
    console.log('\n🟡 MEDIUM Vulnerabilities:');
    report.mediumVulnerabilities.forEach((vuln, i) => {
      console.log(`   ${i + 1}. ${vuln}`);
    });
  }

  console.log('\n📋 Test Results by Suite:');
  report.testResults.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`\n   ${status} ${result.suite}`);
    console.log(`      Tests: ${result.tests}, Failures: ${result.failures}`);
    console.log(`      Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.vulnerabilities.length > 0) {
      console.log('      Vulnerabilities Found:');
      result.vulnerabilities.forEach(vuln => {
        console.log(`        - ${vuln}`);
      });
    }
  });

  console.log('\n💡 Recommendations:');
  report.recommendations.forEach(rec => {
    console.log(rec);
  });

  console.log('\n' + '='.repeat(80));
  
  // Overall security assessment
  const totalVulnerabilities = 
    report.criticalVulnerabilities.length +
    report.highVulnerabilities.length +
    report.mediumVulnerabilities.length +
    report.lowVulnerabilities.length;

  if (totalVulnerabilities === 0) {
    console.log('✅ SECURITY STATUS: EXCELLENT - No vulnerabilities detected!');
  } else if (report.criticalVulnerabilities.length > 0) {
    console.log('🚨 SECURITY STATUS: CRITICAL - Immediate action required!');
  } else if (report.highVulnerabilities.length > 0) {
    console.log('⚠️ SECURITY STATUS: HIGH RISK - Address issues before production!');
  } else if (report.mediumVulnerabilities.length > 0) {
    console.log('⚡ SECURITY STATUS: MODERATE - Improvements recommended!');
  } else {
    console.log('✅ SECURITY STATUS: GOOD - Minor issues only');
  }
  
  console.log('='.repeat(80));

  // Save detailed report to file
  const reportPath = path.join(path.dirname(__filename), 'security-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  // Save markdown report
  const markdownReport = generateMarkdownReport(report);
  const mdPath = path.join(path.dirname(__filename), 'SECURITY_REPORT.md');
  fs.writeFileSync(mdPath, markdownReport);
  console.log(`📄 Markdown report saved to: ${mdPath}`);
}

function generateMarkdownReport(report: SecurityReport): string {
  let md = '# Security Test Report\n\n';
  md += `**Generated:** ${report.timestamp}\n\n`;
  md += `## Executive Summary\n\n`;
  md += `- **Total Tests:** ${report.totalTests}\n`;
  md += `- **Passed:** ${report.totalPassed} (${((report.totalPassed / report.totalTests) * 100).toFixed(2)}%)\n`;
  md += `- **Failed:** ${report.totalFailed}\n`;
  md += `- **Duration:** ${(report.totalDuration / 1000).toFixed(2)} seconds\n\n`;

  md += `## Vulnerability Summary\n\n`;
  md += `| Severity | Count |\n`;
  md += `|----------|-------|\n`;
  md += `| Critical | ${report.criticalVulnerabilities.length} |\n`;
  md += `| High | ${report.highVulnerabilities.length} |\n`;
  md += `| Medium | ${report.mediumVulnerabilities.length} |\n`;
  md += `| Low | ${report.lowVulnerabilities.length} |\n\n`;

  if (report.criticalVulnerabilities.length > 0) {
    md += `## Critical Vulnerabilities\n\n`;
    report.criticalVulnerabilities.forEach((vuln, i) => {
      md += `${i + 1}. ${vuln}\n`;
    });
    md += '\n';
  }

  if (report.highVulnerabilities.length > 0) {
    md += `## High Severity Vulnerabilities\n\n`;
    report.highVulnerabilities.forEach((vuln, i) => {
      md += `${i + 1}. ${vuln}\n`;
    });
    md += '\n';
  }

  if (report.mediumVulnerabilities.length > 0) {
    md += `## Medium Severity Vulnerabilities\n\n`;
    report.mediumVulnerabilities.forEach((vuln, i) => {
      md += `${i + 1}. ${vuln}\n`;
    });
    md += '\n';
  }

  md += `## Test Results\n\n`;
  md += `| Test Suite | Status | Tests | Failures | Duration |\n`;
  md += `|------------|--------|-------|----------|----------|\n`;
  report.testResults.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    md += `| ${result.suite} | ${status} | ${result.tests} | ${result.failures} | ${(result.duration / 1000).toFixed(2)}s |\n`;
  });
  md += '\n';

  md += `## Recommendations\n\n`;
  report.recommendations.forEach(rec => {
    md += `${rec}\n`;
  });

  return md;
}

// Main execution
async function main() {
  try {
    const report = await runSecurityTests();
    generateReport(report);
    
    // Exit with appropriate code
    const hasVulnerabilities = 
      report.criticalVulnerabilities.length > 0 ||
      report.highVulnerabilities.length > 0;
    
    process.exit(hasVulnerabilities ? 1 : 0);
  } catch (error) {
    console.error('❌ Error running security tests:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}