
---

### Prompt 6: WebSocket Echo & Auth

```text
Add WebSocket support using the `ws` library in `src/ws.ts`.
On server startup, mount the WebSocket server on the same HTTP/2 listener.
Implement:
- Echo server: send back any text message
- JWT-based auth: clients must send `?token=...` in connection URL and reject unauthorized
Write unit tests mocking WebSocket connections for both auth success and failure.
