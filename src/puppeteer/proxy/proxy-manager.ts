/**
 * Proxy Manager Implementation
 * @module puppeteer/proxy/proxy-manager
 * @nist ac-4 "Information flow enforcement"
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 * 
 * This file re-exports the proxy manager from the modular structure
 */

export { ProxyManager } from './manager/index.js';
export type { ProxyManagerEvents, ProxyInstance } from './manager/types.js';