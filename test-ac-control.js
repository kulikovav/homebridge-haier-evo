#!/usr/bin/env node
/**
 * Test script for controlling Haier air conditioner devices
 * This script demonstrates the various commands available for AC control
 */

require('dotenv').config();
const { HaierAPI } = require('./lib/haier-api');
const { DeviceFactory } = require('./lib/device-factory');

// Test configuration
const TEST_CONFIG = {
  email: process.env.HAIER_EVO_EMAIL,
  password: process.env.HAIER_EVO_PASSWORD,
  region: process.env.HAIER_EVO_REGION || 'ru',
  deviceId: process.env.HAIER_EVO_DEVICE_ID || 'test-ac-control-' + Date.now(),
  debug: true
};

// Test runner class
class ACControlTester {
  constructor(config) {
    this.config = config;
    this.api = null;
    this.devices = [];
    this.acDevices = [];
  }

  async setup() {
    console.log('🔄 Setting up API client...');
    this.api = new HaierAPI(this.config);

    try {
      await this.api.authenticate();
      console.log('✅ Authentication successful!');

      // Fetch devices
      const devices = await this.api.fetchDevices();
      console.log(`📱 Found ${devices.length} devices`);

      // Create device objects
      this.devices = devices.map(device => DeviceFactory.createDevice(device, this.api));

      // Filter for AC devices
      this.acDevices = this.devices.filter(device => device.constructor.name === 'HaierACDevice');
      console.log(`❄️ Found ${this.acDevices.length} AC devices`);

      if (this.acDevices.length === 0) {
        console.error('❌ No AC devices found');
        return false;
      }

      // Log device details
      this.acDevices.forEach((device, index) => {
        console.log(`\n📱 AC Device #${index + 1}: ${device.device_name}`);
        console.log(`   - MAC: ${device.mac}`);
        console.log(`   - ID: ${device.device_id}`);
        console.log(`   - Type: ${device.device_type}`);
        console.log(`   - Model: ${device.device_model || 'Unknown'}`);
        console.log(`   - Temperature range: ${device.min_temperature}°C - ${device.max_temperature}°C`);
        console.log(`   - Current status: ${device.status ? 'ON' : 'OFF'}`);
        console.log(`   - Current mode: ${device.mode || 'Unknown'}`);
        console.log(`   - Current temperature: ${device.current_temperature}°C`);
        console.log(`   - Target temperature: ${device.target_temperature}°C`);
        console.log(`   - Fan mode: ${device.fan_mode || 'Unknown'}`);
        console.log(`   - Vertical blinds mode: ${device.swing_mode || 'Unknown'}`);
        console.log(`   - Vertical blinds tilt angle: ${device.get_tilt_angle()}°`);
        console.log(`   - Swing mode active: ${device.is_in_swing_mode() ? 'Yes' : 'No'}`);
        console.log(`   - Light: ${device.light_on ? 'ON' : 'OFF'}`);
        console.log(`   - Health mode: ${device.health ? 'ON' : 'OFF'}`);
        console.log(`   - Quiet mode: ${device.quiet ? 'ON' : 'OFF'}`);
        console.log(`   - Turbo mode: ${device.turbo ? 'ON' : 'OFF'}`);
        console.log(`   - Comfort mode: ${device.comfort ? 'ON' : 'OFF'}`);
      });

      return true;
    } catch (error) {
      console.error('❌ Setup failed:', error);
      return false;
    }
  }

