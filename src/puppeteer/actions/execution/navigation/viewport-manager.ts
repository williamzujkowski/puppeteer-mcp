/**
 * Viewport management for navigation operations
 * @module puppeteer/actions/execution/navigation/viewport-manager
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page, Viewport } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:navigation:viewport-manager');

/**
 * Viewport configuration parameters
 */
export interface ViewportConfig {
  /** Viewport width in pixels */
  width: number;
  /** Viewport height in pixels */
  height: number;
  /** Device scale factor */
  deviceScaleFactor?: number;
  /** Whether viewport supports touch */
  hasTouch?: boolean;
  /** Whether viewport is landscape */
  isLandscape?: boolean;
  /** Whether mobile viewport */
  isMobile?: boolean;
}

/**
 * Predefined viewport presets
 */
export const VIEWPORT_PRESETS = {
  /** Desktop 1920x1080 */
  DESKTOP_FHD: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: true,
    isMobile: false,
  },
  /** Desktop 1366x768 */
  DESKTOP_HD: {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: true,
    isMobile: false,
  },
  /** Desktop 1280x720 */
  DESKTOP_720P: {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: true,
    isMobile: false,
  },
  /** Tablet landscape 1024x768 */
  TABLET_LANDSCAPE: {
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    hasTouch: true,
    isLandscape: true,
    isMobile: true,
  },
  /** Tablet portrait 768x1024 */
  TABLET_PORTRAIT: {
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    hasTouch: true,
    isLandscape: false,
    isMobile: true,
  },
  /** Mobile landscape 667x375 */
  MOBILE_LANDSCAPE: {
    width: 667,
    height: 375,
    deviceScaleFactor: 2,
    hasTouch: true,
    isLandscape: true,
    isMobile: true,
  },
  /** Mobile portrait 375x667 */
  MOBILE_PORTRAIT: {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    hasTouch: true,
    isLandscape: false,
    isMobile: true,
  },
  /** iPhone 13 390x844 */
  IPHONE_13: {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    hasTouch: true,
    isLandscape: false,
    isMobile: true,
  },
  /** Samsung Galaxy S21 384x854 */
  GALAXY_S21: {
    width: 384,
    height: 854,
    deviceScaleFactor: 2.75,
    hasTouch: true,
    isLandscape: false,
    isMobile: true,
  },
} as const;

/**
 * Viewport validation configuration
 */
export interface ViewportValidationConfig {
  /** Minimum width allowed */
  minWidth?: number;
  /** Maximum width allowed */
  maxWidth?: number;
  /** Minimum height allowed */
  minHeight?: number;
  /** Maximum height allowed */
  maxHeight?: number;
  /** Minimum device scale factor */
  minDeviceScaleFactor?: number;
  /** Maximum device scale factor */
  maxDeviceScaleFactor?: number;
}

/**
 * Default viewport validation configuration
 */
const DEFAULT_VALIDATION_CONFIG: Required<ViewportValidationConfig> = {
  minWidth: 100,
  maxWidth: 7680, // 8K width
  minHeight: 100,
  maxHeight: 4320, // 8K height
  minDeviceScaleFactor: 0.1,
  maxDeviceScaleFactor: 5.0,
};

/**
 * Viewport validation result
 */
interface ViewportValidationResult {
  /** Whether viewport is valid */
  isValid: boolean;
  /** Validation error message */
  error?: string;
  /** Validation warnings */
  warnings?: string[];
  /** Normalized viewport configuration */
  normalizedConfig?: ViewportConfig;
}

/**
 * Viewport manager for handling viewport operations
 * @nist ac-3 "Access enforcement"
 */
export class ViewportManager {
  private readonly validationConfig: Required<ViewportValidationConfig>;

  constructor(validationConfig?: Partial<ViewportValidationConfig>) {
    this.validationConfig = { ...DEFAULT_VALIDATION_CONFIG, ...validationConfig };

    logger.debug('Viewport manager initialized', {
      validationConfig: this.validationConfig,
    });
  }

