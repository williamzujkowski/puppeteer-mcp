---
title: Deployment Guide
description:
  'Learn how to deploy Puppeteer MCP in various environments, from local development to production
  scale'
---

# Deployment Guide

Learn how to deploy Puppeteer MCP in various environments, from local development to production
scale.

## Deployment Options

### [NPM Package](/puppeteer-mcp/npm-package.md)

Deploy using npm for Node.js applications:

- Global installation guide
- Local project integration
- Publishing to npm registry
- Version management
- Package maintenance

### [Docker](/puppeteer-mcp/docker.md)

Container-based deployment:

- Official Docker images
- Custom Dockerfile creation
- Docker Compose setup
- Container orchestration
- Security considerations

### [Production Setup](/puppeteer-mcp/production.md)

Enterprise production deployment:

- Infrastructure requirements
- Security hardening
- SSL/TLS configuration
- Monitoring setup
- Backup strategies

### [Scaling Guide](/puppeteer-mcp/scaling.md)

Scale Puppeteer MCP for high load:

- Horizontal scaling patterns
- Load balancing strategies
- Session distribution
- Resource optimization
- Performance tuning

## Quick Start Deployments

### Local Development

```bash
# Using npx (no installation)
npx puppeteer-mcp

# Or global install
npm install -g puppeteer-mcp
puppeteer-mcp
```

### Docker Deployment

```bash
# Run with Docker
docker run -d \
  -p 3000:3000 \
  -e PUPPETEER_MCP_AUTH_TOKEN=your-token \
  williamzujkowski/puppeteer-mcp:latest
```

### Production Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  puppeteer-mcp:
    image: williamzujkowski/puppeteer-mcp:latest
    environment:
      - PUPPETEER_MCP_AUTH_TOKEN=${AUTH_TOKEN}
      - NODE_ENV=production
    ports:
      - '3000:3000'
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
```

## Deployment Checklist

### Pre-Deployment

- [ ] Generate secure authentication tokens
- [ ] Review resource requirements
- [ ] Plan monitoring strategy
- [ ] Configure backups
- [ ] Test deployment process

### Security

- [ ] Enable HTTPS/TLS
- [ ] Configure firewalls
- [ ] Set up rate limiting
- [ ] Review authentication
- [ ] Enable audit logging

### Performance

- [ ] Configure resource limits
- [ ] Set up load balancing
- [ ] Enable caching
- [ ] Configure CDN (if applicable)
- [ ] Optimize browser pool

### Monitoring

- [ ] Set up health checks
- [ ] Configure logging
- [ ] Enable metrics collection
- [ ] Set up alerts
- [ ] Plan incident response

## Environment Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 10GB
- **Network**: 100Mbps

### Recommended Production

- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Disk**: 50GB SSD
- **Network**: 1Gbps

### Software Requirements

- **Node.js**: 20.0.0+
- **Chrome/Chromium**: Latest
- **Docker**: 20.10+ (if using containers)

## Deployment Architectures

### Single Instance

Best for development and small teams:

```
[Client] → [Puppeteer MCP Server] → [Chrome]
```

### Load Balanced

For medium traffic with redundancy:

```
[Clients] → [Load Balancer] → [MCP Servers] → [Chrome Pool]
```

### Microservices

For large scale deployments:

```
[API Gateway] → [MCP Services] → [Session Manager] → [Chrome Cluster]
```

## Common Deployment Scenarios

### 1. Team Automation Server

Deploy for internal team use:

- Single Docker container
- Basic authentication
- Shared browser pool
- Internal network only

### 2. SaaS Integration

Deploy as part of a SaaS platform:

- Kubernetes deployment
- Multi-tenant isolation
- API rate limiting
- Usage monitoring

### 3. Enterprise Deployment

Deploy for enterprise use:

- High availability setup
- Security compliance
- Audit logging
- Disaster recovery

## Post-Deployment

### Health Monitoring

```bash
# Check service health
curl http://localhost:3000/health

# Check detailed status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/status
```

### Performance Testing

```bash
# Load test with k6
k6 run load-test.js

# Monitor resource usage
docker stats puppeteer-mcp
```

### Troubleshooting

- Check logs for errors
- Verify network connectivity
- Ensure Chrome dependencies
- Review resource limits
- Test authentication

## Best Practices

1. **Use Environment Variables** for configuration
2. **Enable Monitoring** from day one
3. **Plan for Scaling** even if starting small
4. **Automate Deployments** with CI/CD
5. **Regular Backups** of configuration
6. **Security First** approach
7. **Document Everything** for your team

## Next Steps

Choose your deployment method:

- Simple setup? Try [NPM Package](/puppeteer-mcp/npm-package.md)
- Need containers? See [Docker](/puppeteer-mcp/docker.md)
- Going to production? Read [Production Setup](/puppeteer-mcp/production.md)
- Planning for growth? Check [Scaling Guide](/puppeteer-mcp/scaling.md)
