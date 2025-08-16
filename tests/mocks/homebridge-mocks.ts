import { EventEmitter } from 'events';

export const mockService = {
  getCharacteristic: jest.fn(() => ({
    onGet: jest.fn().mockReturnThis(),
    onSet: jest.fn().mockReturnThis(),
    setProps: jest.fn().mockReturnThis(),
    updateValue: jest.fn().mockReturnThis(),
    updateCharacteristic: jest.fn().mockReturnThis(),
  })),
  addCharacteristic: jest.fn().mockReturnThis(),
  updateCharacteristic: jest.fn().mockReturnThis(),
  setCharacteristic: jest.fn().mockReturnThis(),
};

export const mockCharacteristic = {
  ON: 1,
  OFF: 0,
  HEAT: 1,
  COOL: 2,
  AUTO: 3,
  CurrentHeatingCoolingState: {
    OFF: 0,
    HEAT: 1,
    COOL: 2,
  },
  TargetHeatingCoolingState: {
    OFF: 0,
    HEAT: 1,
    COOL: 2,
    AUTO: 3,
  },
  TemperatureDisplayUnits: {
    CELSIUS: 0,
    FAHRENHEIT: 1,
  },
};

export const mockPlatformAccessory = {
  UUID: 'test-uuid-123',
  displayName: 'Test Device',
  context: {},
  getService: jest.fn(() => mockService),
  addService: jest.fn(() => mockService),
  removeService: jest.fn(),
  updateCharacteristic: jest.fn(),
};

export const mockAPI = {
  version: '1.6.1',
  serverVersion: '1.6.1',
  user: 'test-user',
  hapLegacyTypes: false,
  hap: {
    Service: {
      AccessoryInformation: 'AccessoryInformation',
      Thermostat: 'Thermostat',
      Switch: 'Switch',
      TemperatureSensor: 'TemperatureSensor',
      Fanv2: 'Fanv2',
      Lightbulb: 'Lightbulb',
    },
    Characteristic: mockCharacteristic,
    uuid: {
      generate: jest.fn(() => 'test-uuid-123'),
    },
  },
  platformAccessory: jest.fn(() => mockPlatformAccessory),
  registerPlatformAccessories: jest.fn(),
  unregisterPlatformAccessories: jest.fn(),
  updatePlatformAccessories: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
  once: jest.fn(),
  removeAllListeners: jest.fn(),
  removeListener: jest.fn(),
  listeners: jest.fn(),
  listenerCount: jest.fn(),
  eventNames: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  getMaxListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  rawListeners: jest.fn(),
  addListener: jest.fn(),
};

export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

export const mockPlatformConfig = {
  platform: 'HaierEvo', // Add required platform property
  name: 'Test Platform',
  email: 'test@example.com',
  password: 'testpassword',
  region: 'ru',
  refreshInterval: 300,
  debug: false,
};

export const mockDynamicPlatformPlugin = {
  accessories: [mockPlatformAccessory],
  on: jest.fn(),
  emit: jest.fn(),
  configureAccessory: jest.fn(), // Add the missing method
  removeAllListeners: jest.fn(),
  removeListener: jest.fn(),
  listeners: jest.fn(),
  listenerCount: jest.fn(),
  eventNames: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  getMaxListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  rawListeners: jest.fn(),
  addListener: jest.fn(),
};

export const createMockService = (serviceType: string, displayName: string, subType?: string) => ({
  ...mockService,
  serviceType,
  displayName,
  subType,
});

export const createMockCharacteristic = (characteristicType: string) => ({
  ...mockCharacteristic,
  characteristicType,
  value: null,
  onGet: jest.fn().mockReturnThis(),
  onSet: jest.fn().mockReturnThis(),
  setProps: jest.fn().mockReturnThis(),
  updateValue: jest.fn().mockReturnThis(),
  updateCharacteristic: jest.fn().mockReturnThis(),
});
