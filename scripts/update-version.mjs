#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const currentVersion = packageJson.version;

console.log(`🔄 Updating documentation to version ${currentVersion}...`);

// Patterns to match version numbers
const versionPatterns = [
  // Match v1.0.x format
  /v1\.0\.\d+/g,
  // Match plain 1.0.x format in specific contexts
  /(?:version|v|Version|V):\s*1\.0\.\d+/g,
  // Match NPM package version references
  /puppeteer-mcp\)?\s*v?1\.0\.\d+/g,
  // Match version in package references like "package": "1.0.x"
  /(?:"version":\s*"|package.*version.*:|NPM Package.*v)1\.0\.\d+/g,
];

// Files and directories to update
const filesToUpdate = [
  'CLAUDE.md',
  'README.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'NPM_PUBLISHING_CHECKLIST.md',
];

const directoriesToSearch = [
  'starlight-docs/src/content/docs',
  'testing',
  'src/mcp/auth',
];

// Function to recursively find all markdown files
function findMarkdownFiles(dir, files = []) {
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and .git directories
        if (item !== 'node_modules' && item !== '.git' && item !== 'dist') {
          findMarkdownFiles(fullPath, files);
        }
      } else if (stat.isFile() && extname(item) === '.md') {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not read directory ${dir}: ${error.message}`);
  }
  
  return files;
}

// Function to update version in a file
function updateVersionInFile(filePath, dryRun = false) {
  try {
    let content = readFileSync(filePath, 'utf8');
    const originalContent = content;
    let updatedCount = 0;

    // Apply each pattern
    for (const pattern of versionPatterns) {
      const matches = content.match(pattern) || [];
      for (const match of matches) {
        // Extract the version number
        const versionMatch = match.match(/1\.0\.\d+/);
        if (versionMatch && versionMatch[0] !== currentVersion) {
          const newMatch = match.replace(/1\.0\.\d+/, currentVersion);
          content = content.replace(match, newMatch);
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      if (dryRun) {
        console.log(`📄 Would update ${filePath}: ${updatedCount} version reference(s)`);
      } else {
        writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Updated ${filePath}: ${updatedCount} version reference(s)`);
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}: ${error.message}`);
    return false;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  if (dryRun) {
    console.log('🔍 Running in dry-run mode (no files will be modified)...\n');
  }

  let totalFilesUpdated = 0;
  let totalFilesChecked = 0;

  // Update specific files
  console.log('📋 Checking primary documentation files...');
  for (const file of filesToUpdate) {
    const filePath = join(projectRoot, file);
    totalFilesChecked++;
    if (updateVersionInFile(filePath, dryRun)) {
      totalFilesUpdated++;
    }
  }

  // Search directories for markdown files
  console.log('\n📁 Searching documentation directories...');
  for (const dir of directoriesToSearch) {
    const dirPath = join(projectRoot, dir);
    const markdownFiles = findMarkdownFiles(dirPath);
    
    for (const file of markdownFiles) {
      totalFilesChecked++;
      if (updateVersionInFile(file, dryRun)) {
        totalFilesUpdated++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Version Update Summary');
  console.log('='.repeat(60));
  console.log(`Current version: ${currentVersion}`);
  console.log(`Files checked: ${totalFilesChecked}`);
  console.log(`Files ${dryRun ? 'to be updated' : 'updated'}: ${totalFilesUpdated}`);
  
  if (!dryRun && totalFilesUpdated > 0) {
    console.log('\n💡 Don\'t forget to commit these changes!');
    console.log('   git add -A');
    console.log(`   git commit -m "chore: update documentation to version ${currentVersion}"`);
  }
  
  if (dryRun && totalFilesUpdated > 0) {
    console.log('\n💡 Run without --dry-run to apply these changes:');
    console.log('   npm run update:version');
  }
}

// Run the script
main();