/// <reference types="express" />

declare namespace Express {
  export interface Request {
    id: string;
    startTime: number;
  }
}

// __dirname is handled by Node.js types