  /**
   * Set viewport for a page
   * @param page - Page instance
   * @param context - Execution context
   * @param config - Viewport configuration
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async setViewport(
    page: Page,
    context: ActionContext,
    config: ViewportConfig,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Setting viewport', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        config,
      });

      // Validate viewport configuration
      const validation = this.validateViewportConfig(config);
      if (!validation.isValid) {
        return this.createFailureResult(
          startTime,
          validation.error ?? 'Viewport validation failed',
          config,
        );
      }

      const normalizedConfig = validation.normalizedConfig!;

      // Convert to Puppeteer viewport format
      const puppeteerViewport = this.toPuppeteerViewport(normalizedConfig);

      // Set the viewport
      await page.setViewport(puppeteerViewport);

      // Get the actual viewport to confirm
      const actualViewport = page.viewport();

      const duration = Date.now() - startTime;

      logger.info('Viewport set successfully', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        requestedConfig: normalizedConfig,
        actualViewport,
        duration,
      });

      return this.createSuccessResult(
        startTime,
        normalizedConfig,
        actualViewport,
        validation.warnings,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set viewport';

      logger.error('Failed to set viewport', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        config,
        error: errorMessage,
      });

      return this.createFailureResult(startTime, errorMessage, config);
    }
  }

  /**
   * Set viewport using preset
   * @param page - Page instance
   * @param context - Execution context
   * @param presetName - Preset name
   * @returns Action result
   */
  async setViewportPreset(
    page: Page,
    context: ActionContext,
    presetName: keyof typeof VIEWPORT_PRESETS,
  ): Promise<ActionResult> {
    const preset = VIEWPORT_PRESETS[presetName];
    if (!preset) {
      return this.createFailureResult(Date.now(), `Unknown viewport preset: ${presetName}`, {
        width: 0,
        height: 0,
      });
    }

    logger.debug('Setting viewport preset', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      presetName,
      preset,
    });

