# Session Persistence with Redis

This document describes the Redis-backed session persistence implementation for the puppeteer-mcp
project, including configuration, usage, and operational considerations.

## Overview

The session persistence system provides:

- **Redis-backed session storage** with automatic failover to in-memory store
- **Session migration utilities** for moving between different stores
- **Replication and synchronization** features for high availability
- **Comprehensive monitoring** and health checks
- **Graceful fallback mechanisms** when Redis is unavailable
- **NIST compliance** with proper audit logging and security controls

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Session Store Factory                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Redis Session  │  │ In-Memory Store │  │    Migration    │ │
│  │     Store       │  │   (Fallback)    │  │   Utilities     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Monitoring    │  │   Replication   │  │  Health Checks  │ │
│  │    System       │  │    Manager      │  │     System      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Redis Connection
REDIS_URL=redis://localhost:6379
REDIS_TLS=true
REDIS_KEY_PREFIX=mcp:
REDIS_SESSION_TTL=86400  # 24 hours in seconds
REDIS_FALLBACK_ENABLED=true

# Redis Reliability
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000
REDIS_HEALTH_CHECK_INTERVAL=30000

# Session Store Configuration
SESSION_STORE_TYPE=auto  # auto, redis, memory
SESSION_STORE_MONITORING_ENABLED=true
SESSION_STORE_REPLICATION_ENABLED=false
SESSION_STORE_MIGRATION_ENABLED=false
```

### Session Store Types

- **`auto`**: Automatically selects Redis if available, otherwise falls back to in-memory
- **`redis`**: Forces Redis usage (falls back to in-memory if Redis unavailable)
- **`memory`**: Forces in-memory store usage

## Usage

### Basic Usage

```typescript
import { sessionStoreFactory } from './src/store/session-store-factory.js';

// Create a session store instance
const storeResult = await sessionStoreFactory.create('my-app', {
  preferredStore: 'auto',
  enableMonitoring: true,
  enableReplication: false,
  enableMigration: true,
});

// Use the store
const sessionId = await storeResult.store.create({
  userId: 'user123',
  username: 'john_doe',
  roles: ['user'],
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});

// Retrieve session
const session = await storeResult.store.get(sessionId);
```

### Advanced Configuration

```typescript
// Create with custom configuration
const storeResult = await sessionStoreFactory.create('advanced-app', {
  preferredStore: 'redis',
  enableMonitoring: true,
  enableReplication: true,
  enableMigration: true,
  monitoringConfig: {
    healthCheckInterval: 15000,
    alertThresholds: {
      maxLatency: 500,
      maxErrorRate: 0.01,
    },
  },
  replicationConfig: {
    mode: 'master-slave',
    syncInterval: 60000,
    conflictResolution: 'last-write-wins',
  },
});
```

## Features

### 1. Redis Session Store

Provides persistent session storage with:

- **TTL-based expiration**: Sessions automatically expire based on configuration
- **Atomic operations**: Uses Redis pipelines for consistency
- **User session indexing**: Efficient retrieval of all sessions for a user
- **Graceful fallback**: Automatic failover to in-memory store

```typescript
// Direct store usage
import { RedisSessionStore } from './src/store/redis-session-store.js';

const store = new RedisSessionStore();
await store.create(sessionData);
```

### 2. Session Migration

Migrate sessions between different stores:

```typescript
import { SessionMigration } from './src/store/session-migration.js';

const migration = new SessionMigration();

// Migrate from in-memory to Redis
await migration.migrate(inMemoryStore, redisStore, {
  skipExisting: true,
  deleteAfterMigration: false,
  batchSize: 100,
});

// Create backup
const backup = await migration.backup(store);

// Restore from backup
await migration.restore(targetStore, backup);
```

### 3. Replication and Synchronization

High availability through replication:

```typescript
import { SessionReplicationManager } from './src/store/session-replication.js';

const replication = new SessionReplicationManager(primaryStore, {
  mode: 'master-slave',
  syncInterval: 30000,
  conflictResolution: 'last-write-wins',
});

// Add replica
await replication.addReplica('replica1', replicaStore);

