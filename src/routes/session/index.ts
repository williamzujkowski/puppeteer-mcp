/**
 * Session route handlers module exports
 * @module routes/session
 * @nist ac-12 "Session termination"
 * @nist au-2 "Audit events"
 */

// Export all schemas
export * from './schemas.js';

// Export formatters
export * from './response-formatter.js';

// Export middleware
export * from './validation-middleware.js';

// Export error handling
export * from './error-handler.js';

// Export handler factories
export { SessionCreationHandlerFactory } from './creation-handlers.js';
export { SessionRetrievalHandlerFactory } from './retrieval-handlers.js';
export { SessionUpdateHandlerFactory } from './update-handlers.js';
export { SessionDeletionHandlerFactory } from './deletion-handlers.js';
