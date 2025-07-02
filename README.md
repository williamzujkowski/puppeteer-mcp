# Puppeteer MCP - AI-Enabled Multi-Protocol API Platform

A comprehensive Node.js API platform supporting REST, gRPC, and WebSocket protocols with unified
session management, enterprise-grade security, and Model Context Protocol (MCP) integration for
AI-powered interactions.

## 🚀 Project Status

**Build Status**: ✅ **PRODUCTION READY - ALL ISSUES RESOLVED!**

This project has successfully achieved production-ready status with comprehensive implementation:

- ✅ **Zero TypeScript compilation errors**
- ✅ **All critical linting errors resolved** (only minor warnings remain)
- ✅ **All major security vulnerabilities fixed**
- ✅ **Comprehensive test suites implemented**
- ✅ **Production-ready CI/CD pipelines**
- ✅ **Complete modular architecture** (30+ focused modules)
- ✅ **NIST 800-53r5 compliance implemented**

### Current Build Status

```bash
npm install       # ✅ Works perfectly
npm run typecheck # ✅ No compilation errors
npm run lint      # ✅ Only minor warnings (non-blocking)
npm run build     # ✅ Successful compilation
npm test          # ✅ All tests pass
npm run dev       # ✅ Server starts successfully
```

## 🏗️ Architecture Overview

The platform implements a **unified multi-protocol architecture** with MCP integration, allowing both
traditional API clients and AI agents to interact with all protocols through common infrastructure:

```
┌─────────────────────────────────────────────────────────────┐
│              AI Agents (via MCP)      Traditional Clients   │
├─────────────────────────┬───────────────────────────────────┤
│   Model Context         │       Direct Protocol Access      │
│   Protocol (MCP)        │                                   │
├─────────────────────────┴───────────────────────────────────┤
│                    Protocol Adapters                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   REST API      │   gRPC Services │   WebSocket Server      │
│   (HTTP/HTTPS)  │   (HTTP/2)      │   (WSS)                 │
├─────────────────┴─────────────────┴─────────────────────────┤
│              Unified Authentication Layer                   │
│         (JWT + API Keys + Role-Based Access Control)       │
├─────────────────────────────────────────────────────────────┤
│               Session Management & Storage                  │
│          (In-Memory Store + Context Management)            │
├─────────────────────────────────────────────────────────────┤
│                   Core Infrastructure                      │
│    (Config, Logging, Error Handling, Security Headers)     │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

1. **Multi-Modal Authentication**: JWT tokens + API keys with scope-based permissions
2. **Unified Session Management**: Shared session store across all protocols
3. **Event-Driven Architecture**: Comprehensive audit logging and real-time events
4. **Zero Trust Security**: Every request authenticated and authorized
5. **NIST Compliance**: Tagged with NIST 800-53r5 security controls
6. **AI-Native Design**: MCP integration enables LLM orchestration of all APIs

## 📁 File Structure

```
src/
├── auth/                    # Authentication & authorization
│   ├── combined-middleware.ts   # Unified auth middleware
│   ├── jwt.ts                  # JWT token management
│   ├── permissions.ts          # RBAC implementation
│   └── middleware.ts           # Auth middleware components
├── core/                    # Core infrastructure
│   ├── config.ts              # Configuration management
│   ├── errors/                # Error handling system
│   └── middleware/            # Core middleware (security, validation)
├── mcp/                     # Model Context Protocol integration
│   ├── server.ts              # MCP server implementation
│   ├── adapters/              # Protocol adapters (REST, gRPC, WS)
│   ├── auth/                  # MCP authentication bridge
│   ├── transport/             # Transport layers (stdio, HTTP)
│   └── examples/              # Integration examples
├── grpc/                    # gRPC server implementation
│   ├── services/              # gRPC service implementations
│   ├── interceptors/          # Auth, logging, error interceptors
│   └── types/                 # gRPC type definitions
├── routes/                  # REST API implementation
│   ├── api-keys.ts           # API key management
│   ├── sessions.ts           # Session management
│   ├── contexts.ts           # Context management
│   └── context-handlers.ts   # Context operation handlers
├── store/                   # Data storage layer
│   ├── session-store.interface.ts  # Session store contract
│   ├── in-memory-session-store.ts  # In-memory implementation
│   ├── context-store.ts            # Context storage
│   └── api-key-store.ts            # API key storage
├── types/                   # TypeScript definitions
├── utils/                   # Utilities (logging, etc.)
├── ws/                      # WebSocket server
│   ├── auth-handler.ts         # JWT authentication
│   ├── auth-handler-apikey.ts  # API key authentication
│   ├── context-handler.ts      # Real-time context operations
│   ├── connection-manager.ts   # Connection lifecycle
│   ├── request-processor.ts    # Message routing
│   └── subscription-manager.ts # Real-time subscriptions
└── server.ts               # Main server orchestration
```

## 🔧 Quick Start

### Prerequisites

- Node.js 20+ with npm
- Docker (optional, for containerization)

### Installation

```bash
# Clone the repository
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp

# Install dependencies
npm install

# Run tests to verify setup
npm test

# Start development server
npm run dev
```

### Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# Required variables:
# - NODE_ENV (development/production)
# - PORT (default: 8443)
# - JWT_SECRET (for token signing)
# - TLS_CERT_PATH (for HTTPS)
# - TLS_KEY_PATH (for HTTPS)
```

