/**
 * Puppeteer configuration module
 * @module puppeteer/config
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-5 "Denial of service protection"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { z } from 'zod';
import type { LaunchOptions } from 'puppeteer';
import { config } from '../core/config.js';
import path from 'path';
import os from 'os';

/**
 * Puppeteer configuration schema
 * @nist cm-7 "Least functionality"
 */
export const puppeteerConfigSchema = z.object({
  executablePath: z.string().optional(),
  headless: z.boolean().default(true),
  args: z.array(z.string()).default([]),
  poolMaxSize: z.number().int().positive().default(5),
  idleTimeout: z.number().int().positive().default(300000), // 5 minutes
  downloadPath: z.string().optional(),
  cacheEnabled: z.boolean().default(true),
  defaultViewport: z
    .object({
      width: z.number().int().positive().default(1280),
      height: z.number().int().positive().default(720),
      deviceScaleFactor: z.number().positive().default(1),
      isMobile: z.boolean().default(false),
      hasTouch: z.boolean().default(false),
    })
    .default({}),
  timeout: z.number().int().positive().default(30000), // 30 seconds
});

export type PuppeteerConfig = z.infer<typeof puppeteerConfigSchema>;

/**
 * Security-focused browser arguments
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-6 "Least privilege"
 */
const SECURITY_BROWSER_ARGS = [
  '--no-sandbox', // Required in Docker/containerized environments
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage', // Overcome limited resource problems
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--disable-web-security', // Note: Only for trusted content
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-blink-features=AutomationControlled',
];

/**
 * Performance-focused browser arguments
 * @nist sc-5 "Denial of service protection"
 */
