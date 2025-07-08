# Migration from MkDocs to Astro Starlight

This document outlines the migration from MkDocs Material to Astro Starlight for the Puppeteer MCP
documentation.

## 🎯 Migration Overview

The documentation has been successfully migrated from MkDocs Material to Astro Starlight, providing:

- ⚡ Faster build times and page loads
- 🎨 Modern component-based architecture
- 📱 Better mobile experience
- 🔍 Enhanced search capabilities
- 🌐 Better internationalization support

## 📋 What Was Migrated

### Content Migration

- ✅ All 48 documentation pages
- ✅ Navigation structure preserved
- ✅ Internal links updated
- ✅ Redirects configured for old URLs

### Feature Conversions

| MkDocs Feature          | Starlight Equivalent                        |
| ----------------------- | ------------------------------------------- |
| Material theme (indigo) | Custom Tailwind theme with indigo accent    |
| `!!! note` admonitions  | `:::note` callouts                          |
| `!!! warning`           | `:::caution`                                |
| `!!! danger`            | `:::danger`                                 |
| `!!! tip`               | `:::tip`                                    |
| `=== "Tab"` syntax      | Custom `<Tabs>` component                   |
| Grid cards              | Custom `<CardGrid>` and `<Card>` components |
| Material icons          | Emoji icons                                 |
| `mkdocs.yml` navigation | `astro.config.mjs` sidebar                  |

### Custom Components Created

1. **CardGrid.astro** - Responsive grid layout for feature cards
2. **Card.astro** - Feature card with icon, title, description, and link
3. **Tabs.astro** - Tab container component
4. **TabItem.astro** - Individual tab panel
5. **Head.astro** - Custom head component for metadata

### Styling

- ✅ Custom CSS matching MkDocs Material design
- ✅ Tailwind CSS integration
- ✅ Dark mode support
- ✅ Responsive design

## 🚀 How to Use the New Documentation

### Development

```bash
# Navigate to Starlight docs
cd starlight-docs

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### From Root Directory

```bash
# Install Starlight dependencies
npm run docs:starlight:install

# Run Starlight dev server
npm run docs:starlight:dev

# Build Starlight docs
npm run docs:starlight:build
```

## 🔄 URL Changes and Redirects

All URLs remain the same except for the removal of `.md` extensions. Redirects are configured for:

- `/getting-started` → `/quickstart/`
- `/quickstart-npm` → `/quickstart/installation`
- `/npm-package` → `/deployment/npm-package`
- `/deployment/npm-global` → `/deployment/npm-package`
- `/guides/getting-started` → `/quickstart/`
- `/guides/deployment` → `/deployment/`

## 📝 Content Updates Needed

When updating documentation:

1. **Frontmatter is required** - All pages need title and description
2. **Import components** - Add imports at the top of MDX files
3. **No `.md` in links** - Remove extensions from internal links
4. **Use MDX for components** - Files using components should be `.mdx`

### Example MDX Page

```mdx
---
title: My Page Title
description: Brief description of the page
---

import Card from '@/components/Card.astro';
import Tabs from '@/components/Tabs.astro';
import TabItem from '@/components/TabItem.astro';

# My Page Title

<Tabs labels={['Option 1', 'Option 2']}>
  <TabItem label="Option 1">Content for option 1</TabItem>
  <TabItem label="Option 2">Content for option 2</TabItem>
</Tabs>
```

## 🚨 Known Differences

1. **Search** - Starlight's search works differently than MkDocs
2. **PDF Export** - Not built-in (was mkdocs-print-site-plugin)
3. **Revision Dates** - Not shown by default (was git-revision-date-localized)
4. **Minification** - Handled by Astro's build process

## 🔧 CI/CD Updates

A new GitHub Actions workflow has been created:

- `.github/workflows/docs-starlight.yml` - Builds and deploys Starlight docs

The original MkDocs workflow remains for backward compatibility during transition.

## 📚 Resources

- [Astro Documentation](https://docs.astro.build)
- [Starlight Documentation](https://starlight.astro.build)
- [Migration Script](./migrate-to-starlight.js) - Used for automated content migration

## ✅ Migration Checklist

- [x] Create Starlight project structure
- [x] Migrate all content files
- [x] Convert MkDocs features to Starlight
- [x] Create custom components
- [x] Set up styling and theme
- [x] Configure navigation
- [x] Set up redirects
- [x] Update package.json scripts
- [x] Create CI/CD workflow
- [ ] Test all pages and links
- [ ] Deploy to GitHub Pages
- [ ] Update main README

## 🎉 Benefits of Starlight

1. **Performance** - Static site generation with optimal loading
2. **Developer Experience** - Modern tooling with Astro
3. **Customization** - Full control with components
4. **SEO** - Better meta tag handling
5. **Accessibility** - Built-in a11y features
6. **Future-proof** - Active development and community
