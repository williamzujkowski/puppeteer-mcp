/**
 * OpenTelemetry resource detection and configuration
 * @module telemetry/resources
 * @nist au-2 "Audit events"
 * @nist si-6 "Security function verification"
 */

import { Resource, ResourceAttributes } from '@opentelemetry/resources';
import { 
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_HOST_NAME,
  SEMRESATTRS_PROCESS_PID,
} from '@opentelemetry/semantic-conventions';
import { 
  detectResourcesSync,
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
} from '@opentelemetry/resources';
import { randomUUID } from 'crypto';
import type { TelemetryConfig } from './config.js';

/**
 * Instance ID for this service instance
 */
const instanceId = randomUUID();

/**
 * Get base service attributes
 */
function getServiceAttributes(config: TelemetryConfig): ResourceAttributes {
  const attributes: ResourceAttributes = {
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
    [SEMRESATTRS_SERVICE_INSTANCE_ID]: instanceId,
  };
  
  if (config.environment) {
    attributes[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT] = config.environment;
  }
  
  return attributes;
}

/**
 * Get custom application attributes
 */
function getApplicationAttributes(): ResourceAttributes {
  return {
    'app.name': 'puppeteer-mcp',
    'app.type': 'browser-automation',
    'app.framework': 'express',
    'app.protocols': ['http', 'grpc', 'websocket', 'mcp'],
    'app.security.compliance': 'NIST',
    'app.node.env': process.env.NODE_ENV ?? 'development',
  };
}

/**
 * Get infrastructure attributes
 */
function getInfrastructureAttributes(): ResourceAttributes {
  const attributes: ResourceAttributes = {
    'infra.type': process.env.K8S_NODE_NAME ? 'kubernetes' : 
                  process.env.ECS_CONTAINER_METADATA_URI ? 'ecs' : 
                  process.env.LAMBDA_TASK_ROOT ? 'lambda' : 
                  'bare-metal',
  };
  
  // Kubernetes attributes
  if (process.env.K8S_NODE_NAME) {
    attributes['k8s.node.name'] = process.env.K8S_NODE_NAME;
    if (process.env.K8S_POD_NAME) attributes['k8s.pod.name'] = process.env.K8S_POD_NAME;
    if (process.env.K8S_POD_NAMESPACE) attributes['k8s.namespace.name'] = process.env.K8S_POD_NAMESPACE;
    if (process.env.K8S_POD_UID) attributes['k8s.pod.uid'] = process.env.K8S_POD_UID;
  }
  
  // Container attributes
  if (process.env.HOSTNAME?.match(/^[a-f0-9]{12}$/)) {
    attributes['container.id'] = process.env.HOSTNAME;
  }
  
  return attributes;
}

/**
 * Create resource with automatic detection
 */
export function createResource(config: TelemetryConfig): Resource {
  // Base resource with service information
  const baseResource = new Resource(getServiceAttributes(config));
  
  // Detect resources if enabled
  let detectedResource = Resource.empty();
  if (config.resource.detectionEnabled) {
    try {
      detectedResource = detectResourcesSync({
        detectors: [
          envDetectorSync,
          hostDetectorSync,
          osDetectorSync,
          processDetectorSync,
        ],
      });
    } catch (error) {
      console.error('Failed to detect resources:', error);
    }
  }
  
  // Application-specific attributes
  const appResource = new Resource(getApplicationAttributes());
  
  // Infrastructure attributes
  const infraResource = new Resource(getInfrastructureAttributes());
  
  // Custom attributes from configuration
  let customResource = Resource.empty();
  if (config.resource.attributes) {
    customResource = new Resource(config.resource.attributes);
  }
  
  // Merge all resources (later resources override earlier ones)
  return baseResource
    .merge(detectedResource)
    .merge(appResource)
    .merge(infraResource)
    .merge(customResource);
}

/**
 * Get resource attributes as a plain object
 */
export function getResourceAttributes(resource: Resource): ResourceAttributes {
  return resource.attributes;
}

/**
 * Resource health check
 */
export interface ResourceHealth {
  healthy: boolean;
  attributes: ResourceAttributes;
  warnings: string[];
}

/**
 * Check resource health and completeness
 */
export function checkResourceHealth(resource: Resource): ResourceHealth {
  const attributes = getResourceAttributes(resource);
  const warnings: string[] = [];
  
  // Check required attributes
  if (!attributes[SEMRESATTRS_SERVICE_NAME]) {
    warnings.push('Missing required attribute: service.name');
  }
  
  if (!attributes[SEMRESATTRS_SERVICE_VERSION]) {
    warnings.push('Missing required attribute: service.version');
  }
  
  // Check recommended attributes
  if (!attributes[SEMRESATTRS_SERVICE_INSTANCE_ID]) {
    warnings.push('Missing recommended attribute: service.instance.id');
  }
  
  if (!attributes[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]) {
    warnings.push('Missing recommended attribute: deployment.environment');
  }
  
  // Check for process information
  if (!attributes[SEMRESATTRS_PROCESS_PID]) {
    warnings.push('Process detection may have failed');
  }
  
  // Check for host information
  if (!attributes[SEMRESATTRS_HOST_NAME]) {
    warnings.push('Host detection may have failed');
  }
  
  return {
    healthy: warnings.length === 0,
    attributes,
    warnings,
  };
}

/**
 * Create minimal resource for testing
 */
export function createTestResource(serviceName: string = 'test-service'): Resource {
  return new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: '0.0.0-test',
    [SEMRESATTRS_SERVICE_INSTANCE_ID]: 'test-instance',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: 'test',
  });
}