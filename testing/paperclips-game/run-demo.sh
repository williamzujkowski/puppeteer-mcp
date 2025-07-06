#!/bin/bash

# Puppeteer-MCP Browser Automation Demo Runner
# This script ensures the project is built and runs the paperclips automation demo

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."

echo -e "${BLUE}🎮 Puppeteer-MCP Browser Automation Demo${NC}"
echo -e "${BLUE}======================================${NC}\n"

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    echo -e "${RED}❌ Error: Cannot find package.json. Please run this script from the puppeteer-mcp project.${NC}"
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}🔨 Building project...${NC}"
    npm run build
else
    # Check if build is up to date (simple check - if any .ts file is newer than dist)
    if [ -n "$(find src -name '*.ts' -newer dist -print -quit 2>/dev/null)" ]; then
        echo -e "${YELLOW}🔨 Source files changed, rebuilding...${NC}"
        npm run build
    fi
fi

# Create results directory
RESULTS_DIR="$SCRIPT_DIR/demo-results"
mkdir -p "$RESULTS_DIR"

echo -e "${GREEN}✅ Project is ready!${NC}\n"

# Run the demo
echo -e "${BLUE}🚀 Starting browser automation demo...${NC}"
echo -e "${BLUE}This will automate the Universal Paperclips game for 30 seconds.${NC}\n"

# Set environment variables for better stability
export NODE_ENV=development
export PUPPETEER_DISABLE_DEV_SHM=true

# Run the demo
cd "$SCRIPT_DIR"
node paperclips-automation-demo.js

# Check if demo completed successfully
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Demo completed successfully!${NC}"
    echo -e "${GREEN}📁 Results saved in: $RESULTS_DIR${NC}"
    
    # List generated files
    echo -e "\n${BLUE}Generated files:${NC}"
    ls -la "$RESULTS_DIR" | grep -E "\.(png|json|md)$" | tail -10
    
    # Offer to open results
    echo -e "\n${YELLOW}Would you like to view the results? (y/n)${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Find the latest markdown report
        LATEST_REPORT=$(ls -t "$RESULTS_DIR"/automation-report-*.md 2>/dev/null | head -1)
        if [ -f "$LATEST_REPORT" ]; then
            echo -e "${BLUE}Opening report: $(basename "$LATEST_REPORT")${NC}"
            # Try to open with default text editor
            if command -v xdg-open &> /dev/null; then
                xdg-open "$LATEST_REPORT"
            elif command -v open &> /dev/null; then
                open "$LATEST_REPORT"
            else
                cat "$LATEST_REPORT"
            fi
        fi
    fi
else
    echo -e "\n${RED}❌ Demo failed. Please check the error messages above.${NC}"
    exit 1
fi