# CLAUDE.md

**Version**: 2.2.0  
**Last Updated**: 2025-01-06  
**Status**: Active  
**Type**: AI Assistant Router  
**NPM Package**: [puppeteer-mcp](https://www.npmjs.com/package/puppeteer-mcp) v1.0.10

## 🎯 Quick Reference (<100 tokens)

**What**: AI-enabled browser automation platform with MCP/REST/gRPC/WebSocket interfaces  
**Purpose**: Router document for AI assistants working on this codebase  
**Key**: For any task → Check decision tree below → Route to specific docs  
**NPM**: `npm install -g puppeteer-mcp`

## 📋 Summary (100-500 tokens)

### Project Identity

Beta browser automation platform combining Puppeteer with modern AI protocols (MCP) and traditional
APIs (REST/gRPC/WebSocket). Enterprise-focused security with NIST compliance. Currently seeking
production feedback to ensure readiness.

### Navigation Aid for AI

This document routes you to detailed documentation. Don't implement from this file - use it to find
the right resource.

### Quick Decision Tree

```
Task Type?
├─ Coding → docs/development/standards.md → docs/development/workflow.md
├─ AI Patterns → docs/ai/routing-patterns.md
├─ Architecture → docs/architecture/
├─ Past Decisions → docs/lessons/implementation.md
└─ API Usage → docs/api/
```

### Essential Commands

```bash
puppeteer-mcp     # Start MCP server (after global install)
npm test          # Run tests
npm run build     # Build project
npm run typecheck # Check TypeScript
```

## 📚 Detailed Reference (500-2000 tokens)

### 🗺️ Complete Documentation Map

#### Development & Implementation

- **Standards Compliance**: `docs/development/standards.md` - TypeScript, testing, security
  standards
- **Development Workflow**: `docs/development/workflow.md` - Process, priorities, best practices
- **Architecture Details**: `docs/architecture/` - System design, components, patterns

#### AI-Specific Resources

- **AI Routing Patterns**: `docs/ai/routing-patterns.md` - Delegation, subagent patterns
- **Task Decomposition**: `docs/ai/routing-patterns.md#task-delegation`

#### Knowledge Base

- **Implementation Lessons**: `docs/lessons/implementation.md` - Past decisions, insights
- **Architecture Evolution**: `docs/architecture/evolution.md` - How system evolved

#### API Documentation

- **REST API**: `docs/api/rest.md`
- **gRPC Services**: `docs/api/grpc.md`
- **WebSocket Events**: `docs/api/websocket.md`
- **MCP Protocol**: `docs/api/mcp.md`

### 🚀 Getting Started

```bash
# Production Use
npm install -g puppeteer-mcp    # Install globally
puppeteer-mcp                   # Start MCP server

# Development Setup
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp
npm install
npm run dev
```

### 📊 Project Status

- **Release Stage**: Beta - Seeking Production Feedback 🔔
- **NPM Package**: v1.0.10 (published with beta status)
- **TypeScript**: Zero compilation errors ✅
- **ESLint**: 87 warnings, 0 errors ✅
- **Tests**: 20/20 suites passing ✅
- **Architecture**: 188 TypeScript files ✅
- **Feedback**: [GitHub Issues](https://github.com/williamzujkowski/puppeteer-mcp/issues)

### 🏗️ Architecture Components

| Component          | Location         | Details                                       |
| ------------------ | ---------------- | --------------------------------------------- |
| Session Store      | `src/store/`     | See `docs/architecture/session-management.md` |
| Authentication     | `src/auth/`      | See `docs/architecture/authentication.md`     |
| REST API           | `src/routes/`    | See `docs/api/rest.md`                        |
| gRPC Services      | `src/grpc/`      | See `docs/api/grpc.md`                        |
| WebSocket          | `src/ws/`        | See `docs/api/websocket.md`                   |
| MCP Server         | `src/mcp/`       | See `docs/api/mcp.md`                         |
| Browser Automation | `src/puppeteer/` | See `docs/architecture/browser-automation.md` |

### 🤖 AI Assistant Routing Logic

#### Primary Decision Tree

```
What type of task?
├─ Implementation/Coding
│   ├─ First: docs/development/standards.md (standards check)
│   └─ Then: docs/development/workflow.md (process guide)
├─ AI Patterns/Delegation
│   └─ Route: docs/ai/routing-patterns.md
├─ Architecture Question
│   └─ Route: docs/architecture/[component].md
├─ Historical/Past Decision
│   └─ Route: docs/lessons/implementation.md
└─ API Usage
    └─ Route: docs/api/[protocol].md
```

#### When to Delegate

- Multiple independent tasks → Use subagent pattern
- Complex analysis needed → Delegate to specialized agent
- Standards verification → Delegate compliance check

See `docs/ai/routing-patterns.md` for delegation patterns.

### 📋 Standards & Security

**Applied Standards**:
[github.com/williamzujkowski/standards](https://github.com/williamzujkowski/standards)

- CS:TS (TypeScript), TS:JEST (Testing), SEC:API (Security), NIST-IG (Compliance)

**Security Principles**:

- Zero trust architecture
- All endpoints authenticated (except /health)
- Input validation with Zod schemas
- NIST control tagging

For implementation details → `docs/development/standards.md`

### 🎯 Current Priorities

For active priorities and maintenance tasks → `docs/development/workflow.md#priorities`

### 📚 Quick Links

**Internal Docs**:

- Standards: `docs/development/standards.md`
- Workflow: `docs/development/workflow.md`
- Architecture: `docs/architecture/`
- APIs: `docs/api/`

**External Resources**:

- NPM: [npmjs.com/package/puppeteer-mcp](https://www.npmjs.com/package/puppeteer-mcp)
- Standards: [github.com/williamzujkowski/standards](https://github.com/williamzujkowski/standards)

---

**Remember**: This is a router document. Always navigate to detailed docs for implementation.
