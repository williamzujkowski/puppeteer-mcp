/**
 * File-based exporter for logs and metrics
 * @module telemetry/exporters/file-exporter
 * @nist au-2 "Audit events"
 * @nist au-6 "Audit review, analysis, and reporting"
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-node';
import type { PushMetricExporter, ResourceMetrics } from '@opentelemetry/sdk-metrics';
import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode } from '@opentelemetry/core';
import type { TelemetryConfig } from '../config.js';
import type { ExporterFactory, ExporterOptions } from './types.js';
import { logger } from '../../utils/logger.js';

/**
 * File exporter configuration
 */
interface FileExporterConfig {
  filePath: string;
  maxFileSize: number;
  rotateOnSize: boolean;
  format: 'json' | 'ndjson';
}

/**
 * Default file exporter configuration
 */
const DEFAULT_CONFIG: FileExporterConfig = {
  filePath: './telemetry-output.log',
  maxFileSize: 100 * 1024 * 1024, // 100MB
  rotateOnSize: true,
  format: 'ndjson',
};

/**
 * File-based span exporter
 */
export class FileSpanExporter implements SpanExporter {
  private readonly config: FileExporterConfig;

  constructor(config: Partial<FileExporterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.exportAsync(spans, resultCallback).catch((error) => {
      logger.error({ error, filePath: this.config.filePath }, 'Failed to export spans to file');
      resultCallback({
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
  }

  private async exportAsync(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    await this.ensureDirectoryExists(this.config.filePath);

    if (this.config.rotateOnSize) {
      await this.rotateFileIfNeeded();
    }

    const data = this.formatSpans(spans);
    await fs.appendFile(this.config.filePath, data);

    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for file exporter
  }

  async forceFlush(): Promise<void> {
    // File system writes are synchronous, no flushing needed
  }

  private formatSpans(spans: ReadableSpan[]): string {
    if (this.config.format === 'json') {
      return JSON.stringify(spans, null, 2) + '\n';
    }

    // NDJSON format (newline-delimited JSON)
    return spans.map((span) => JSON.stringify(span)).join('\n') + '\n';
  }

  private async rotateFileIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.config.filePath);
      if (stats.size >= this.config.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${this.config.filePath}.${timestamp}`;
        await fs.rename(this.config.filePath, rotatedPath);
        logger.info({ rotatedPath }, 'Rotated telemetry file');
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn({ error }, 'Failed to check file size for rotation');
      }
    }
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

/**
 * File-based metric exporter
 */
export class FileMetricExporter implements PushMetricExporter {
  private readonly config: FileExporterConfig;

  constructor(config: Partial<FileExporterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Use different default file for metrics
    if (config.filePath === undefined || config.filePath.trim() === '') {
      this.config.filePath = './telemetry-metrics.log';
    }
  }

  export(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): void {
    this.exportAsync(metrics, resultCallback).catch((error) => {
      logger.error({ error, filePath: this.config.filePath }, 'Failed to export metrics to file');
      resultCallback({
        code: ExportResultCode.FAILED,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
  }

  private async exportAsync(
    metrics: ResourceMetrics,
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    await this.ensureDirectoryExists(this.config.filePath);

    if (this.config.rotateOnSize) {
      await this.rotateFileIfNeeded();
    }

    const data = this.formatMetrics(metrics);
    await fs.appendFile(this.config.filePath, data);

    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for file exporter
  }

  async forceFlush(): Promise<void> {
    // File system writes are synchronous, no flushing needed
  }

  private formatMetrics(metrics: ResourceMetrics): string {
    if (this.config.format === 'json') {
      return JSON.stringify(metrics, null, 2) + '\n';
    }

    // NDJSON format
    return JSON.stringify(metrics) + '\n';
  }

  private async rotateFileIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.config.filePath);
      if (stats.size >= this.config.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${this.config.filePath}.${timestamp}`;
        await fs.rename(this.config.filePath, rotatedPath);
        logger.info({ rotatedPath }, 'Rotated metrics file');
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn({ error }, 'Failed to check metrics file size for rotation');
      }
    }
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

/**
 * File trace exporter factory
 */
export class FileTraceExporterFactory implements ExporterFactory<SpanExporter> {
  create(_config: TelemetryConfig): SpanExporter {
    const filePath = join(process.cwd(), 'logs', 'traces.log');

    logger.info({ filePath }, 'Creating file trace exporter');

    return new FileSpanExporter({ filePath });
  }

  getType(): string {
    return 'file';
  }
}

/**
 * File metric exporter factory
 */
export class FileMetricExporterFactory implements ExporterFactory<PushMetricExporter> {
  create(_config: TelemetryConfig): PushMetricExporter {
    const filePath = join(process.cwd(), 'logs', 'metrics.log');

    logger.info({ filePath }, 'Creating file metric exporter');

    return new FileMetricExporter({ filePath });
  }

  getType(): string {
    return 'file';
  }
}

/**
 * Create file span exporter with custom options
 */
export function createFileSpanExporter(
  options: ExporterOptions & Partial<FileExporterConfig> = {},
): FileSpanExporter {
  return new FileSpanExporter(options);
}

/**
 * Create file metric exporter with custom options
 */
export function createFileMetricExporter(
  options: ExporterOptions & Partial<FileExporterConfig> = {},
): FileMetricExporter {
  return new FileMetricExporter(options);
}
