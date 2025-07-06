# Puppeteer MCP Documentation (Astro Starlight)

This directory contains the Puppeteer MCP documentation built with
[Astro Starlight](https://starlight.astro.build/).

## 🚀 Getting Started

### Prerequisites

- Node.js 20 or higher
- npm or pnpm

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The documentation will be available at `http://localhost:4321/puppeteer-mcp/`.

### Building

Build the documentation for production:

```bash
npm run build
```

### Preview

Preview the production build locally:

```bash
npm run preview
```

## 📁 Project Structure

```
starlight-docs/
├── src/
│   ├── content/
│   │   └── docs/           # Documentation content (Markdown/MDX)
│   ├── components/         # Custom Astro components
│   ├── styles/            # Custom CSS styles
│   └── assets/            # Images and other assets
├── public/                # Static assets
├── astro.config.mjs       # Astro configuration
├── tailwind.config.mjs    # Tailwind CSS configuration
└── package.json
```

## 🎨 Features

### Custom Components

- **CardGrid/Card**: Feature cards with icons and links
- **Tabs/TabItem**: Tabbed content sections
- **Custom styling**: Matches the MkDocs Material theme

### Starlight Features

- 🌍 Full-text search
- 🌙 Dark mode
- 📱 Mobile-friendly
- ⚡️ Fast page loads
- 🔗 Automatic link validation
- 📊 Built-in analytics support
- 🌐 i18n ready

## 🔄 Migration from MkDocs

This documentation was migrated from MkDocs Material. Key differences:

1. **Components**: Custom Astro components replace MkDocs extensions
2. **Styling**: Tailwind CSS instead of MkDocs Material theme
3. **Tabs**: Custom Tabs component instead of pymdownx.tabbed
4. **Admonitions**: Starlight's built-in callouts (:::note, :::tip, etc.)
5. **Cards**: Custom CardGrid/Card components

## 🛠️ Customization

### Adding Pages

Create new `.md` or `.mdx` files in `src/content/docs/`:

```md
---
title: My New Page
description: Description of the page
---

# Content goes here
```

### Using Components

Import and use custom components in MDX files:

```mdx
import Card from '@/components/Card.astro';
import CardGrid from '@/components/CardGrid.astro';

<CardGrid>
  <Card title="Feature" icon="🚀" href="/link">
    Description
  </Card>
</CardGrid>
```

### Styling

- Edit `src/styles/custom.css` for general styles
- Edit `src/styles/starlight-overrides.css` for theme overrides
- Use Tailwind classes in components

## 📝 Writing Guidelines

1. Use frontmatter for page metadata
2. Import components at the top of MDX files
3. Use Starlight's built-in callouts for notes/warnings
4. Keep URLs relative without `.md` extensions
5. Place images in `src/assets/` or `public/`

## 🚀 Deployment

The documentation is automatically deployed to GitHub Pages when changes are pushed to the main
branch. See `.github/workflows/docs-starlight.yml` for the deployment configuration.

## 📚 Resources

- [Astro Documentation](https://docs.astro.build)
- [Starlight Documentation](https://starlight.astro.build)
- [Tailwind CSS](https://tailwindcss.com)
