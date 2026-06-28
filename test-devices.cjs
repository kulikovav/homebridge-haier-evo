#!/usr/bin/env node

/**
 * Standalone Device Testing Script
 *
 * This script tests individual device functionality without Jest dependencies.
 * It focuses on device creation, status updates, and command handling.
 */

const { DeviceFactory } = require('./dist/device-factory');
const { HaierAPI } = require('./dist/haier-api');

// Mock device data for testing
const MOCK_DEVICES = {
  airConditioner: {
    id: 'ac-123',
    name: 'Test AC',
    type: 'air_conditioner',
    mac: '00:11:22:33:44:55',
    model: 'Test AC Model',
    status: 1,
    attributes: []
  },
  refrigerator: {
    id: 'fridge-123',
    name: 'Test Fridge',
    type: 'refrigerator',
    mac: 'AA:BB:CC:DD:EE:FF',
    model: 'Test Fridge Model',
    status: 1,
    attributes: []
  }
};

// Create a mock API for testing
const createMockApi = () => {
  return {
    log: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
    on: () => {},
    emit: () => {},
    sendCommand: async () => Promise.resolve({}),
    getDeviceStatus: async () => Promise.resolve({}),
    ensureValidToken: async () => Promise.resolve(),
    isWebSocketConnected: () => false,
    connectWebSocket: async () => Promise.resolve(),
    disconnectWebSocket: () => {},
    removeAllListeners: () => {},
    setDeviceProperty: async () => Promise.resolve({})
  };
};

