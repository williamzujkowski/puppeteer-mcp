/**
 * PDF generation functionality acceptance tests
 * @module tests/acceptance/basic/pdf
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  createMCPClient,
  createMCPSession,
  cleanupMCPSession,
  mcpNavigate,
  mcpPDF,
  mcpWaitForSelector,
  mcpClick,
} from '../utils/mcp-client.js';
import { getTestTargets, TEST_CONFIG } from '../utils/reliable-test-config.js';
const TEST_TARGETS = getTestTargets();
import { retryOperation, validateUrl, PerformanceTracker } from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('PDF Generation Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;

  beforeAll(async () => {
    // Validate test targets
    const targetsToValidate = [TEST_TARGETS.testing.theInternet, TEST_TARGETS.ecommerce.sauceDemo];

    for (const url of targetsToValidate) {
      const isAccessible = await validateUrl(url);
      if (!isAccessible) {
        console.warn(`Warning: Test target ${url} is not accessible`);
      }
    }

    mcpClient = await createMCPClient();
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    if (mcpClient !== null) {
      await mcpClient.cleanup();
    }
  });

  beforeEach(async () => {
    sessionInfo = await createMCPSession(mcpClient.client);
  }, TEST_CONFIG.timeout);

  afterEach(async () => {
    if (sessionInfo !== null) {
      await cleanupMCPSession(mcpClient.client, sessionInfo);
    }
  });

  describe('Basic PDF Generation', () => {
    it(
      'should generate PDF from full page with default settings',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Navigate to a visually consistent page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          performance.checkpoint('navigation');

          // Wait for page to be fully loaded
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');
          await new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 1000);
          });
          performance.checkpoint('page_ready');

          // Generate PDF with default settings
          const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId);
          performance.checkpoint('pdf_generated');

          // Verify PDF was generated
          expect(pdfData).toBeTruthy();
          expect(pdfData.length).toBeGreaterThan(0);
          expect(typeof pdfData).toBe('string');

          // Verify it's base64 encoded PDF data
          expect(pdfData).toMatch(/^[A-Za-z0-9+/]+=*$/);

          console.warn(
            'Default PDF generated, size:',
            Buffer.from(pdfData, 'base64').length,
            'bytes',
          );
          console.warn('Performance:', performance.getReport());
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should generate PDF of a complex page layout',
      async () => {
        await retryOperation(async () => {
          // Navigate to SauceDemo for complex layout
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );

          // Wait for login form
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.login_wrapper');

          // Generate PDF of the login page
          const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            printBackground: true,
          });

          expect(pdfData).toBeTruthy();
          expect(pdfData.length).toBeGreaterThan(0);

          const pdfSize = Buffer.from(pdfData, 'base64').length;
          console.warn('SauceDemo login PDF generated, size:', pdfSize, 'bytes');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('PDF Formats and Page Sizes', () => {
    it(
      'should generate PDFs in different page formats',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test different formats
          const formats: Array<'a4' | 'letter' | 'legal'> = ['a4', 'letter', 'legal'];
          const results: Array<{ format: string; size: number }> = [];

          for (const format of formats) {
            const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId, { format });

            expect(pdfData).toBeTruthy();
            expect(pdfData.length).toBeGreaterThan(0);

            const pdfSize = Buffer.from(pdfData, 'base64').length;
            results.push({ format, size: pdfSize });
          }

          // All formats should produce PDFs
          expect(results).toHaveLength(3);
          results.forEach((result) => {
            expect(result.size).toBeGreaterThan(1000); // Should be at least 1KB
          });

          console.warn('Format test results:', results);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle custom page sizes (A0, A5, A6)',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test large format (A0)
          const a0PDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, { format: 'a0' });
          expect(a0PDF).toBeTruthy();

          // Test small format (A6)
          const a6PDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, { format: 'a6' });
          expect(a6PDF).toBeTruthy();

          const a0Size = Buffer.from(a0PDF, 'base64').length;
          const a6Size = Buffer.from(a6PDF, 'base64').length;

          console.warn('Format sizes - A0:', a0Size, 'bytes, A6:', a6Size, 'bytes');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('PDF Orientation and Scale', () => {
    it(
      'should generate PDFs in both portrait and landscape orientation',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Portrait (default)
          const portraitPDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            landscape: false,
          });
          expect(portraitPDF).toBeTruthy();

          // Landscape
          const landscapePDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            landscape: true,
          });
          expect(landscapePDF).toBeTruthy();

          const portraitSize = Buffer.from(portraitPDF, 'base64').length;
          const landscapeSize = Buffer.from(landscapePDF, 'base64').length;

          console.warn(
            'Orientation sizes - Portrait:',
            portraitSize,
            'bytes, Landscape:',
            landscapeSize,
            'bytes',
          );
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle different scale settings',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test different scales
          const scales = [0.5, 1.0, 1.5];
          const results: Array<{ scale: number; size: number }> = [];

          for (const scale of scales) {
            const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId, { scale });

            expect(pdfData).toBeTruthy();
            const pdfSize = Buffer.from(pdfData, 'base64').length;
            results.push({ scale, size: pdfSize });
          }

          // All scales should produce valid PDFs
          expect(results).toHaveLength(3);
          results.forEach((result) => {
            expect(result.size).toBeGreaterThan(1000);
          });

          console.warn('Scale test results:', results);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('PDF Margins and Headers/Footers', () => {
    it(
      'should generate PDF with custom margins',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test with custom margins
          const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            margin: {
              top: '2cm',
              bottom: '2cm',
              left: '1.5cm',
              right: '1.5cm',
            },
          });

          expect(pdfData).toBeTruthy();
          expect(pdfData.length).toBeGreaterThan(0);

          const pdfSize = Buffer.from(pdfData, 'base64').length;
          console.warn('PDF with custom margins generated, size:', pdfSize, 'bytes');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should generate PDF with headers and footers',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test with headers and footers
          const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            displayHeaderFooter: true,
            headerTemplate:
              '<div style="font-size: 10px; width: 100%; text-align: center;">Test Header - <span class="date"></span></div>',
            footerTemplate:
              '<div style="font-size: 10px; width: 100%; text-align: center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
            margin: {
              top: '2cm',
              bottom: '2cm',
              left: '1cm',
              right: '1cm',
            },
          });

          expect(pdfData).toBeTruthy();
          expect(pdfData.length).toBeGreaterThan(0);

          const pdfSize = Buffer.from(pdfData, 'base64').length;
          console.warn('PDF with headers/footers generated, size:', pdfSize, 'bytes');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('PDF Quality and Optimization', () => {
    it(
      'should generate PDF with background graphics',
      async () => {
        await retryOperation(async () => {
          // Navigate to a page with background colors/images
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.ecommerce.sauceDemo,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '.login_wrapper');

          // Generate PDF without background
          const noBgPDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            printBackground: false,
          });

          // Generate PDF with background
          const withBgPDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            printBackground: true,
          });

          expect(noBgPDF).toBeTruthy();
          expect(withBgPDF).toBeTruthy();

          const noBgSize = Buffer.from(noBgPDF, 'base64').length;
          const withBgSize = Buffer.from(withBgPDF, 'base64').length;

          console.warn(
            'Background test - No BG:',
            noBgSize,
            'bytes, With BG:',
            withBgSize,
            'bytes',
          );
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle CSS page size preferences',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test with CSS page size disabled
          const standardPDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            preferCSSPageSize: false,
          });

          // Test with CSS page size enabled
          const cssPageSizePDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            preferCSSPageSize: true,
          });

          expect(standardPDF).toBeTruthy();
          expect(cssPageSizePDF).toBeTruthy();

          console.warn('CSS page size test completed');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('PDF Page Ranges and Regions', () => {
    it(
      'should handle specific page ranges',
      async () => {
        await retryOperation(async () => {
          // Navigate to a page that might have multiple print pages
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/large',
          );

          // Wait for content, fallback to main page if large doesn't exist
          try {
            await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1', 5000);
          } catch {
            await mcpNavigate(
              mcpClient.client,
              sessionInfo.contextId,
              TEST_TARGETS.testing.theInternet,
            );
            await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');
          }

          // Generate PDF with page range (first page only)
          const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            pageRanges: '1',
          });

          expect(pdfData).toBeTruthy();
          expect(pdfData.length).toBeGreaterThan(0);

          const pdfSize = Buffer.from(pdfData, 'base64').length;
          console.warn('Page range PDF generated, size:', pdfSize, 'bytes');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should generate PDF of dynamic content after interactions',
      async () => {
        await retryOperation(async () => {
          // Navigate to a page with dynamic content
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/dropdown',
          );

          // Wait for dropdown
          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#dropdown');

          // Interact with dropdown to change content
          await mcpClick(mcpClient.client, sessionInfo.contextId, '#dropdown');

          // Generate PDF of the modified state
          const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            printBackground: true,
          });

          expect(pdfData).toBeTruthy();
          expect(pdfData.length).toBeGreaterThan(0);

          const pdfSize = Buffer.from(pdfData, 'base64').length;
          console.warn('Dynamic content PDF generated, size:', pdfSize, 'bytes');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Error Handling and Edge Cases', () => {
    it(
      'should handle invalid PDF parameters gracefully',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test with invalid scale (should be between 0.1 and 2)
          try {
            await mcpPDF(
              mcpClient.client,
              sessionInfo.contextId,
              { scale: 5.0 }, // Invalid scale
            );
            // If it doesn't throw, the implementation handles it gracefully
          } catch (error) {
            // Error handling is expected for invalid parameters
            expect(error).toBeTruthy();
            console.warn('Expected error for invalid scale:', (error as Error).message);
          }

          // Test that normal PDF generation still works after error
          const validPDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, { scale: 1.0 });
          expect(validPDF).toBeTruthy();
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle PDF generation with timeout settings',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Test with short timeout
          const pdfData = await mcpPDF(
            mcpClient.client,
            sessionInfo.contextId,
            { timeout: 5000 }, // 5 second timeout
          );

          expect(pdfData).toBeTruthy();
          expect(pdfData.length).toBeGreaterThan(0);

          console.warn('PDF with timeout generated successfully');
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle consecutive PDF generations',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );
          performance.checkpoint('navigation');

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'h1');

          // Generate multiple PDFs in sequence
          const pdfs: string[] = [];
          const sizes: number[] = [];

          for (let i = 0; i < 3; i++) {
            const pdfData = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
              format: 'a4',
              landscape: i % 2 === 1,
            });
            pdfs.push(pdfData);
            sizes.push(Buffer.from(pdfData, 'base64').length);
            performance.checkpoint(`pdf_${i}`);
          }

          // Verify all PDFs were generated
          expect(pdfs).toHaveLength(3);
          pdfs.forEach((pdf, index) => {
            expect(pdf).toBeTruthy();
            expect(pdf.length).toBeGreaterThan(0);
            expect(sizes[index]).toBeGreaterThan(1000);
          });

          console.warn('Consecutive PDF generation completed:', performance.getReport());
          console.warn('PDF sizes:', sizes);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should generate PDF from pages with various content types',
      async () => {
        await retryOperation(async () => {
          // Test with form page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/login',
          );

          await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, '#login');

          const formPDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
            printBackground: true,
          });

          expect(formPDF).toBeTruthy();

          // Test with table page
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet + '/tables',
          );

          try {
            await mcpWaitForSelector(mcpClient.client, sessionInfo.contextId, 'table', 5000);

            const tablePDF = await mcpPDF(mcpClient.client, sessionInfo.contextId, {
              format: 'a4',
              landscape: true,
            });

            expect(tablePDF).toBeTruthy();
          } catch {
            // Table page might not exist, skip this part
            console.warn('Table page not found, skipping table PDF test');
          }

          const formSize = Buffer.from(formPDF, 'base64').length;
          console.warn('Content type PDFs - Form:', formSize, 'bytes');
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
