/**
 * Express type extensions
 */
import { Request } from 'express';

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