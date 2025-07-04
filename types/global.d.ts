/// <reference types="express" />

declare namespace Express {
  export interface Request {
    id: string;
    startTime: number;
  }
}

// Declare __dirname for ES modules compatibility with Jest
declare const __dirname: string;