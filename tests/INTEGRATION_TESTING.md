# Haier Evo Plugin - Integration Testing Guide

This document describes how to run integration tests to verify the plugin works correctly with the real Haier Evo API before publishing.

## 🧪 Test Types

### 1. Unit Tests
- **Purpose**: Test individual components in isolation
- **Command**: `npm run test:unit`
- **Coverage**: Core logic, utilities, and helper functions
- **Dependencies**: None (fully mocked)

### 2. Mock Integration Tests
- **Purpose**: Test integration between components using mocked APIs
- **Command**: `npm run test:integration:mock`
- **Coverage**: Component interactions, error handling, data flow
- **Dependencies**: Mock data and responses

### 3. Real API Integration Tests ⭐
- **Purpose**: Verify plugin works with actual Haier Evo API
- **Command**: `npm run test:integration:real`
- **Coverage**: End-to-end functionality, real API responses, device discovery
- **Dependencies**: Real Haier Evo API credentials

## 🚀 Running Real API Integration Tests

### Prerequisites
1. **Valid Haier Evo Account**: Must have access to real devices
2. **Network Access**: Must be able to reach `iot-platform.evo.haieronline.ru`
3. **Environment Variable**: Set `RUN_REAL_API_TESTS=1`

### Quick Start
```bash
# Enable real API tests
export RUN_REAL_API_TESTS=1

# Run real API integration tests
npm run test:integration:real

# Or use the test runner script
node scripts/test-integration.js
```

### Test Configuration
The real API tests use the following configuration:
```typescript
{
  email: 'ha@aka',
  password: 'passwwww1',
  region: 'ru',
  refreshInterval: 300,
  debug: true,
}
```

## 📋 Test Coverage

### Real API Tests Cover:

#### 1. Authentication Flow
- ✅ Login with real credentials
- ✅ Token validation and refresh
- ✅ Error handling for invalid credentials

#### 2. Device Discovery
- ✅ Fetch real devices from API
- ✅ Parse device information correctly
- ✅ Extract device types (AC, Refrigerator)
- ✅ Handle device attributes and properties

#### 3. Device Status
- ✅ Get real-time device status
- ✅ Parse status attributes correctly
- ✅ Handle different device types

#### 4. WebSocket Connection
- ✅ Connect to real WebSocket endpoint
- ✅ Handle authentication and messages
- ✅ Process real-time status updates

#### 5. Device Factory Integration
- ✅ Create correct device instances
- ✅ Detect device types accurately
- ✅ Handle device-specific logic

#### 6. End-to-End Flow
- ✅ Complete platform initialization
- ✅ Device discovery and creation
- ✅ Service and characteristic setup

## 🔧 Test Commands

### All Tests
```bash
npm test                    # Run all tests
npm run test:coverage      # Run with coverage report
```

### Integration Tests
```bash
npm run test:integration           # Run all integration tests
npm run test:integration:mock     # Run only mock integration tests
npm run test:integration:real     # Run only real API tests
```

### Pre-Publish Testing
```bash
npm run test:prepublish    # Build + Lint + Real API tests
```

## 📊 Expected Results

### Successful Test Run
```
🧪 Haier Evo Plugin - Real API Integration Test Runner
=====================================================

✅ Real API tests enabled
🔐 Using credentials from test configuration
🌐 Testing against Haier Evo API (ru region)

🚀 Starting real API integration tests...

✅ Real API authentication successful
✅ Real API device discovery successful: 3 devices found
✅ Real API device status successful
✅ Real API WebSocket connection successful
✅ Real API device factory integration successful
✅ Real API device type detection successful

==================================================
🎉 All real API integration tests passed!
✅ Plugin is ready for publishing
```

### Failed Test Run
```
❌ Real API authentication failed: Authentication failed: Invalid credentials
❌ Real API device discovery failed: Network error
❌ Real API device status failed: Device not found

==================================================
❌ Some real API integration tests failed
🔧 Please fix the issues before publishing
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Authentication Failures
- **Symptom**: "Authentication failed" errors
- **Cause**: Invalid credentials or account issues
- **Solution**: Verify email/password and account status

#### 2. Network Timeouts
- **Symptom**: Tests hang or timeout
- **Cause**: Network connectivity issues
- **Solution**: Check firewall, proxy, and network access

#### 3. Device Discovery Failures
- **Symptom**: "No devices found" errors
- **Cause**: Account has no devices or API changes
- **Solution**: Verify account has devices and check API endpoints

#### 4. WebSocket Connection Failures
- **Symptom**: WebSocket connection errors
- **Cause**: Network restrictions or API changes
- **Solution**: Check WebSocket access and API documentation

### Debug Mode
Enable debug logging for detailed troubleshooting:
```typescript
{
  debug: true,  // Enable verbose logging
  // ... other config
}
```

## 📝 Test Reports

### Coverage Report
```bash
npm run test:coverage
```
Generates HTML coverage report in `coverage/` directory.

### Test Results
```bash
npm run test:integration:real -- --verbose
```
Shows detailed test output and timing information.

## 🔒 Security Notes

### Credential Handling
- **Never commit real credentials** to version control
- **Use environment variables** for sensitive data
- **Rotate credentials** regularly
- **Limit test account permissions** when possible

### Network Security
- **Test in isolated environment** when possible
- **Monitor API usage** during testing
- **Respect rate limits** and API terms of service

## 📚 Additional Resources

### Test Files
- `tests/integration/real-api.integration.test.ts` - Real API tests
- `tests/integration/end-to-end-real.integration.test.ts` - E2E tests
- `tests/integration/test-config.ts` - Test configuration
- `scripts/test-integration.js` - Test runner script

### Mock Data
- `tests/mocks/haier-api-mocks.ts` - Mock API responses
- `tests/mocks/homebridge-mocks.ts` - Mock Homebridge objects

### Configuration
- `tests/setup.ts` - Jest test setup
- `jest.config.js` - Jest configuration

## 🎯 Pre-Publish Checklist

Before publishing the plugin, ensure:

1. ✅ **All unit tests pass**: `npm run test:unit`
2. ✅ **All mock integration tests pass**: `npm run test:integration:mock`
3. ✅ **All real API tests pass**: `npm run test:integration:real`
4. ✅ **Code builds successfully**: `npm run build`
5. ✅ **Linting passes**: `npm run lint`
6. ✅ **Coverage meets standards**: `npm run test:coverage`

### Quick Pre-Publish Test
```bash
npm run test:prepublish
```

This command runs all necessary checks in sequence and only succeeds if everything passes.

---

**Note**: Real API tests require valid credentials and network access. These tests are essential for ensuring the plugin works correctly in production environments.
