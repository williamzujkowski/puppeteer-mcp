/// <reference types="express" />

declare namespace Express {
  export interface Request {
    id: string;
    startTime: number;
  }
}