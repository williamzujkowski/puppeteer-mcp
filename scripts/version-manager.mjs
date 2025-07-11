#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Helper functions
function getCurrentVersion() {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  return packageJson.version;
}

function runCommand(cmd, silent = false) {
  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf8' });
    if (!silent) console.log(output.trim());
    return output.trim();
  } catch (error) {
    console.error(`Error running command: ${cmd}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Commands
const commands = {
  check: () => {
    console.log('🔍 Checking version consistency...\n');
    const currentVersion = getCurrentVersion();
    console.log(`📦 Package version: ${currentVersion}`);

    // Run dry-run to see what would be updated
    runCommand('npm run update:version:dry', true);

    // Count outdated references
    const output = execSync('npm run update:version:dry 2>&1', {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const matches = output.match(/Files to be updated: (\d+)/);
    const outdatedCount = matches ? parseInt(matches[1]) : 0;

    if (outdatedCount > 0) {
      console.log(`\n⚠️  Found ${outdatedCount} files with outdated version references`);
      console.log('💡 Run "npm run version:sync" to update them');
      process.exit(1);
    } else {
      console.log('\n✅ All documentation versions are up to date!');
    }
  },

  sync: () => {
    console.log('🔄 Synchronizing version across documentation...\n');
    runCommand('npm run update:version');
    console.log('\n✅ Version synchronization complete!');
  },

  bump: () => {
    const bumpType = args[1] || 'patch';
    const validTypes = [
      'major',
      'minor',
      'patch',
      'premajor',
      'preminor',
      'prepatch',
      'prerelease',
    ];

    if (!validTypes.includes(bumpType)) {
      console.error(`❌ Invalid version bump type: ${bumpType}`);
      console.log(`Valid types: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    console.log(`📈 Bumping version (${bumpType})...\n`);

    // Get current version
    const currentVersion = getCurrentVersion();

    // Bump version
    runCommand(`npm version ${bumpType} --no-git-tag-version`);

    // Get new version
    const newVersion = getCurrentVersion();

    console.log(`Version bumped: ${currentVersion} → ${newVersion}`);

    // Update documentation
    console.log('\n📝 Updating documentation...');
    runCommand('npm run update:version');

    console.log(`\n✅ Version bumped to ${newVersion} and documentation updated!`);
    console.log('\n💡 Next steps:');
    console.log('   1. Review changes: git diff');
    console.log(
      '   2. Commit: git add -A && git commit -m "chore: bump version to ' + newVersion + '"',
    );
    console.log('   3. Tag: git tag v' + newVersion);
    console.log('   4. Push: git push && git push --tags');
  },

  release: () => {
    const bumpType = args[1] || 'patch';

    console.log('🚀 Starting release process...\n');

    // Check git status
    const gitStatus = runCommand('git status --porcelain', true);
    if (gitStatus) {
      console.error('❌ Working directory is not clean. Please commit or stash changes.');
      process.exit(1);
    }

    // Ensure we're on main branch
    const currentBranch = runCommand('git rev-parse --abbrev-ref HEAD', true);
    if (currentBranch !== 'main') {
      console.error(`❌ Must be on main branch to release. Currently on: ${currentBranch}`);
      process.exit(1);
    }

    // Pull latest changes
    console.log('📥 Pulling latest changes...');
    runCommand('git pull');

    // Run tests
    console.log('\n🧪 Running tests...');
    runCommand('npm test');

    // Bump version and update docs
    commands.bump();

    const newVersion = getCurrentVersion();

    // Commit changes
    console.log('\n📝 Committing changes...');
    runCommand('git add -A');
    runCommand(`git commit -m "chore: release v${newVersion}"`);

    // Create tag
    console.log('\n🏷️  Creating tag...');
    runCommand(`git tag -a v${newVersion} -m "Release v${newVersion}"`);

    // Push changes
    console.log('\n📤 Pushing changes...');
    runCommand('git push');
    runCommand('git push --tags');

    console.log(`\n✅ Release v${newVersion} complete!`);
    console.log('\n💡 The GitHub Actions release workflow will now:');
    console.log('   - Build and test the project');
    console.log('   - Create Docker images');
    console.log('   - Publish to NPM');
    console.log('   - Create a GitHub release');
  },

  help: () => {
    console.log(`
📦 Version Manager for Puppeteer MCP

Usage: node scripts/version-manager.mjs <command> [options]

Commands:
  check             Check if all documentation has consistent version numbers
  sync              Update all documentation to match package.json version
  bump [type]       Bump version and update documentation
                    Types: major, minor, patch (default), premajor, preminor, prepatch, prerelease
  release [type]    Full release process: test, bump, commit, tag, push
  help              Show this help message

Examples:
  npm run version:check          # Check version consistency
  npm run version:sync           # Sync documentation versions
  npm run version:bump patch     # Bump patch version
  npm run version:release minor  # Create a minor release
`);
  },
};

// Main execution
const commandName = command || 'help';
const commandFn = commands[commandName];

if (!commandFn) {
  console.error(`❌ Unknown command: ${commandName}`);
  commands.help();
  process.exit(1);
}

commandFn();
