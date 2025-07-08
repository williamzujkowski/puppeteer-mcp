/**
 * gRPC Context service type definitions
 * @module grpc/types/context
 */

// Request types
export interface CreateContextRequest {
  session_id: string;
  name?: string;
  type: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface GetContextRequest {
  context_id: string;
}

export interface UpdateContextRequest {
  context_id: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  update_mask?: string[];
}

export interface DeleteContextRequest {
  context_id: string;
}

export interface ListContextsRequest {
  session_id: string;
  filter?: {
    types?: string[];
    statuses?: string[];
  };
  pagination?: {
    page_token?: string;
    page_size?: number;
  };
}

export interface ExecuteCommandRequest {
  context_id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  working_dir?: string;
  timeout_seconds?: number;
}

export interface StreamContextEventsRequest {
  session_id: string;
}

// Response types
export interface ContextProto {
  id: string;
  session_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  status: string;
}

export interface CreateContextResponse {
  context: ContextProto;
}

export interface GetContextResponse {
  context: ContextProto;
}

export interface UpdateContextResponse {
  context: ContextProto;
}

export interface DeleteContextResponse {
  success: boolean;
}

export interface ListContextsResponse {
  contexts: ContextProto[];
  next_page_token?: string;
  total_count: number;
}

export interface ExecuteCommandResponse {
  output?: string;
  exit_code?: number;
  error?: string;
  stdout?: string;
  stderr?: string;
}

export interface ContextEvent {
  event_type: string;
  context_id: string;
  session_id: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
