/**
 * Security configuration parser
 * @module core/config/security-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt, parseArray } from './base-parsers.js';

/**
 * Parse security configuration from environment
 */
export function parseSecurityConfig(jwtSecret: string): {
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  JWT_ALGORITHM: string;
  ALLOWED_ORIGINS: string[];
  TRUSTED_PROXIES: string[];
  ENABLE_INTRUSION_DETECTION: boolean;
  MAX_LOGIN_ATTEMPTS: number;
  LOGIN_LOCKOUT_DURATION: number;
  ENABLE_ANOMALY_DETECTION: boolean;
  ENABLE_THREAT_INTEL: boolean;
} {
  return {
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    JWT_ALGORITHM: process.env.JWT_ALGORITHM ?? 'HS256',
    ALLOWED_ORIGINS: parseArray(process.env.ALLOWED_ORIGINS, ['https://localhost:8443']),
    TRUSTED_PROXIES: parseArray(process.env.TRUSTED_PROXIES, []),
    ENABLE_INTRUSION_DETECTION: parseBoolean(process.env.ENABLE_INTRUSION_DETECTION, true),
    MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 5),
    LOGIN_LOCKOUT_DURATION: parseInt(process.env.LOGIN_LOCKOUT_DURATION, 900000),
    ENABLE_ANOMALY_DETECTION: parseBoolean(process.env.ENABLE_ANOMALY_DETECTION, true),
    ENABLE_THREAT_INTEL: parseBoolean(process.env.ENABLE_THREAT_INTEL, false),
  };
}