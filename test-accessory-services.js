#!/usr/bin/env node

// Standalone tests for accessory service creation/removal on restore

const { HaierEvoAccessory } = require('./dist/accessories/haier-evo-accessory');
const fs = require('fs');
const path = require('path');

function loadJSON(relPath) {
  const abs = path.join(__dirname, relPath);
  const raw = fs.readFileSync(abs, 'utf8');
  const stripped = raw.replace(/^Full status response:\s*/, '');
  try {
    return JSON.parse(stripped);
  } catch (err) {
    // Some captured files may contain unescaped control characters inside strings.
    // For our tests we don't rely on full payload; fallback to minimal object.
    return {};
  }
}

function createMockPlatform({ config, data }) {
  const Service = {
    AccessoryInformation: 'AccessoryInformation',
    HeaterCooler: 'HeaterCooler',
    Switch: 'Switch',
    TemperatureSensor: 'TemperatureSensor',
    Fanv2: 'Fanv2',
    Lightbulb: 'Lightbulb',
    ContactSensor: 'ContactSensor'
  };

  const Characteristic = {
    Active: { ACTIVE: 1, INACTIVE: 0 },
    CurrentHeaterCoolerState: { INACTIVE: 0, IDLE: 1, HEATING: 2, COOLING: 3 },
    TargetHeaterCoolerState: { AUTO: 0, HEAT: 1, COOL: 2 },
    CurrentTemperature: 'CurrentTemperature',
    CoolingThresholdTemperature: 'CoolingThresholdTemperature',
    HeatingThresholdTemperature: 'HeatingThresholdTemperature',
    RotationSpeed: 'RotationSpeed',
    SwingMode: { SWING_ENABLED: 1, SWING_DISABLED: 0 },
    On: 'On',
    ContactSensorState: { CONTACT_DETECTED: 0, CONTACT_NOT_DETECTED: 1 }
  };

  const log = { debug() {}, info() {}, warn() {}, error() {} };

  const platform = {
    Service,
    Characteristic,
    log,
    getConfig: () => config,
    getHaierAPI: () => ({
      on: () => {},
      ensureValidToken: async () => {},
      getDeviceStatus: async () => (data || {}),
      setDeviceProperty: async () => {}
    }),
    updatePlatformAccessory: () => {},
  };

  return platform;
}

function createMockAccessory(name = 'Test Device') {
  const services = [];

  function addService(type, displayName, subtype) {
    const svc = {
      type,
      displayName,
      subtype,
      getCharacteristic: () => ({
        onGet: () => ({ onSet: () => ({ setProps: () => ({}) }) }),
        updateValue: function() { return this; },
        setValue: function() { return this; }
      }),
      setCharacteristic: function() { return this; },
      updateCharacteristic: function() { return this; }
    };
    services.push(svc);
    return svc;
  }

  // Seed AccessoryInformation service
  addService('AccessoryInformation', name, undefined);

  return {
    services,
    displayName: name,
    context: { device: {} },
    getService(type) { return services.find(s => s.type === type); },
    getServiceById(type, subtype) { return services.find(s => s.type === type && s.subtype === subtype); },
    addService,
    removeService(service) {
      const idx = services.indexOf(service);
      if (idx >= 0) services.splice(idx, 1);
    }
  };
}

function createDeviceInfoAC() {
  return {
    id: 'ac-acc-1',
    name: 'AC Accessory',
    type: 'air_conditioner',
    mac: '00:11:22:33:44:55',
    model: 'Mock AC',
    status: 1,
    attributes: []
  };
}

