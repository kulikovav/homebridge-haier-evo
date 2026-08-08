import {
  parseAuthToken,
  parseAuthResponse,
  parseDeviceConfig,
} from '../../src/validation';

describe('parseAuthToken', () => {
  it('should return valid AuthToken for correct input', () => {
    const input = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expire: '2023-12-31T23:59:59Z',
      refreshExpire: '2024-01-31T23:59:59Z',
    };
    const result = parseAuthToken(input);
    expect(result).toEqual(input);
  });

  it('should accept empty expire and refreshExpire strings', () => {
    const input = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expire: '',
      refreshExpire: '',
    };
    const result = parseAuthToken(input);
    expect(result).toEqual(input);
  });

  it('should return null when accessToken is missing', () => {
    const input = {
      refreshToken: 'refresh-456',
      expire: '2023-12-31T23:59:59Z',
      refreshExpire: '2024-01-31T23:59:59Z',
    };
    const result = parseAuthToken(input);
    expect(result).toBeNull();
  });

  it('should return null when accessToken is empty string', () => {
    const input = {
      accessToken: '',
      refreshToken: 'refresh-456',
      expire: '2023-12-31T23:59:59Z',
      refreshExpire: '2024-01-31T23:59:59Z',
    };
    const result = parseAuthToken(input);
    expect(result).toBeNull();
  });

  it('should return null when refreshToken is missing', () => {
    const input = {
      accessToken: 'access-123',
      expire: '2023-12-31T23:59:59Z',
      refreshExpire: '2024-01-31T23:59:59Z',
    };
    const result = parseAuthToken(input);
    expect(result).toBeNull();
  });

  it('should return null when refreshToken is empty string', () => {
    const input = {
      accessToken: 'access-123',
      refreshToken: '',
      expire: '2023-12-31T23:59:59Z',
      refreshExpire: '2024-01-31T23:59:59Z',
    };
    const result = parseAuthToken(input);
    expect(result).toBeNull();
  });

  it('should return null when expire is missing', () => {
    const input = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      refreshExpire: '2024-01-31T23:59:59Z',
    };
    const result = parseAuthToken(input);
    expect(result).toBeNull();
  });

  it('should return null when refreshExpire is missing', () => {
    const input = {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expire: '2023-12-31T23:59:59Z',
    };
    const result = parseAuthToken(input);
    expect(result).toBeNull();
  });

  it('should return null when input is not an object', () => {
    expect(parseAuthToken('string-input')).toBeNull();
    expect(parseAuthToken(123)).toBeNull();
    expect(parseAuthToken(null)).toBeNull();
    expect(parseAuthToken(undefined)).toBeNull();
  });
});

describe('parseAuthResponse', () => {
  it('should successfully parse a valid auth response', () => {
    const validRawData = {
      data: {
        token: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expire: '3600',
          refreshExpire: '86400',
        },
      },
    };
    const result = parseAuthResponse(validRawData);
    expect(result).not.toBeNull();
    expect(result?.data.token.accessToken).toBe('test-access-token');
    expect(result?.data.token.refreshToken).toBe('test-refresh-token');
    expect(result?.data.token.expire).toBe('3600');
    expect(result?.data.token.refreshExpire).toBe('86400');
  });

  it('should return null for invalid auth response (missing token fields)', () => {
    const invalidRawData = {
      data: {
        token: {
          accessToken: 'test-access-token',
        },
      },
    };
    const result = parseAuthResponse(invalidRawData);
    expect(result).toBeNull();
  });

  it('should return null for invalid auth response (wrong types)', () => {
    const invalidRawData = {
      data: {
        token: {
          accessToken: 123,
          refreshToken: 'test-refresh-token',
          expire: '3600',
          refreshExpire: '86400',
        },
      },
    };
    const result = parseAuthResponse(invalidRawData);
    expect(result).toBeNull();
  });

  it('should return null for empty object', () => {
    const result = parseAuthResponse({});
    expect(result).toBeNull();
  });

  it('should return null for null input', () => {
    const result = parseAuthResponse(null);
    expect(result).toBeNull();
  });

  it('should return null for undefined input', () => {
    const result = parseAuthResponse(undefined);
    expect(result).toBeNull();
  });

  it('should parse valid auth response and strip extra fields', () => {
    const validWithExtraFields = {
      data: {
        token: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expire: '3600',
          refreshExpire: '86400',
          extraField: 'should-be-ignored',
        },
      },
      extraOuterField: 'should-also-be-ignored',
    };
    const result = parseAuthResponse(validWithExtraFields);
    expect(result).not.toBeNull();
    expect(result?.data.token.accessToken).toBe('test-access-token');
    expect(result?.data.token).not.toHaveProperty('extraField');
    expect(result).not.toHaveProperty('extraOuterField');
  });

  it('should successfully parse valid auth response with optional error field', () => {
    const validRawDataWithError = {
      data: {
        token: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expire: '3600',
          refreshExpire: '86400',
        },
      },
      error: { code: 'some-code' },
    };
    const result = parseAuthResponse(validRawDataWithError);
    expect(result).not.toBeNull();
    expect(result?.data.token.accessToken).toBe('test-access-token');
    expect(result?.error).toEqual({ code: 'some-code' });
  });
});

describe('parseDeviceConfig', () => {
  it('should return parsed data for an empty object (minimal valid config)', () => {
    const raw = {};
    const result = parseDeviceConfig(raw);
    expect(result).toEqual({});
  });

  it('should return parsed data for a complete valid config', () => {
    const raw = {
      error: 'some error',
      info: {
        model: 'model-123',
        serialNumber: 'SN12345',
        firmware: '1.0.0',
      },
      settings: {
        firmware: { value: '1.0.0' },
        name: { name: 'My Device' },
      },
      attributes: [
        {
          name: 'attr1',
          id: 'id1',
          currentValue: 'val1',
          value: 'val1',
        },
      ],
      sensors: {
        items: [
          {
            value: {
              name: 'sensor1',
              description: 'a sensor',
            },
          },
        ],
      },
      temperature: {
        value: { name: 'temp1' },
      },
      power: {
        value: { name: 'power1' },
      },
    };
    const result = parseDeviceConfig(raw);
    expect(result).toEqual(raw);
  });

  it('should return null if invalid types are provided', () => {
    expect(parseDeviceConfig(null)).toBeNull();
    expect(parseDeviceConfig('string')).toBeNull();
    expect(parseDeviceConfig(123)).toBeNull();
    expect(parseDeviceConfig([])).toBeNull();
  });

  it('should preserve unexpected top-level properties from API responses', () => {
    const raw = {
      info: { model: 'model-123' },
      extra: 'kept for forward-compatible API responses',
    };
    const result = parseDeviceConfig(raw);
    expect(result).toEqual(raw);
  });

  it('should strip unknown nested properties on non-strict nested schemas', () => {
    const raw = {
      info: {
        model: 'model-123',
        unexpectedNested: 'stripped',
      },
    };
    const result = parseDeviceConfig(raw);
    expect(result).not.toBeNull();
    expect(result?.info).toEqual({ model: 'model-123' });
    expect(result?.info).not.toHaveProperty('unexpectedNested');
  });

  it('should return null if attributes array has invalid items', () => {
    const raw = {
      attributes: [
        {
          name: 'attr1',
        },
      ],
    };
    const result = parseDeviceConfig(raw);
    expect(result).toBeNull();
  });
});
