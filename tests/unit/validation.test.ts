import { parseAuthResponse } from '../../src/validation';

describe('Validation Tests', () => {
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
            // missing refreshToken, expire, refreshExpire
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
            accessToken: 123, // should be string
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

    it('should parse valid auth response and ignore extra fields', () => {
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
        extraOuterField: 'should-also-be-ignored'
      };

      const result = parseAuthResponse(validWithExtraFields);
      expect(result).not.toBeNull();
      expect(result?.data.token.accessToken).toBe('test-access-token');
      // The parsed data shouldn't contain the extra fields in TypeScript type, but it might in runtime object depending on Zod configuration (strip vs strict vs passthrough). By default Zod strips extra fields.
      expect((result?.data.token as any).extraField).toBeUndefined();
      expect((result as any).extraOuterField).toBeUndefined();
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
        error: { code: 'some-code' }
      };

      const result = parseAuthResponse(validRawDataWithError);
      expect(result).not.toBeNull();
      expect(result?.data.token.accessToken).toBe('test-access-token');
      expect(result?.error).toEqual({ code: 'some-code' });
    });
  });
});
