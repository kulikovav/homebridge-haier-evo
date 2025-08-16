# Testing Guide for Homebridge Haier Evo Plugin

This document provides comprehensive guidance on running tests for the Homebridge Haier Evo plugin, including unit tests and standalone tests.

## 🧪 Test Structure

```
tests/
├── setup/                     # Test setup and configuration
│   └── setup.ts              # Global test setup
├── mocks/                     # Mock data and objects
│   ├── haier-api-mocks.ts    # Haier API mock responses
│   └── homebridge-mocks.ts   # Homebridge API mocks
├── unit/                      # Unit tests for individual components
│   ├── constants.test.ts      # Constants module tests
│   └── device-factory.test.ts # Device factory tests
└── README.md                  # This testing guide
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run All Tests
```bash
npm test
```

### 3. Run Tests in Watch Mode
```bash
npm run test:watch
```

### 4. Generate Coverage Report
```bash
npm run test:coverage
```

## 📋 Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode (re-runs on file changes) |
| `npm run test:coverage` | Run tests with coverage report |

| `npm run test:unit` | Run only unit tests |

## 🧩 Test Types

### Unit Tests (`tests/unit/`)
- **Purpose**: Test individual functions and classes in isolation
- **Scope**: Single module or component
- **Dependencies**: Mocked external dependencies
- **Speed**: Fast execution

**Examples:**
- Constants validation
- Device factory logic
- Type checking
- Utility functions

### Standalone Tests (Root directory)
- **Purpose**: Test real-world scenarios and API interactions
- **Scope**: Component integration and API communication
- **Dependencies**: Can use real API or mocked responses
- **Speed**: Medium to slow execution

**Examples:**
- `test-devices.js` - Device factory and functionality testing
- `test-rate-limiting.js` - API rate limiting behavior
- `test-real-api.js` - Real API integration testing
- `test-ac-control.js` - Air conditioner control testing
- `run-tests.js` - Comprehensive test runner

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',                    // TypeScript support
  testEnvironment: 'node',              // Node.js environment
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.ts'], // Coverage collection
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,                   // 30 second timeout
};
```

### Test Setup (`tests/setup.ts`)
- Global mocks for timers, console, and external modules
- Test utility functions
- Mock data factories
- Global test configuration

## 🎭 Mocking Strategy

### External Dependencies
- **Homebridge**: Mocked API objects and services
- **WebSocket**: Mocked with mock-socket
- **HTTP Requests**: Mocked with nock
- **Timers**: Mocked setTimeout/setInterval

### Mock Data
- **Haier API Responses**: Realistic API response structures
- **Device Configurations**: Various device types and states
- **Error Scenarios**: Network failures, authentication errors

## 📊 Coverage Reporting

### Coverage Metrics
- **Statements**: Percentage of code statements executed
- **Branches**: Percentage of conditional branches taken
- **Functions**: Percentage of functions called
- **Lines**: Percentage of code lines executed

### Coverage Reports
```bash
npm run test:coverage
```

Reports are generated in:
- **Console**: Text summary
- **HTML**: Detailed browser-based report (`coverage/lcov-report/index.html`)
- **LCOV**: Machine-readable format for CI/CD

## 🧪 Writing Tests

### Test Structure
```typescript
describe('Component Name', () => {
  let component: Component;

  beforeEach(() => {
    // Setup
    component = new Component();
  });

  afterEach(() => {
    // Cleanup
    component.destroy();
  });

  describe('Feature', () => {
    it('should behave correctly', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = component.process(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Best Practices
1. **Arrange-Act-Assert**: Structure tests in three clear phases
2. **Descriptive Names**: Use clear, descriptive test names
3. **Single Responsibility**: Each test should test one specific behavior
4. **Mock External Dependencies**: Don't rely on external services
5. **Clean Setup/Teardown**: Ensure tests don't affect each other

### Assertion Examples
```typescript
// Basic assertions
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toBeDefined();
expect(value).toBeUndefined();

