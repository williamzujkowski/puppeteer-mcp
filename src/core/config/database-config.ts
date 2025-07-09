/**
 * Database configuration parser
 * @module core/config/database-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt } from './base-parsers.js';

/**
 * Parse database configuration from environment
 */
export function parseDatabaseConfig(): {
  DATABASE_TYPE: 'sqlite' | 'postgres' | 'mysql';
  DATABASE_PATH: string;
  DATABASE_HOST: string | undefined;
  DATABASE_PORT: number | undefined;
  DATABASE_NAME: string | undefined;
  DATABASE_USER: string | undefined;
  DATABASE_PASSWORD: string | undefined;
  DATABASE_SSL: boolean;
  DATABASE_POOL_MIN: number;
  DATABASE_POOL_MAX: number;
} {
  return {
    DATABASE_TYPE: (process.env.DATABASE_TYPE as 'sqlite' | 'postgres' | 'mysql') ?? 'sqlite',
    DATABASE_PATH: process.env.DATABASE_PATH ?? './data/app.db',
    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PORT: (process.env.DATABASE_PORT !== undefined && process.env.DATABASE_PORT !== '') ? parseInt(process.env.DATABASE_PORT, 5432) : undefined,
    DATABASE_NAME: process.env.DATABASE_NAME,
    DATABASE_USER: process.env.DATABASE_USER,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_SSL: parseBoolean(process.env.DATABASE_SSL, false),
    DATABASE_POOL_MIN: parseInt(process.env.DATABASE_POOL_MIN, 2),
    DATABASE_POOL_MAX: parseInt(process.env.DATABASE_POOL_MAX, 10),
  };
}