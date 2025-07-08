#!/usr/bin/env node

/**
 * Script to fix ESLint strict-boolean-expressions warnings
 * Run with: node scripts/fix-eslint-warnings.js
 */

const fs = require('fs');
const path = require('path');

const fixes = [
  {
    file: 'tests/acceptance/api/http-interactions.test.ts',
    lines: [47, 57],
    pattern: /if\s*\(\s*result\s*\)/g,
    replacement: 'if (result !== null && result !== undefined)',
  },
  {
    file: 'tests/acceptance/api/http-interactions.test.ts',
    line: 92,
    pattern: /response\.data/,
    replacement: 'response.data === true',
  },
  {
    file: 'tests/acceptance/basic/forms.test.ts',
    lines: [50, 60],
    pattern: /if\s*\(\s*result\s*\)/g,
    replacement: 'if (result !== null && result !== undefined)',
  },
  {
    file: 'tests/acceptance/basic/navigation.test.ts',
    lines: [48, 58],
    pattern: /if\s*\(\s*result\s*\)/g,
    replacement: 'if (result !== null && result !== undefined)',
  },
  {
    file: 'tests/acceptance/utils/mcp-client.ts',
    lines: [110, 130, 137, 161, 167, 188, 220, 250, 285, 315, 346, 348],
    pattern: /if\s*\(\s*(.+?)\s*\)\s*{/g,
    replacement: 'if ($1 !== null && $1 !== undefined) {',
  },
  {
    file: 'tests/acceptance/utils/mcp-client.ts',
    lines: [193, 225, 255, 290, 320],
    pattern: /if\s*\(\s*(!?)(\w+)\s*\)/g,
    replacement: 'if ($1($2 && $2.length > 0))',
  },
  {
    file: 'tests/acceptance/utils/test-helpers.ts',
    line: 37,
    pattern: /if\s*\(\s*browser\s*\)/g,
    replacement: 'if (browser !== null && browser !== undefined)',
  },
  {
    file: 'tests/acceptance/workflows/authentication.test.ts',
    lines: [49, 59],
    pattern: /if\s*\(\s*result\s*\)/g,
    replacement: 'if (result !== null && result !== undefined)',
  },
  {
    file: 'tests/acceptance/workflows/ecommerce.test.ts',
    lines: [50, 60],
    pattern: /if\s*\(\s*result\s*\)/g,
    replacement: 'if (result !== null && result !== undefined)',
  },
  {
    file: 'tests/unit/mcp/mcp-server.test.ts',
    lines: [307, 312, 317],
    pattern: /if\s*\(\s*(!?)(\w+)\s*\)/g,
    replacement: 'if ($1($2 && $2.length > 0))',
  },
  {
    file: 'tests/unit/mcp/transport.test.ts',
    line: 156,
    pattern: /if\s*\(\s*transport\s*\)/g,
    replacement: 'if (transport !== null && transport !== undefined)',
  },
];

console.log('ESLint Strict Boolean Expressions Fix Script');
console.log('===========================================\n');

console.log('This script will help identify locations that need fixes.');
console.log('Due to the complexity of the fixes, manual review is recommended.\n');

console.log('Summary of required fixes:');
console.log('1. Object conditionals: Add explicit null/undefined checks');
console.log('2. Any values: Add type guards or explicit comparisons');
console.log('3. Nullable strings: Use explicit length or null checks\n');

console.log('Files that need attention:\n');

const filesToFix = [
  {
    path: 'tests/acceptance/api/http-interactions.test.ts',
    warnings: 3,
    fixes: [
      'Line 47, 57: Change `if (result)` to `if (result !== null && result !== undefined)`',
      'Line 92: Add explicit comparison for response.data',
    ],
  },
  {
    path: 'tests/acceptance/basic/forms.test.ts',
    warnings: 2,
    fixes: ['Line 50, 60: Change `if (result)` to `if (result !== null && result !== undefined)`'],
  },
  {
    path: 'tests/acceptance/basic/navigation.test.ts',
    warnings: 2,
    fixes: ['Line 48, 58: Change `if (result)` to `if (result !== null && result !== undefined)`'],
  },
  {
    path: 'tests/acceptance/utils/mcp-client.ts',
    warnings: 17,
    fixes: [
      'Lines 110, 130, 137, 161, 167, 188, 220, 250, 285, 315, 346, 348: Add explicit null checks for any values',
      'Lines 193, 225, 255, 290, 320: Add string length checks',
    ],
  },
  {
    path: 'tests/acceptance/utils/test-helpers.ts',
    warnings: 1,
    fixes: ['Line 37: Change `if (browser)` to `if (browser !== null && browser !== undefined)`'],
  },
  {
    path: 'tests/acceptance/workflows/authentication.test.ts',
    warnings: 2,
    fixes: ['Line 49, 59: Change `if (result)` to `if (result !== null && result !== undefined)`'],
  },
  {
    path: 'tests/acceptance/workflows/ecommerce.test.ts',
    warnings: 2,
    fixes: ['Line 50, 60: Change `if (result)` to `if (result !== null && result !== undefined)`'],
  },
  {
    path: 'tests/unit/mcp/mcp-server.test.ts',
    warnings: 3,
    fixes: ['Lines 307, 312, 317: Add string length checks for nullable strings'],
  },
  {
    path: 'tests/unit/mcp/transport.test.ts',
    warnings: 1,
    fixes: [
      'Line 156: Change `if (transport)` to `if (transport !== null && transport !== undefined)`',
    ],
  },
];

filesToFix.forEach((file) => {
  console.log(`📄 ${file.path}`);
  console.log(`   Warnings: ${file.warnings}`);
  file.fixes.forEach((fix) => {
    console.log(`   - ${fix}`);
  });
  console.log('');
});

console.log('\nTo fix these issues manually:');
console.log('1. Open each file listed above');
console.log('2. Navigate to the specified line numbers');
console.log('3. Apply the suggested fixes');
console.log('4. Run `npm run lint` to verify fixes\n');

console.log('Example transformations:');
console.log('```typescript');
console.log('// Before (object conditional)');
console.log('if (result) { ... }');
console.log('');
console.log('// After');
console.log('if (result !== null && result !== undefined) { ... }');
console.log('');
console.log('// Before (nullable string)');
console.log('if (!value) { ... }');
console.log('');
console.log('// After');
console.log('if (!value || value.length === 0) { ... }');
console.log('');
console.log('// Before (any value)');
console.log('if (response.data) { ... }');
console.log('');
console.log('// After');
console.log('if (response.data === true) { ... }');
console.log('// or');
console.log('if (response.data !== null && response.data !== undefined) { ... }');
console.log('```');
