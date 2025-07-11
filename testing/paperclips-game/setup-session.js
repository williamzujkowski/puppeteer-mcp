#!/usr/bin/env node

/**
 * Setup script to create a session and generate proper JWT tokens
 * This script directly creates a session in the session store
 */

import crypto from 'crypto';
import { InMemorySessionStore } from '../../dist/store/in-memory-session-store.js';
import { generateTokenPair } from '../../dist/auth/jwt.js';

async function createTestSession() {
  const sessionStore = new InMemorySessionStore();

  // Generate test user data
  const userId = crypto.randomUUID();
  const username = 'paperclips-player';
  const roles = ['user', 'admin'];

  // Create session data
  const sessionData = {
    userId,
    username,
    roles,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };

  // Create session in store
  const sessionId = await sessionStore.create(sessionData);

  // Generate token pair
  const tokens = generateTokenPair(userId, username, roles, sessionId);

  console.log('Session created successfully!');
  console.log('Session ID:', sessionId);
  console.log('User ID:', userId);
  console.log('Access Token:', tokens.accessToken);
  console.log('Refresh Token:', tokens.refreshToken);
  console.log('Expires In:', tokens.expiresIn, 'seconds');

  return {
    sessionId,
    userId,
    username,
    roles,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

// Export for use in other scripts
export { createTestSession };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestSession().catch(console.error);
}
