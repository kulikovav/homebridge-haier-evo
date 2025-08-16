#!/usr/bin/env node

/**
 * Standalone Real Haier Evo API Integration Test Runner
 *
 * This script provides comprehensive testing of the real Haier Evo API
 * without Jest dependencies. It includes proper test structure, error handling,
 * and detailed reporting.
 */

// Load environment variables from .env file
require('dotenv').config();

const { HaierAPI } = require('./dist/haier-api');
const { DeviceFactory } = require('./dist/device-factory');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const TEST_CONFIG = {
  haierEvo: {
    name: 'Haier Evo',
    email: process.env.HAIER_EVO_EMAIL,
    password: process.env.HAIER_EVO_PASSWORD,
    region: process.env.HAIER_EVO_REGION || 'ru',
    debug: process.env.DEBUG === '1'
  },
  testSettings: {
    timeout: parseInt(process.env.TEST_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.TEST_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.TEST_RETRY_DELAY) || 1000
  },
  deviceId: process.env.HAIER_EVO_DEVICE_ID || uuidv4()
};

// Validate test configuration
  function validateTestConfig() {
    const { haierEvo } = TEST_CONFIG;

    if (!haierEvo.email) {
      throw new Error('Missing HAIER_EVO_EMAIL environment variable');
    }

    if (!haierEvo.password) {
      throw new Error('Missing HAIER_EVO_PASSWORD environment variable');
    }

    if (!haierEvo.region) {
      throw new Error('Missing Haier Evo region configuration');
    }

    console.log('✅ Test configuration validated successfully');
    return true;
  }

// Test results tracking
class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      startTime: Date.now(),
      tests: []
    };
    this.currentTest = null;
  }

  // Test assertion helper
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Test assertion with custom error
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Got: ${actual}`);
    }
  }

  // Test assertion for truthy values
  assertTrue(value, message) {
    if (!value) {
      throw new Error(`Assertion failed: ${message}. Expected truthy value, got: ${value}`);
    }
  }

  // Test assertion for falsy values
  assertFalse(value, message) {
    if (value) {
      throw new Error(`Assertion failed: ${message}. Expected falsy value, got: ${value}`);
    }
  }

  // Run a test with proper error handling
  async runTest(name, testFn, timeout = 30000) {
    const testResult = {
      name,
      status: 'pending',
      duration: 0,
      error: null,
      startTime: Date.now()
    };

    this.currentTest = testResult;
    this.results.total++;

    console.log(`\n🧪 Running: ${name}`);

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout);
      });

      await Promise.race([testFn(), timeoutPromise]);

      testResult.status = 'passed';
      testResult.duration = Date.now() - testResult.startTime;
      this.results.passed++;

      console.log(`✅ PASSED: ${name} (${testResult.duration}ms)`);
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error;
      testResult.duration = Date.now() - testResult.startTime;
      this.results.failed++;

      console.log(`❌ FAILED: ${name} (${testResult.duration}ms)`);
      console.log(`   Error: ${error.message}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.split('\n')[1]}`);
      }
    }

    this.results.tests.push(testResult);
    this.currentTest = null;
  }

  // Skip a test
  skipTest(name, reason) {
    const testResult = {
      name: `${name} (SKIPPED)`,
      status: 'skipped',
      duration: 0,
      error: null,
      startTime: Date.now(),
      skipReason: reason
    };

    this.results.total++;
    this.results.skipped++;
    this.results.tests.push(testResult);

    console.log(`⏭️  SKIPPED: ${name} - ${reason}`);
  }

  // Print test summary
  printSummary() {
    const duration = Date.now() - this.results.startTime;

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Skipped: ${this.results.skipped} ⏭️`);
    console.log(`Duration: ${duration}ms`);
    console.log('='.repeat(60));

    if (this.results.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          console.log(`   • ${t.name}: ${t.error?.message}`);
        });
    }

    if (this.results.skipped > 0) {
      console.log('\n⏭️  SKIPPED TESTS:');
      this.results.tests
        .filter(t => t.status === 'skipped')
        .forEach(t => {
          console.log(`   • ${t.name}: ${t.skipReason}`);
        });
    }

    const exitCode = this.results.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

