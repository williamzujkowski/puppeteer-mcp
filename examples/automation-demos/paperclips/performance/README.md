# Performance Test Suite for puppeteer-mcp

This comprehensive performance test suite validates the scalability, reliability, and performance
characteristics of the puppeteer-mcp system under various load conditions.

## Overview

The performance test suite includes:

1. **Concurrent Session Test** - Tests multiple browser sessions running simultaneously
2. **Scalability Test** - Gradually increases load to find performance limits
3. **Stress Test** - Pushes system beyond normal limits to identify breaking points
4. **Resource Monitoring Test** - Deep analysis of CPU, memory, and browser pool usage
5. **Comprehensive Test** - Complete suite with production readiness assessment

## Test URLs

The tests validate performance against these target URLs:

- `https://williamzujkowski.github.io/paperclips/index2.html` - Interactive game for browser
  automation
- `https://williamzujkowski.github.io/` - Static homepage for baseline performance

## Quick Start

### Prerequisites

1. **puppeteer-mcp server** must be running on `localhost:3000`
2. **Node.js 20.0.0+** required
3. **2GB+ RAM** recommended
4. **2+ CPU cores** recommended

### Installation

```bash
cd /home/william/git/puppeteer-mcp/testing/paperclips-game/performance-tests
npm install
```

### Running Tests

```bash
# Run all tests
./run-performance-tests.sh all

# Run specific test types
./run-performance-tests.sh concurrent 10        # 10 concurrent sessions
./run-performance-tests.sh scalability          # Scalability analysis
./run-performance-tests.sh stress               # Stress testing
./run-performance-tests.sh resource 5 120000    # Resource monitoring
./run-performance-tests.sh comprehensive        # Complete suite

# Check system requirements
./run-performance-tests.sh requirements
```

## Test Details

### 1. Concurrent Session Test

**Purpose**: Validates concurrent browser session handling

**Test Actions**:

- Creates multiple browser sessions simultaneously
- Navigates to test URLs
- Performs browser automation (clicks, waits, screenshots)
- Measures response times and error rates

**Key Metrics**:

- Session creation time
- Average response time
- Error rate
- Memory usage
- CPU utilization
- Browser pool efficiency

**Usage**:

```bash
tsx concurrent-session-test.ts [session_count]
```

### 2. Scalability Test

**Purpose**: Determines maximum sustainable concurrent sessions

**Test Process**:

- Tests session counts: 1, 2, 3, 5, 8, 10, 12, 15
- Identifies performance degradation points
- Calculates maximum sustainable load
- Provides production recommendations

**Key Metrics**:

- Maximum sustainable sessions
- Performance degradation point
- Resource utilization by session count
- Response time scaling

**Usage**:

```bash
tsx scalability-test.ts
```

### 3. Stress Test

**Purpose**: Identifies system breaking points and failure modes

**Test Approach**:

- Progressively increases load beyond normal limits
- Monitors for system failures
- Tests recovery capabilities
- Identifies critical failure points

**Key Metrics**:

- Breaking point (sessions)
- System recovery time
- Critical error patterns
- Resource exhaustion thresholds

**Usage**:

```bash
tsx stress-test.ts
```

### 4. Resource Monitoring Test

**Purpose**: Deep analysis of system resource utilization

**Monitoring Scope**:

- CPU usage patterns
- Memory allocation and potential leaks
- Browser pool efficiency
- Network resource consumption
- System stability over time

**Key Metrics**:

- Peak resource usage
- Resource efficiency scores
- Memory leak detection
- CPU utilization patterns

**Usage**:

```bash
tsx resource-monitoring-test.ts [sessions] [duration_ms]
```

### 5. Comprehensive Performance Test

**Purpose**: Complete performance assessment with production readiness evaluation

**Test Components**:

- All individual tests
- Cross-test analysis
- Production readiness scoring
- Actionable recommendations

**Key Outputs**:

- System capabilities summary
- Performance metrics
- Resource utilization analysis
- Production readiness score (0-100)
- Optimization recommendations

**Usage**:

```bash
tsx comprehensive-performance-test.ts
```

## Output and Reports

### Results Directory

All test results are saved to `./results/` with timestamps:

- `concurrent-session-test-YYYY-MM-DD-HH-MM-SS.json`
- `scalability-test-YYYY-MM-DD-HH-MM-SS.json`
- `resource-monitoring-YYYY-MM-DD-HH-MM-SS.json`
- `comprehensive-performance-report-YYYY-MM-DD-HH-MM-SS.json`

### Report Contents

Each report includes:

- Test configuration
- Detailed metrics
- Performance analysis
- Bottleneck identification
- Optimization recommendations
- Production readiness assessment

## Performance Thresholds

### Acceptable Performance

- **Response Time**: < 3 seconds average
- **Error Rate**: < 5%
- **Memory Usage**: < 1GB peak
- **CPU Usage**: < 70% sustained

### Warning Thresholds

- **Response Time**: 3-5 seconds average
- **Error Rate**: 5-10%
- **Memory Usage**: 1-2GB peak
- **CPU Usage**: 70-85% sustained

### Critical Thresholds

- **Response Time**: > 5 seconds average
- **Error Rate**: > 10%
- **Memory Usage**: > 2GB peak
- **CPU Usage**: > 85% sustained

## Production Recommendations

### Based on Test Results

The test suite provides specific recommendations based on measured performance:

1. **Scalability**: Maximum recommended concurrent sessions
2. **Resource Limits**: Memory and CPU allocation guidelines
3. **Monitoring**: Key metrics to track in production
4. **Auto-scaling**: Triggers and thresholds
5. **Error Handling**: Retry logic and fallback strategies

### Production Readiness Scoring

- **80-100**: Ready for production deployment
- **60-79**: Needs optimization before production
- **0-59**: Not ready for production

## Troubleshooting

### Common Issues

1. **Server Not Running**

   ```bash
   # Start puppeteer-mcp server
   cd /home/william/git/puppeteer-mcp
   npm run dev
   ```

2. **Connection Errors**
   - Verify server is running on localhost:3000
   - Check firewall settings
   - Ensure adequate system resources

3. **High Resource Usage**
   - Close unnecessary applications
   - Increase system memory if possible
   - Reduce concurrent session count

4. **Test Failures**
   - Check server logs for errors
   - Verify test URLs are accessible
   - Ensure stable internet connection

### Debug Mode

Add debug logging by setting environment variable:

```bash
DEBUG=performance-test tsx [test-file]
```

## Configuration

### Test Configuration

Edit `config.ts` to modify:

- Target URLs
- Session counts
- Test durations
- Performance thresholds
- Monitoring intervals

### Server Configuration

For optimal performance testing:

- Increase browser pool size
- Adjust timeout settings
- Configure resource limits
- Enable detailed logging

## Continuous Integration

### Automated Testing

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Performance Tests
  run: |
    cd testing/paperclips-game/performance-tests
    npm install
    ./run-performance-tests.sh comprehensive
```

### Performance Regression Detection

Compare results over time to detect performance regressions:

- Monitor response time trends
- Track resource usage patterns
- Alert on performance degradation

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review server logs
3. Verify system requirements
4. Open an issue in the project repository

## License

This performance test suite is part of the puppeteer-mcp project and follows the same MIT license.
