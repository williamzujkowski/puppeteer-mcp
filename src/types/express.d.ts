/**
 * Express type extensions
 */
import { Request } from 'express';
import 'express-session';

declare module 'express' {
  export interface Request {
    user?: {
      userId: string;
      username: string;
      roles: string[];
      sessionId: string;
    };
    id?: string;
    startTime?: number;
  }
}

declare module 'express-session' {
  interface SessionData {
    csrfSecret?: string;
    userId?: string;
    createdAt?: string;
    lastActivity?: string;
  }
}