/**
 * Version detection and compatibility checking utilities
 * @module puppeteer/pool/compatibility/version-detector
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

import { createLogger } from '../../../utils/logger.js';
import type { VersionCompatibility } from './types.js';

const logger = createLogger('version-detector');

/**
 * Version detector for compatibility checking
 * @nist ac-3 "Access enforcement"
 */
export class VersionDetector {
  private static readonly SUPPORTED_VERSIONS = [
    '1.0.0',
    '1.0.1',
    '1.0.2',
    '1.0.3',
    '1.0.4',
    '1.0.5',
    '1.0.6',
    '1.0.7',
    '1.0.8',
    '1.0.9',
    '1.0.10',
    '1.0.11',
    '1.0.12',
  ];

  private static readonly BREAKING_CHANGES = new Map<string, string[]>([
    ['1.0.0', ['Initial release']],
    ['1.0.5', ['Pool configuration schema changes']],
    ['1.0.10', ['Optimization config structure changes']],
  ]);

  private static readonly DEPRECATED_FEATURES = new Map<string, string[]>([
    ['1.0.8', ['Legacy pool methods']],
    ['1.0.10', ['Old optimization flags']],
  ]);

  /**
   * Detect current version compatibility
   * @nist ac-3 "Access enforcement"
   */
  static detectVersion(): string {
    try {
      // In a real implementation, this would read from package.json
      // For now, we'll use a placeholder
      return '1.0.12';
    } catch (error) {
      logger.warn({ error }, 'Failed to detect version');
      return '1.0.0';
    }
  }

  /**
   * Check if a version is supported
   * @nist ac-3 "Access enforcement"
   */
  static isVersionSupported(version: string): boolean {
    return VersionDetector.SUPPORTED_VERSIONS.includes(version);
  }

  /**
   * Get version compatibility information
   * @nist ac-3 "Access enforcement"
   */
  static getVersionCompatibility(version: string): VersionCompatibility {
    const isCompatible = VersionDetector.isVersionSupported(version);
    const requiredMigrations = VersionDetector.getRequiredMigrations(version);
    const deprecatedFeatures = VersionDetector.getDeprecatedFeatures(version);

    return {
      version,
      isCompatible,
      requiredMigrations,
      deprecatedFeatures,
    };
  }

  /**
   * Get required migrations for a version
   * @nist ac-3 "Access enforcement"
   */
  private static getRequiredMigrations(version: string): string[] {
    const migrations: string[] = [];

    for (const [breakingVersion, changes] of VersionDetector.BREAKING_CHANGES) {
      if (VersionDetector.isVersionBefore(version, breakingVersion)) {
        migrations.push(...changes);
      }
    }

    return migrations;
  }

  /**
   * Get deprecated features for a version
   * @nist ac-3 "Access enforcement"
   */
  private static getDeprecatedFeatures(version: string): string[] {
    const deprecatedFeatures: string[] = [];

    for (const [deprecationVersion, features] of VersionDetector.DEPRECATED_FEATURES) {
      if (VersionDetector.isVersionBefore(version, deprecationVersion)) {
        deprecatedFeatures.push(...features);
      }
    }

    return deprecatedFeatures;
  }

  /**
   * Check if version A is before version B
   * @nist ac-3 "Access enforcement"
   */
  private static isVersionBefore(versionA: string, versionB: string): boolean {
    const parseVersion = (version: string): number[] => {
      return version.split('.').map(Number);
    };

    const partsA = parseVersion(versionA);
    const partsB = parseVersion(versionB);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      // eslint-disable-next-line security/detect-object-injection
      const partA = partsA[i] ?? 0;
      // eslint-disable-next-line security/detect-object-injection
      const partB = partsB[i] ?? 0;

      if (partA < partB) return true;
      if (partA > partB) return false;
    }

    return false;
  }

  /**
   * Compare two versions
   * @nist ac-3 "Access enforcement"
   */
  static compareVersions(versionA: string, versionB: string): -1 | 0 | 1 {
    if (VersionDetector.isVersionBefore(versionA, versionB)) return -1;
    if (VersionDetector.isVersionBefore(versionB, versionA)) return 1;
    return 0;
  }

  /**
   * Get latest supported version
   * @nist ac-3 "Access enforcement"
   */
  static getLatestSupportedVersion(): string {
    return VersionDetector.SUPPORTED_VERSIONS[VersionDetector.SUPPORTED_VERSIONS.length - 1];
  }

  /**
   * Check if upgrade is available
   * @nist ac-3 "Access enforcement"
   */
  static isUpgradeAvailable(currentVersion: string): boolean {
    const latestVersion = VersionDetector.getLatestSupportedVersion();
    return VersionDetector.compareVersions(currentVersion, latestVersion) < 0;
  }

  /**
   * Get upgrade path for a version
   * @nist ac-3 "Access enforcement"
   */
  static getUpgradePath(fromVersion: string, toVersion?: string): string[] {
    const targetVersion = toVersion ?? VersionDetector.getLatestSupportedVersion();
    const path: string[] = [];

    const fromIndex = VersionDetector.SUPPORTED_VERSIONS.indexOf(fromVersion);
    const toIndex = VersionDetector.SUPPORTED_VERSIONS.indexOf(targetVersion);

    if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) {
      return path;
    }

    for (let i = fromIndex + 1; i <= toIndex; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const version = VersionDetector.SUPPORTED_VERSIONS[i];
      if (version) {
        path.push(version);
      }
    }

    return path;
  }
}
