/**
 * Security metrics module
 * @module telemetry/metrics/app-metrics/security-metrics
 * @nist au-6 "Audit review, analysis, and reporting"
 * @nist si-6 "Security function verification"
 */

import { Meter } from '@opentelemetry/api';
import { SecurityMetrics, AuthLabels } from './types.js';

/**
 * Security metrics implementation
 */
export class SecurityMetricsImpl implements SecurityMetrics {
  public readonly meter: Meter;
  public readonly authAttemptsTotal;
  public readonly authFailuresTotal;
  public readonly authTokensIssued;
  public readonly authTokensRevoked;
  public readonly authActiveTokens;

  constructor(meter: Meter) {
    this.meter = meter;
    
    this.authAttemptsTotal = meter.createCounter('auth_attempts_total', {
      description: 'Total number of authentication attempts',
      unit: '1',
    });
    
    this.authFailuresTotal = meter.createCounter('auth_failures_total', {
      description: 'Total number of authentication failures',
      unit: '1',
    });
    
    this.authTokensIssued = meter.createCounter('auth_tokens_issued_total', {
      description: 'Total number of authentication tokens issued',
      unit: '1',
    });
    
    this.authTokensRevoked = meter.createCounter('auth_tokens_revoked_total', {
      description: 'Total number of authentication tokens revoked',
      unit: '1',
    });
    
    this.authActiveTokens = meter.createUpDownCounter('auth_active_tokens', {
      description: 'Number of active authentication tokens',
      unit: '1',
    });
  }

  /**
   * Record authentication attempt
   */
  recordAuthAttempt(
    method: string,
    success: boolean,
    reason?: string,
  ): void {
    const labels: AuthLabels = {
      method,
      success: success.toString(),
    };
    
    this.authAttemptsTotal.add(1, labels);
    
    if (!success) {
      this.authFailuresTotal.add(1, {
        ...labels,
        reason: reason ?? 'unknown',
      });
    }
  }

  /**
   * Record token issuance
   */
  recordTokenIssued(tokenType: string = 'bearer'): void {
    this.authTokensIssued.add(1, { token_type: tokenType });
    this.authActiveTokens.add(1);
  }

  /**
   * Record token revocation
   */
  recordTokenRevoked(tokenType: string = 'bearer', reason: string = 'manual'): void {
    this.authTokensRevoked.add(1, { token_type: tokenType, reason });
    this.authActiveTokens.add(-1);
  }

  /**
   * Record security event
   */
  recordSecurityEvent(
    eventType: string,
    severity: string,
    source: string,
  ): void {
    const securityEventsCounter = this.meter.createCounter('security_events_total', {
      description: 'Total number of security events',
      unit: '1',
    });
    
    securityEventsCounter.add(1, {
      event_type: eventType,
      severity,
      source,
    });
  }
}