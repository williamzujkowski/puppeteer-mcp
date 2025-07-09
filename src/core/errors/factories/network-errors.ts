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
    defaultContext?: RequestContext,
  ): NetworkDomainError =>
    new NetworkDomainError({
      message: `Connection failed to: ${url}`,
      errorCode: 'NETWORK_CONNECTION_FAILED',
      networkInfo: { url, method: 'GET' },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  timeout: (
    url: string,
    timeout: number,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): NetworkDomainError =>
    new NetworkDomainError({
      message: `Request timeout: ${url}`,
      errorCode: 'NETWORK_TIMEOUT',
      networkInfo: { url, timeout },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  dnsResolutionFailed: (
    hostname: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): NetworkDomainError =>
    new NetworkDomainError({
      message: `DNS resolution failed for: ${hostname}`,
      errorCode: 'NETWORK_DNS_RESOLUTION_FAILED',
      networkInfo: { url: hostname },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  sslError: (
    url: string,
    _error: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): NetworkDomainError =>
    new NetworkDomainError({
      message: `SSL/TLS error for: ${url}`,
      errorCode: 'NETWORK_SSL_ERROR',
      networkInfo: { url },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),

  proxyError: (
    proxyUrl: string,
    context?: RequestContext,
    defaultContext?: RequestContext,
  ): NetworkDomainError =>
    new NetworkDomainError({
      message: `Proxy connection failed: ${proxyUrl}`,
      errorCode: 'NETWORK_PROXY_ERROR',
      networkInfo: { url: proxyUrl },
      requestId: context?.requestId ?? defaultContext?.requestId,
    }),
};
