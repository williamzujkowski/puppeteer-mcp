#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function rollbackRelease() {
  console.log(`${colors.bright}${colors.red}🔄 Release Rollback Tool${colors.reset}\n`);

  try {
    // Get current version
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    const currentVersion = packageJson.version;

    console.log(`Current version: ${colors.cyan}v${currentVersion}${colors.reset}`);

    // Get list of recent tags
    const tags = execSync('git tag --sort=-version:refname | head -10', {
      cwd: projectRoot,
      encoding: 'utf8',
    })
      .trim()
      .split('\n');

    console.log('\nRecent releases:');
    tags.forEach((tag, index) => {
      console.log(`  ${index + 1}. ${tag}`);
    });

    // Ask which version to rollback to
    const choice = await question(`\nSelect version to rollback to (1-${tags.length}): `);
    const targetTag = tags[parseInt(choice) - 1];

    if (!targetTag) {
      throw new Error('Invalid selection');
    }

    console.log(`\n${colors.yellow}⚠️  WARNING: This will rollback to ${targetTag}${colors.reset}`);
    console.log('This action will:');
    console.log('  • Deprecate the current npm version');
    console.log('  • Publish the previous version as latest');
    console.log('  • Create a rollback tag in git');
    console.log('  • Update documentation');

    const confirm = await question(`\nAre you sure? (yes/no): `);

    if (confirm.toLowerCase() !== 'yes') {
      console.log('Rollback cancelled.');
      process.exit(0);
    }

    console.log(`\n${colors.bright}Starting rollback...${colors.reset}`);

    // Step 1: Create rollback branch
    const rollbackBranch = `rollback/${currentVersion}-to-${targetTag.replace('v', '')}`;
    console.log(`\n1. Creating rollback branch: ${rollbackBranch}`);
    execSync(`git checkout -b ${rollbackBranch} ${targetTag}`, {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    // Step 2: Update package.json with rollback metadata
    console.log('\n2. Updating package metadata...');
    const rollbackPackageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    rollbackPackageJson.rollback = {
      from: currentVersion,
      to: targetTag.replace('v', ''),
      date: new Date().toISOString(),
      reason: await question('Rollback reason: '),
    };

    // Step 3: Deprecate current version on NPM
    console.log(`\n3. Deprecating v${currentVersion} on NPM...`);
    try {
      execSync(
        `npm deprecate puppeteer-mcp@${currentVersion} "Rolled back due to issues. Use ${targetTag} instead."`,
        { cwd: projectRoot, stdio: 'inherit' },
      );
    } catch (error) {
      console.log(
        `${colors.yellow}Warning: Could not deprecate on NPM. You may need to do this manually.${colors.reset}`,
      );
    }

    // Step 4: Re-publish previous version as latest
    console.log(`\n4. Publishing ${targetTag} as latest...`);
    const needsAuth = await question('Do you need to login to NPM? (yes/no): ');

    if (needsAuth.toLowerCase() === 'yes') {
      console.log('Please login to NPM:');
      execSync('npm login', { cwd: projectRoot, stdio: 'inherit' });
    }

    try {
      // Build the previous version
      execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

      // Publish with latest tag
      execSync('npm publish --tag latest', { cwd: projectRoot, stdio: 'inherit' });
      console.log(`${colors.green}✓ Published ${targetTag} as latest${colors.reset}`);
    } catch (error) {
      console.log(
        `${colors.red}Failed to publish. You may need to do this manually.${colors.reset}`,
      );
    }

    // Step 5: Create rollback documentation
    console.log('\n5. Creating rollback documentation...');
    const rollbackDoc = `# Rollback Notice

## Version Rollback: v${currentVersion} → ${targetTag}

**Date:** ${new Date().toISOString()}
**Reason:** ${rollbackPackageJson.rollback.reason}

### Affected Users

If you have installed v${currentVersion}, please downgrade to ${targetTag}:

\`\`\`bash
npm install puppeteer-mcp@${targetTag.replace('v', '')}
\`\`\`

### Docker Users

\`\`\`bash
docker pull ghcr.io/williamzujkowski/puppeteer-mcp:${targetTag.replace('v', '')}
\`\`\`

### What Happened?

${rollbackPackageJson.rollback.reason}

### Next Steps

We are working on a fix and will release a new version soon.
`;

    require('fs').writeFileSync(join(projectRoot, 'ROLLBACK_NOTICE.md'), rollbackDoc);

    // Step 6: Create git tag for rollback
    console.log('\n6. Creating rollback tag...');
    execSync(`git add -A`, { cwd: projectRoot });
    execSync(
      `git commit -m "rollback: v${currentVersion} to ${targetTag}\n\nReason: ${rollbackPackageJson.rollback.reason}"`,
      { cwd: projectRoot },
    );
    execSync(`git tag rollback-${currentVersion}-${new Date().getTime()}`, { cwd: projectRoot });

    // Step 7: Push changes
    const shouldPush = await question('\nPush rollback to remote? (yes/no): ');

    if (shouldPush.toLowerCase() === 'yes') {
      execSync(`git push origin ${rollbackBranch} --tags`, { cwd: projectRoot, stdio: 'inherit' });
    }

    // Step 8: Create GitHub issue
    console.log('\n7. Creating tracking issue...');
    const createIssue = await question('Create GitHub issue for tracking? (yes/no): ');

    if (createIssue.toLowerCase() === 'yes') {
      const issueBody = `## Rollback Tracking Issue

**Rolled back from:** v${currentVersion}
**Rolled back to:** ${targetTag}
**Date:** ${new Date().toISOString()}
**Reason:** ${rollbackPackageJson.rollback.reason}

### Action Items
- [ ] Investigate root cause
- [ ] Fix the issue
- [ ] Add tests to prevent recurrence
- [ ] Prepare new release
- [ ] Update affected users

### Rollback Commands Used
\`\`\`bash
npm deprecate puppeteer-mcp@${currentVersion} "Rolled back due to issues"
npm publish --tag latest # (from ${targetTag})
\`\`\`
`;

      console.log('\nIssue content:');
      console.log(issueBody);
      console.log('\nPlease create this issue manually on GitHub.');
    }

    console.log(`\n${colors.green}✅ Rollback completed successfully!${colors.reset}`);
    console.log('\nNext steps:');
    console.log('1. Monitor for any issues with the rollback');
    console.log('2. Communicate the rollback to users');
    console.log('3. Fix the issues that caused the rollback');
    console.log('4. Prepare a new release when ready');
  } catch (error) {
    console.error(`\n${colors.red}Rollback failed: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Execute rollback
rollbackRelease();