// Test results tracking
class DeviceTestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      startTime: Date.now(),
      tests: []
    };
  }

  // Test assertion helpers
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  assertTrue(value, message) {
    if (!value) {
      throw new Error(`Assertion failed: ${message}. Expected truthy value, got: ${value}`);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Got: ${actual}`);
    }
  }

  assertNotEqual(actual, expected, message) {
    if (actual === expected) {
      throw new Error(`Assertion failed: ${message}. Expected different values, got: ${actual}`);
    }
  }

  // Run a test with proper error handling
  async runTest(name, testFn, timeout = 15000) {
    const testResult = {
      name,
      status: 'pending',
      duration: 0,
      error: null,
      startTime: Date.now()
    };

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
    }

    this.results.tests.push(testResult);
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
    console.log('📊 DEVICE TEST SUMMARY');
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

    const exitCode = this.results.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

// Device-specific test functions
async function testAirConditionerDevice(runner) {
  console.log('\n❄️  Testing Air Conditioner Device');
  console.log('-'.repeat(40));

  // Test device creation
  await runner.runTest('AC Device Creation', async () => {
    const mockApi = createMockApi();
    const device = DeviceFactory.createDevice(MOCK_DEVICES.airConditioner, mockApi);
    runner.assertTrue(device, 'AC device should be created');
    runner.assertEqual(device.constructor.name, 'HaierACDevice', 'Should create HaierACDevice instance');
    console.log('   ✅ AC device created successfully');
  });

    // Test temperature setting
  await runner.runTest('AC Temperature Setting', async () => {
    const mockApi = createMockApi();
    const device = DeviceFactory.createDevice(MOCK_DEVICES.airConditioner, mockApi);
    const testTemp = 22;
    // Mock the API call since we don't have a real API
    device.sendCommand = async () => Promise.resolve();
    await device.set_temperature(testTemp);
    runner.assertEqual(device.target_temperature, testTemp, 'Target temperature should be set');
    console.log(`   ✅ Temperature set to ${testTemp}°C`);
  });

  // Test mode setting
  await runner.runTest('AC Mode Setting', async () => {
    const mockApi = createMockApi();
    const device = DeviceFactory.createDevice(MOCK_DEVICES.airConditioner, mockApi);
    const testMode = 'cool';
    // Mock the API call since we don't have a real API
    device.sendCommand = async () => Promise.resolve();
    await device.set_operation_mode(testMode);
    runner.assertEqual(device.mode, testMode, 'Mode should be set');
    console.log(`   ✅ Mode set to ${testMode}`);
  });

  // Test fan speed setting
  await runner.runTest('AC Fan Speed Setting', async () => {
    const mockApi = createMockApi();
    const device = DeviceFactory.createDevice(MOCK_DEVICES.airConditioner, mockApi);
    const testFanSpeed = 'medium';
    // Mock the API call since we don't have a real API
    device.sendCommand = async () => Promise.resolve();
    await device.set_fan_mode(testFanSpeed);
    runner.assertEqual(device.fan_mode, testFanSpeed, 'Fan mode should be set');
    console.log(`   ✅ Fan mode set to ${testFanSpeed}`);
  });

  // Test power control
  await runner.runTest('AC Power Control', async () => {
    const mockApi = createMockApi();
    const device = DeviceFactory.createDevice(MOCK_DEVICES.airConditioner, mockApi);
    // Mock the API call since we don't have a real API
    device.sendCommand = async () => Promise.resolve();
    await device.switch_on('cool');
    runner.assertEqual(device.status, 1, 'Device should be turned on');
    console.log('   ✅ Device turned on');

    await device.switch_off();
    runner.assertEqual(device.status, 0, 'Device should be turned off');
    console.log('   ✅ Device turned off');
  });
}

async function testRefrigeratorDevice(runner) {
  console.log('\n🧊 Testing Refrigerator Device');
  console.log('-'.repeat(40));

  // Test device creation
  await runner.runTest('Fridge Device Creation', async () => {
    const device = DeviceFactory.createDevice(MOCK_DEVICES.refrigerator, null);
    runner.assertTrue(device, 'Refrigerator device should be created');
    runner.assertEqual(device.constructor.name, 'HaierRefrigeratorDevice', 'Should create HaierRefrigeratorDevice instance');
    console.log('   ✅ Refrigerator device created successfully');
  });

    // Test refrigerator temperature setting
  await runner.runTest('Fridge Temperature Setting', async () => {
    const device = DeviceFactory.createDevice(MOCK_DEVICES.refrigerator, null);
    const testTemp = 4;
    // Mock the API call since we don't have a real API
    device.sendCommand = async () => Promise.resolve();
    await device.set_temperature(testTemp);
    runner.assertEqual(device.refrigerator_temperature, testTemp, 'Refrigerator temperature should be set');
    console.log(`   ✅ Refrigerator temperature set to ${testTemp}°C`);
  });

  // Test freezer temperature setting
  await runner.runTest('Freezer Temperature Setting', async () => {
    const device = DeviceFactory.createDevice(MOCK_DEVICES.refrigerator, null);
    const testTemp = -18;
    // Mock the API call since we don't have a real API
    device.sendCommand = async () => Promise.resolve();
    await device.set_freezer_temperature(testTemp);
    runner.assertEqual(device.freezer_temperature, testTemp, 'Freezer temperature should be set');
    console.log(`   ✅ Freezer temperature set to ${testTemp}°C`);
  });

  // Test mode settings
  await runner.runTest('Fridge Mode Settings', async () => {
    const device = DeviceFactory.createDevice(MOCK_DEVICES.refrigerator, null);
    // Mock the API call since we don't have a real API
    device.sendCommand = async () => Promise.resolve();

    await device.set_super_cool_mode(true);
    runner.assertTrue(device.super_cool_mode, 'Super cool mode should be enabled');
    console.log('   ✅ Super cool mode enabled');

    await device.set_vacation_mode(true);
    runner.assertTrue(device.vacation_mode, 'Vacation mode should be enabled');
    console.log('   ✅ Vacation mode enabled');
  });

  // Test unsupported features
  await runner.runTest('Fridge Unsupported Features', async () => {
    const device = DeviceFactory.createDevice(MOCK_DEVICES.refrigerator, null);

    try {
      await device.set_fan_mode('high');
      throw new Error('Should have thrown error for unsupported fan mode');
    } catch (error) {
      runner.assertTrue(error.message.includes('not supported'), 'Should handle unsupported features gracefully');
      console.log('   ✅ Unsupported features handled correctly');
    }
  });
}

async function testDeviceFactory(runner) {
  console.log('\n🏭 Testing Device Factory');
  console.log('-'.repeat(40));

  // Test factory with valid device types
  await runner.runTest('Factory Valid Device Types', async () => {
    const mockApi = createMockApi();
    const acDevice = DeviceFactory.createDevice(MOCK_DEVICES.airConditioner, mockApi);
    const fridgeDevice = DeviceFactory.createDevice(MOCK_DEVICES.refrigerator, mockApi);

    runner.assertTrue(acDevice, 'AC device should be created');
    runner.assertTrue(fridgeDevice, 'Fridge device should be created');
    runner.assertNotEqual(acDevice.constructor.name, fridgeDevice.constructor.name, 'Different device types should create different classes');

    console.log('   ✅ Factory creates different device types correctly');
  });

  // Test factory with invalid device type
  await runner.runTest('Factory Invalid Device Type', async () => {
    const mockApi = createMockApi();
    const invalidDevice = { ...MOCK_DEVICES.airConditioner, type: 'invalid_type' };

    // The factory should handle invalid device types gracefully by falling back to AC device
    const device = DeviceFactory.createDevice(invalidDevice, mockApi);
    runner.assertTrue(device, 'Device should be created even for invalid type');
    runner.assertEqual(device.constructor.name, 'HaierACDevice', 'Should fall back to AC device for invalid types');
    console.log('   ✅ Invalid device types handled gracefully (fallback to AC device)');
  });
}

// Main test execution
async function runDeviceTests() {
  const runner = new DeviceTestRunner();

  console.log('🚀 Haier Evo Device Testing Suite');
  console.log('='.repeat(60));
  console.log('Testing device creation, configuration, and functionality');
  console.log('='.repeat(60));

  try {
    // Test device factory
    await testDeviceFactory(runner);

    // Test air conditioner device
    await testAirConditionerDevice(runner);

    // Test refrigerator device
    await testRefrigeratorDevice(runner);

  } catch (error) {
    console.error('\n💥 Device test suite failed with unexpected error:', error.message);
    console.error('Stack:', error.stack);
    runner.results.failed++;
  }

  // Print final results
  runner.printSummary();
}

// Run the tests
runDeviceTests().catch(error => {
  console.error('\n💥 Device test runner failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});
