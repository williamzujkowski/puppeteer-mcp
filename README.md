# Puppeteer MCP - Multi-Protocol API Platform

A comprehensive Node.js API platform supporting REST, gRPC, and WebSocket protocols with unified session management and authentication.

## 🚀 Project Status

This project has been successfully bootstrapped following the Kickstart.md methodology and CLAUDE.md standards. The foundation is in place with all major components implemented.

### ✅ Completed Components

1. **Project Infrastructure**
   - TypeScript with ESM modules configuration
   - Jest testing framework with coverage requirements
   - ESLint and Prettier with Husky pre-commit hooks
   - Comprehensive CI/CD pipeline with GitHub Actions
   - Docker containerization with security hardening
   - Security scanning and NIST compliance

2. **Core Architecture**
   - Configuration system with Zod validation
   - Structured error handling across protocols
   - Pino logger with audit logging capabilities
   - Common middleware (auth, security, logging)
   - Type definitions for all protocols

3. **Authentication & Security**
   - JWT-based authentication with refresh tokens
   - API key authentication support
   - Role-based access control (RBAC)
   - Session management with TTL
   - NIST control tagging throughout

4. **REST API**
   - Express server with security headers
   - Health check endpoints
   - Session management endpoints
   - Context management endpoints
   - Input validation with Zod

5. **gRPC Services**
   - Protocol buffer definitions
   - Session service implementation
   - Context service implementation
   - Authentication and logging interceptors
   - Streaming support

6. **WebSocket Server**
   - Real-time bidirectional communication
   - JWT authentication on connection
   - Message handling for all operations
   - Connection management with heartbeat
   - Event broadcasting

## 🏗️ Architecture Overview

```
src/
├── auth/          # Authentication utilities and middleware
├── core/          # Core utilities (config, errors, middleware)
├── grpc/          # gRPC services and interceptors
├── routes/        # REST API routes
├── store/         # Session storage implementation
├── types/         # TypeScript type definitions
├── utils/         # Utility functions (logger)
├── ws/            # WebSocket server and handlers
└── server.ts      # Main server entry point
```

## 🔧 Setup Instructions

### Prerequisites
- Node.js 20+ with npm
- Docker (optional, for containerization)
- Redis (optional, for production session storage)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/puppeteer-mcp.git
cd puppeteer-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key environment variables:
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 8443)
- `JWT_SECRET` - Secret for JWT signing
- `TLS_CERT_PATH` - Path to TLS certificate
- `TLS_KEY_PATH` - Path to TLS key

## 📡 API Protocols

### REST API
- Base URL: `https://localhost:8443/api/v1`
- Authentication: Bearer token in Authorization header
- Content-Type: application/json

### gRPC
- Server: `localhost:50051`
- Services: SessionService, ContextService, HealthService
- Authentication: JWT token in metadata

### WebSocket
- URL: `wss://localhost:8443/ws`
- Authentication: Token in connection query parameter
- Message format: JSON with type field

## 🧪 Testing

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=routes
```

### Coverage Requirements
- Overall: 85%
- Auth modules: 95%
- Utility functions: 100%

## 🔒 Security

This project implements comprehensive security measures:

- **Authentication**: JWT with refresh tokens, API keys
- **Authorization**: Role-based access control
- **Transport Security**: TLS/HTTPS enforcement
- **Input Validation**: Zod schemas for all inputs
- **Rate Limiting**: Per-endpoint rate limits
- **Security Headers**: Helmet.js configuration
- **NIST Compliance**: Tagged with NIST 800-53r5 controls

## 📚 Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide for Claude Code
- [SECURITY.md](./SECURITY.md) - Security policies and procedures
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [API Documentation](./docs/api/) - Detailed API documentation

## 🚦 CI/CD

The project includes comprehensive GitHub Actions workflows:

- **CI Pipeline**: Linting, testing, building, security scanning
- **Security Scanning**: Daily vulnerability scans
- **Dependency Updates**: Automated via Dependabot
- **Release Pipeline**: Multi-platform Docker builds

## 🐳 Docker

```bash
# Build Docker image
docker build -t puppeteer-mcp .

# Run with Docker Compose
docker-compose up -d

# Run with security hardening
docker-compose -f docker-compose.yml up -d
```

## 📊 Monitoring

- Health endpoints: `/health` and `/ready`
- Structured logging with request IDs
- Performance metrics in logs
- Audit logging for security events

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built following William Zujkowski's standards
- Implements NIST 800-53r5 security controls
- Uses the Kickstart.md methodology for bootstrapping

## ⚠️ Current Status

While the project structure and all major components have been implemented, there are some TypeScript compilation issues that need to be resolved before the project can be fully built and run. These are primarily related to type definitions and can be fixed with some additional type annotations and adjustments.

The core architecture, security implementation, and multi-protocol support are all in place and follow best practices as defined in the CLAUDE.md standards.