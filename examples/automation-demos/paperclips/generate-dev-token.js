#!/usr/bin/env node

/**
 * Development Token Generator
 *
 * Generates a JWT token for development testing purposes.
 * This bypasses the normal authentication flow for API testing.
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Default development JWT secret (matches config defaults)
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-development-use-only';
const JWT_EXPIRY = '1h';

/**
 * Generate a development token
 */
function generateDevToken() {
  const userId = uuidv4();
  const sessionId = uuidv4();
  const username = 'test-user';
  const roles = ['user'];

  const payload = {
    sub: userId,
    username,
    roles,
    sessionId,
    type: 'access',
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS512',
    expiresIn: JWT_EXPIRY,
  });

  return {
    accessToken: token,
    userId,
    sessionId,
    username,
    roles,
    expiresIn: 3600,
  };
}

// Generate and output token
const tokenData = generateDevToken();

console.log(JSON.stringify(tokenData, null, 2));

export { generateDevToken };
