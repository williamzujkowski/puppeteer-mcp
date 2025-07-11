# Puppeteer-MCP Browser Automation Demo

## Overview

This demo showcases the puppeteer-mcp platform's browser automation capabilities by automating
gameplay of Universal Paperclips. It demonstrates real-world browser automation using direct server
integration.

## What This Demo Demonstrates

### Core Platform Features

- **Browser Pool Management**: Efficient browser instance handling
- **Session Authentication**: Secure session creation and management
- **Context Management**: Isolated browser contexts for automation
- **Page Navigation**: Loading and interacting with web pages
- **Element Interaction**: Finding and clicking page elements
- **State Monitoring**: Extracting and tracking page data
- **Screenshot Capture**: Visual documentation of automation progress
- **Error Handling**: Robust error management and recovery
- **Comprehensive Reporting**: Detailed JSON and Markdown reports

### Automation Capabilities

- Automated clicking of game elements
- Real-time game state analysis
- Progress tracking with metrics
- Screenshot capture at key moments
- Performance measurement (clicks per second)
- Upgrade detection (optional)

## Prerequisites

1. Ensure puppeteer-mcp is built:

   ```bash
   cd /home/william/git/puppeteer-mcp
   npm run build
   ```

2. Chromium/Chrome must be installed (the demo will auto-detect it)

## Running the Demo

### Quick Start

```bash
cd /home/william/git/puppeteer-mcp/testing/paperclips-game
node paperclips-automation-demo.js
```

### What to Expect

1. **Platform Initialization** (5-10 seconds)
   - Browser pool creation
   - Session authentication
   - Context setup

2. **Game Loading** (5-10 seconds)
   - Navigation to Universal Paperclips
   - Initial screenshot capture
   - Game state analysis

3. **Automated Gameplay** (30 seconds)
   - Continuous paperclip production
   - Progress monitoring
   - Periodic screenshots
   - Real-time metrics display

4. **Report Generation**
   - JSON report with full data
   - Markdown report for easy reading
   - Summary statistics

## Output

The demo creates a `demo-results/` directory containing:

- **Screenshots**: Visual progression of the automation
  - `screenshot-initial-load-*.png` - Game at start
  - `screenshot-progress-*-clicks-*.png` - Progress snapshots
  - `screenshot-final-state-*.png` - Final game state

- **Reports**:
  - `automation-report-*.json` - Complete automation data
  - `automation-report-*.md` - Human-readable summary

## Example Output

```
🎮 PUPPETEER-MCP BROWSER AUTOMATION DEMO 🎮
=========================================

🚀 [14:23:45] === INITIALIZING PUPPETEER-MCP PLATFORM ===
📋 [14:23:45] Creating browser pool...
✅ [14:23:46] Browser pool initialized successfully
📋 [14:23:46] Creating authentication session...
✅ [14:23:46] Session created for user: demo-user
✅ [14:23:46] Platform initialization complete

📋 [14:23:47] === NAVIGATING TO UNIVERSAL PAPERCLIPS ===
✅ [14:23:52] Page loaded successfully: "Universal Paperclips"
📸 [14:23:53] Screenshot saved: initial-load (245KB)

🚀 [14:23:53] === STARTING AUTOMATED GAMEPLAY ===
📊 [14:23:53] Paperclips: 0
💰 [14:23:53] Funds: $0.00
🎮 [14:23:54] Clicked: "Make Paperclip"
✅ [14:23:55] Produced 10 paperclips (Total: 10)
📸 [14:23:58] Screenshot saved: progress-50-clicks (189KB)
📊 [14:24:03] Paperclips: 127
💰 [14:24:03] Funds: $3.45

🎉 [14:24:23] === AUTOMATION COMPLETE ===
📊 [14:24:23] Total clicks: 284
📊 [14:24:23] Paperclips produced: 284
📊 [14:24:23] Clicks per second: 9.47
📸 [14:24:24] Screenshot saved: final-state (312KB)

✅ [14:24:25] Reports saved to: demo-results/

📊 Quick Summary:
   • Automation ran for 30.2 seconds
   • Produced 284 paperclips
   • Performed 284 clicks
   • Captured 4 screenshots
   • Recorded 12 game states
   • Encountered 0 errors
```

## Customization

You can modify the demo behavior by editing the script:

- **Duration**: Change the automation duration in `automateGameplay(page, 30000)`
- **Headless Mode**: Set `headless: true` in browser options to run without UI
- **Click Speed**: Adjust the `sleep(100)` delay between clicks
- **Screenshot Frequency**: Modify the modulo values for screenshot intervals

## Technical Details

The demo uses direct server integration, bypassing the MCP/REST/gRPC layers to showcase pure browser
automation capabilities. This approach:

- Directly instantiates server components
- Provides maximum control and performance
- Demonstrates the core automation engine
- Shows what's possible with the platform

## Troubleshooting

### Browser Not Found

If you see "Failed to launch the browser process":

- Install Chromium: `sudo apt-get install chromium-browser`
- Or specify path: Set `PUPPETEER_EXECUTABLE_PATH` environment variable

### Permission Errors

- Ensure write permissions for the demo-results directory
- Run with appropriate user permissions

### Game Not Loading

- Check internet connectivity
- Verify the game URL is accessible
- Try increasing navigation timeout

## Next Steps

This demo showcases basic automation. The puppeteer-mcp platform supports much more:

- Multi-page automation workflows
- Complex form interactions
- File uploads/downloads
- Network request interception
- Cookie and storage management
- PDF generation
- Performance profiling

Explore the full API documentation to build more sophisticated automation solutions!

---

**Note**: This demo is part of the puppeteer-mcp beta release. We welcome feedback and
contributions!