  async runCommand(command, deviceIndex = 0) {
    if (this.acDevices.length === 0) {
      console.error('❌ No AC devices found');
      return false;
    }

    if (deviceIndex >= this.acDevices.length) {
      console.error(`❌ Invalid device index: ${deviceIndex}, max index is ${this.acDevices.length - 1}`);
      return false;
    }

    const device = this.acDevices[deviceIndex];
    console.log(`\n📱 Selected device: ${device.device_name}`);

    try {
      switch (command) {
        case 'power-on':
          console.log('🔌 Turning device ON');
          await device.switch_on('auto');
          break;

        case 'power-off':
          console.log('🔌 Turning device OFF');
          await device.switch_off();
          break;

        case 'set-cool':
          console.log('❄️ Setting mode to COOL');
          await device.set_operation_mode('cool');
          break;

        case 'set-heat':
          console.log('🔥 Setting mode to HEAT');
          await device.set_operation_mode('heat');
          break;

        case 'set-auto':
          console.log('🔄 Setting mode to AUTO');
          await device.set_operation_mode('auto');
          break;

        case 'set-fan-only':
          console.log('💨 Setting mode to FAN ONLY');
          await device.set_operation_mode('fan_only');
          break;

        case 'set-dry':
          console.log('💧 Setting mode to DRY');
          await device.set_operation_mode('dry');
          break;

        case 'set-temp-22':
          console.log('🌡️ Setting temperature to 22°C');
          await device.set_temperature(22);
          break;

        case 'set-temp-24':
          console.log('🌡️ Setting temperature to 24°C');
          await device.set_temperature(24);
          break;

        case 'set-fan-auto':
          console.log('🌀 Setting fan mode to AUTO');
          await device.set_fan_mode('auto');
          break;

        case 'set-fan-high':
          console.log('🌀 Setting fan mode to HIGH');
          await device.set_fan_mode('high');
          break;

        case 'set-fan-medium':
          console.log('🌀 Setting fan mode to MEDIUM');
          await device.set_fan_mode('medium');
          break;

        case 'set-fan-low':
          console.log('🌀 Setting fan mode to LOW');
          await device.set_fan_mode('low');
          break;

        case 'set-swing-auto':
          console.log('↕️ Setting vertical blinds to AUTO (swing mode)');
          await device.set_swing_mode('auto');
          break;

        case 'set-swing-off':
          console.log('↕️ Setting vertical blinds to OFF (center position)');
          await device.set_swing_mode('off');
          break;

        case 'set-swing-up':
          console.log('↕️ Setting vertical blinds to UP position');
          await device.set_swing_mode('upper');
          break;

        case 'set-swing-down':
          console.log('↕️ Setting vertical blinds to DOWN position');
          await device.set_swing_mode('bottom');
          break;

        case 'set-swing-pos1':
          console.log('↕️ Setting vertical blinds to POSITION 1');
          await device.set_swing_mode('position_1');
          break;

        case 'set-swing-pos2':
          console.log('↕️ Setting vertical blinds to POSITION 2');
          await device.set_swing_mode('position_2');
          break;

        case 'set-swing-pos3':
          console.log('↕️ Setting vertical blinds to POSITION 3');
          await device.set_swing_mode('position_3');
          break;

        case 'set-tilt-angle':
          const angle = parseInt(process.argv[3] || '0');
          console.log(`↕️ Setting vertical blinds tilt angle to ${angle}°`);
          await device.set_tilt_angle(angle);
          const resultAngle = device.get_tilt_angle();
          console.log(`↕️ Current tilt angle: ${resultAngle}°`);
          break;

        case 'set-light-on':
          console.log('💡 Turning light ON');
          await device.set_light(true);
          break;

                case 'set-light-off':
          console.log('💡 Turning light OFF');
          await device.set_light(false);
          break;

        case 'set-health-on':
          console.log('🌿 Turning health mode ON');
          await device.set_health_mode(true);
          break;

        case 'set-health-off':
          console.log('🌿 Turning health mode OFF');
          await device.set_health_mode(false);
          break;

        case 'set-quiet-on':
          console.log('🔇 Turning quiet mode ON');
          await device.set_quiet_mode(true);
          break;

        case 'set-quiet-off':
          console.log('🔇 Turning quiet mode OFF');
          await device.set_quiet_mode(false);
          break;

        case 'set-turbo-on':
          console.log('🚀 Turning turbo mode ON');
          await device.set_turbo_mode(true);
          break;

        case 'set-turbo-off':
          console.log('🚀 Turning turbo mode OFF');
          await device.set_turbo_mode(false);
          break;

        case 'set-comfort-on':
          console.log('😴 Turning comfort mode ON');
          await device.set_comfort_mode(true);
          break;

                case 'set-comfort-off':
          console.log('😴 Turning comfort mode OFF');
          await device.set_comfort_mode(false);
          break;

                // Sound mode commands have been removed as requested

        default:
          console.error(`❌ Unknown command: ${command}`);
          console.log('Available commands:');
          console.log('  power-on, power-off');
          console.log('  set-cool, set-heat, set-auto, set-fan-only, set-dry');
          console.log('  set-temp-22, set-temp-24');
          console.log('  set-fan-auto, set-fan-high, set-fan-medium, set-fan-low');
          console.log('  set-swing-auto, set-swing-off, set-swing-up, set-swing-down');
          console.log('  set-swing-pos1, set-swing-pos2, set-swing-pos3');
          console.log('  set-tilt-angle [angle] (e.g., set-tilt-angle 45)');
          console.log('  set-light-on, set-light-off');
          console.log('  set-health-on, set-health-off');
          console.log('  set-quiet-on, set-quiet-off');
          console.log('  set-turbo-on, set-turbo-off');
          console.log('  set-comfort-on, set-comfort-off');
          return false;
      }

      console.log(`\n✅ Command "${command}" executed successfully`);
      return true;
    } catch (error) {
      console.error(`\n❌ Failed to execute command "${command}":`, error);
      return false;
    }
  }

  async run(command) {
    console.log('🚀 Starting AC control test...');

    const setupSuccess = await this.setup();
    if (!setupSuccess) {
      console.error('❌ Setup failed, aborting test');
      return false;
    }

    // Execute the specified command
    const result = await this.runCommand(command, 0);

    // Keep connection open for a bit to receive WebSocket updates
    console.log('\n🔄 Waiting for WebSocket updates (10 seconds)...');
    console.log('   This allows time to see status updates coming back from the device');

    // Display a countdown
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`   Remaining: ${i} seconds...${i > 1 ? '\r' : '\n'}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return result;
  }
}

// Parse command line arguments
const command = process.argv[2] || 'power-on';

// Run the test
const tester = new ACControlTester(TEST_CONFIG);
tester.run(command)
  .then(success => {
    console.log(`\n🏁 Test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test execution error:', error);
    process.exit(1);
  });
