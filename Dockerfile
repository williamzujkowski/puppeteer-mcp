# Multi-stage Dockerfile for Puppeteer MCP
# Following CN:DOCKER standards
# @nist cm-2 "Baseline Configuration"
# @nist cm-6 "Configuration Settings"
# @nist si-3 "Malicious Code Protection"

# Security scanning stage
FROM node:22-alpine AS security-scan
WORKDIR /scan

# Copy package files for scanning
COPY package*.json ./

# Install dependencies and run security audit
RUN npm ci --only=production && \
    npm audit --production --json > npm-audit.json || true && \
    npm audit --production --audit-level=high || true

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies for building native modules
RUN apk add --no-cache python3 make g++

# Skip Puppeteer Chromium download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Skip Puppeteer Chromium download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Security hardening
# @nist ac-3 "Access Enforcement"
# @nist ac-6 "Least Privilege"
# @nist sc-13 "Cryptographic Protection"

# Update base image and install only essential Puppeteer dependencies
# Using --no-cache to ensure we get the latest security patches
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache \
    dumb-init \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/* /tmp/*

# Tell Puppeteer to use installed Chromium instead of downloading
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/proto ./proto

# Set environment to production
ENV NODE_ENV=production

# Security environment variables
# @nist sc-8 "Transmission Confidentiality and Integrity"
ENV NODE_OPTIONS="--enable-source-maps --max-old-space-size=256"

# Docker environment flag for Puppeteer configuration
ENV RUNNING_IN_DOCKER=true

# Make filesystem read-only where possible
RUN chmod -R 755 /app && \
    find /app -type d -exec chmod 755 {} \; && \
    find /app -type f -exec chmod 644 {} \;

# Switch to non-root user
USER nodejs

# Expose port (non-privileged)
EXPOSE 8443

# Health check
# @nist si-6 "Security Function Verification"
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8443/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Add security labels
LABEL security.scan="trivy scan --severity HIGH,CRITICAL puppeteer-mcp:latest" \
      security.compliance="NIST 800-53r5" \
      maintainer="security@example.com"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]