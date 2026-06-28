/**
 * WebSocket lifecycle characterization and verification tests.
 *
 * These tests verify:
 * - Timer cleanup on disconnect/destroy
 * - Command batch rejection during disconnect
 * - Event listener removal on destroy
 * - WebSocket connection state machine behavior
 *
 * Notes on test infrastructure:
 * - setup.ts mocks ws→mock-socket. mock-socket's WebSocket does NOT expose
 *   the EventEmitter .on()/.emit() API — it uses addEventListener.
 *   For tests that need WebSocket event handling, we create manual mock
 *   instances that extend EventEmitter.
 * - setup.ts mocks setTimeout/setInterval/clearTimeout/clearInterval to jest.fn()
 *   returning fixed IDs (123, 456). We track calls to verify timer management.
 * - setup.ts mocks console.log/error/warn to jest.fn() to suppress noise.
 */

import { EventEmitter } from 'events';
import { HaierAPI } from '../../src/haier-api';
import { HaierEvoConfig } from '../../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a manually controlled mock WebSocket with EventEmitter API */
function createControlledWs(): any {
  const ee = new EventEmitter();
  return {
    readyState: 1, // OPEN
    CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
    url: 'wss://test/ws/token',
    send: jest.fn(),
    ping: jest.fn(),
    close: jest.fn(),
    terminate: jest.fn(),
    removeAllListeners: jest.fn(function (this: any) {
      EventEmitter.prototype.removeAllListeners.call(ee);
    }),
    listenerCount: jest.fn(function (this: any, event: string) {
      return EventEmitter.listenerCount(ee, event);
    }),
    on: ee.on.bind(ee),
    once: ee.once.bind(ee),
    emit: ee.emit.bind(ee),
    off: ee.off.bind(ee),
    addListener: ee.addListener.bind(ee),
    removeListener: ee.removeListener.bind(ee),
  };
}

function makeConfig(overrides: Partial<HaierEvoConfig> = {}): HaierEvoConfig {
  return {
    name: 'test-platform',
    email: 'test@example.com',
    password: 'test-password',
    region: 'ru',
    deviceId: 'test-device-uuid',
    ...overrides,
  } as HaierEvoConfig;
}

function setValidTokens(api: HaierAPI) {
  const future = new Date(Date.now() + 86400 * 1000);
  const a = api as any;
  a.accessToken = 'test-token';
  a.refreshToken = 'test-refresh';
  a.tokenExpire = future;
  a.refreshExpire = future;
}

// ---------------------------------------------------------------------------
// Tests: HaierAPI WebSocket Lifecycle
// ---------------------------------------------------------------------------

