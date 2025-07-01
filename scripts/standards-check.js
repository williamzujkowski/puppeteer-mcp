#!/usr/bin/env node

/**
 * Standards compliance check script
 * Verifies code follows established standards
 */

import { execSync } from 'child_process';

console.log('📋 Running standards compliance checks...\n');

const checks = [
  {
    name: 'TypeScript Compilation',
    command: 'npm run typecheck',
    emoji: '🔧',
  },
  {
    name: 'ESLint',
    command: 'npm run lint',
    emoji: '📝',
  },
  {
    name: 'Prettier Formatting',
    command: 'npm run format:check',
    emoji: '💅',
  },
  {
    name: 'Unit Tests',
    command: 'npm test',
    emoji: '🧪',
  },
  {
    name: 'Security Audit',
    command: 'npm audit --audit-level=high',
    emoji: '🔒',
  },
];

let hasErrors = false;

for (const check of checks) {
  process.stdout.write(`${check.emoji} Running ${check.name}...\n`);
  try {
    execSync(check.command, { stdio: 'inherit' });
    process.stdout.write(`✅ ${check.name} passed\n\n`);
  } catch (error) {
    process.stderr.write(`❌ ${check.name} failed\n\n`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.stderr.write('\n❌ Standards compliance checks failed\n');
  process.exit(1);
} else {
  process.stdout.write('\n✅ All standards compliance checks passed\n');
}