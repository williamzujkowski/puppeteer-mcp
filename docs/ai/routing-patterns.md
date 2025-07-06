# AI Routing Patterns

**Version**: 1.0.10  
**Last Updated**: 2025-01-03  
**Status**: Active  
**Category**: AI Guidance

## Table of Contents

1. [Overview](#overview)
2. [Task Delegation Pattern](#task-delegation-pattern)
3. [Routing Decision Framework](#routing-decision-framework)
4. [Common Scenarios](#common-scenarios)
5. [Best Practices](#best-practices)
6. [Anti-Patterns](#anti-patterns)

## Overview

This document provides AI-specific routing patterns and delegation strategies for working with the
puppeteer-mcp codebase. These patterns have been proven effective through extensive use in this
project.

### Purpose

- Guide AI assistants in efficient task decomposition
- Provide routing strategies for complex operations
- Establish patterns for parallel execution
- Reduce context switching and improve efficiency

## Task Delegation Pattern

### Core Philosophy

**IMPORTANT**: When working on this project, prefer delegating complex tasks to specialized
subagents using the Task tool. This approach ensures:

- Parallel execution of independent tasks
- Specialized analysis for different aspects
- Comprehensive coverage of standards and best practices
- Reduced context switching

### When to Delegate

Delegate tasks in these scenarios:

1. **Multi-File Operations**
   - Searching for patterns across multiple files
   - Implementing features that span multiple layers
   - Refactoring that touches many components

2. **Specialized Analysis**
   - Security audits and compliance checks
   - Performance optimization analysis
   - Architecture review and recommendations

3. **Systematic Improvements**
   - ESLint issue resolution campaigns
   - Test suite fixing across multiple files
   - Complexity reduction in large functions

4. **Implementation Tasks**
   - Browser automation implementations
   - Puppeteer integration tasks
   - Protocol layer additions

### Delegation Examples

#### Example 1: Implementing a New API Endpoint

```typescript
// Delegate these tasks to subagents:

// Task 1: "Search for existing auth middleware patterns in src/routes/"
// Task 2: "Analyze current session store implementation in src/store/"
// Task 3: "Generate OpenAPI spec for new endpoint based on existing patterns"
// Task 4: "Create comprehensive test suite following TS:JEST standards"
// Task 5: "Implement endpoint with SEC:API compliance"
// Task 6: "Add NIST control tags to security functions"
```

#### Example 2: Fixing Failing Test Suites

```typescript
// Delegate these tasks to subagents:

// Task 1: "Analyze test failure in auth.test.ts and identify root cause"
// Task 2: "Review implementation of session-store.ts to understand expected behavior"
// Task 3: "Fix browser pool test failures related to resource cleanup"
// Task 4: "Reduce complexity in action-executor.ts to ≤10"
// Task 5: "Update all affected tests after fixing page ID bug"
// Task 6: "Verify no regression in other test suites"
```

#### Example 3: Browser Automation Feature

```typescript
// Delegate these tasks to subagents:

// Task 1: "Analyze existing browser action patterns in src/puppeteer/actions/"
// Task 2: "Design security validation for new browser action type"
// Task 3: "Implement action handler with NIST compliance tags"
// Task 4: "Create unit tests with Puppeteer mocking"
// Task 5: "Add integration tests for the new action"
// Task 6: "Update MCP tool definitions to include new action"
```

## Routing Decision Framework

### Decision Tree for Task Routing

```
Is the task complex (3+ steps)?
├─ YES → Use task delegation pattern
│   ├─ Can subtasks run in parallel?
│   │   ├─ YES → Delegate all at once
│   │   └─ NO → Delegate in sequence
│   └─ Do subtasks require different expertise?
│       ├─ YES → Delegate to specialized subagents
│       └─ NO → Consider single agent if simple
└─ NO → Handle directly if truly simple
```

### Routing by Task Type

#### Code Search and Analysis

- **Route to**: Subagent with Grep/Glob tools
- **Pattern**: Search first, then analyze results
- **Example**: "Find all uses of deprecated API"

#### Standards Compliance

- **Route to**: `docs/development/standards.md`
- **Pattern**: Check standards, then implement
- **Example**: "Ensure function complexity ≤10"

#### Security Implementation

- **Route to**: Subagent with security expertise
- **Pattern**: Validate, tag with NIST, test
- **Example**: "Add authentication to new endpoint"

#### Test Implementation

- **Route to**: Subagent with testing expertise
- **Pattern**: Write failing test, implement, verify
- **Example**: "Add test coverage for new feature"

## Common Scenarios

### Scenario 1: Large-Scale Refactoring

When refactoring spans multiple files:

1. **Analyze Impact**: Delegate search for all affected files
2. **Plan Changes**: Create refactoring strategy
3. **Execute in Parallel**: Delegate file updates to subagents
4. **Verify**: Run tests and check for regressions

### Scenario 2: Bug Investigation

When investigating complex bugs:

1. **Gather Evidence**: Delegate log analysis
2. **Trace Execution**: Follow code path systematically
3. **Identify Root Cause**: Analyze implementation vs tests
4. **Fix and Verify**: Implement fix with tests

### Scenario 3: Feature Implementation

When implementing new features:

1. **Research Patterns**: Find similar implementations
2. **Design Solution**: Follow architectural patterns
3. **Implement Components**: Delegate to specialized subagents
4. **Integrate**: Wire components together
5. **Test Thoroughly**: Unit, integration, and e2e tests

## Best Practices

### 1. Parallel Over Sequential

```typescript
// GOOD: Parallel delegation
// All tasks start simultaneously
Task 1: "Analyze auth patterns"
Task 2: "Review session implementation"
Task 3: "Check security standards"

// AVOID: Sequential when parallel is possible
// Each task waits for the previous
Task 1: Complete analysis
Wait for Task 1...
Task 2: Based on Task 1...
```

### 2. Clear Task Boundaries

```typescript
// GOOD: Clear, independent tasks
Task 1: "Find all REST endpoints in src/routes/"
Task 2: "List all WebSocket handlers in src/ws/"

// AVOID: Overlapping or vague tasks
Task 1: "Look at the API stuff"
Task 2: "Check some endpoints"
```

### 3. Specific Instructions

```typescript
// GOOD: Specific with clear success criteria
Task: 'Reduce complexity in auth-handler.ts from 12 to ≤10 by extracting validation logic into helper functions';

// AVOID: Vague instructions
Task: 'Make the auth handler better';
```

### 4. Context Preservation

When delegating related tasks, provide context:

```typescript
// Context for all tasks
"We're implementing browser screenshot functionality. All tasks should consider:"
"- Security validation for file paths"
"- NIST compliance tags"
"- Resource cleanup"

Task 1: "Design screenshot action interface"
Task 2: "Implement security validation"
Task 3: "Add Puppeteer implementation"
```

## Anti-Patterns

### 1. Over-Delegation

**Problem**: Delegating trivial tasks that are faster to do directly.

```typescript
// AVOID: Delegating simple tasks
Task: 'Add a comment to line 42';

// BETTER: Do simple tasks directly
// Just add the comment yourself
```

### 2. Circular Dependencies

**Problem**: Tasks that depend on each other circularly.

```typescript
// AVOID: Circular dependencies
Task 1: "Implement API (needs Task 2's types)"
Task 2: "Create types (needs Task 1's API)"

// BETTER: Break the cycle
Task 1: "Design API interface"
Task 2: "Implement types based on interface"
Task 3: "Implement API using types"
```

### 3. Missing Success Criteria

**Problem**: Tasks without clear completion criteria.

```typescript
// AVOID: No success criteria
Task: 'Improve performance';

// BETTER: Measurable criteria
Task: 'Reduce browser pool acquisition time to <1s by implementing warm pool strategy';
```

### 4. Context Switching

**Problem**: Jumping between unrelated tasks.

```typescript
// AVOID: Random task switching
Task 1: "Fix auth bug"
Task 2: "Update README"
Task 3: "Add WebSocket feature"

// BETTER: Group related tasks
Phase 1: Fix all auth-related issues
Phase 2: Add new WebSocket features
Phase 3: Update documentation
```

## Summary

The task delegation pattern is a powerful tool for managing complexity in large codebases. By
following these routing patterns:

1. **Delegate Complex Tasks**: Use subagents for multi-step operations
2. **Parallelize When Possible**: Run independent tasks simultaneously
3. **Provide Clear Context**: Ensure subagents have necessary information
4. **Define Success Criteria**: Make task completion measurable
5. **Group Related Work**: Minimize context switching

These patterns have been proven effective in:

- Reducing ESLint warnings by 90% (768 → 78)
- Fixing 6 failing test suites systematically
- Implementing Puppeteer integration in record time
- Completing MCP integration in 1 day vs 8 weeks estimate

For implementation details and standards, refer to:

- `docs/development/standards.md` - Coding standards
- `docs/development/workflow.md` - Development workflow
- `docs/lessons/implementation.md` - Lessons learned
