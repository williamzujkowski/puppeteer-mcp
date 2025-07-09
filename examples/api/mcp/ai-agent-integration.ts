/**
 * MCP (Model Context Protocol) AI Agent Integration Example
 * 
 * This example demonstrates:
 * - Using MCP tools for browser automation
 * - Integrating with AI agents (Claude, etc.)
 * - Building complex automation workflows
 * - Handling MCP-specific patterns
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

class MCPAgentClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private serverProcess: any = null;
  private availableTools: Map<string, MCPTool> = new Map();
  private availableResources: Map<string, MCPResource> = new Map();

  async connect(): Promise<void> {
    console.log('Starting MCP server...');
    
    // Spawn the MCP server process
    this.serverProcess = spawn('puppeteer-mcp', [], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: {
        ...process.env,
        API_KEY: process.env.API_KEY || 'your-api-key'
      }
    });

    // Create transport
    this.transport = new StdioClientTransport({
      command: 'puppeteer-mcp',
      args: []
    });

    // Create client
    this.client = new Client({
      name: 'mcp-agent-example',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: true,
        resources: true,
        prompts: true
      }
    });

    // Connect
    await this.client.connect(this.transport);
    console.log('Connected to MCP server');

    // Discover available tools and resources
    await this.discoverCapabilities();
  }

  private async discoverCapabilities(): Promise<void> {
    if (!this.client) return;

    // List tools
    const tools = await this.client.listTools();
    tools.tools.forEach(tool => {
      this.availableTools.set(tool.name, tool);
      console.log(`Tool discovered: ${tool.name}`);
    });

    // List resources
    const resources = await this.client.listResources();
    resources.resources.forEach(resource => {
      this.availableResources.set(resource.uri, resource);
      console.log(`Resource discovered: ${resource.uri}`);
    });
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const tool = this.availableTools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    console.log(`Calling tool: ${toolName}`, args);
    const result = await this.client.callTool({ name: toolName, arguments: args });
    
    return result;
  }

  async readResource(uri: string): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const result = await this.client.readResource({ uri });
    return result;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
    
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
    
    console.log('Disconnected from MCP server');
  }

  getAvailableTools(): MCPTool[] {
    return Array.from(this.availableTools.values());
  }

  getAvailableResources(): MCPResource[] {
    return Array.from(this.availableResources.values());
  }
}

// Example 1: AI-guided web scraping workflow
async function aiWebScrapingWorkflow() {
  const agent = new MCPAgentClient();
  
  try {
    await agent.connect();
    
    // Create a browser session
    const sessionResult = await agent.callTool('browser_create_session', {
      capabilities: {
        browserName: 'chrome',
        acceptInsecureCerts: true
      }
    });
    
    const sessionId = sessionResult.content[0].data?.sessionId;
    console.log(`Session created: ${sessionId}`);
    
    // Navigate to target website
    await agent.callTool('browser_navigate', {
      sessionId,
      url: 'https://news.ycombinator.com'
    });
    
    // Wait for content to load
    await agent.callTool('browser_wait', {
      sessionId,
      selector: '.itemlist',
      timeout: 10000
    });
    
    // Extract article data
    const articlesResult = await agent.callTool('browser_evaluate', {
      sessionId,
      script: `
        Array.from(document.querySelectorAll('.athing')).slice(0, 10).map(item => {
          const titleEl = item.querySelector('.titleline > a');
          const scoreEl = item.nextElementSibling?.querySelector('.score');
          const commentsEl = item.nextElementSibling?.querySelector('.subline > a:last-child');
          
          return {
            id: item.id,
            title: titleEl?.textContent || '',
            url: titleEl?.href || '',
            score: parseInt(scoreEl?.textContent || '0'),
            comments: parseInt(commentsEl?.textContent || '0')
          };
        })
      `
    });
    
    const articles = articlesResult.content[0].data;
    console.log(`Extracted ${articles.length} articles`);
    
    // AI analysis prompt (simulated)
    const analysisPrompt = `
      Analyze these Hacker News articles and identify:
      1. Main technology trends
      2. Most discussed topics
      3. Sentiment patterns
      
      Articles: ${JSON.stringify(articles, null, 2)}
    `;
    
    console.log('Analysis prompt prepared for AI agent');
    
    // Clean up
    await agent.callTool('browser_close_session', { sessionId });
    
    return articles;
    
  } finally {
    await agent.disconnect();
  }
}

// Example 2: Multi-step form automation with AI decision making
async function intelligentFormAutomation() {
  const agent = new MCPAgentClient();
  
  try {
    await agent.connect();
    
    // Create session
    const sessionResult = await agent.callTool('browser_create_session', {});
    const sessionId = sessionResult.content[0].data?.sessionId;
    
    // Navigate to form
    await agent.callTool('browser_navigate', {
      sessionId,
      url: 'https://example.com/application-form'
    });
    
    // Analyze form structure
    const formAnalysis = await agent.callTool('browser_evaluate', {
      sessionId,
      script: `
        const form = document.querySelector('form');
        const fields = Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
          type: field.type,
          name: field.name,
          id: field.id,
          required: field.required,
          label: field.labels?.[0]?.textContent || '',
          options: field.tagName === 'SELECT' ? 
            Array.from(field.options).map(opt => opt.value) : null
        }));
        
        return {
          action: form.action,
          method: form.method,
          fields
        };
      `
    });
    
    const formData = formAnalysis.content[0].data;
    console.log('Form structure analyzed:', formData);
    
    // AI decides how to fill the form (simulated)
    const fillStrategy = {
      '#firstName': 'John',
      '#lastName': 'Doe',
      '#email': 'john.doe@example.com',
      '#country': 'USA',
      '#experience': '5-10 years',
      '#interests': ['technology', 'automation', 'ai']
    };
    
    // Fill form fields based on AI strategy
    for (const [selector, value] of Object.entries(fillStrategy)) {
      if (Array.isArray(value)) {
        // Handle multi-select
        for (const v of value) {
          await agent.callTool('browser_click', {
            sessionId,
            selector: `${selector} option[value="${v}"]`
          });
        }
      } else {
        // Handle regular fields
        await agent.callTool('browser_type', {
          sessionId,
          selector,
          text: value
        });
      }
    }
    
    // Take screenshot before submission
    const screenshotResult = await agent.callTool('browser_screenshot', {
      sessionId,
      fullPage: true
    });
    
    console.log('Form filled, screenshot taken');
    
    // Submit form
    await agent.callTool('browser_click', {
      sessionId,
      selector: 'button[type="submit"]'
    });
    
    // Wait for response
    await agent.callTool('browser_wait', {
      sessionId,
      selector: '.success-message, .error-message',
      timeout: 10000
    });
    
    // Check result
    const result = await agent.callTool('browser_evaluate', {
      sessionId,
      script: `
        const success = document.querySelector('.success-message');
        const error = document.querySelector('.error-message');
        
        return {
          success: !!success,
          message: (success || error)?.textContent || 'Unknown result'
        };
      `
    });
    
    console.log('Form submission result:', result.content[0].data);
    
    // Clean up
    await agent.callTool('browser_close_session', { sessionId });
    
  } finally {
    await agent.disconnect();
  }
}

// Example 3: Intelligent web testing with visual regression
async function visualRegressionTesting() {
  const agent = new MCPAgentClient();
  
  try {
    await agent.connect();
    
    const testCases = [
      { url: 'https://example.com', name: 'homepage' },
      { url: 'https://example.com/about', name: 'about' },
      { url: 'https://example.com/contact', name: 'contact' }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.name}`);
      
      // Create session for each test
      const sessionResult = await agent.callTool('browser_create_session', {
        capabilities: {
          viewport: { width: 1920, height: 1080 }
        }
      });
      
      const sessionId = sessionResult.content[0].data?.sessionId;
      
      try {
        // Navigate to page
        await agent.callTool('browser_navigate', {
          sessionId,
          url: testCase.url
        });
        
        // Wait for page to stabilize
        await agent.callTool('browser_wait', {
          sessionId,
          condition: 'load',
          timeout: 10000
        });
        
        // Additional wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take screenshot
        const screenshotResult = await agent.callTool('browser_screenshot', {
          sessionId,
          fullPage: true
        });
        
        // Extract page metrics
        const metricsResult = await agent.callTool('browser_evaluate', {
          sessionId,
          script: `
            const metrics = {
              // Visual metrics
              bodyHeight: document.body.scrollHeight,
              bodyWidth: document.body.scrollWidth,
              imageCount: document.images.length,
              brokenImages: Array.from(document.images)
                .filter(img => !img.complete || img.naturalHeight === 0).length,
              
              // Performance metrics
              loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
              domElements: document.getElementsByTagName('*').length,
              
              // Accessibility metrics
              missingAltText: Array.from(document.images)
                .filter(img => !img.alt).length,
              headingStructure: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
                .map(h => ({ level: h.tagName, text: h.textContent }))
            };
            
            return metrics;
          `
        });
        
        results.push({
          testCase: testCase.name,
          url: testCase.url,
          screenshot: screenshotResult.content[0].data,
          metrics: metricsResult.content[0].data,
          timestamp: new Date().toISOString()
        });
        
      } finally {
        // Clean up session
        await agent.callTool('browser_close_session', { sessionId });
      }
    }
    
    // AI analysis of results (simulated)
    console.log('\nVisual Regression Test Results:');
    results.forEach(result => {
      console.log(`\n${result.testCase}:`);
      console.log(`  Load time: ${result.metrics.loadTime}ms`);
      console.log(`  DOM elements: ${result.metrics.domElements}`);
      console.log(`  Broken images: ${result.metrics.brokenImages}`);
      console.log(`  Missing alt text: ${result.metrics.missingAltText}`);
    });
    
    return results;
    
  } finally {
    await agent.disconnect();
  }
}

// Example 4: Conversational browser automation
async function conversationalAutomation() {
  const agent = new MCPAgentClient();
  
  try {
    await agent.connect();
    
    // Simulate a conversation with an AI agent
    const conversation = [
      { role: 'user', content: 'Search for "puppeteer automation" on Google' },
      { role: 'assistant', content: 'I\'ll search for "puppeteer automation" on Google for you.' },
      { role: 'user', content: 'Click on the first result' },
      { role: 'assistant', content: 'I\'ll click on the first search result.' },
      { role: 'user', content: 'Take a screenshot of the page' },
      { role: 'assistant', content: 'I\'ll take a screenshot of the current page.' }
    ];
    
    // Create session
    const sessionResult = await agent.callTool('browser_create_session', {});
    const sessionId = sessionResult.content[0].data?.sessionId;
    
    // Execute conversation steps
    for (let i = 0; i < conversation.length; i += 2) {
      const userMessage = conversation[i];
      const assistantMessage = conversation[i + 1];
      
      console.log(`User: ${userMessage.content}`);
      console.log(`Assistant: ${assistantMessage.content}`);
      
      // Parse intent and execute (simplified)
      if (userMessage.content.includes('Search for')) {
        const searchTerm = userMessage.content.match(/"([^"]+)"/)?.[1] || '';
        
        await agent.callTool('browser_navigate', {
          sessionId,
          url: 'https://www.google.com'
        });
        
        await agent.callTool('browser_type', {
          sessionId,
          selector: 'input[name="q"]',
          text: searchTerm
        });
        
        await agent.callTool('browser_keyboard', {
          sessionId,
          key: 'Enter'
        });
        
        await agent.callTool('browser_wait', {
          sessionId,
          selector: '#search',
          timeout: 5000
        });
        
      } else if (userMessage.content.includes('Click on the first result')) {
        await agent.callTool('browser_click', {
          sessionId,
          selector: '#search .g:first-child a'
        });
        
        await agent.callTool('browser_wait', {
          sessionId,
          condition: 'load',
          timeout: 10000
        });
        
      } else if (userMessage.content.includes('Take a screenshot')) {
        const screenshotResult = await agent.callTool('browser_screenshot', {
          sessionId,
          fullPage: false
        });
        
        console.log('Screenshot captured successfully');
      }
    }
    
    // Get final page info
    const pageInfo = await agent.callTool('browser_evaluate', {
      sessionId,
      script: `
        ({
          url: window.location.href,
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content || ''
        })
      `
    });
    
    console.log('\nFinal page info:', pageInfo.content[0].data);
    
    // Clean up
    await agent.callTool('browser_close_session', { sessionId });
    
  } finally {
    await agent.disconnect();
  }
}

// Run examples
if (require.main === module) {
  (async () => {
    console.log('MCP AI Agent Integration Examples\n');
    
    try {
      console.log('1. AI-Guided Web Scraping');
      await aiWebScrapingWorkflow();
      console.log('\n---\n');
      
      console.log('2. Intelligent Form Automation');
      await intelligentFormAutomation();
      console.log('\n---\n');
      
      console.log('3. Visual Regression Testing');
      await visualRegressionTesting();
      console.log('\n---\n');
      
      console.log('4. Conversational Automation');
      await conversationalAutomation();
      
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}