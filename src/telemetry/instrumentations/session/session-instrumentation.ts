/**
 * Session instrumentation coordinator
 * @module telemetry/instrumentations/session/session-instrumentation
 * @nist au-2 "Audit events"
 * @nist ac-12 "Session termination"
 */

import type { SessionStore } from '../../../store/session-store.interface.js';
import { getTracer } from '../../index.js';
import { instrumentCreate } from './session-create.js';
import { instrumentDelete } from './session-delete.js';
import { instrumentDeleteExpired } from './session-cleanup.js';
import { instrumentGet } from './session-get.js';
import { instrumentExists } from './session-exists.js';
import { instrumentGetByUserId } from './session-list.js';
import { instrumentUpdate } from './session-modify.js';
import { instrumentTouch } from './session-touch.js';
import type { InstrumentationContext } from './types.js';

/**
 * Instrument session store with comprehensive telemetry
 */
export function instrumentSessionStore(store: SessionStore): SessionStore {
  const tracer = getTracer('session-store');
  
  const context: InstrumentationContext = {
    tracer,
    store,
  };

  // Instrument all session operations
  instrumentCreate(context);
  instrumentGet(context);
  instrumentGetByUserId(context);
  instrumentExists(context);
  instrumentUpdate(context);
  instrumentTouch(context);
  instrumentDelete(context);
  instrumentDeleteExpired(context);

  return store;
}