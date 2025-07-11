/**
 * Content Extraction Example
 *
 * This example demonstrates how to:
 * - Extract text content from pages
 * - Scrape structured data
 * - Handle dynamic content
 * - Export data in various formats
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const API_KEY = process.env.API_KEY || 'your-api-key';

interface Product {
  title: string;
  price: string;
  description: string;
  image: string;
  rating: number;
  availability: string;
}

interface Article {
  title: string;
  author: string;
  date: string;
  content: string;
  tags: string[];
}

class ContentExtractor {
  private sessionId: string | null = null;
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  });

  async initialize(): Promise<void> {
    const response = await this.apiClient.post('/sessions', {
      capabilities: {
        acceptInsecureCerts: true,
        browserName: 'chrome',
      },
    });

    this.sessionId = response.data.data.id;
    console.log(`Session initialized: ${this.sessionId}`);
  }

  async navigate(url: string): Promise<void> {
    await this.execute('goto', [url]);
    console.log(`Navigated to: ${url}`);
  }

  async waitForContent(selector: string, timeout = 10000): Promise<void> {
    await this.execute('waitForSelector', [selector, { timeout }]);
  }

  async extractText(selector: string): Promise<string> {
    const text = await this.execute('evaluate', [
      `
      document.querySelector('${selector}')?.textContent?.trim() || ''
    `,
    ]);
    return text as string;
  }

  async extractAttribute(selector: string, attribute: string): Promise<string> {
    const value = await this.execute('evaluate', [
      `
      document.querySelector('${selector}')?.getAttribute('${attribute}') || ''
    `,
    ]);
    return value as string;
  }

  async extractMultiple(selector: string): Promise<string[]> {
    const items = await this.execute('evaluate', [
      `
      Array.from(document.querySelectorAll('${selector}'))
        .map(el => el.textContent?.trim() || '')
    `,
    ]);
    return items as string[];
  }

  async extractProducts(): Promise<Product[]> {
    // Wait for products to load
    await this.waitForContent('.product-item');

    const products = await this.execute('evaluate', [
      `
      Array.from(document.querySelectorAll('.product-item')).map(item => ({
        title: item.querySelector('.product-title')?.textContent?.trim() || '',
        price: item.querySelector('.price')?.textContent?.trim() || '',
        description: item.querySelector('.description')?.textContent?.trim() || '',
        image: item.querySelector('img')?.src || '',
        rating: parseFloat(item.querySelector('.rating')?.textContent || '0'),
        availability: item.querySelector('.availability')?.textContent?.trim() || 'Unknown'
      }))
    `,
    ]);

    return products as Product[];
  }

  async extractArticle(): Promise<Article> {
    // Wait for article content
    await this.waitForContent('article');

    const article = await this.execute('evaluate', [
      `
      const article = document.querySelector('article');
      if (!article) return null;
      
      return {
        title: article.querySelector('h1')?.textContent?.trim() || '',
        author: article.querySelector('.author')?.textContent?.trim() || '',
        date: article.querySelector('.date')?.textContent?.trim() || '',
        content: article.querySelector('.content')?.textContent?.trim() || '',
        tags: Array.from(article.querySelectorAll('.tag'))
          .map(tag => tag.textContent?.trim() || '')
          .filter(Boolean)
      };
    `,
    ]);

    return article as Article;
  }

  async extractTable(tableSelector: string): Promise<any[]> {
    const tableData = await this.execute('evaluate', [
      `
      const table = document.querySelector('${tableSelector}');
      if (!table) return [];
      
      const headers = Array.from(table.querySelectorAll('thead th'))
        .map(th => th.textContent?.trim() || '');
      
      const rows = Array.from(table.querySelectorAll('tbody tr'))
        .map(tr => {
          const cells = Array.from(tr.querySelectorAll('td'))
            .map(td => td.textContent?.trim() || '');
          
          // Convert to object using headers as keys
          return headers.reduce((obj, header, index) => {
            obj[header] = cells[index] || '';
            return obj;
          }, {});
        });
      
      return rows;
    `,
    ]);

    return tableData as any[];
  }

  async scrollToBottom(): Promise<void> {
    await this.execute('evaluate', [
      `
      window.scrollTo(0, document.body.scrollHeight);
    `,
    ]);

    // Wait for potential lazy-loaded content
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async extractWithInfiniteScroll(selector: string, maxScrolls = 5): Promise<any[]> {
    const allItems: any[] = [];
    let previousHeight = 0;

    for (let i = 0; i < maxScrolls; i++) {
      // Get current items
      const items = (await this.execute('evaluate', [
        `
        Array.from(document.querySelectorAll('${selector}'))
          .map(el => el.textContent?.trim() || '')
      `,
      ])) as string[];

      // Add new items
      const newItems = items.slice(allItems.length);
      allItems.push(...newItems);

      // Check if we've reached the bottom
      const currentHeight = (await this.execute('evaluate', [
        `
        document.body.scrollHeight
      `,
      ])) as number;

      if (currentHeight === previousHeight) {
        console.log('Reached bottom of page');
        break;
      }

      previousHeight = currentHeight;

      // Scroll down
      await this.scrollToBottom();
      console.log(`Scroll ${i + 1}/${maxScrolls}: Found ${newItems.length} new items`);
    }

    return allItems;
  }

  private async execute(script: string, args: any[] = []): Promise<any> {
    if (!this.sessionId) {
      throw new Error('Session not initialized');
    }

    const response = await this.apiClient.post(`/sessions/${this.sessionId}/execute`, {
      script,
      args,
      context: {},
    });

    return response.data.data.result;
  }

  async exportToJSON(data: any, filename: string): Promise<void> {
    const outputPath = path.join(__dirname, 'output', filename);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    console.log(`Data exported to: ${outputPath}`);
  }

  async exportToCSV(data: any[], filename: string): Promise<void> {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row) => headers.map((header) => JSON.stringify(row[header] || '')).join(',')),
    ].join('\n');

    const outputPath = path.join(__dirname, 'output', filename);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv);
    console.log(`CSV exported to: ${outputPath}`);
  }

  async cleanup(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.apiClient.delete(`/sessions/${this.sessionId}`);
        console.log('Session cleaned up');
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
  }
}

// Example: Extract products from an e-commerce site
async function extractProductCatalog() {
  const extractor = new ContentExtractor();

  try {
    await extractor.initialize();
    await extractor.navigate('https://example-shop.com/products');

    // Extract product data
    const products = await extractor.extractProducts();
    console.log(`Found ${products.length} products`);

    // Export data
    await extractor.exportToJSON(products, 'products.json');
    await extractor.exportToCSV(products, 'products.csv');

    // Extract with filters
    const inStockProducts = products.filter((p) => p.availability === 'In Stock');
    console.log(`${inStockProducts.length} products in stock`);
  } finally {
    await extractor.cleanup();
  }
}

// Example: Extract blog articles with pagination
async function extractBlogArticles() {
  const extractor = new ContentExtractor();
  const allArticles: Article[] = [];

  try {
    await extractor.initialize();

    // Navigate through pages
    for (let page = 1; page <= 5; page++) {
      await extractor.navigate(`https://example-blog.com/articles?page=${page}`);

      // Check if there are articles on this page
      const hasArticles = await extractor.execute('evaluate', [
        `
        document.querySelectorAll('article').length > 0
      `,
      ]);

      if (!hasArticles) break;

      // Extract article links
      const articleLinks = (await extractor.execute('evaluate', [
        `
        Array.from(document.querySelectorAll('article a'))
          .map(a => a.href)
      `,
      ])) as string[];

      // Visit each article
      for (const link of articleLinks) {
        await extractor.navigate(link);
        const article = await extractor.extractArticle();
        allArticles.push(article);
        console.log(`Extracted: ${article.title}`);
      }
    }

    // Export all articles
    await extractor.exportToJSON(allArticles, 'articles.json');
    console.log(`Total articles extracted: ${allArticles.length}`);
  } finally {
    await extractor.cleanup();
  }
}

// Example: Extract data from dynamic content
async function extractDynamicContent() {
  const extractor = new ContentExtractor();

  try {
    await extractor.initialize();
    await extractor.navigate('https://example-feed.com');

    // Extract content with infinite scroll
    const posts = await extractor.extractWithInfiniteScroll('.post-item', 10);
    console.log(`Extracted ${posts.length} posts`);

    // Export data
    await extractor.exportToJSON(posts, 'dynamic-posts.json');
  } finally {
    await extractor.cleanup();
  }
}

// Run examples
if (require.main === module) {
  (async () => {
    console.log('Running content extraction examples...\n');

    try {
      await extractProductCatalog();
      console.log('\n---\n');

      await extractBlogArticles();
      console.log('\n---\n');

      await extractDynamicContent();
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}
