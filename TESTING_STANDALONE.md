# Standalone Testing Guide for Haier Evo

This guide explains how to run tests without Jest dependencies using our standalone test scripts.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Project dependencies installed (`npm install`)
- Project built (`npm run build`)

### Basic Usage

```bash
# Run all tests
node run-tests.js

# Run only API integration tests
node run-tests.js --api

# Run only device tests
node run-tests.js --devices

# Show help
node run-tests.js --help
```

## 📋 Test Scripts Overview

### 1. `run-tests.js` - Main Test Runner
The comprehensive test runner that can execute multiple test suites.

**Features:**
- Unified test execution
- Colorized output
- Command-line options
- Comprehensive reporting
- Exit codes for CI/CD integration

**Options:**
- `--api` - Run only API integration tests
- `--devices` - Run only device tests
- `--all` - Run all tests (default)
- `--help` - Show help information

### 2. `test-real-api.js` - API Integration Tests
Tests real Haier Evo API integration without Jest.

**Tests Included:**
- API instance creation
- Authentication
- Device discovery
- Device status retrieval
- WebSocket connection
- Device factory integration
- Token refresh
- Error handling

**Requirements:**
- `RUN_REAL_API_TESTS=1` environment variable
- Valid Haier Evo API credentials

### 3. `test-devices.js` - Device Functionality Tests
Tests individual device functionality and the device factory.

**Tests Included:**
- Device factory validation
- Air conditioner device functionality
- Refrigerator device functionality
- Unsupported feature handling
- Device state management

**Features:**
- Mock device data
- No external API calls required
- Fast execution
- Comprehensive device coverage

## 🔧 Environment Variables

### Required for Real API Tests
```bash
export RUN_REAL_API_TESTS=1
export HAIER_EVO_EMAIL=your.email@example.com
export HAIER_EVO_PASSWORD=your_actual_password
export HAIER_EVO_REGION=ru
```

### Optional
```bash
export DEBUG=1                    # Enable debug output
export FORCE_COLOR=1             # Force colorized output
export HAIER_EVO_DEVICE_ID=your-device-id  # Specific device for testing
export TEST_TIMEOUT=30000        # Test timeout in milliseconds
export TEST_RETRY_ATTEMPTS=3     # Number of retry attempts
export TEST_RETRY_DELAY=1000     # Delay between retries in milliseconds
```

### Quick Setup
Use the provided setup script to configure your credentials:
```bash
./setup-test-credentials.sh
```

Or manually create a `.env` file based on `env.example`:
```bash
cp env.example .env
# Edit .env with your actual credentials
source .env
```

## 📊 Test Execution Examples

### Run All Tests
```bash
# Enable real API tests and run everything
RUN_REAL_API_TESTS=1 node run-tests.js
```

### Run Only Device Tests (Fast)
```bash
# Device tests don't require real API access
node run-tests.js --devices
```

### Run Only API Tests
```bash
# Only run real API integration tests
RUN_REAL_API_TESTS=1 node run-tests.js --api
```

### Individual Script Execution
```bash
# Run API tests directly
RUN_REAL_API_TESTS=1 node test-real-api.js

# Run device tests directly
node test-devices.js
```

## 🎯 Test Categories

### API Integration Tests (`test-real-api.js`)
**Purpose:** Verify real API communication and integration
**Duration:** 30-60 seconds (depends on API response times)
**Dependencies:** Internet connection, valid API credentials
**Use Cases:**
- Pre-deployment verification
- API health checks
- Integration testing

### Device Tests (`test-devices.js`)
**Purpose:** Verify device logic and factory functionality
**Duration:** 5-15 seconds
**Dependencies:** None (uses mock data)
**Use Cases:**
- Development testing
- CI/CD pipeline testing
- Quick functionality verification

## 🔍 Test Output

### Success Output
```
✅ PASSED: API Authentication (1250ms)
✅ PASSED: Device Discovery (890ms)
✅ PASSED: WebSocket Connection (2100ms)

📊 TEST SUMMARY
============================================================
Total Tests: 8
Passed: 8 ✅
Failed: 0 ❌
Skipped: 0 ⏭️
Duration: 4240ms
============================================================

🎉 All tests completed successfully!
```

### Failure Output
```
❌ FAILED: WebSocket Connection (30000ms)
   Error: Connection timeout after 30s

📊 TEST SUMMARY
============================================================
Total Tests: 8
Passed: 7 ✅
Failed: 1 ❌
Skipped: 0 ⏭️
Duration: 35000ms
============================================================

❌ FAILED TESTS:
   • WebSocket Connection: Connection timeout after 30s
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "Cannot find module" Errors
```bash
# Ensure project is built
npm run build

# Check if dist/ directory exists
ls -la dist/
```

#### 2. Real API Tests Skipped
```bash
# Check environment variable
echo $RUN_REAL_API_TESTS

# Set it if missing
export RUN_REAL_API_TESTS=1
```

#### 3. Authentication Failures
- Verify API credentials in test configuration
- Check network connectivity
- Ensure API service is available
- **Common Issue**: Default credentials in test scripts are incorrect
- **Solution**: Use `./setup-test-credentials.sh` or set environment variables:
  ```bash
  export HAIER_EVO_EMAIL=your.actual@email.com
  export HAIER_EVO_PASSWORD=your_actual_password
  export HAIER_EVO_REGION=ru
  source .env  # if using .env file
  ```

#### 4. Test Timeouts
- Increase timeout values in test scripts
- Check network latency
- Verify API response times

### Debug Mode
```bash
# Enable debug output
DEBUG=1 node run-tests.js

# Or for individual scripts
DEBUG=1 node test-real-api.js
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Test Haier Evo
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: node run-tests.js --devices
      - run: |
          if [ "${{ secrets.RUN_REAL_API_TESTS }}" = "true" ]; then
            RUN_REAL_API_TESTS=1 node run-tests.js --api
          fi
```

### Exit Codes
- `0` - All tests passed
- `1` - Some tests failed
- Scripts exit with appropriate codes for CI/CD integration

## 📈 Performance

### Test Execution Times
- **Device Tests:** 5-15 seconds
- **API Tests:** 30-60 seconds
- **Full Suite:** 35-75 seconds

### Optimization Tips
- Run device tests frequently during development
- Use API tests for integration verification
- Parallel execution possible with separate processes

## 🔧 Customization

### Adding New Tests
1. Create test function in appropriate script
2. Add test call to main execution function
3. Follow existing test patterns

### Modifying Test Configuration
- Update `TEST_CONFIG` objects in scripts
- Modify timeout values
- Adjust assertion logic

### Extending Test Runner
- Add new test categories
- Implement custom reporting
- Add test filtering options

## 📚 Related Files

- `test-real-api.js` - API integration tests
- `test-devices.js` - Device functionality tests
- `test-ac-control.js` - Comprehensive AC device control testing
- `run-tests.js` - Main test runner
- `tests/integration/` - Jest-based tests (legacy)
- `package.json` - Test scripts and dependencies

## 🤝 Contributing

When adding new tests:
1. Follow existing test patterns
2. Use descriptive test names
3. Include proper error handling
4. Add appropriate assertions
5. Update documentation

## 📞 Support

For testing issues:
1. Check this documentation
2. Verify environment setup
3. Review test output for errors
4. Check network connectivity
5. Verify API credentials
