// Test setup file
import 'jest';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock setTimeout and setInterval with proper typing and mock property
const mockTimeout = jest.fn((callback: any, delay: any) => {
  return 123 as any;
});

const mockInterval = jest.fn((callback: any, delay: any) => {
  return 456 as any;
});

const mockClearTimeout = jest.fn();
const mockClearInterval = jest.fn();

// Assign to global with proper typing and ensure mock property is accessible
(global as any).setTimeout = mockTimeout;
(global as any).setInterval = mockInterval;
(global as any).clearTimeout = mockClearTimeout;
(global as any).clearInterval = mockClearInterval;

// Mock EventEmitter
jest.mock('events', () => {
  const EventEmitter = jest.requireActual('events').EventEmitter;
  return {
    EventEmitter,
    once: jest.fn(),
  };
});

// Mock WebSocket
jest.mock('ws', () => {
  return jest.requireActual('mock-socket');
});

// Mock axios
jest.mock('axios', () => {
  return {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      get: jest.fn(),
      post: jest.fn(),
    })),
  };
});

// Global test utilities with proper typing
(global as any).testUtils = {
  createMockDevice: (overrides = {}) => ({
    id: 'test-device-1',
    name: 'Test Air Conditioner',
    type: 'air_conditioner',
    model: 'TEST-AC-001',
    mac: 'AA:BB:CC:DD:EE:FF',
    status: 1,
    attributes: [],
    ...overrides,
  }),

  createMockStatus: (overrides = {}) => ({
    current_temperature: 22,
    target_temperature: 24,
    status: 1,
    mode: 'cool',
    fan_mode: 'auto',
    swing_mode: 'off',
    swing_horizontal_mode: 'auto',
    ...overrides,
  }),

  createMockConfig: (overrides = {}) => ({
    name: 'Test Platform',
    email: 'test@example.com',
    password: 'testpassword',
    region: 'ru',
    refreshInterval: 300,
    debug: false,
    ...overrides,
  }),

  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  createMockLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
};
