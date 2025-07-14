#!/usr/bin/env node
/**
 * Fix for puppeteer-core Debug.ts IIFE syntax error
 * This script patches the puppeteer-core debug files to fix the
 * "TypeError: (intermediate value) is not a function" error
 */

const fs = require('fs');
const path = require('path');

const filesToPatch = [
  'node_modules/puppeteer-core/src/common/Debug.ts',
  'node_modules/puppeteer-core/lib/cjs/puppeteer/common/Debug.js',
  'node_modules/puppeteer-core/lib/esm/puppeteer/common/Debug.js'
];

const oldPattern = /\(await importDebug\(\)\)\(prefix\)\(logArgs\);/g;
const newReplacement = `try {
        const debugModule = await importDebug();
        const debugFn = debugModule(prefix);
        debugFn(...logArgs);
      } catch (error) {
        // Ignore debug errors in test environment
      }`;

filesToPatch.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (fs.existsSync(fullPath)) {
    console.log(`Patching ${filePath}...`);
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace the problematic pattern
    content = content.replace(oldPattern, newReplacement);
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ Successfully patched ${filePath}`);
  } else {
    console.log(`⚠ File not found: ${filePath}`);
  }
});

console.log('Puppeteer debug fix applied successfully!');