// Start replication
await replication.start();
```

### 4. Monitoring and Health Checks

Comprehensive monitoring system:

```typescript
import { SessionStoreMonitor } from './src/store/session-monitoring.js';

const monitor = new SessionStoreMonitor(store, {
  healthCheckInterval: 30000,
  alertThresholds: {
    maxLatency: 1000,
    maxErrorRate: 0.05,
  },
});

// Start monitoring
await monitor.start();

// Get health status
const health = await monitor.performHealthCheck();
```

### 5. Session Store Factory

Centralized store management:

```typescript
// Create multiple stores
await sessionStoreFactory.create('web-app', { preferredStore: 'redis' });
await sessionStoreFactory.create('api-app', { preferredStore: 'memory' });

// List all stores
const stores = sessionStoreFactory.list();

// Get health status
const health = await sessionStoreFactory.getHealthStatus();

// Switch store type
await sessionStoreFactory.switchStoreType('web-app', 'memory', {
  migrateData: true,
});
```

## Redis Configuration

### Connection Options

```typescript
// Redis connection via URL
REDIS_URL=redis://username:password@localhost:6379/0

// Redis with TLS
REDIS_URL=rediss://username:password@localhost:6380/0
REDIS_TLS=true

// Redis Cluster
REDIS_URL=redis://node1:6379,node2:6379,node3:6379
```

### Performance Tuning

```bash
# Redis configuration for session storage
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## Monitoring and Observability

### Health Checks

The system provides multiple health check endpoints:

```typescript
// Store-level health check
const health = await store.healthCheck();
// Returns: { redis: { available, latency, error }, fallback: { available } }

// Factory-level health check
const factoryHealth = await sessionStoreFactory.getHealthStatus();
// Returns: { overall: 'healthy|degraded|unhealthy', instances: [...] }
```

### Metrics

Available metrics include:

- **Operation metrics**: Count, latency, error rates for CRUD operations
- **Store metrics**: Total sessions, active sessions, expired sessions
- **Redis metrics**: Latency, memory usage, key count, connections
- **Fallback metrics**: Activation count, fallback duration

### Prometheus Integration

```typescript
// Export Prometheus metrics
const monitor = new SessionStoreMonitor(store);
const metrics = monitor.exportMetrics();
console.log(metrics.prometheus);
```

## Security and Compliance

### NIST Controls

The implementation includes NIST compliance features:

- **AU-2/AU-3**: Comprehensive audit logging for all session operations
- **AC-12**: Automatic session termination and cleanup
- **SC-8**: Encrypted transmission (TLS support)
- **SC-28**: Protection of data at rest (Redis encryption)

### Security Features

- **Input validation**: Zod schema validation for all session data
- **Audit logging**: Detailed logs for all session operations
- **Access controls**: Role-based session data access
- **Data encryption**: Support for TLS/SSL connections

## Operational Procedures

### Deployment

1. **Configure Redis**: Set up Redis instance with appropriate configuration
2. **Set environment variables**: Configure connection and behavior settings
3. **Initialize stores**: Create session store instances via factory
4. **Enable monitoring**: Start health checks and monitoring systems

### Backup and Recovery

```typescript
// Create backup
const backup = await sessionStoreFactory.createBackup('my-app');

// Store backup data
await fs.writeFile('session-backup.json', JSON.stringify(backup));

// Restore from backup
const backupData = JSON.parse(await fs.readFile('session-backup.json'));
await sessionStoreFactory.restoreBackup('my-app', backupData);
```

### Scaling and High Availability

1. **Redis Clustering**: Use Redis Cluster for horizontal scaling
2. **Replication**: Enable session replication for redundancy
3. **Load Balancing**: Distribute session stores across multiple instances
4. **Monitoring**: Implement comprehensive monitoring and alerting

### Troubleshooting

#### Common Issues

1. **Redis Connection Failures**
   - Check Redis service status
   - Verify connection string and credentials
   - Review network connectivity and firewall rules

2. **High Latency**
   - Monitor Redis performance metrics
   - Check network latency
   - Review Redis configuration and memory usage

3. **Memory Issues**
   - Monitor Redis memory usage
   - Adjust TTL settings
   - Implement proper cleanup procedures

#### Debugging

