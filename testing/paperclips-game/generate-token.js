#!/usr/bin/env node

/**
 * Generate JWT token for testing
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Use the same JWT_SECRET as the server
const JWT_SECRET = 'test-secret-for-paperclips-must-be-32-chars-long';

function createTestToken(payload = {}, secret = JWT_SECRET, expiresIn = '1h') {
  return jwt.sign(
    {
      sub: 'paperclips-player',
      username: 'paperclips-player',
      roles: ['user', 'admin'], // Give admin role for full access
      ...payload,
    },
    secret,
    { expiresIn }
  );
}

console.log('JWT_SECRET:', JWT_SECRET);
console.log('Token:', createTestToken());