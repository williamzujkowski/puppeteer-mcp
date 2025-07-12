import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  redirects: {
    '/getting-started': '/quickstart/',
    '/quickstart-npm': '/quickstart/installation',
    '/npm-package': '/deployment/npm-package',
    '/deployment/npm-global': '/deployment/npm-package',
    '/guides/getting-started': '/quickstart/',
    '/guides/deployment': '/deployment/',
  },
  site: 'https://williamzujkowski.github.io',
  base: '/puppeteer-mcp',
  integrations: [
    starlight({
      title: 'Puppeteer MCP',
      description: 'AI-Enabled Browser Automation Platform with Multi-Protocol Support',
      logo: {
        src: './src/assets/logo.svg',
        alt: 'Puppeteer MCP Logo',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/williamzujkowski/puppeteer-mcp',
        },
      ],
      customCss: ['./src/styles/custom.css', './src/styles/starlight-overrides.css'],
      editLink: {
        baseUrl: 'https://github.com/williamzujkowski/puppeteer-mcp/edit/main/starlight-docs/',
      },
      sidebar: [
        {
          label: 'Home',
          items: [
            { label: 'Welcome', link: '/' },
            { label: 'Quick Start', link: '/quickstart/index' },
            { label: 'Architecture Overview', link: '/architecture/overview' },
          ],
        },
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', link: '/quickstart/installation' },
            { label: 'First Steps', link: '/quickstart/first-steps' },
            { label: 'Claude Desktop Setup', link: '/quickstart/claude-desktop' },
            { label: 'Configuration', link: '/quickstart/configuration' },
            { label: 'Troubleshooting', link: '/troubleshooting' },
          ],
        },
        {
          label: 'Quick Reference',
          items: [
            { label: 'API Cheat Sheet', link: '/quick-reference/api-cheatsheet' },
            { label: 'Common Patterns', link: '/quick-reference/common-patterns' },
            { label: 'Environment Variables', link: '/quick-reference/env-vars' },
            { label: 'Error Codes', link: '/quick-reference/error-codes' },
            { label: 'MCP Tools Summary', link: '/quick-reference/mcp-tools-summary' },
          ],
        },
        {
          label: 'User Guides',
          items: [
            { label: 'Overview', link: '/guides/index' },
            { label: 'Browser Automation', link: '/guides/browser-automation' },
            { label: 'API Integration', link: '/guides/api-integration' },
            { label: 'MCP Usage Examples', link: '/guides/mcp-usage-examples' },
            { label: 'Advanced Scenarios', link: '/guides/advanced-scenarios' },
          ],
        },
        {
          label: 'Advanced Guides',
          items: [
            { label: 'Overview', link: '/guides/advanced/index' },
            { label: 'Telemetry & Monitoring', link: '/guides/advanced/telemetry' },
            { label: 'Session Persistence', link: '/guides/advanced/session-persistence' },
            { label: 'Browser Pool Optimization', link: '/guides/advanced/browser-pool-optimization' },
            { label: 'Proxy Configuration', link: '/guides/advanced/proxy-configuration' },
            { label: 'Middleware Development', link: '/guides/advanced/middleware' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', link: '/reference/index' },
            { label: 'REST API', link: '/reference/rest-api' },
            { label: 'gRPC API', link: '/reference/grpc-api' },
            { label: 'WebSocket API', link: '/reference/websocket-api' },
            { label: 'MCP Tools', link: '/reference/mcp-tools' },
            { label: 'Puppeteer Actions', link: '/reference/puppeteer-actions' },
          ],
        },
        {
          label: 'Testing',
          items: [
            { label: 'Overview', link: '/testing/index' },
            { label: 'Security Testing', link: '/testing/security-testing' },
            { label: 'Performance Testing', link: '/testing/performance-testing' },
            { label: 'UX Testing', link: '/testing/ux-testing' },
            { label: 'UX Checklist', link: '/testing/ux-checklist' },
            { label: 'UX Test Scenarios', link: '/testing/ux-test-scenarios' },
            { label: 'Acceptance Testing', link: '/testing/acceptance-testing' },
          ],
        },
        {
          label: 'Evaluation',
          items: [
            { label: 'Overview', link: '/evaluation/index' },
            { label: 'Quick Start', link: '/evaluation/quick-start' },
            { label: 'Project Plan', link: '/evaluation/project-plan' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Overview', link: '/operations/index' },
            { label: 'CI/CD Pipeline', link: '/operations/ci-cd' },
            { label: 'Version Management', link: '/operations/version-management' },
            { label: 'Error Handling', link: '/operations/error-handling' },
          ],
        },
        {
          label: 'Deployment',
          items: [
            { label: 'Overview', link: '/deployment/index' },
            { label: 'NPM Package', link: '/deployment/npm-package' },
            { label: 'Docker', link: '/deployment/docker' },
            { label: 'Production Setup', link: '/deployment/production' },
            { label: 'Scaling Guide', link: '/deployment/scaling' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Overview', link: '/architecture/index' },
            { label: 'System Design', link: '/architecture/overview' },
            { label: 'Session Management', link: '/architecture/session-management' },
            { label: 'Security Model', link: '/architecture/security' },
            { label: 'MCP Integration', link: '/architecture/mcp-integration-plan' },
          ],
        },
        {
          label: 'Development',
          items: [
            { label: 'Overview', link: '/development/index' },
            { label: 'Development Workflow', link: '/development/workflow' },
            { label: 'Coding Standards', link: '/development/standards' },
            { label: 'Testing Guide', link: '/development/testing' },
            { label: 'AI Patterns', link: '/ai/routing-patterns' },
          ],
        },
        {
          label: 'Contributing',
          items: [
            { label: 'Overview', link: '/contributing/index' },
            { label: 'Code of Conduct', link: '/contributing/code-of-conduct' },
            { label: 'How to Contribute', link: '/contributing' },
          ],
        },
        {
          label: 'Resources',
          items: [
            { label: 'Roadmap', link: '/project/roadmap' },
            { label: 'Lessons Learned', link: '/lessons/implementation' },
            { label: 'Planning Insights', link: '/lessons/project-planning' },
          ],
        },
      ],
      head: [
        // Add analytics if needed
        // {
        //   tag: 'script',
        //   attrs: {
        //     src: 'https://analytics.example.com/script.js',
        //     'data-site': 'YOUR_SITE_ID',
        //     defer: true,
        //   },
        // },
      ],
      defaultLocale: 'root',
      locales: {
        root: {
          label: 'English',
          lang: 'en',
        },
      },
      credits: true,
      lastUpdated: true,
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
      favicon: '/favicon.ico',
    }),
    tailwind(),
  ],
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
  build: {
    assets: 'assets',
  },
});
