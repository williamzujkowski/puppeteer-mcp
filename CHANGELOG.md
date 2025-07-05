# Changelog

## [1.0.9] - 2025-01-05

### Fixed
- Improved MCP server startup to ensure it always runs when invoked
- Updated MCP configuration instructions for better compatibility
- Added alternative npx configuration with -y flag for Claude Desktop

### Changed
- Removed conditional startup check that could prevent MCP server from starting
- Added puppeteer-mcp npm script for easier invocation

## [1.0.8] - 2025-01-05

### Fixed
- Fixed MCP server stdio transport to work correctly with MCP clients
- MCP server now properly handles stdio mode vs HTTP server mode
- Logs are now written to stderr when in MCP stdio mode to avoid protocol corruption
- Server properly detects when running as MCP server (non-TTY or MCP_TRANSPORT=stdio)

### Changed
- Refactored server startup to support both MCP stdio mode and HTTP server mode
- Exported startHTTPServer function for better modularity

## [1.0.7] - 2025-01-05

### Fixed
- Fixed express-rate-limit validation error about trust proxy setting
- Added configurable TRUST_PROXY environment variable
- Trust proxy now defaults to 'loopback' in development (only trust localhost)
- Disabled rate limit validation warning since we handle trust proxy properly

### Added
- Added root route (/) that returns service information and available endpoints
- Added TRUST_PROXY configuration option for production deployments

### Security
- Improved IP spoofing protection by making trust proxy configurable
- Better security for rate limiting in production environments

## [1.0.6] - 2025-01-05

### Fixed
- Improved logging consistency across the application
- Fixed inconsistent timestamp formats (now all using ISO format)
- Fixed inconsistent log levels (using string levels instead of numeric)
- Fixed HTTPS URL display when TLS is disabled (now correctly shows http://)
- Added proper logger name context to main server logger

## [1.0.5] - 2025-01-05

### Fixed
- Removed deprecated gRPC server.start() call to fix deprecation warning
- Fixed audit log directory creation issue for global npm installations
- Added proper error handling for audit logger stream to prevent uncaught exceptions
- Improved fallback behavior when audit logging fails

## [1.0.4] - 2025-01-05

### Added
- Created QUICKSTART.md guide with environment variables documentation
- Improved error messages for port conflicts and permission issues
- Better documentation for common startup issues

### Fixed
- Enhanced error handling for server startup failures
- Improved user guidance for troubleshooting

## [1.0.3] - 2025-01-05

### Fixed
- Fixed WebSocket server initialization timing issue
- WebSocket server now initializes after HTTP server is listening
- Improved error handling for port conflicts

## [1.0.2] - 2025-01-05

### Fixed
- Fixed proto file path resolution for global npm installations
- Fixed audit log path resolution when running from global install
- Improved path handling to support both local and global installations

## [1.0.1] - 2025-01-04

### Fixed
- Initial fixes for global npm installation support
- Path resolution improvements

## [1.0.0] - 2025-01-04

### Added
- Initial release
- MCP (Model Context Protocol) server implementation
- REST API endpoints
- gRPC services
- WebSocket support
- Browser automation with Puppeteer
- Session management
- Authentication with JWT
- Comprehensive test coverage