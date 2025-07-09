/**
 * Network error factories
 * @module core/errors/factories/network-errors
 * @nist si-11 "Error handling"
 */

import { NetworkDomainError } from '../domain-errors.js';
import type { RequestContext } from './types.js';

/**
 * Network error factory methods
 */
export const networkErrors = {
  connectionFailed: (
    url: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): NetworkDomainError =>
    new NetworkDomainError(
      `Connection failed to: ${url}`,
      'NETWORK_CONNECTION_FAILED',
      { url, method: 'GET' },
      context?.requestId ?? defaultContext?.requestId
    ),

  timeout: (
    url: string,
    timeout: number,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): NetworkDomainError =>
    new NetworkDomainError(
      `Request timeout: ${url}`,
      'NETWORK_TIMEOUT',
      { url, timeout },
      context?.requestId ?? defaultContext?.requestId
    ),

  dnsResolutionFailed: (
    hostname: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): NetworkDomainError =>
    new NetworkDomainError(
      `DNS resolution failed for: ${hostname}`,
      'NETWORK_DNS_RESOLUTION_FAILED',
      { url: hostname },
      context?.requestId ?? defaultContext?.requestId
    ),

  sslError: (
    url: string,
    error: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): NetworkDomainError =>
    new NetworkDomainError(
      `SSL/TLS error for: ${url}`,
      'NETWORK_SSL_ERROR',
      { url, error },
      context?.requestId ?? defaultContext?.requestId
    ),

  proxyError: (
    proxyUrl: string,
    context?: RequestContext,
    defaultContext?: RequestContext
  ): NetworkDomainError =>
    new NetworkDomainError(
      `Proxy connection failed: ${proxyUrl}`,
      'NETWORK_PROXY_ERROR',
      { url: proxyUrl },
      context?.requestId ?? defaultContext?.requestId
    ),
};