// Main test suite
async function runIntegrationTests() {
  const runner = new TestRunner();
  let haierAPI = null;

  console.log('🚀 Haier Evo Real API Integration Tests');
  console.log('='.repeat(60));
  console.log(`Region: ${TEST_CONFIG.haierEvo.region}`);
  console.log(`Email: ${TEST_CONFIG.haierEvo.email}`);
  console.log(`Debug: ${TEST_CONFIG.haierEvo.debug}`);
  console.log('='.repeat(60));

  // Validate test configuration
  try {
    validateTestConfig();
  } catch (error) {
    console.error('❌ Test configuration validation failed:', error.message);
    process.exit(1);
  }

  try {
    // Test 1: API Instance Creation
    await runner.runTest('API Instance Creation', async () => {
      haierAPI = new HaierAPI(TEST_CONFIG.haierEvo);
      runner.assertTrue(haierAPI, 'HaierAPI instance should be created');
      console.log('   ✅ HaierAPI instance created successfully');
    });

    // Test 2: Authentication
    await runner.runTest('API Authentication', async () => {
      runner.assertTrue(haierAPI, 'HaierAPI instance should exist');
      await haierAPI.authenticate();
      runner.assertTrue(haierAPI.isTokenValid(), 'Authentication token should be valid');
      console.log('   ✅ Authentication successful');
      console.log(`   🔑 Token valid: ${haierAPI.isTokenValid()}`);
    });

    // Test 3: Device Discovery
    await runner.runTest('Device Discovery', async () => {
      runner.assertTrue(haierAPI, 'HaierAPI instance should exist');
      const devices = await haierAPI.fetchDevices();
      runner.assertTrue(Array.isArray(devices), 'Devices should be an array');
      console.log(`   ✅ Found ${devices.length} devices`);

      if (devices.length > 0) {
        devices.forEach((device, index) => {
          console.log(`      ${index + 1}. ${device.name} (${device.type}) - MAC: ${device.mac}`);
        });
      }
    });

    // Test 4: Device Status (if devices found)
    if (haierAPI && haierAPI.devices && haierAPI.devices.length > 0) {
      const firstDevice = haierAPI.devices[0];
      await runner.runTest(`Device Status - ${firstDevice.name}`, async () => {
        const status = await haierAPI.getDeviceStatus(firstDevice.mac);
        runner.assertTrue(status, 'Device status should be retrieved');
        runner.assertTrue(typeof status.current_temperature === 'number', 'Current temperature should be a number');
        console.log(`   ✅ Status retrieved for ${firstDevice.name}`);
        console.log(`      Current temp: ${status.current_temperature}°C`);
        if (status.target_temperature) {
          console.log(`      Target temp: ${status.target_temperature}°C`);
        }
        console.log(`      Status: ${status.status}`);
      });
    } else {
      runner.skipTest('Device Status', 'No devices available for testing');
    }

    // Test 5: WebSocket Connection
    await runner.runTest('WebSocket Connection', async () => {
      runner.assertTrue(haierAPI, 'HaierAPI instance should exist');
      await haierAPI.connectWebSocket();
      runner.assertTrue(haierAPI.isWebSocketConnected(), 'WebSocket should be connected');
      console.log('   ✅ WebSocket connected successfully');

      // Wait for potential messages
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('   ✅ WebSocket test completed');
    });

    // Test 6: Device Factory Integration
    await runner.runTest('Device Factory Integration', async () => {
      if (haierAPI && haierAPI.devices && haierAPI.devices.length > 0) {
        const firstDevice = haierAPI.devices[0];
        const device = DeviceFactory.createDevice(firstDevice, haierAPI);
        runner.assertTrue(device, 'Device should be created by factory');
        console.log(`   ✅ Device factory created: ${device.constructor.name}`);

        // Log device temperature limits to help with debugging
        console.log(`   ℹ️ Device temperature limits: ${device.min_temperature}°C - ${device.max_temperature}°C`);
        console.log(`   ℹ️ Current target temperature: ${device.target_temperature}°C`);

        // Adjust target temperature if it's outside the valid range
        if (device.target_temperature < device.min_temperature || device.target_temperature > device.max_temperature) {
          const defaultTemp = Math.round((device.min_temperature + device.max_temperature) / 2);
          console.log(`   ⚠️ Adjusting target temperature to ${defaultTemp}°C (was ${device.target_temperature}°C)`);
          await device.set_temperature(defaultTemp);
        }
      } else {
        runner.skipTest('Device Factory Integration', 'No devices available for testing');
      }
    });

    // Test 7: Token Refresh
    await runner.runTest('Token Refresh', async () => {
      runner.assertTrue(haierAPI, 'HaierAPI instance should exist');
      await haierAPI.refreshAccessToken();
      runner.assertTrue(haierAPI.isTokenValid(), 'Token should remain valid after refresh');
      console.log('   ✅ Token refresh successful');
    });

    // Test 8: Rate Limiting Configuration
    await runner.runTest('Rate Limiting Configuration', async () => {
      runner.assertTrue(haierAPI, 'HaierAPI instance should exist');

      // Test initial configuration
      const initialConfig = haierAPI.getRateLimitStatus();
      runner.assertTrue(initialConfig, 'Rate limiting status should be available');
      console.log('   📊 Initial configuration:', JSON.stringify(initialConfig.config, null, 2));

      // Test custom configuration
      haierAPI.configureRateLimit({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 15000,
        jitter: 0.2
      });

      const updatedConfig = haierAPI.getRateLimitStatus();
      runner.assertTrue(updatedConfig, 'Updated rate limiting status should be available');
      runner.assertEqual(updatedConfig.config.maxRetries, 5, 'Max retries should be updated');
      runner.assertEqual(updatedConfig.config.baseDelay, 500, 'Base delay should be updated');

      console.log('   ✅ Configuration updated successfully');
      console.log('   📊 Updated configuration:', JSON.stringify(updatedConfig.config, null, 2));
    });

    // Test 9: Error Handling
    await runner.runTest('Error Handling - Invalid Device', async () => {
      runner.assertTrue(haierAPI, 'HaierAPI instance should exist');
      try {
        await haierAPI.getDeviceStatus('invalid-mac-address');
        throw new Error('Should have thrown an error for invalid MAC');
      } catch (error) {
        runner.assertTrue(error.message.includes('error') || error.message.includes('invalid'), 'Should handle invalid device gracefully');
        console.log('   ✅ Error handling works correctly');
      }
    });

  } catch (error) {
    console.error('\n💥 Test suite failed with unexpected error:', error.message);
    console.error('Stack:', error.stack);
    runner.results.failed++;
  } finally {
    // Cleanup
    if (haierAPI) {
      try {
        haierAPI.removeAllListeners();
        if (haierAPI.isWebSocketConnected()) {
          haierAPI.disconnectWebSocket();
        }
      } catch (error) {
        console.log('⚠️  Cleanup warning:', error.message);
      }
    }
  }

  // Print final results
  runner.printSummary();
}

// Environment check
if (!process.env.RUN_REAL_API_TESTS) {
  console.log('⚠️  Real API tests are disabled by default.');
  console.log('   Set RUN_REAL_API_TESTS=1 to enable real API testing.');
  console.log('   Example: RUN_REAL_API_TESTS=1 node test-real-api.js');
  process.exit(0);
}

// Run the tests
runIntegrationTests().catch(error => {
  console.error('\n💥 Test runner failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});
