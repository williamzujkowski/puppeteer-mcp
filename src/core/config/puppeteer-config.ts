/**
 * Puppeteer configuration parser
 * @module core/config/puppeteer-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt, parseArray } from './base-parsers.js';

/**
 * Parse Puppeteer configuration from environment
 */
export function parsePuppeteerConfig(): {
  PUPPETEER_HEADLESS: boolean;
  PUPPETEER_ARGS: string[];
  PUPPETEER_EXECUTABLE_PATH: string | undefined;
  PUPPETEER_USER_DATA_DIR: string | undefined;
  PUPPETEER_DEFAULT_VIEWPORT_WIDTH: number;
  PUPPETEER_DEFAULT_VIEWPORT_HEIGHT: number;
  PUPPETEER_SLOW_MO: number;
  BROWSER_POOL_MAX_SIZE: number;
  BROWSER_IDLE_TIMEOUT: number;
  PUPPETEER_DOWNLOAD_PATH: string | undefined;
  PUPPETEER_CACHE_ENABLED: boolean;
} {
  return {
    PUPPETEER_HEADLESS: parseBoolean(process.env.PUPPETEER_HEADLESS, true),
    PUPPETEER_ARGS: parseArray(process.env.PUPPETEER_ARGS, ['--no-sandbox', '--disable-setuid-sandbox']),
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
    PUPPETEER_USER_DATA_DIR: process.env.PUPPETEER_USER_DATA_DIR,
    PUPPETEER_DEFAULT_VIEWPORT_WIDTH: parseInt(process.env.PUPPETEER_DEFAULT_VIEWPORT_WIDTH, 1920),
    PUPPETEER_DEFAULT_VIEWPORT_HEIGHT: parseInt(process.env.PUPPETEER_DEFAULT_VIEWPORT_HEIGHT, 1080),
    PUPPETEER_SLOW_MO: parseInt(process.env.PUPPETEER_SLOW_MO, 0),
    BROWSER_POOL_MAX_SIZE: parseInt(process.env.BROWSER_POOL_MAX_SIZE, 5),
    BROWSER_IDLE_TIMEOUT: parseInt(process.env.BROWSER_IDLE_TIMEOUT, 300000),
    PUPPETEER_DOWNLOAD_PATH: process.env.PUPPETEER_DOWNLOAD_PATH,
    PUPPETEER_CACHE_ENABLED: parseBoolean(process.env.PUPPETEER_CACHE_ENABLED, true),
  };
}