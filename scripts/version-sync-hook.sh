#!/bin/bash

# Check if package.json has been modified
if git diff --cached --name-only | grep -q "package.json"; then
  echo "📦 package.json detected in staged files..."
  
  # Check if version field was modified
  if git diff --cached package.json | grep -q '"version"'; then
    echo "🔄 Version change detected! Updating documentation..."
    
    # Run the version update script
    npm run update:version
    
    # Add all modified documentation files to the commit
    git add CLAUDE.md README.md CHANGELOG.md SECURITY.md NPM_PUBLISHING_CHECKLIST.md
    git add starlight-docs/src/content/docs/**/*.md
    git add testing/**/*.md
    git add src/mcp/auth/**/*.md
    
    echo "✅ Documentation version numbers updated and staged!"
  fi
fi