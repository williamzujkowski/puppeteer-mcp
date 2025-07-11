#!/usr/bin/env node

/**
 * Quick test to verify the paperclips automation demo components
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Verifying Paperclips Automation Demo Setup...\n');

const checks = [
  {
    name: 'Demo script exists',
    path: path.join(__dirname, 'paperclips-automation-demo.js'),
    type: 'file',
  },
  {
    name: 'README exists',
    path: path.join(__dirname, 'README-DEMO.md'),
    type: 'file',
  },
  {
    name: 'Run script exists',
    path: path.join(__dirname, 'run-demo.sh'),
    type: 'file',
  },
  {
    name: 'Run script is executable',
    path: path.join(__dirname, 'run-demo.sh'),
    type: 'executable',
  },
  {
    name: 'Project dist directory exists',
    path: path.join(__dirname, '../../dist'),
    type: 'directory',
  },
  {
    name: 'Browser pool module exists',
    path: path.join(__dirname, '../../dist/puppeteer/pool/browser-pool.js'),
    type: 'file',
  },
];

let allPassed = true;

checks.forEach((check) => {
  try {
    const stats = fs.statSync(check.path);

    if (check.type === 'file' && stats.isFile()) {
      console.log(`✅ ${check.name}`);
    } else if (check.type === 'directory' && stats.isDirectory()) {
      console.log(`✅ ${check.name}`);
    } else if (check.type === 'executable' && stats.isFile() && stats.mode & 0o111) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name} - Wrong type`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ ${check.name} - Not found`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('✅ All checks passed! The demo is ready to run.');
  console.log('\nTo run the demo:');
  console.log('  cd ' + __dirname);
  console.log('  ./run-demo.sh');
  console.log('\nOr directly:');
  console.log('  node paperclips-automation-demo.js');
} else {
  console.log('❌ Some checks failed. Please ensure the project is built:');
  console.log('  cd ' + path.join(__dirname, '../..'));
  console.log('  npm run build');
  process.exit(1);
}

// Test import
try {
  await import('./paperclips-automation-demo.js');
  console.log('\n✅ Demo module imports successfully');
} catch (error) {
  console.log('\n❌ Failed to import demo module:', error.message);
  process.exit(1);
}