    return this.setViewport(page, context, preset);
  }

  /**
   * Get current viewport
   * @param page - Page instance
   * @returns Current viewport or null
   */
  getCurrentViewport(page: Page): Viewport | null {
    return page.viewport();
  }

  /**
   * Validate viewport configuration
   * @param config - Viewport configuration to validate
   * @returns Validation result
   * @nist si-10 "Information input validation"
   */
  private validateViewportConfig(config: ViewportConfig): ViewportValidationResult {
    const warnings: string[] = [];

    // Basic type validation
    if (typeof config.width !== 'number' || typeof config.height !== 'number') {
      return {
        isValid: false,
        error: 'Width and height must be numbers',
      };
    }

    // Range validation
    if (
      config.width < this.validationConfig.minWidth ||
      config.width > this.validationConfig.maxWidth
    ) {
      return {
        isValid: false,
        error: `Width must be between ${this.validationConfig.minWidth} and ${this.validationConfig.maxWidth}`,
      };
    }

    if (
      config.height < this.validationConfig.minHeight ||
      config.height > this.validationConfig.maxHeight
    ) {
      return {
        isValid: false,
        error: `Height must be between ${this.validationConfig.minHeight} and ${this.validationConfig.maxHeight}`,
      };
    }

    // Device scale factor validation
    const deviceScaleFactor = config.deviceScaleFactor ?? 1;
    if (
      deviceScaleFactor < this.validationConfig.minDeviceScaleFactor ||
      deviceScaleFactor > this.validationConfig.maxDeviceScaleFactor
    ) {
      return {
        isValid: false,
        error: `Device scale factor must be between ${this.validationConfig.minDeviceScaleFactor} and ${this.validationConfig.maxDeviceScaleFactor}`,
      };
    }

    // Integer validation
    if (!Number.isInteger(config.width) || !Number.isInteger(config.height)) {
      return {
        isValid: false,
        error: 'Width and height must be integers',
      };
    }

    // Warnings for unusual configurations
    if (config.width > 3840 || config.height > 2160) {
      warnings.push('Very large viewport dimensions may impact performance');
    }

    if (deviceScaleFactor > 3) {
      warnings.push('High device scale factor may impact performance');
    }

    const aspectRatio = config.width / config.height;
    if (aspectRatio < 0.5 || aspectRatio > 4) {
      warnings.push('Unusual aspect ratio detected');
    }

    // Normalize configuration
    const normalizedConfig: ViewportConfig = {
      width: Math.round(config.width),
      height: Math.round(config.height),
      deviceScaleFactor,
      hasTouch: config.hasTouch ?? false,
      isLandscape: config.isLandscape ?? config.width > config.height,
      isMobile: config.isMobile ?? false,
    };

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      normalizedConfig,
    };
  }

  /**
   * Convert to Puppeteer viewport format
   * @param config - Viewport configuration
   * @returns Puppeteer viewport object
   */
  private toPuppeteerViewport(config: ViewportConfig): Viewport {
    return {
      width: config.width,
      height: config.height,
      deviceScaleFactor: config.deviceScaleFactor ?? 1,
      hasTouch: config.hasTouch ?? false,
      isLandscape: config.isLandscape ?? config.width > config.height,
      isMobile: config.isMobile ?? false,
    };
  }

  /**
   * Create success action result
   * @param startTime - Operation start time
   * @param requestedConfig - Requested viewport configuration
   * @param actualViewport - Actual viewport after setting
   * @param warnings - Validation warnings
   * @returns Success action result
   */
  private createSuccessResult(
    startTime: number,
    requestedConfig: ViewportConfig,
    actualViewport: Viewport | null,
    warnings?: string[],
  ): ActionResult {
    const duration = Date.now() - startTime;

    return {
      success: true,
      actionType: 'setViewport',
      data: {
        viewport: actualViewport,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        requestedWidth: requestedConfig.width,
        requestedHeight: requestedConfig.height,
        requestedScale: requestedConfig.deviceScaleFactor,
        actualViewport,
        warnings,
      },
    };
  }

  /**
   * Create failure action result
   * @param startTime - Operation start time
   * @param errorMessage - Error message
   * @param config - Viewport configuration that failed
   * @returns Failure action result
   */
  private createFailureResult(
    startTime: number,
    errorMessage: string,
    config: ViewportConfig,
  ): ActionResult {
    const duration = Date.now() - startTime;

    return {
      success: false,
      actionType: 'setViewport',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        requestedWidth: config.width,
        requestedHeight: config.height,
        requestedScale: config.deviceScaleFactor,
      },
    };
  }

  /**
   * Get available viewport presets
   * @returns Array of available preset names
   */
  getAvailablePresets(): Array<keyof typeof VIEWPORT_PRESETS> {
    return Object.keys(VIEWPORT_PRESETS) as Array<keyof typeof VIEWPORT_PRESETS>;
  }

  /**
   * Get preset configuration
   * @param presetName - Preset name
   * @returns Preset configuration or null
   */
  getPresetConfig(presetName: keyof typeof VIEWPORT_PRESETS): ViewportConfig | null {
    return VIEWPORT_PRESETS[presetName] ?? null;
  }

  /**
   * Update validation configuration
   * @param config - New validation configuration
   */
  updateValidationConfig(config: Partial<ViewportValidationConfig>): void {
    Object.assign(this.validationConfig, config);

    logger.info('Viewport validation configuration updated', {
      newConfig: config,
      currentConfig: this.validationConfig,
    });
  }

  /**
   * Get current validation configuration
   * @returns Current validation configuration
   */
  getValidationConfig(): Required<ViewportValidationConfig> {
    return { ...this.validationConfig };
  }

  /**
   * Check if viewport configuration is mobile-like
   * @param config - Viewport configuration
   * @returns True if mobile-like viewport
   */
  isMobileViewport(config: ViewportConfig): boolean {
    const isMobile = config.isMobile === true;
    const hasTouch = config.hasTouch === true;
    const isSmall = config.width <= 768 && config.height <= 1024;
    const hasHighDensity = (config.deviceScaleFactor ?? 1) >= 2;

    return isMobile || (hasTouch && isSmall && hasHighDensity);
  }

  /**
   * Check if viewport configuration is tablet-like
   * @param config - Viewport configuration
   * @returns True if tablet-like viewport
   */
  isTabletViewport(config: ViewportConfig): boolean {
    const hasTouch = config.hasTouch === true;
    const isTabletSize =
      (config.width >= 768 && config.width <= 1024) ||
      (config.height >= 768 && config.height <= 1024);
    const hasHighDensity = (config.deviceScaleFactor ?? 1) >= 1.5;

    return hasTouch && isTabletSize && hasHighDensity && !this.isMobileViewport(config);
  }

  /**
   * Check if viewport configuration is desktop-like
   * @param config - Viewport configuration
   * @returns True if desktop-like viewport
   */
  isDesktopViewport(config: ViewportConfig): boolean {
    return !this.isMobileViewport(config) && !this.isTabletViewport(config);
  }
}

/**
 * Create viewport manager instance
 * @param validationConfig - Optional validation configuration
 * @returns Viewport manager instance
 */
export function createViewportManager(
  validationConfig?: Partial<ViewportValidationConfig>,
): ViewportManager {
  return new ViewportManager(validationConfig);
}
