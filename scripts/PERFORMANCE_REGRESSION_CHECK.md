# Performance Regression Check Script

A Node.js script that compares performance metrics between baseline and current versions to detect regressions in CI/CD pipelines.

## Features

- **Automatic regression detection**: Compares metrics and flags values that exceed threshold
- **Configurable threshold**: Set custom regression tolerance (default 10%)
- **Smart metric handling**: Understands which metrics should increase vs decrease
- **Nested metric support**: Handles complex JSON structures with nested metrics
- **Clear output**: Color-coded results with detailed change percentages
- **CI/CD ready**: Returns appropriate exit codes for pipeline integration

## Usage

```bash
node scripts/check-performance-regression.js --baseline <path> --current <path> [--threshold <percent>]
```

### Parameters

- `--baseline`: Path to baseline performance metrics JSON file (required)
- `--current`: Path to current performance metrics JSON file (required)  
- `--threshold`: Regression threshold percentage (default: 10)
- `--help, -h`: Show help message

### Exit Codes

- `0`: No regressions found
- `1`: Regressions detected or error occurred

## Examples

### Basic Usage

```bash
# Check with default 10% threshold
node scripts/check-performance-regression.js \
  --baseline baseline-metrics.json \
  --current current-metrics.json

# Check with custom 5% threshold
node scripts/check-performance-regression.js \
  --baseline baseline-metrics.json \
  --current current-metrics.json \
  --threshold 5
```

### Sample Metrics File Format

```json
{
  "navigation": {
    "duration": 1500,
    "responseTime": 250,
    "loadTime": 1200
  },
  "memory": {
    "heapUsed": 52428800,
    "heapTotal": 104857600,
    "rss": 157286400
  },
  "api": {
    "throughput": 1000,
    "successRate": 99.5,
    "errorRate": 0.5
  }
}
```

## Metric Type Detection

The script automatically detects whether a metric should increase or decrease:

### Lower is Better (Time/Resource Metrics)
- `duration`, `time`, `latency`
- `memory`, `cpu`, `heap`
- `responseTime`, `loadTime`, `renderTime`
- Regression = increase beyond threshold

### Higher is Better (Performance Metrics)
- `throughput`, `successRate`
- `requestsPerSecond`, `score`
- Regression = decrease beyond threshold

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run performance tests (current)
  run: npm run test:performance -- --json > current-metrics.json

- name: Run performance tests (baseline)
  run: |
    git checkout main
    npm run test:performance -- --json > baseline-metrics.json
    git checkout -

- name: Check for regressions
  run: |
    node scripts/check-performance-regression.js \
      --baseline baseline-metrics.json \
      --current current-metrics.json \
      --threshold 10
```

### GitLab CI Example

```yaml
performance-check:
  script:
    - npm run test:performance -- --json > current-metrics.json
    - git checkout main
    - npm run test:performance -- --json > baseline-metrics.json
    - git checkout -
    - node scripts/check-performance-regression.js --baseline baseline-metrics.json --current current-metrics.json
```

## Output Example

```
Performance Regression Check

Baseline: baseline-metrics.json
Current:  current-metrics.json
Threshold: 10%

Comparing metrics...

✓ navigation.duration: 1500 → 1400 (-6.67%)
✓ navigation.responseTime: 250 → 240 (-4.00%)
✗ memory.heapUsed: 52428800 → 62914560 (+20.00%) - REGRESSION
✓ api.throughput: 1000 → 1100 (+10.00%)
✓ api.successRate: 99.5 → 98.5 (-1.01%)

Summary
──────────────────────────────────────────────────
Total metrics checked: 8
Passed: 7
Failed: 1

Performance regressions detected!

Regressed metrics:
  • memory.heapUsed: 52428800 → 62914560 (+20.00%)
```

## Testing the Script

Run the included test suite:

```bash
node scripts/test-performance-regression.js
```

This will:
1. Create sample baseline and current metrics
2. Run tests with and without regressions
3. Verify the script behaves correctly

## Best Practices

1. **Consistent metric collection**: Ensure metrics are collected the same way for baseline and current
2. **Appropriate thresholds**: Set thresholds based on metric importance and normal variance
3. **Metric stability**: Run multiple iterations and average results for more stable comparisons
4. **Baseline updates**: Periodically update baseline metrics as performance improves

## Troubleshooting

### Missing metrics in current
If a metric exists in baseline but not current, it will be skipped with a warning.

### Non-numeric values
Only numeric values are compared. Strings, booleans, and arrays are ignored.

### Nested structures
The script handles nested objects automatically, creating dot-notation paths (e.g., `memory.heapUsed`).