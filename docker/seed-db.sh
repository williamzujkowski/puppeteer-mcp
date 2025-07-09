#!/bin/bash
# Database seeding script for development

set -e

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-puppeteer_mcp}"
DB_USER="${DB_USER:-mcp}"
DB_PASSWORD="${DB_PASSWORD:-mcp-password}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Wait for PostgreSQL to be ready
log_info "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; do
    echo -n "."
    sleep 1
done
echo ""

# Seed data SQL
SEED_SQL=$(cat << 'EOF'
-- Seed development data
BEGIN;

-- Insert test API keys
INSERT INTO mcp.api_keys (key_hash, name, description, permissions, created_by, metadata)
VALUES 
    (encode(digest('test-key-admin', 'sha256'), 'hex'), 
     'Admin Test Key', 
     'Full admin access for testing', 
     '["read", "write", "admin"]'::jsonb,
     'seed-script',
     '{"environment": "development"}'::jsonb),
    
    (encode(digest('test-key-readonly', 'sha256'), 'hex'), 
     'ReadOnly Test Key', 
     'Read-only access for testing', 
     '["read"]'::jsonb,
     'seed-script',
     '{"environment": "development"}'::jsonb),
    
    (encode(digest('test-key-automation', 'sha256'), 'hex'), 
     'Automation Test Key', 
     'For automated testing', 
     '["read", "write"]'::jsonb,
     'seed-script',
     '{"environment": "development", "purpose": "automation"}'::jsonb)
ON CONFLICT (key_hash) DO NOTHING;

-- Insert sample sessions
INSERT INTO mcp.sessions (user_id, status, metadata)
VALUES 
    ('test-user-1', 'active', '{"browser": "chrome", "version": "120"}'::jsonb),
    ('test-user-2', 'idle', '{"browser": "firefox", "version": "121"}'::jsonb),
    ('test-user-3', 'expired', '{"browser": "safari", "version": "17"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Insert sample metrics
INSERT INTO mcp.metrics (metric_name, metric_value, labels)
SELECT 
    'browser_pool_usage',
    random() * 10,
    json_build_object('pool', 'default', 'time', now() - interval '1 hour' * s)::jsonb
FROM generate_series(0, 23) s;

INSERT INTO mcp.metrics (metric_name, metric_value, labels)
SELECT 
    'api_response_time',
    random() * 500 + 50,
    json_build_object('endpoint', '/api/sessions', 'method', 'POST', 'time', now() - interval '1 hour' * s)::jsonb
FROM generate_series(0, 23) s;

COMMIT;

-- Display summary
SELECT 'API Keys' as table_name, COUNT(*) as count FROM mcp.api_keys
UNION ALL
SELECT 'Sessions', COUNT(*) FROM mcp.sessions
UNION ALL
SELECT 'Metrics', COUNT(*) FROM mcp.metrics;
EOF
)

# Execute seed SQL
log_info "Seeding database..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
$SEED_SQL
EOF

log_success "Database seeded successfully!"

# Display test credentials
echo ""
echo "Test API Keys:"
echo "- Admin:      test-key-admin"
echo "- ReadOnly:   test-key-readonly"
echo "- Automation: test-key-automation"
echo ""
echo "Test Users:"
echo "- test-user-1 (active session)"
echo "- test-user-2 (idle session)"
echo "- test-user-3 (expired session)"