/**
 * Express type extensions
 */
import { Request } from 'express';

declare module 'express' {
  export interface Request {
    user?: {
      id: string;
      username: string;
      roles: string[];
      sessionId: string;
    };
    id?: string;
    startTime?: number;
  }
}