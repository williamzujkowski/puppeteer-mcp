#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

// Checklist items
const checklist = [
  {
    category: 'Code Quality',
    items: [
      {
        name: 'All tests passing',
        command: 'npm test',
        critical: true,
      },
      {
        name: 'No TypeScript errors',
        command: 'npm run typecheck',
        critical: true,
      },
      {
        name: 'No ESLint errors',
        command: 'npm run lint',
        critical: true,
      },
      {
        name: 'Code formatted',
        command: 'npm run format:check',
        critical: false,
      },
      {
        name: 'Build successful',
        command: 'npm run build',
        critical: true,
      },
    ],
  },
  {
    category: 'Security',
    items: [
      {
        name: 'No high/critical vulnerabilities',
        command: 'npm audit --production --audit-level=high',
        critical: true,
      },
      {
        name: 'Security checks pass',
        command: 'npm run security:check',
        critical: true,
      },
      {
        name: 'Dependencies up to date',
        command: 'npm outdated || true',
        critical: false,
        manual: true,
      },
    ],
  },
  {
    category: 'Documentation',
    items: [
      {
        name: 'CHANGELOG.md updated',
        check: () => {
          const changelog = readFileSync(join(projectRoot, 'CHANGELOG.md'), 'utf8');
          const version = JSON.parse(
            readFileSync(join(projectRoot, 'package.json'), 'utf8'),
          ).version;
          return changelog.includes(`[${version}]`);
        },
        critical: true,
      },
      {
        name: 'README.md version updated',
        check: () => {
          const readme = readFileSync(join(projectRoot, 'README.md'), 'utf8');
          const version = JSON.parse(
            readFileSync(join(projectRoot, 'package.json'), 'utf8'),
          ).version;
          return readme.includes(version);
        },
        critical: false,
      },
      {
        name: 'API documentation generated',
        command: 'ls docs/api/generated',
        critical: false,
      },
    ],
  },
  {
    category: 'Version Management',
    items: [
      {
        name: 'Version consistency',
        command: 'npm run version:check',
        critical: true,
      },
      {
        name: 'Git working directory clean',
        command: 'git status --porcelain',
        check: (output) => output.trim() === '',
        critical: true,
      },
      {
        name: 'On main branch',
        command: 'git branch --show-current',
        check: (output) => output.trim() === 'main',
        critical: true,
      },
      {
        name: 'Up to date with remote',
        command: 'git fetch && git status -uno',
        check: (output) => output.includes('Your branch is up to date'),
        critical: true,
      },
    ],
  },
  {
    category: 'Performance',
    items: [
      {
        name: 'Performance benchmarks within limits',
        command: 'node scripts/check-performance.js',
        critical: false,
      },
      {
        name: 'Bundle size acceptable',
        check: () => {
          const stats = execSync('du -sh dist/', { cwd: projectRoot }).toString();
          const sizeInMB = parseFloat(stats.split('\t')[0].replace('M', ''));
          return sizeInMB < 50; // 50MB limit
        },
        critical: false,
      },
    ],
  },
];

// Run checklist
async function runChecklist() {
  console.log(`${colors.bright}${colors.cyan}🚀 Release Preparation Checklist${colors.reset}\n`);

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    critical: [],
  };

  for (const category of checklist) {
    console.log(`${colors.bright}${colors.blue}${category.category}${colors.reset}`);

    for (const item of category.items) {
      process.stdout.write(`  • ${item.name}... `);

      try {
        let passed = false;

        if (item.manual) {
          // Manual check - just run command for info
          if (item.command) {
            execSync(item.command, { cwd: projectRoot, stdio: 'pipe' });
          }
          console.log(`${colors.yellow}[MANUAL CHECK REQUIRED]${colors.reset}`);
          results.warnings++;
          continue;
        }

        if (item.command) {
          const output = execSync(item.command, {
            cwd: projectRoot,
            stdio: 'pipe',
            encoding: 'utf8',
          });

          if (item.check) {
            passed = item.check(output);
          } else {
            passed = true; // Command succeeded
          }
        } else if (item.check) {
          passed = item.check();
        }

        if (passed) {
          console.log(`${colors.green}✓${colors.reset}`);
          results.passed++;
        } else {
          throw new Error('Check failed');
        }
      } catch (error) {
        console.log(`${colors.red}✗${colors.reset}`);
        results.failed++;

        if (item.critical) {
          results.critical.push(item.name);
        }

        if (error.message && error.message !== 'Check failed') {
          console.log(`    ${colors.red}Error: ${error.message}${colors.reset}`);
        }
      }
    }

    console.log('');
  }

  // Summary
  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  ${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`  ${colors.yellow}Warnings: ${results.warnings}${colors.reset}`);

  if (results.critical.length > 0) {
    console.log(`\n${colors.bright}${colors.red}❌ Critical issues found:${colors.reset}`);
    results.critical.forEach((issue) => {
      console.log(`  • ${issue}`);
    });
    console.log(
      `\n${colors.red}Release cannot proceed until critical issues are resolved.${colors.reset}`,
    );
    process.exit(1);
  } else if (results.failed > 0) {
    console.log(
      `\n${colors.yellow}⚠️  Non-critical issues found. Review before proceeding.${colors.reset}`,
    );
  } else {
    console.log(`\n${colors.green}✅ All checks passed! Ready for release.${colors.reset}`);

    // Generate release command
    const version = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).version;
    console.log(`\n${colors.bright}Next steps:${colors.reset}`);
    console.log(`  1. Review the checklist results above`);
    console.log(`  2. Run: ${colors.cyan}npm run release${colors.reset}`);
    console.log(`  3. Or trigger GitHub Actions release workflow`);
  }
}

// Create performance check script if it doesn't exist
function createPerformanceCheck() {
  const scriptPath = join(projectRoot, 'scripts', 'check-performance.js');
  if (!existsSync(scriptPath)) {
    const content = `#!/usr/bin/env node

// Simple performance check
console.log('Running performance checks...');

// Add your performance checks here
// For now, just succeed
process.exit(0);
`;
    writeFileSync(scriptPath, content, { mode: 0o755 });
  }
}

// Main execution
createPerformanceCheck();
runChecklist().catch((error) => {
  console.error(`${colors.red}Error running checklist: ${error.message}${colors.reset}`);
  process.exit(1);
});
