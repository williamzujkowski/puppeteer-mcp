# CLAUDE.md

**Version**: 2.1.0  
**Last Updated**: 2025-01-04  
**Status**: Active  
**Type**: AI Assistant Router  
**NPM Package**: [puppeteer-mcp](https://www.npmjs.com/package/puppeteer-mcp) v1.0.0

## Purpose

This file provides routing guidance to Claude Code (claude.ai/code) when working with code in this
repository. It serves as a lightweight router that directs AI assistants to appropriate
documentation based on the task at hand.

## Project Overview

This is a **production-ready AI-enabled browser automation platform** built with Node.js and
TypeScript that provides REST, gRPC, WebSocket, and Model Context Protocol (MCP) interfaces with
unified session management, enterprise-grade security, and comprehensive Puppeteer integration.

### Key Features

- Multi-protocol support (REST/gRPC/WebSocket/MCP)
- Enterprise-grade security with NIST compliance
- Comprehensive browser automation via Puppeteer
- AI agent support through Model Context Protocol
- Zero TypeScript compilation errors
- Production-ready architecture

## 🗺️ Documentation Map

### For Development Tasks

When implementing features or fixing issues:

- **Coding Standards**: See `docs/development/standards.md`
- **Development Workflow**: See `docs/development/workflow.md`
- **Architecture Decisions**: See `docs/architecture/` directory

### For AI-Specific Guidance

When using AI delegation patterns:

- **Routing Patterns**: See `docs/ai/routing-patterns.md`
- **Task Delegation**: See `docs/ai/routing-patterns.md#task-delegation`

### For Learning & Reference

When understanding past decisions:

- **Implementation Lessons**: See `docs/lessons/implementation.md`
- **Architecture Evolution**: See `docs/architecture/evolution.md`

## 🚀 Quick Start

### Installation

```bash
# Install as npm package (recommended)
npm install -g puppeteer-mcp

# Or use directly with npx
npx puppeteer-mcp

# For development
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp
npm install
```

### Essential Commands

```bash
# Production usage (after npm install -g)
puppeteer-mcp              # Start MCP server

# Development commands
npm install                # Install dependencies
npm run typecheck          # Check TypeScript compilation
npm run lint               # Run ESLint
npm run build              # Build the project
npm test                   # Run tests
npm run dev                # Start development server
```

### Current Status

- **TypeScript**: Zero compilation errors ✅
- **ESLint**: 78 warnings, 0 errors ✅
- **Tests**: 20/20 test suites passing ✅
- **Architecture**: 188 TypeScript files, modular design ✅

## 🏗️ Architecture Overview

### Core Components

1. **Session Store** (`src/store/`): Unified session management
2. **Authentication** (`src/auth/`): JWT + API key support
3. **Protocol Layers**:
   - REST API (`src/routes/`)
   - gRPC Services (`src/grpc/`)
   - WebSocket (`src/ws/`)
   - MCP Server (`src/mcp/`)
4. **Browser Automation** (`src/puppeteer/`): Comprehensive Puppeteer integration

### Key Architectural Patterns

- **Unified Session Management**: Single source of truth for all protocols
- **Multi-Modal Authentication**: Flexible auth supporting multiple methods
- **Event-Driven Architecture**: Real-time capabilities across protocols
- **Resource Pooling**: Efficient browser instance management
- **Security-First Design**: NIST compliance throughout

## 🤖 AI Assistant Guidelines

### Working Philosophy

When working on this project, prefer delegating complex tasks to specialized subagents. This
ensures:

- Parallel execution of independent tasks
- Specialized analysis for different aspects
- Comprehensive coverage of standards
- Reduced context switching

### When to Route to Detailed Docs

1. **Complex Implementation Tasks**: Route to `docs/development/workflow.md`
2. **Standards Compliance**: Route to `docs/development/standards.md`
3. **AI Delegation Patterns**: Route to `docs/ai/routing-patterns.md`
4. **Historical Context**: Route to `docs/lessons/implementation.md`

### Quick Decision Tree

```
Is this a coding task?
├─ YES → Check docs/development/standards.md first
│   └─ Then docs/development/workflow.md for process
├─ NO → Is this about AI patterns?
│   ├─ YES → See docs/ai/routing-patterns.md
│   └─ NO → Is this about past decisions?
│       ├─ YES → See docs/lessons/implementation.md
│       └─ NO → Check relevant architecture docs
```

## 📋 Standards Overview

This project follows William Zujkowski's standards (https://github.com/williamzujkowski/standards):

- **Code Standards (CS:TS)**: TypeScript with strict mode, max 300 lines/file
- **Testing Standards (TS:JEST)**: 85%+ coverage, test-first development
- **Security Standards (SEC:API)**: Zero trust, comprehensive validation
- **NIST Compliance (NIST-IG)**: Tagged security controls
- **Container Standards (CN:DOCKER)**: Multi-stage builds, security scanning

For detailed standards implementation, see `docs/development/standards.md`.

## 🔒 Security Requirements

All code must follow security-first principles:

1. **Authentication Required**: All endpoints except /health
2. **Input Validation**: Zod schemas for all inputs
3. **NIST Control Tags**: Security functions must be tagged
4. **Zero Trust**: Never trust, always verify

For detailed security implementation, see `docs/development/standards.md#security-standards`.

## 🎯 Current Priorities

### High Priority ⚠️

1. Test Stability: Fix failing tests in browser automation
2. ESLint Cleanup: Reduce warnings to <50
3. Browser Test Reliability: Improve resource cleanup

### Medium Priority 🔄

1. Type Safety: Eliminate remaining `any` types
2. Performance Monitoring: Add browser operation metrics
3. Documentation: Generate OpenAPI specs

For full priority list and maintenance tasks, see `docs/development/workflow.md#priorities`.

## 📚 Additional Resources

### Internal Documentation

- Architecture Documentation: `docs/architecture/`
- API Documentation: `docs/api/`
- Testing Guide: `docs/testing/`

### External Resources

- NPM Package: https://www.npmjs.com/package/puppeteer-mcp
- Project Standards: https://github.com/williamzujkowski/standards
- NIST Controls: https://csrc.nist.gov/projects/risk-management/sp800-53-controls
- TypeScript Best Practices:
  https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html

## 🔄 Keeping Documentation Updated

When making significant changes:

1. Update relevant documentation in `docs/`
2. Keep this router file lean (focus on routing, not details)
3. Follow the Knowledge Management Standards for all docs
4. Ensure version numbers and dates are current

## 💡 Quick Tips for AI Assistants

1. **Always Check Standards First**: Before implementing, review applicable standards
2. **Delegate Complex Tasks**: Use subagent pattern for multi-step operations
3. **Security is Non-Negotiable**: Every feature must consider security
4. **Test-Driven Development**: Write tests before implementation
5. **Keep Files Small**: Max 300 lines, extract when needed

## 🏆 Project Achievements

- ✅ Published to npm as `puppeteer-mcp` v1.0.0
- ✅ Zero TypeScript compilation errors
- ✅ 90% reduction in ESLint warnings (768 → 78)
- ✅ 100% test suite passing rate (20/20)
- ✅ Enterprise security (NIST compliant)
- ✅ Comprehensive browser automation
- ✅ Multi-protocol support
- ✅ AI-ready architecture

For detailed implementation lessons and insights, see `docs/lessons/implementation.md`.

---

**Remember**: This file is a router. For detailed information on any topic, follow the documentation
map above to find the appropriate detailed documentation.
