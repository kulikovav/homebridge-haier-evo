export const mockAuthResponse = {
  data: {
    token: {
      accessToken: 'mock-access-token-123',
      refreshToken: 'mock-refresh-token-456',
      expire: '2024-12-31T23:59:59+00:00',
      refreshExpire: '2024-12-31T23:59:59+00:00'
    }
  },
  error: null
};

export const mockDevicesResponse = {
  data: [
    {
      id: 'ac-device-1',
      name: 'Living Room AC',
      type: 'air_conditioner',
      model: 'AS35S2SF2FA',
      mac: 'AA:BB:CC:DD:EE:01',
      status: 1,
      attributes: [
        { name: 'current_temperature', id: 'temp_current', value: 22 },
        { name: 'target_temperature', id: 'temp_target', value: 24 },
        { name: 'mode', id: 'mode', value: '1' },
        { name: 'fan_mode', id: 'fan', value: '5' }
      ]
    },
    {
      id: 'fridge-device-1',
      name: 'Kitchen Fridge',
      type: 'refrigerator',
      model: 'HEC07HRC03R',
      mac: 'AA:BB:CC:DD:EE:02',
      status: 1,
      attributes: [
        { name: 'current_temperature', id: 'temp_current', value: 4 },
        { name: 'target_temperature', id: 'temp_target', value: 4 },
        { name: 'eco_mode', id: 'eco', value: '0' }
      ]
    }
  ],
  error: null
};

export const mockDeviceStatus = {
  data: {
    current_temperature: 22,
    target_temperature: 24,
    status: 1,
    mode: '1',
    fan_mode: '5',
    swing_mode: '0',
    swing_horizontal_mode: '8',
    quiet: false,
    turbo: false,
    comfort: true,
    health: false,
    light: true,
    sound: false
  },
  error: null
};

export const mockWebSocketMessage = {
  type: 'device_status_update',
  data: {
    deviceId: 'ac-device-1',
    status: {
      current_temperature: 23,
      target_temperature: 24,
      mode: '1'
    }
  }
};

export const mockCommandResponse = {
  type: 'device_command_response',
  data: {
    deviceId: 'ac-device-1',
    command: { type: 'set_temperature', temperature: 25 },
    success: true,
    timestamp: Date.now()
  }
};

export const mockErrorResponse = {
  error: {
    message: 'Authentication failed',
    code: 'AUTH_ERROR'
  }
};