function createDeviceInfoRefrigerator() {
  return {
    id: 'rf-acc-1',
    name: 'RF Accessory',
    type: 'refrigerator',
    mac: 'aa:bb:cc:dd:ee:ff',
    model: 'Mock RF',
    status: 1,
    attributes: []
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function testCreatesServiceWhenEnabledNewAccessory() {
  const config = { enableTurboModeSwitch: true };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();

  // New accessory path
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);

  const turbo = accessory.services.find(s => s.subtype === 'turbo');
  assert(!!turbo, 'Turbo service should be created when enabled');
}

async function testAddsServiceOnRestoreWhenEnabled() {
  // First create with disabled
  let config = { enableTurboModeSwitch: false };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.services.find(s => s.subtype === 'turbo'), 'Turbo should not exist when disabled');

  // Now enable and restore (existing accessory path)
  platform.getConfig = () => ({ enableTurboModeSwitch: true });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.services.find(s => s.subtype === 'turbo'), 'Turbo should be added on restore when enabled');
}

async function testRemovesServiceOnRestoreWhenDisabled() {
  // First create with enabled
  let config = { enableTurboModeSwitch: true };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.services.find(s => s.subtype === 'turbo'), 'Turbo should exist when enabled');

  // Disable and restore
  platform.getConfig = () => ({ enableTurboModeSwitch: false });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.services.find(s => s.subtype === 'turbo'), 'Turbo should be removed on restore when disabled');
}

async function testRefrigeratorNewHasServices() {
  const rfData = loadJSON('tests/refrigerator.data');
  const platform = createMockPlatform({ config: {}, data: rfData });
  const accessory = createMockAccessory('RF Accessory');
  const deviceInfo = createDeviceInfoRefrigerator();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('TemperatureSensor', 'ambient-temp'), 'ambient-temp sensor should exist');
  assert(!!accessory.getServiceById('TemperatureSensor', 'freezer-temp'), 'freezer-temp sensor should exist');
  assert(!!accessory.getServiceById('ContactSensor', 'refrigerator-door'), 'refrigerator-door sensor should exist');
  assert(!!accessory.getServiceById('ContactSensor', 'freezer-door'), 'freezer-door sensor should exist');
  // myzone may be optional per model; do not hard-fail
}

async function testAddsFanServiceOnRestoreWhenEnabled() {
  // Start disabled
  const configDisabled = { enableFanService: false };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config: configDisabled, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.getServiceById('Fanv2', 'fan'), 'Fan should not exist when disabled');

  // Enable and restore
  platform.getConfig = () => ({ enableFanService: true });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('Fanv2', 'fan'), 'Fan should be added on restore when enabled');
}

async function testRemovesFanServiceOnRestoreWhenDisabled() {
  // Start enabled
  const configEnabled = { enableFanService: true };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config: configEnabled, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('Fanv2', 'fan'), 'Fan should exist when enabled');

  // Disable and restore
  platform.getConfig = () => ({ enableFanService: false });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.getServiceById('Fanv2', 'fan'), 'Fan should be removed on restore when disabled');
}

async function testAddsBlindsFanOnRestoreWhenEnabled() {
  const configDisabled = { enableBlindsControl: false };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config: configDisabled, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.getServiceById('Fanv2', 'blinds-fan'), 'Blinds Fan should not exist when disabled');

  platform.getConfig = () => ({ enableBlindsControl: true });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('Fanv2', 'blinds-fan'), 'Blinds Fan should be added on restore when enabled');
}

async function testRemovesBlindsFanOnRestoreWhenDisabled() {
  const configEnabled = { enableBlindsControl: true };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config: configEnabled, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('Fanv2', 'blinds-fan'), 'Blinds Fan should exist when enabled');

  platform.getConfig = () => ({ enableBlindsControl: false });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.getServiceById('Fanv2', 'blinds-fan'), 'Blinds Fan should be removed on restore when disabled');
}

async function testAddsQuietOnRestoreWhenEnabled() {
  const configDisabled = { enableQuietModeSwitch: false };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config: configDisabled, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.getServiceById('Switch', 'quiet'), 'Quiet switch should not exist when disabled');

  platform.getConfig = () => ({ enableQuietModeSwitch: true });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('Switch', 'quiet'), 'Quiet switch should be added on restore when enabled');
}

