# Universal Project Kickstart Prompt

Copy this prompt into any web-based LLM chat (ChatGPT, Claude, Gemini, etc.) along with your project_plan.md content.

---

## 🚀 Project Kickstart Assistant

I need help implementing a project based on my project plan. I'll provide the plan content below, and I'd like you to:

### 1. **Analyze & Identify** (Auto-Detection)
- Detect the project type, tech stack, and languages
- Identify frameworks, databases, and infrastructure needs
- Recognize architectural patterns and deployment targets
- Note any compliance or security requirements

### 2. **Standards Mapping** (From: https://github.com/williamzujkowski/standards)
> 💡 **Note**: For creating new standards, see [CREATING_STANDARDS_GUIDE.md](https://github.com/williamzujkowski/standards/blob/master/CREATING_STANDARDS_GUIDE.md)
Based on the detected technologies, recommend relevant standards:
- **Code Standards (CS):** Language-specific best practices
- **Testing Standards (TS):** Testing frameworks and coverage requirements
- **Security Standards (SEC):** Security patterns and authentication
- **Frontend/Backend (FE/WD):** UI/UX and API standards
- **Infrastructure (CN/DOP):** Container and deployment standards
- **Data Engineering (DE):** Database and data pipeline standards
- **Legal/Compliance (LEG):** Privacy and regulatory requirements
- **NIST Compliance (NIST-IG):** NIST 800-53r5 control tagging ([NIST_IMPLEMENTATION_GUIDE.md](https://github.com/williamzujkowski/standards/blob/master/NIST_IMPLEMENTATION_GUIDE.md))

### 3. **Implementation Blueprint**
Create a structured implementation plan with:
- Project scaffold/boilerplate structure
- Core dependencies and toolchain setup
- Development workflow (git flow, CI/CD)
- Testing strategy and coverage targets
- Security checklist and authentication approach
- Compliance requirements (NIST controls for security features)
- Deployment pipeline and monitoring

### 4. **Code Generation**
Provide starter code for:
- Project configuration files (package.json, pyproject.toml, etc.)
- CI/CD pipeline configuration
- Docker/container setup if applicable
- Basic application skeleton following identified standards
- Testing setup and example tests
- Security configurations and middleware

### 5. **Quality Gates**
Define automated checks for:
- Code style and linting rules
- Test coverage thresholds
- Security scanning requirements
- Performance benchmarks
- Documentation standards

### 6. **Tool Recommendations**
Suggest modern tools for:
- **Required:** Essential tools for the detected stack
- **Recommended:** Tools that enhance developer experience
- **Optional:** Nice-to-have tools for advanced workflows

---

## My Project Plan:

Below is a three-phase blueprint for building your “MCP” API platform in Node.js, followed by successive refinement into iterative chunks, and finally a set of self-contained prompts you can feed to a code-generation LLM. Each prompt builds on the last, drives towards a solid, test-driven MVP, and ends by wiring new pieces into the growing system.

---

## Phase 1: High-Level Blueprint

1. **Project Initialization**

   * Scaffold a TypeScript/ESM Node.js project
   * Set up eslint/prettier, Husky pre-commit hooks
   * Configure Jest or Mocha for TDD

2. **REST API Layer**

   * Choose framework (Express or Fastify with HTTP/2)
   * Define core CRUD resources (`/sessions`, `/contexts`)
   * Implement versioning and validation
   * Add logging, error handling, and health checks

3. **gRPC Layer**

   * Define `.proto` files for service (e.g. `ControlService`, `StreamService`)
   * Generate TypeScript stubs (`@grpc/proto-loader` + `@grpc/grpc-js`)
   * Implement unary and streaming RPCs
   * Add interceptors for auth and logging

4. **WebSocket Layer**

   * Pick a library (`ws` or Socket.IO)
   * Define message envelope (JSON or Protobuf framing)
   * Implement server and client examples
   * Secure via WSS and origin checks

5. **Shared Core**

   * Session/context models
   * Common utilities (logging, config, error types)
   * Authentication/authorization middleware (API keys, JWT, OAuth2)

6. **Testing & CI**

   * Unit tests for each module
   * Integration tests covering end-to-end flows
   * GitHub Actions for lint/test/build on push

---

## Phase 2: Iterative Chunking

### Chunk Group A: Project Foundations

1. **A1.** Init repo, tsconfig, package.json
2. **A2.** Lint/prettier, Husky hooks
3. **A3.** Basic test runner setup

### Chunk Group B: REST MVP

1. **B1.** Create `src/server.ts` with HTTP/2 server
2. **B2.** Define `/health` endpoint + tests
3. **B3.** Scaffold `/sessions` router, in-memory store + tests
4. **B4.** Add validation & error-handler middleware

### Chunk Group C: gRPC MVP

1. **C1.** Write `control.proto` (Session RPCs)
2. **C2.** Generate TypeScript stubs
3. **C3.** Implement and test unary RPCs
4. **C4.** Add a bidi stream method

### Chunk Group D: WebSocket MVP

1. **D1.** Integrate `ws` server into existing HTTP/2 server
2. **D2.** Define handshake and simple echo test
3. **D3.** Implement broadcast events for context changes
4. **D4.** Add auth check on WS connection

### Chunk Group E: Integration & Hardening

1. **E1.** Wire REST → gRPC → WS in one process
2. **E2.** Add JWT-based auth across all layers
3. **E3.** End-to-end tests (REST→WS roundtrip)
4. **E4.** CI pipeline + Dockerfile

---

## Phase 3: Right-Sized Steps

We’ll break each chunk into 2–4 small steps that include test scaffolding, implementation, and integration:

### Example: Chunk B3 → Sessions Router

1. **B3.1** Write a Jest unit test for `SessionStore` interface:

   ```ts
   test('SessionStore: create and fetch', async () => {
     const store = new InMemorySessionStore();
     const id = await store.create({ user: 'alice' });
     expect(await store.get(id)).toMatchObject({ user: 'alice' });
   });
   ```
2. **B3.2** Implement `InMemorySessionStore` to satisfy the test.
3. **B3.3** Write an integration test for `GET /sessions/:id`.
4. **B3.4** Implement Express router for `/sessions` that uses the store, passing the integration test.

You would do this for every chunk until the system is fully wired.

---

## Phase 4: Code-Generation Prompts

Below each section is a single prompt (wrapped in triple-backticks) you can hand off to a code-generation LLM. **Each prompt** includes context, the exact task, testing requirements, and wiring instructions.

---

### Prompt 1: Project Init & Testing

```text
You are bootstrapping a new Node.js MVP for the “MCP” API server. Create a repository skeleton with:
- `package.json` configured for TypeScript (ESM), top-level `await`
- Scripts: lint, format, build, test
- `tsconfig.json` targeting ES2020
- ESLint and Prettier configs
- Husky pre-commit hooks that run lint and format
- Jest (or Mocha+Chai) initialized with a simple example test file

Ensure linting and tests pass on `npm test`. No business logic yet.
```

---

### Prompt 2: Health Check Endpoint

```text
Add a TCP HTTP/2 server in `src/server.ts` that listens on port 8443.
Implement a `/health` GET endpoint returning `{ status: 'ok' }`.
Write Jest tests verifying:
- Server starts without error
- GET `/health` returns 200 and correct JSON
Run lint, build, test, and confirm green build.
```

---

### Prompt 3: In-Memory Session Store

````text
Implement `src/store/SessionStore.ts` defining an interface:
```ts
interface SessionStore {
  create(data: Record<string, unknown>): Promise<string>;
  get(id: string): Promise<Record<string, unknown> | null>;
}
````

Create `InMemorySessionStore` in `src/store/InMemorySessionStore.ts` using a Map.
Write Jest unit tests to cover `create` and `get` as described.
Ensure tests pass.

````

---

### Prompt 4: Sessions REST Router

```text
In `src/routes/sessions.ts`, create an Express router that:
- `POST /sessions` calls `store.create` and returns `{ id }`
- `GET /sessions/:id` calls `store.get` and returns data or 404
Write integration tests using Supertest:
- Creating a session returns 201 and ID
- Fetching returns the original data
Wire router into `src/server.ts` under `/sessions`.
````

---

### Prompt 5: gRPC Control Service

````text
Create `proto/control.proto` with a `ControlService`:
```proto
service ControlService {
  rpc CreateSession(CreateRequest) returns (CreateResponse);
  rpc GetSession(GetRequest) returns (GetResponse);
}
message CreateRequest { map<string, string> data = 1; }
message CreateResponse { string id = 1; }
message GetRequest { string id = 1; }
message GetResponse { map<string, string> data = 1; }
````

Use `@grpc/proto-loader` and `@grpc/grpc-js` to generate TypeScript stubs.
Implement the server handlers to call your `InMemorySessionStore`.
Write Mocha or Jest tests for the unary RPCs.

````

---

### Prompt 6: WebSocket Echo & Auth

```text
Add WebSocket support using the `ws` library in `src/ws.ts`.
On server startup, mount the WebSocket server on the same HTTP/2 listener.
Implement:
- Echo server: send back any text message
- JWT-based auth: clients must send `?token=...` in connection URL and reject unauthorized
Write unit tests mocking WebSocket connections for both auth success and failure.
````

---

*(Continue in this pattern for the remaining chunks – C3, C4, D3, D4, E1–E4 – each time stating exactly what file(s) to edit, what tests to write first, what implementation to follow, and how to wire into existing modules.)*

---

With these prompts, you can steadily drive a code-generation LLM through every milestone of your Node.js MCP server, with tests first, clear increments, and no orphaned code.


---

## Additional Context (Optional):
- Team size: [small/medium/large]
- Experience level: [beginner/intermediate/expert]
- Timeline: [MVP/short-term/long-term]
- Special requirements: [compliance/performance/scale]

---

## Expected Output Format:

1. **Tech Stack Analysis**
   ```yaml
   detected:
     languages: [...]
     frameworks: [...]
     databases: [...]
     infrastructure: [...]
   ```

2. **Standards Recommendations**
   ```
   Essential Standards:
   - CS:[language] - Core language patterns
   - TS:[framework] - Testing approach
   - SEC:[relevant] - Security requirements

   Recommended Standards:
   - FE/WD:[as-applicable]
   - DOP:[deployment]
   - OBS:[monitoring]
   ```

3. **Project Structure**
   ```
   project-root/
   ├── src/
   ├── tests/
   ├── docs/
   └── [configuration files]
   ```

4. **Quick Start Commands**
   ```bash
   # Initialize project
   # Install dependencies
   # Run tests
   # Start development
   ```

5. **Implementation Checklist**
   - [ ] Project setup and structure
   - [ ] Core functionality implementation
   - [ ] Testing framework and initial tests
   - [ ] Security measures
   - [ ] CI/CD pipeline
   - [ ] Documentation
   - [ ] Deployment configuration

---

Please analyze my project plan and provide comprehensive implementation guidance following the standards repository approach.

## Related Standards

- [CLAUDE.md](./docs/core/CLAUDE.md) - The main LLM router that references this prompt
- [KICKSTART_ADVANCED.md](KICKSTART_ADVANCED.md) - Advanced kickstart features