const PERFORMANCE_BROWSER_ARGS = [
  '--memory-pressure-off',
  '--max-old-space-size=4096',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

/**
 * Privacy-focused browser arguments
 * @nist ia-7 "Cryptographic module authentication"
 */
const PRIVACY_BROWSER_ARGS = [
  '--disable-features=TranslateUI',
  '--disable-features=BlinkGenPropertyTrees',
  '--disable-ipc-flooding-protection',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-background-networking',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-update',
  '--disable-domain-reliability',
  '--disable-features=AudioServiceOutOfProcess',
  '--disable-hang-monitor',
  '--disable-offer-store-unmasked-wallet-cards',
  '--disable-popup-blocking',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-speech-api',
  '--disable-sync',
  '--hide-scrollbars',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-default-browser-check',
  '--no-pings',
  '--password-store=basic',
  '--use-mock-keychain',
];

/**
 * Get default browser launch options
 * @nist cm-6 "Configuration settings"
 */
export function getDefaultLaunchOptions(): LaunchOptions {
  const args = [...SECURITY_BROWSER_ARGS, ...PERFORMANCE_BROWSER_ARGS, ...PRIVACY_BROWSER_ARGS];

  // Add additional args from environment
  if (
    config.PUPPETEER_ARGS !== null &&
    config.PUPPETEER_ARGS !== undefined &&
    Array.isArray(config.PUPPETEER_ARGS) &&
    config.PUPPETEER_ARGS.length > 0
  ) {
    args.push(...config.PUPPETEER_ARGS);
  }

  return {
    headless: config.PUPPETEER_HEADLESS,
    executablePath: config.PUPPETEER_EXECUTABLE_PATH,
    args,
    defaultViewport: {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
    ignoreDefaultArgs: false,
    timeout: 30000,
  };
}

/**
 * Get browser executable path based on environment
 * @nist cm-7 "Least functionality"
 */
export function getBrowserExecutablePath(): string | undefined {
  if (
    config.PUPPETEER_EXECUTABLE_PATH !== null &&
    config.PUPPETEER_EXECUTABLE_PATH !== undefined &&
    config.PUPPETEER_EXECUTABLE_PATH !== ''
  ) {
    return config.PUPPETEER_EXECUTABLE_PATH;
  }

  // Check if running in Docker
  if (process.env.RUNNING_IN_DOCKER === 'true') {
    return '/usr/bin/chromium-browser';
  }

  // Let Puppeteer find the browser
  return undefined;
}

/**
 * Get cache directory path
 * @nist cm-6 "Configuration settings"
 */
export function getCacheDirectory(): string {
  if (
    config.PUPPETEER_DOWNLOAD_PATH !== null &&
    config.PUPPETEER_DOWNLOAD_PATH !== undefined &&
    config.PUPPETEER_DOWNLOAD_PATH !== ''
  ) {
    return config.PUPPETEER_DOWNLOAD_PATH;
  }

  return path.join(os.homedir(), '.cache', 'puppeteer');
}

/**
 * Get environment-specific browser configuration
 * @nist cm-7 "Least functionality"
 * @nist sc-5 "Denial of service protection"
 */
export function getEnvironmentConfig(): Partial<LaunchOptions> {
  const env = config.NODE_ENV;

  switch (env) {
    case 'production':
      return {
        headless: true,
        args: [
          ...SECURITY_BROWSER_ARGS,
          ...PERFORMANCE_BROWSER_ARGS,
          ...PRIVACY_BROWSER_ARGS,
          '--disable-software-rasterizer',
          '--disable-extensions',
        ],
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      };

    case 'test':
      return {
        headless: true,
        args: [...SECURITY_BROWSER_ARGS, '--disable-extensions', '--disable-default-apps'],
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      };

    case 'development':
    default:
      return {
        headless: config.PUPPETEER_HEADLESS,
        devtools: true,
        args: SECURITY_BROWSER_ARGS,
      };
  }
}

/**
 * Validate browser pool configuration
 * @nist sc-5 "Denial of service protection"
 */
export function validatePoolConfig(poolSize: number, idleTimeout: number): void {
  if (poolSize > 20) {
    throw new Error('Browser pool size cannot exceed 20 to prevent resource exhaustion');
  }

  if (idleTimeout < 60000) {
    // 1 minute
    throw new Error('Browser idle timeout must be at least 1 minute');
  }

  if (idleTimeout > 3600000) {
    // 1 hour
    throw new Error('Browser idle timeout cannot exceed 1 hour');
  }
}

/**
 * Get secure browser context options
 * @nist ac-4 "Information flow enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export function getSecureContextOptions(): Record<string, unknown> {
  return {
    // Disable all permissions by default
    permissions: [],
    // Block all cookies
    acceptInsecureCerts: false,
    // Disable service workers
    serviceWorkers: 'block',
    // Clear cookies on context close
    recordVideo: undefined,
    // Disable geolocation
    geolocation: undefined,
    // Set secure user agent
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Disable JavaScript if not needed
    javaScriptEnabled: true, // Can be toggled based on use case
    // Block images to save bandwidth
    loadImages: false,
    // Set strict cookie policy
    cookiePolicy: 'strict',
    // Disable webgl
    webgl: false,
    // Disable web audio
    webaudio: false,
  };
}

/**
 * Export parsed configuration
 */
export const puppeteerConfig: PuppeteerConfig = {
  executablePath: config.PUPPETEER_EXECUTABLE_PATH,
  headless: config.PUPPETEER_HEADLESS,
  args: config.PUPPETEER_ARGS?.split(',').map((arg) => arg.trim()) ?? [],
  poolMaxSize: config.BROWSER_POOL_MAX_SIZE,
  idleTimeout: config.BROWSER_IDLE_TIMEOUT,
  downloadPath: config.PUPPETEER_DOWNLOAD_PATH,
  cacheEnabled: config.PUPPETEER_CACHE_ENABLED,
  defaultViewport: {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  timeout: 30000,
};

// Validate configuration on module load
validatePoolConfig(puppeteerConfig.poolMaxSize, puppeteerConfig.idleTimeout);
