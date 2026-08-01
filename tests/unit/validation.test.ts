import { parseAuthToken } from '../../src/validation';

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
