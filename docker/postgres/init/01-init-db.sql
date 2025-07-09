-- Initialize puppeteer-mcp database
-- This script runs on first container startup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS mcp;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
SET search_path TO mcp, public;

-- Create custom types
CREATE TYPE session_status AS ENUM ('active', 'idle', 'expired', 'terminated');
CREATE TYPE action_type AS ENUM (
    'navigate', 'click', 'type', 'select', 'scroll',
    'wait', 'screenshot', 'evaluate', 'cookie_set',
    'cookie_get', 'cookie_delete'
);

-- Sessions table
CREATE TABLE IF NOT EXISTS mcp.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    status session_status NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    terminated_at TIMESTAMP WITH TIME ZONE,
    context_count INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0
);

-- Browser contexts table
CREATE TABLE IF NOT EXISTS mcp.browser_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES mcp.sessions(id) ON DELETE CASCADE,
    context_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    options JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    page_count INTEGER DEFAULT 0,
    UNIQUE(session_id, context_id)
);

-- Pages table
CREATE TABLE IF NOT EXISTS mcp.pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    context_id UUID NOT NULL REFERENCES mcp.browser_contexts(id) ON DELETE CASCADE,
    page_id VARCHAR(255) NOT NULL,
    url TEXT,
    title TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE,
    action_count INTEGER DEFAULT 0,
    UNIQUE(context_id, page_id)
);

-- Actions audit table
CREATE TABLE IF NOT EXISTS audit.actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    context_id UUID,
    page_id UUID,
    action_type action_type NOT NULL,
    target TEXT,
    value TEXT,
    options JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    error JSONB,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT
);

-- API keys table
CREATE TABLE IF NOT EXISTS mcp.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    rate_limit INTEGER DEFAULT 100,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Metrics table for performance data
CREATE TABLE IF NOT EXISTS mcp.metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id UUID,
    context_id UUID
);

-- Create indexes
CREATE INDEX idx_sessions_user_id ON mcp.sessions(user_id);
CREATE INDEX idx_sessions_status ON mcp.sessions(status);
CREATE INDEX idx_sessions_created_at ON mcp.sessions(created_at);
CREATE INDEX idx_sessions_expires_at ON mcp.sessions(expires_at);

CREATE INDEX idx_contexts_session_id ON mcp.browser_contexts(session_id);
CREATE INDEX idx_contexts_status ON mcp.browser_contexts(status);
CREATE INDEX idx_contexts_created_at ON mcp.browser_contexts(created_at);

CREATE INDEX idx_pages_context_id ON mcp.pages(context_id);
CREATE INDEX idx_pages_status ON mcp.pages(status);
CREATE INDEX idx_pages_url ON mcp.pages(url);

CREATE INDEX idx_actions_session_id ON audit.actions(session_id);
CREATE INDEX idx_actions_created_at ON audit.actions(created_at);
CREATE INDEX idx_actions_user_id ON audit.actions(user_id);
CREATE INDEX idx_actions_type ON audit.actions(action_type);

CREATE INDEX idx_api_keys_key_hash ON mcp.api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON mcp.api_keys(status);

CREATE INDEX idx_metrics_name_timestamp ON mcp.metrics(metric_name, timestamp);
CREATE INDEX idx_metrics_session_id ON mcp.metrics(session_id);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON mcp.sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contexts_updated_at BEFORE UPDATE ON mcp.browser_contexts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON mcp.pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON mcp.api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE VIEW mcp.active_sessions AS
SELECT 
    s.*,
    COUNT(DISTINCT bc.id) as active_contexts,
    COUNT(DISTINCT p.id) as active_pages
FROM mcp.sessions s
LEFT JOIN mcp.browser_contexts bc ON s.id = bc.session_id AND bc.status = 'active'
LEFT JOIN mcp.pages p ON bc.id = p.context_id AND p.status = 'active'
WHERE s.status = 'active'
GROUP BY s.id;

CREATE VIEW mcp.session_activity AS
SELECT 
    s.id as session_id,
    s.user_id,
    COUNT(a.id) as action_count,
    MAX(a.created_at) as last_action,
    AVG(a.duration_ms) as avg_duration_ms
FROM mcp.sessions s
LEFT JOIN audit.actions a ON s.id = a.session_id
GROUP BY s.id, s.user_id;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA mcp TO mcp;
GRANT ALL PRIVILEGES ON SCHEMA audit TO mcp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA mcp TO mcp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO mcp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA mcp TO mcp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO mcp;

-- Insert sample data for development
INSERT INTO mcp.api_keys (key_hash, name, description, permissions, created_by)
VALUES (
    encode(digest('dev-api-key-123', 'sha256'), 'hex'),
    'Development API Key',
    'Default API key for local development',
    '["read", "write", "admin"]'::jsonb,
    'system'
);