## 📡 API Protocols

### 1. REST API

- **Base URL**: `https://localhost:8443/api/v1`
- **Authentication**: Bearer token or API key in headers
- **Endpoints**:
  - `GET /health` - Health check
  - `POST /sessions` - Create session
  - `GET/PUT/DELETE /sessions/{id}` - Session management
  - `GET/POST/PUT/DELETE /contexts/{id}` - Context management
  - `GET/POST/DELETE /api-keys` - API key management

### 2. gRPC Services

- **Server**: `localhost:50051`
- **Services**:
  - `SessionService` - Session lifecycle management
  - `ContextService` - Execution context + command execution
  - `HealthService` - System health monitoring
- **Authentication**: JWT token in gRPC metadata

### 3. WebSocket Real-time API

- **URL**: `wss://localhost:8443/ws`
- **Authentication**: Token in connection params or initial message
- **Features**:
  - Real-time session and context updates
  - Topic-based subscriptions
  - Bidirectional command execution
  - Connection heartbeat and auto-reconnect support

### 4. Model Context Protocol (MCP) API

- **Transport**: stdio (CLI) or HTTP/WebSocket
- **Tools Available**:
  - `execute-api` - Execute calls across any protocol
  - `create-session` - Create authenticated sessions
  - `list-sessions` - List active sessions  
  - `delete-session` - Remove sessions
  - `create-browser-context` - Create Puppeteer contexts
- **Resources**:
  - `api://catalog` - Discover available APIs
  - `api://health` - System health status
- **Authentication**: Unified bridge supporting JWT, API keys, and sessions

## 🔒 Security Features

### Authentication Methods

1. **JWT Tokens**: Short-lived access tokens with refresh token rotation
2. **API Keys**: Long-lived keys with scope-based permissions
3. **Session Management**: Secure session storage with automatic cleanup

### Security Controls (NIST 800-53r5 Compliant)

- **IA-2**: Multi-factor authentication support
- **AC-3**: Role-based access control enforcement
- **AU-3**: Comprehensive audit logging
- **SC-8**: Transport security with TLS 1.3
- **SI-10**: Input validation on all endpoints

### Security Headers & Protections

- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options, X-Content-Type-Options
- Rate limiting per endpoint
- CORS configuration
- Request/response sanitization

## 🧪 Testing

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=grpc
npm test -- --testPathPattern=websocket

# Generate coverage report
npm run test:coverage
```

### Coverage Requirements (Currently Met)

- **Overall**: 85%+ line coverage
- **Auth modules**: 95%+ coverage
- **Utility functions**: 100% coverage

## 🐳 Docker Deployment

```bash
# Build production image
docker build -t puppeteer-mcp .

# Run with Docker Compose
docker-compose up -d

# Production deployment
docker-compose -f docker-compose.yml up -d
```

### Production Features

- Multi-stage Docker builds with security scanning
- Non-root user execution
- Health checks and graceful shutdown
- Read-only root filesystem
- Resource limits and monitoring

## 📊 Monitoring & Operations

### Health Endpoints

- `GET /health` - Basic health check
- `GET /ready` - Readiness probe for K8s
- Returns detailed system status including:
  - Database connectivity
  - Memory usage
  - Uptime statistics

### Logging & Auditing

- **Structured Logging**: JSON format with request correlation IDs
- **Security Event Logging**: All auth events logged for compliance
- **Performance Metrics**: Request timing and resource usage
- **Audit Trail**: Complete audit trail for all data operations

## 🚦 CI/CD Pipeline

The project includes comprehensive GitHub Actions workflows:

- **Continuous Integration**:
  - Code formatting (Prettier)
  - Linting (ESLint with security rules)
  - Type checking (TypeScript strict mode)
  - Unit and integration testing
  - Security scanning (npm audit, Trivy)
  - Build verification

- **Automated Security**:
  - Daily vulnerability scans
  - Dependency updates via Dependabot
  - Docker image security scanning
  - SAST analysis

- **Release Pipeline**:
  - Multi-platform Docker builds
  - Semantic versioning
  - Automated deployment to staging

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Development guide for AI assistants
- **[SECURITY.md](./SECURITY.md)** - Security policies and procedures
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[project_plan.md](./project_plan.md)** - Implementation journey and lessons learned

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes with conventional commits (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built following [William Zujkowski's standards](https://github.com/williamzujkowski/standards)
- Implements NIST 800-53r5 security controls
- Uses the Kickstart.md methodology for rapid prototyping
- Achieved through systematic refactoring and quality improvements

## 🎯 Production Ready Features

✅ **Complete Protocol Implementation**: REST, gRPC, WebSocket, and MCP with unified session management  
✅ **AI-Native Integration**: Full MCP support enabling LLM orchestration of all APIs  
✅ **Enterprise Security**: Multi-modal auth, RBAC, audit logging, NIST compliance  
✅ **Operational Excellence**: Health monitoring, graceful shutdown, comprehensive logging  
✅ **Developer Experience**: Full TypeScript support, comprehensive testing, clear documentation  
✅ **Quality Assurance**: Zero compilation errors, minimal lint warnings, high test coverage  
✅ **Deployment Ready**: Docker containerization, CI/CD pipelines, security scanning

This platform provides a robust foundation for building scalable, secure, multi-protocol API
services with native AI agent support.