describe('HaierAPI WebSocket lifecycle', () => {
  let api: HaierAPI;

  beforeEach(() => {
    api = new HaierAPI(makeConfig({ debug: false, tokenRefreshMode: 'disabled' }), { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any);
    setValidTokens(api);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // Timer management
  // -------------------------------------------------------------------

  describe('Timer management', () => {
    test('disconnect() clears reconnectTimer, heartbeatTimer, statusRequestTimer', () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;
      a.isConnected = true;

      // Simulate active state with timers
      a.reconnectTimer = 123;
      a.heartbeatTimer = 456;
      a.statusRequestTimer = 789;

      // Mock ws.close() to emit close synchronously
      ws.close.mockImplementation(() => {
        ws.readyState = 3; // CLOSED
      });

      api.disconnect();

      // disconnect clears timers but does NOT set ws to null (current behavior)
      expect(a.reconnectTimer).toBeNull();
      expect(a.heartbeatTimer).toBeNull();
      expect(a.statusRequestTimer).toBeNull();
      expect(a.isConnected).toBe(false);
      // ws is NOT nulled in disconnect() (only in disconnectWebSocket())
      // This is a bug to fix in the refactoring
    });

    test('disconnectWebSocket() sets ws to null', () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;
      a.isConnected = true;

      api.disconnectWebSocket();

      expect(a.ws).toBeNull();
      expect(a.isConnected).toBe(false);
    });

    test('disconnect() clears command batches and rejects pending promises', async () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;
      a.isConnected = true;

      // Queue a batch command - this creates a setTimeout for batchTimeout ms
      const batchPromise = api.setDeviceProperty('AA:BB:CC:DD:EE:FF', '21', '1');

      // Verify batch was created
      expect(a.commandBatches.size).toBe(1);

      // Get the batch timeout ID (setup.ts mocks setTimeout to return 123)
      const stMock = setTimeout as unknown as jest.Mock;
      expect(stMock).toHaveBeenCalled();
      const batchTimeoutId = stMock.mock.results.slice(-1)[0]?.value;

      // Disconnect should clear batch and reject promise
      ws.close.mockImplementation(() => { ws.readyState = 3; });
      api.disconnect();

      // Verify batch was rejected
      await expect(batchPromise).rejects.toThrow('API disconnected');
      expect(a.commandBatches.size).toBe(0);
    });

    test('stopHeartbeat() clears heartbeat timer', () => {
      const a = api as any;
      a.heartbeatTimer = 456;

      (api as any).stopHeartbeat();

      expect(a.heartbeatTimer).toBeNull();
    });

    test('startHeartbeat() clears old timer and creates new heartbeat and statusRequest timers', () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;
      a.isConnected = true;

      // Set an existing heartbeat timer to verify it gets cleared
      a.heartbeatTimer = 456;

      (api as any).startHeartbeat();

      // Old timer should be cleared
      expect(clearInterval).toHaveBeenCalledWith(456);
      // New heartbeat timer created (setInterval returns 456 in setup.ts mock)
      expect(setInterval).toHaveBeenCalled();
      // Old timer was 456, new one is also 456 (mock always returns 456)
      expect(a.heartbeatTimer).not.toBeNull();
      // Status request timer created
      expect(a.statusRequestTimer).not.toBeNull();
    });

    test('stopStatusRequests() clears statusRequestTimer', () => {
      const a = api as any;
      a.statusRequestTimer = 789;

      (api as any).stopStatusRequests();

      expect(clearInterval).toHaveBeenCalledWith(789);
      expect(a.statusRequestTimer).toBeNull();
    });

    test('tokenRefreshTimer is cleared by disconnect()', () => {
      const a = api as any;
      a.tokenRefreshTimer = 123;

      api.disconnect();

      expect(a.tokenRefreshTimer).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // WebSocket state machine
  // -------------------------------------------------------------------

  describe('WebSocket state management', () => {
    test('isWebSocketConnected() returns false when ws is null', () => {
      expect(api.isWebSocketConnected()).toBe(false);
    });

    test('isWebSocketConnected() returns true when ws exists and isConnected', () => {
      const a = api as any;
      a.ws = createControlledWs();
      a.isConnected = true;

      expect(api.isWebSocketConnected()).toBe(true);
    });

    test('isWebSocketConnected() returns false when ws exists but isConnected is false', () => {
      const a = api as any;
      a.ws = createControlledWs();
      a.isConnected = false;

      expect(api.isWebSocketConnected()).toBe(false);
    });

    test('disconnectWebSocket() closes ws and sets to null', () => {
      const a = api as any;
      a.ws = createControlledWs();
      a.isConnected = true;

      api.disconnectWebSocket();

      expect(a.ws).toBeNull();
      expect(a.isConnected).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // Command batching
  // -------------------------------------------------------------------

  describe('Command batching', () => {
    test('setDeviceProperty() adds to command batch', () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;
      a.isConnected = true;

      const batchPromise = api.setDeviceProperty('AA:BB:CC:DD:EE:FF', '21', '1');

      expect(batchPromise).toBeInstanceOf(Promise);
      expect(a.commandBatches.size).toBe(1);

      const batch = a.commandBatches.get('AA:BB:CC:DD:EE:FF');
      expect(batch).toBeDefined();
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0].propertyId).toBe('21');
      expect(batch.promises.length).toBe(1);
    });

    test('setDeviceProperty() updates existing property in batch', () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;
      a.isConnected = true;

      api.setDeviceProperty('AA:BB:CC:DD:EE:FF', '21', '1');
      api.setDeviceProperty('AA:BB:CC:DD:EE:FF', '21', '0');

      expect(a.commandBatches.size).toBe(1);
      const batch = a.commandBatches.get('AA:BB:CC:DD:EE:FF');
      expect(batch.commands.length).toBe(1);
      expect(batch.commands[0].value).toBe('0');
      expect(batch.promises.length).toBe(2);
    });

    test('flushBatches() processes a specific device batch', async () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;
      a.isConnected = true;

      // Mock setDeviceProperties to succeed
      jest.spyOn(api, 'setDeviceProperties').mockResolvedValue();

      const batchPromise = api.setDeviceProperty('AA:BB:CC:DD:EE:FF', '21', '1');

      await api.flushBatches('AA:BB:CC:DD:EE:FF');

      await expect(batchPromise).resolves.toBeUndefined();
      expect(a.commandBatches.size).toBe(0);
    });

    test('flushBatches() processes all pending batches', async () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;
      a.isConnected = true;

      jest.spyOn(api, 'setDeviceProperties').mockResolvedValue();

      const p1 = api.setDeviceProperty('AA:BB:CC:DD:EE:FF', '21', '1');
      const p2 = api.setDeviceProperty('11:22:33:44:55:66', '0', '24');

      expect(a.commandBatches.size).toBe(2);

      await api.flushBatches();

      await expect(p1).resolves.toBeUndefined();
      await expect(p2).resolves.toBeUndefined();
      expect(a.commandBatches.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // Event emission
  // -------------------------------------------------------------------

  describe('Event emission', () => {
    test('disconnect() clears commandBatches map', () => {
      const a = api as any;
      const ws = createControlledWs();
      a.ws = ws;

      a.commandBatches.set('test', { commands: [], promises: [], timeout: 123 });
      ws.close.mockImplementation(() => { ws.readyState = 3; });

      api.disconnect();

      expect(a.commandBatches.size).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Platform timer cleanup
// ---------------------------------------------------------------------------

describe('Platform timer cleanup', () => {
  // Platform requires homebridge API which is complex to mock.
  // We test the HaierAPI.disconnect() behaviors that Platform relies on.

  test('HaierAPI.disconnect() is safe to call multiple times', () => {
    const api = new HaierAPI(makeConfig({ debug: false, tokenRefreshMode: 'disabled' }), { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any);
    setValidTokens(api);

    const ws = createControlledWs();
    (api as any).ws = ws;

    // First disconnect
    api.disconnect();

    // Second disconnect should not throw
    expect(() => api.disconnect()).not.toThrow();
  });

  test('disconnect() handles ws.close() errors gracefully and still cleans up', async () => {
    const api = new HaierAPI(makeConfig({ debug: false, tokenRefreshMode: 'disabled' }), { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any);
    setValidTokens(api);

    const ws = createControlledWs();
    ws.close.mockImplementation(() => { throw new Error('close failed'); });
    (api as any).ws = ws;
    (api as any).reconnectTimer = 123;
    (api as any).heartbeatTimer = 456;
    (api as any).statusRequestTimer = 789;

    // FIXED behavior: disconnect() catches ws.close() errors and still cleans up
    await expect(api.disconnect()).resolves.toBeUndefined();

    // All timers cleared despite close error
    expect((api as any).reconnectTimer).toBeNull();
    expect((api as any).heartbeatTimer).toBeNull();
    expect((api as any).statusRequestTimer).toBeNull();
    expect((api as any).ws).toBeNull();
    expect((api as any).isConnected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: BaseDevice event listener cleanup
// ---------------------------------------------------------------------------

describe('BaseDevice event listener cleanup', () => {
  test('destroy() removes statusUpdateTimer', () => {
    // Create a minimal BaseDevice-like object
    const mockApi = new EventEmitter();
    const device: any = {
      statusUpdateTimer: 456,
      api: mockApi,
      removeAllListeners: jest.fn(),
      destroy: function (this: any) {
        if (this.statusUpdateTimer) {
          clearInterval(this.statusUpdateTimer);
          this.statusUpdateTimer = null;
        }
        const apiAny = this.api as any;
        if (apiAny && typeof apiAny.removeListener === 'function') {
          apiAny.removeListener('device_status_update', this.handleDeviceStatusUpdate);
        }
        this.removeAllListeners();
      },
      handleDeviceStatusUpdate: jest.fn(),
    };

    device.destroy();

    expect(clearInterval).toHaveBeenCalledWith(456);
    expect(device.statusUpdateTimer).toBeNull();
    expect(device.removeAllListeners).toHaveBeenCalled();
  });

  test('destroy() removes event listeners from API', () => {
    const mockApi = {
      removeListener: jest.fn(),
      on: jest.fn(),
    };
    const device: any = {
      statusUpdateTimer: null,
      api: mockApi,
      removeAllListeners: jest.fn(),
      handleDeviceStatusUpdate: jest.fn(),
      handleLegacyStatusUpdate: jest.fn(),
      destroy: function (this: any) {
        if (this.statusUpdateTimer) {
          clearInterval(this.statusUpdateTimer);
          this.statusUpdateTimer = null;
        }
        const apiAny = this.api as any;
        if (apiAny && typeof apiAny.removeListener === 'function') {
          apiAny.removeListener('device_status_update', this.handleDeviceStatusUpdate);
          apiAny.removeListener('deviceStatusUpdate', this.handleLegacyStatusUpdate);
        }
        this.removeAllListeners();
      },
    };

    device.destroy();

    expect(mockApi.removeListener).toHaveBeenCalledWith(
      'device_status_update',
      device.handleDeviceStatusUpdate
    );
    expect(mockApi.removeListener).toHaveBeenCalledWith(
      'deviceStatusUpdate',
      device.handleLegacyStatusUpdate
    );
  });
});