```typescript
// Enable debug logging
const logger = pino({ level: 'debug' });
const store = new RedisSessionStore(logger);

// Check Redis health
const health = await checkRedisHealth();
console.log('Redis health:', health);

// Monitor operations
const monitor = new SessionStoreMonitor(store);
monitor.on('alert', (alert) => {
  console.log('Alert:', alert);
});
```

## Testing

### Unit Tests

```bash
# Run session store tests
npm test -- --testPathPattern=tests/unit/store

# Run specific test suites
npm test -- tests/unit/store/redis-session-store.test.ts
npm test -- tests/unit/store/session-migration.test.ts
npm test -- tests/unit/store/session-store-factory.test.ts
```

### Integration Tests

```bash
# Run with Redis instance
npm run test:integration -- --testPathPattern=sessions

# End-to-end tests
npm run test:e2e -- --testPathPattern=session-persistence
```

## Best Practices

### Configuration

1. **Use environment variables**: Configure via environment for different environments
2. **Enable monitoring**: Always enable monitoring in production
3. **Set appropriate TTLs**: Configure session timeouts based on security requirements
4. **Use TLS**: Enable encryption for production deployments

### Development

1. **Use factory pattern**: Use SessionStoreFactory for consistent store creation
2. **Handle errors gracefully**: Implement proper error handling and fallbacks
3. **Monitor performance**: Track session operation metrics
4. **Test thoroughly**: Include unit, integration, and end-to-end tests

### Operations

1. **Monitor Redis health**: Set up alerts for Redis availability and performance
2. **Implement backups**: Regular backup procedures for session data
3. **Plan for scaling**: Design for horizontal scaling requirements
4. **Security auditing**: Regular security reviews and compliance checks

## Migration Guide

### From In-Memory to Redis

1. **Configure Redis**: Set up Redis instance and connection
2. **Update configuration**: Set `SESSION_STORE_TYPE=redis`
3. **Enable migration**: Set `SESSION_STORE_MIGRATION_ENABLED=true`
4. **Migrate data**: Use migration utilities to transfer existing sessions
5. **Verify operation**: Confirm Redis store is working correctly

### Between Redis Instances

1. **Set up new Redis instance**: Configure target Redis
2. **Create temporary store**: Create new store instance for target
3. **Migrate sessions**: Use migration utilities to transfer data
4. **Update configuration**: Switch to new Redis instance
5. **Clean up**: Remove old Redis instance and temporary store

## API Reference

### SessionStore Interface

```typescript
interface SessionStore {
  create(data: SessionData): Promise<string>;
  get(id: string): Promise<Session | null>;
  update(id: string, data: Partial<SessionData>): Promise<Session | null>;
  delete(id: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
  getByUserId(userId: string): Promise<Session[]>;
  exists(id: string): Promise<boolean>;
  touch(id: string): Promise<boolean>;
}
```

### SessionStoreFactory Methods

```typescript
class SessionStoreFactory {
  create(
    instanceId?: string,
    config?: SessionStoreFactoryConfig,
  ): Promise<SessionStoreFactoryResult>;
  get(instanceId?: string): SessionStoreFactoryResult | undefined;
  list(): Array<{ instanceId: string; result: SessionStoreFactoryResult }>;
  destroy(instanceId: string): Promise<void>;
  destroyAll(): Promise<void>;
  migrate(
    fromInstanceId: string,
    toInstanceId: string,
    options?: MigrationOptions,
  ): Promise<MigrationStats>;
  getHealthStatus(): Promise<HealthStatusResult>;
  switchStoreType(
    instanceId: string,
    newType: 'memory' | 'redis',
    options?: SwitchOptions,
  ): Promise<void>;
  createBackup(instanceId: string): Promise<BackupResult>;
  restoreBackup(
    instanceId: string,
    backup: BackupData,
    options?: RestoreOptions,
  ): Promise<RestoreStats>;
}
```

## Support

For issues, questions, or contributions:

1. **GitHub Issues**: Report bugs and request features
2. **Documentation**: Refer to inline code documentation
3. **Tests**: Review test cases for usage examples
4. **Community**: Engage with the community for support

## License

This session persistence implementation is part of the puppeteer-mcp project and is licensed under
the MIT License.
