#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Updates badge URLs in README.md to point to local badge files
 */
async function updateReadmeBadges() {
  const readmePath = path.join(process.cwd(), 'README.md');
  const badgesDir = path.join(process.cwd(), 'badges');
  
  try {
    // Read the current README content
    const readmeContent = await fs.readFile(readmePath, 'utf8');
    
    // Map of badge types to their potential filenames and shield.io patterns
    const badgeMap = {
      // npm badges - keep these as remote shields.io badges
      'npm version': { keep: true },
      'npm downloads': { keep: true },
      'License': { keep: true },
      'TypeScript': { keep: true },
      'Node.js': { keep: true },
      
      // Local badges that might be generated
      'build': { file: 'build.svg', patterns: [/!\[build[^\]]*\]\([^)]+\)/gi] },
      'tests': { file: 'tests.svg', patterns: [/!\[tests?[^\]]*\]\([^)]+\)/gi] },
      'coverage': { 
        file: 'coverage.svg', 
        patterns: [
          /!\[coverage[^\]]*\]\([^)]+\)/gi,
          /!\[code coverage[^\]]*\]\([^)]+\)/gi
        ] 
      },
      'coverage-lines': { 
        file: 'coverage-lines.svg', 
        patterns: [/!\[coverage[-\s]lines[^\]]*\]\([^)]+\)/gi] 
      },
      'coverage-branches': { 
        file: 'coverage-branches.svg', 
        patterns: [/!\[coverage[-\s]branches[^\]]*\]\([^)]+\)/gi] 
      },
      'coverage-functions': { 
        file: 'coverage-functions.svg', 
        patterns: [/!\[coverage[-\s]functions[^\]]*\]\([^)]+\)/gi] 
      },
      'version': { 
        file: 'version.svg', 
        patterns: [/!\[version[^\]]*\]\([^)]+\)/gi] 
      }
    };
    
    let updatedContent = readmeContent;
    let changesCount = 0;
    
    // Process each badge type
    for (const [badgeType, config] of Object.entries(badgeMap)) {
      // Skip badges we want to keep as remote
      if (config.keep) continue;
      
      const badgePath = path.join(badgesDir, config.file);
      
      // Check if the badge file exists
      try {
        await fs.access(badgePath);
        
        // Update all matching patterns for this badge type
        for (const pattern of config.patterns || []) {
          const matches = updatedContent.match(pattern);
          if (matches) {
            matches.forEach(match => {
              // Extract the alt text from the match
              const altTextMatch = match.match(/!\[([^\]]+)\]/);
              const altText = altTextMatch ? altTextMatch[1] : badgeType;
              
              // Create the new badge reference
              const newBadge = `![${altText}](./badges/${config.file})`;
              
              // Replace the old badge with the new one
              updatedContent = updatedContent.replace(match, newBadge);
              console.log(`Updated ${badgeType} badge: ${match} -> ${newBadge}`);
              changesCount++;
            });
          }
        }
      } catch (err) {
        console.log(`Badge file not found: ${config.file} - skipping`);
      }
    }
    
    // Check if we should add any missing badges that exist in the badges directory
    const existingBadges = await fs.readdir(badgesDir);
    const badgesSection = updatedContent.indexOf('# Puppeteer MCP');
    
    // Find the end of the initial badge section (before the description)
    const firstParagraph = updatedContent.indexOf('\n\n**Beta release');
    
    if (badgesSection !== -1 && firstParagraph !== -1) {
      const currentBadgeSection = updatedContent.substring(badgesSection, firstParagraph);
      
      // Add missing local badges if they exist but aren't in README
      for (const [badgeType, config] of Object.entries(badgeMap)) {
        if (config.keep) continue;
        
        const badgeExists = existingBadges.includes(config.file);
        const badgeInReadme = config.patterns?.some(pattern => 
          currentBadgeSection.match(pattern)
        );
        
        if (badgeExists && !badgeInReadme) {
          // Find the last badge line before the description
          const lines = currentBadgeSection.split('\n');
          const lastBadgeLineIndex = lines.findLastIndex(line => line.includes('!['));
          
          if (lastBadgeLineIndex !== -1) {
            // Insert the new badge after the last badge line
            const insertPosition = updatedContent.indexOf(lines[lastBadgeLineIndex]) + 
                                 lines[lastBadgeLineIndex].length;
            
            const badgeName = badgeType.charAt(0).toUpperCase() + badgeType.slice(1);
            const newBadgeLine = `\n![${badgeName}](./badges/${config.file})`;
            
            updatedContent = updatedContent.slice(0, insertPosition) + 
                           newBadgeLine + 
                           updatedContent.slice(insertPosition);
            
            console.log(`Added missing ${badgeType} badge`);
            changesCount++;
          }
        }
      }
    }
    
    // Write the updated content back to README.md
    if (changesCount > 0) {
      await fs.writeFile(readmePath, updatedContent, 'utf8');
      console.log(`\nSuccessfully updated ${changesCount} badge(s) in README.md`);
    } else {
      console.log('\nNo badge updates were necessary');
    }
    
  } catch (error) {
    console.error('Error updating README badges:', error);
    process.exit(1);
  }
}

// Run the script
updateReadmeBadges().catch(error => {
  console.error('Failed to update badges:', error);
  process.exit(1);
});

export { updateReadmeBadges };