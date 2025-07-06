import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTailwind from '@astrojs/starlight-tailwind';

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
      social: {
        github: 'https://github.com/williamzujkowski/puppeteer-mcp',
      },
      customCss: [
        './src/styles/custom.css',
        './src/styles/starlight-overrides.css',
      ],
      plugins: [starlightTailwind()],
      editLink: {
        baseUrl: 'https://github.com/williamzujkowski/puppeteer-mcp/edit/main/starlight-docs/',
      },
      sidebar: [
        {
          label: 'Home',
          items: [
            { label: 'Welcome', slug: 'index' },
            { label: 'Quick Start', slug: 'quickstart/index' },
            { label: 'Architecture Overview', slug: 'architecture/overview' },
          ],
        },
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'quickstart/installation' },
            { label: 'First Steps', slug: 'quickstart/first-steps' },
            { label: 'Claude Desktop Setup', slug: 'quickstart/claude-desktop' },
            { label: 'Configuration', slug: 'quickstart/configuration' },
            { label: 'Troubleshooting', slug: 'troubleshooting' },
          ],
        },
        {
          label: 'Quick Reference',
          items: [
            { label: 'API Cheat Sheet', slug: 'quick-reference/api-cheatsheet' },
            { label: 'Common Patterns', slug: 'quick-reference/common-patterns' },
            { label: 'Environment Variables', slug: 'quick-reference/env-vars' },
            { label: 'Error Codes', slug: 'quick-reference/error-codes' },
            { label: 'MCP Tools Summary', slug: 'quick-reference/mcp-tools-summary' },
          ],
        },
        {
          label: 'User Guides',
          items: [
            { label: 'Overview', slug: 'guides/index' },
            { label: 'Browser Automation', slug: 'guides/browser-automation' },
            { label: 'API Integration', slug: 'guides/api-integration' },
            { label: 'MCP Usage Examples', slug: 'guides/mcp-usage-examples' },
            { label: 'Advanced Scenarios', slug: 'guides/advanced-scenarios' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', slug: 'reference/index' },
            { label: 'REST API', slug: 'reference/rest-api' },
            { label: 'gRPC API', slug: 'reference/grpc-api' },
            { label: 'WebSocket API', slug: 'reference/websocket-api' },
            { label: 'MCP Tools', slug: 'reference/mcp-tools' },
            { label: 'Puppeteer Actions', slug: 'reference/puppeteer-actions' },
          ],
        },
        {
          label: 'Deployment',
          items: [
            { label: 'Overview', slug: 'deployment/index' },
            { label: 'NPM Package', slug: 'deployment/npm-package' },
            { label: 'Docker', slug: 'deployment/docker' },
            { label: 'Production Setup', slug: 'deployment/production' },
            { label: 'Scaling Guide', slug: 'deployment/scaling' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Overview', slug: 'architecture/index' },
            { label: 'System Design', slug: 'architecture/overview' },
            { label: 'Session Management', slug: 'architecture/session-management' },
            { label: 'Security Model', slug: 'architecture/security' },
            { label: 'MCP Integration', slug: 'architecture/mcp-integration-plan' },
          ],
        },
        {
          label: 'Development',
          items: [
            { label: 'Overview', slug: 'development/index' },
            { label: 'Development Workflow', slug: 'development/workflow' },
            { label: 'Coding Standards', slug: 'development/standards' },
            { label: 'Testing Guide', slug: 'development/testing' },
            { label: 'AI Patterns', slug: 'ai/routing-patterns' },
          ],
        },
        {
          label: 'Contributing',
          items: [
            { label: 'Overview', slug: 'contributing/index' },
            { label: 'Code of Conduct', slug: 'contributing/code-of-conduct' },
            { label: 'How to Contribute', slug: 'contributing' },
          ],
        },
        {
          label: 'Resources',
          items: [
            { label: 'Roadmap', slug: 'project/roadmap' },
            { label: 'Lessons Learned', slug: 'lessons/implementation' },
            { label: 'Planning Insights', slug: 'lessons/project-planning' },
          ],
        },
      ],
      components: {
        // Custom component overrides
        Head: './src/components/Head.astro',
        // Footer: './src/components/Footer.astro',
      },
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
  vite: {
    ssr: {
      noExternal: ['@astrojs/starlight-tailwind'],
    },
  },
});