// Async assertions
await expect(asyncFunction()).resolves.toBe(expected);
await expect(asyncFunction()).rejects.toThrow('Error message');

// Mock assertions
expect(mockFunction).toHaveBeenCalled();
expect(mockFunction).toHaveBeenCalledWith(arg1, arg2);
expect(mockFunction).toHaveBeenCalledTimes(3);
```

## 🔍 Debugging Tests

### Debug Mode
```bash
# Run specific test with debugging
npm test -- --testNamePattern="should authenticate successfully"
```

### Console Output
```typescript
// Enable console output in specific tests
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

### Test Isolation
```typescript
// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  nock.cleanAll();
});
```

## 🚨 Common Test Issues

### 1. Mock Not Working
```typescript
// Ensure mock is set up before test
jest.mock('../../src/haier-api');
const MockHaierAPI = require('../../src/haier-api').HaierAPI;
```

### 2. Async Test Failures
```typescript
// Use proper async/await
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### 3. Timer Mocks
```typescript
// Mock timers globally in setup.ts
global.setTimeout = jest.fn();
global.setInterval = jest.fn();
```

### 4. Event Emitter Mocks
```typescript
// Mock EventEmitter methods
jest.mock('events', () => ({
  EventEmitter: jest.requireActual('events').EventEmitter,
  once: jest.fn(),
}));
```

## 📈 Performance Testing

### Load Testing
```typescript
it('should handle large numbers of devices efficiently', async () => {
  const startTime = Date.now();

  // Create many devices
  const mockDevices = Array.from({ length: 50 }, (_, i) => ({
    id: `device-${i}`,
    // ... device properties
  }));

  await platform.initialize();

  const endTime = Date.now();
  expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
});
```

### Stress Testing
```typescript
it('should handle rapid status updates efficiently', async () => {
  // Send 100 rapid updates
  for (let i = 0; i < 100; i++) {
    deviceStatusUpdateHandler(statusUpdate);
  }

  // Should complete within reasonable time
  expect(endTime - startTime).toBeLessThan(1000);
});
```

## 🔄 Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run lint
```

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test && npm run lint"
    }
  }
}
```

## 📚 Additional Resources

### Jest Documentation
- [Jest Getting Started](https://jestjs.io/docs/getting-started)
- [Jest API Reference](https://jestjs.io/docs/api)
- [Jest Configuration](https://jestjs.io/docs/configuration)

### Testing Best Practices
- [Testing JavaScript](https://testingjavascript.com/)
- [Kent C. Dodds Testing Blog](https://kentcdodds.com/blog/write-tests)

### Mock Libraries
- [nock](https://github.com/nock/nock) - HTTP mocking
- [mock-socket](https://github.com/thoov/mock-socket) - WebSocket mocking
- [jest-mock](https://jestjs.io/docs/jest-object#jestmockmodulename-factory-options)

## 🤝 Contributing Tests

### Adding New Tests
1. Create test file in appropriate directory
2. Follow existing naming conventions
3. Include comprehensive test coverage
4. Add to appropriate test suite

### Test Review Checklist
- [ ] Tests cover all code paths
- [ ] Edge cases are tested
- [ ] Error scenarios are covered
- [ ] Performance considerations included
- [ ] Mocks are properly configured
- [ ] Tests are isolated and repeatable

### Running Tests Before Committing
```bash
npm run test:coverage  # Ensure all tests pass
npm run lint           # Check code quality
npm run build          # Verify TypeScript compilation
```

## 📊 Test Metrics

### Coverage Targets
- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

### Performance Targets
- **Unit Tests**: <100ms per test
- **Standalone Tests**: <2s per test
- **Full Test Suite**: <30s total

### Quality Metrics
- **Test Count**: >100 tests
- **Test Files**: >10 test files
- **Mock Coverage**: 100% external dependencies
- **Error Scenarios**: >20 error test cases

This testing guide ensures comprehensive coverage and quality assurance for the Homebridge Haier Evo plugin. Follow these guidelines to maintain high code quality and reliability.