async function testRemovesQuietOnRestoreWhenDisabled() {
  const configEnabled = { enableQuietModeSwitch: true };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config: configEnabled, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('Switch', 'quiet'), 'Quiet switch should exist when enabled');

  platform.getConfig = () => ({ enableQuietModeSwitch: false });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.getServiceById('Switch', 'quiet'), 'Quiet switch should be removed on restore when disabled');
}

async function testAddsBlindsAutoOnRestoreWhenEnabled() {
  const configDisabled = { enableBlindsAutoSwitch: false };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config: configDisabled, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.getServiceById('Switch', 'blinds-auto'), 'Blinds Auto should not exist when disabled');

  platform.getConfig = () => ({ enableBlindsAutoSwitch: true });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('Switch', 'blinds-auto'), 'Blinds Auto should be added on restore when enabled');
}

async function testRemovesBlindsAutoOnRestoreWhenDisabled() {
  const configEnabled = { enableBlindsAutoSwitch: true };
  const acData = loadJSON('tests/ac.data');
  const platform = createMockPlatform({ config: configEnabled, data: acData });
  const accessory = createMockAccessory('AC Accessory');
  const deviceInfo = createDeviceInfoAC();
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!!accessory.getServiceById('Switch', 'blinds-auto'), 'Blinds Auto should exist when enabled');

  platform.getConfig = () => ({ enableBlindsAutoSwitch: false });
  // eslint-disable-next-line no-new
  new HaierEvoAccessory(platform, accessory, deviceInfo);
  assert(!accessory.getServiceById('Switch', 'blinds-auto'), 'Blinds Auto should be removed on restore when disabled');
}

async function run() {
  const tests = [
    { name: 'Creates service when enabled (new accessory)', fn: testCreatesServiceWhenEnabledNewAccessory },
    { name: 'Adds service on restore when enabled', fn: testAddsServiceOnRestoreWhenEnabled },
    { name: 'Removes service on restore when disabled', fn: testRemovesServiceOnRestoreWhenDisabled },
    { name: 'Adds Fan on restore when enabled', fn: testAddsFanServiceOnRestoreWhenEnabled },
    { name: 'Removes Fan on restore when disabled', fn: testRemovesFanServiceOnRestoreWhenDisabled },
    { name: 'Adds Blinds Fan on restore when enabled', fn: testAddsBlindsFanOnRestoreWhenEnabled },
    { name: 'Removes Blinds Fan on restore when disabled', fn: testRemovesBlindsFanOnRestoreWhenDisabled },
    { name: 'Adds Quiet on restore when enabled', fn: testAddsQuietOnRestoreWhenEnabled },
    { name: 'Removes Quiet on restore when disabled', fn: testRemovesQuietOnRestoreWhenDisabled },
    { name: 'Adds Blinds Auto on restore when enabled', fn: testAddsBlindsAutoOnRestoreWhenEnabled },
    { name: 'Removes Blinds Auto on restore when disabled', fn: testRemovesBlindsAutoOnRestoreWhenDisabled },
    { name: 'Refrigerator services present on new accessory from data', fn: testRefrigeratorNewHasServices },
    { name: 'Refrigerator door/contact services present', fn: testRefrigeratorNewHasServices }
  ];

  let passed = 0;
  console.log('\n🧪 Accessory Service Creation/Removal Tests');
  console.log('----------------------------------------');
  for (const t of tests) {
    process.stdout.write(`Running: ${t.name} ... `);
    try {
      // eslint-disable-next-line no-await-in-loop
      await t.fn();
      console.log('✅');
      passed += 1;
    } catch (e) {
      console.log('❌');
      console.error('   Error:', e.message);
      process.exitCode = 1;
    }
  }
  console.log(`\nSummary: ${passed}/${tests.length} passed`);
  if (passed !== tests.length) process.exit(1);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});


