import { validateConfig } from '../../src/settings';

describe('settings', () => {
  describe('validateConfig', () => {
    it('should validate successfully with minimum required fields', () => {
      const config = {
        email: 'test@example.com',
        password: 'password123',
        region: 'ru',
      };

      const result = validateConfig(config);

      expect(result).toMatchObject({
        ...config,
        name: 'Haier Evo', // default value
      });
    });

    it('should validate successfully with all optional fields', () => {
      const config = {
        platform: 'homebridge-haier-evo',
        name: 'My Custom Evo',
        email: 'test@example.com',
        password: 'password123',
        region: 'kz',
        refreshInterval: 600,
        debug: true,
        deviceCacheTTL: 3600,
        requestRandomization: true,
        minRequestDelay: 100,
        maxRequestDelay: 1000,
        tokenRefreshMode: 'auto',
        tokenRefreshInterval: 3600,
        tokenRefreshThreshold: 600,
        batchTimeout: 100,
        includeDevices: ['dev1'],
        excludeDevices: ['dev2'],
        includeDeviceTypes: ['type1'],
        excludeDeviceTypes: ['type2'],
        includeNamePattern: '^my.*',
        excludeNamePattern: '.*old$',
        enableFanService: true,
        enableBlindsControl: true,
        enableBlindsAutoSwitch: false,
        enableBlindsComfortSwitch: false,
        enableLightControl: true,
        enableHealthModeSwitch: true,
        enableQuietModeSwitch: true,
        enableTurboModeSwitch: true,
        enableComfortModeSwitch: true,
        temperatureEventInterval: 60000,
        temperatureEventForcePublish: true,
        temperatureEventMinDelta: 0.5,
        temperatureEventJitter: 5000,
        deviceId: '12345',
      };

      const result = validateConfig(config);
      expect(result).toEqual(config);
    });

    it('should throw an error for missing required fields', () => {
      const config = {
        password: 'password123',
        region: 'ru',
      };

      expect(() => validateConfig(config)).toThrow(/Invalid plugin configuration: email: Invalid input: expected string, received undefined/);

      expect(() => validateConfig({ email: 'test@test.com', region: 'ru' })).toThrow(/Invalid plugin configuration: password: Invalid input: expected string, received undefined/);

      expect(() => validateConfig({ email: 'test@test.com', password: 'abc' })).toThrow(/Invalid plugin configuration: region: Invalid option: expected one of \"ru\"|\"kz\"|\"by\"/);
    });

    it('should throw an error for invalid types', () => {
      const config = {
        email: 'not-an-email',
        password: 'password123',
        region: 'ru',
      };

      expect(() => validateConfig(config)).toThrow(/Invalid plugin configuration: email: Email must be a valid email address/);

      const configWithInvalidInterval = {
        email: 'test@example.com',
        password: 'password123',
        region: 'ru',
        refreshInterval: '600' // should be a number
      };
      expect(() => validateConfig(configWithInvalidInterval)).toThrow(/Invalid plugin configuration: refreshInterval: Invalid input: expected number, received string/);
    });

    it('should throw an error for invalid enum values', () => {
      const config = {
        email: 'test@example.com',
        password: 'password123',
        region: 'invalid_region',
      };

      // Since VALID_REGIONS is ['ru', 'kz', 'by'], error should list these
      expect(() => validateConfig(config)).toThrow(/Invalid plugin configuration: region: Invalid option: expected one of \"ru\"|\"kz\"|\"by\"/);
    });

    it('should throw an error for extra unexpected properties due to strict mode', () => {
      const config = {
        email: 'test@example.com',
        password: 'password123',
        region: 'ru',
        unexpected_field: 'should_fail',
      };

      expect(() => validateConfig(config)).toThrow(/Invalid plugin configuration: \(root\): Unrecognized key: \"unexpected_field\"/);
    });

    it('should correctly format the error message with multiple issues', () => {
      const config = {
        email: 'invalid-email',
        // missing password
        region: 'invalid-region',
        refreshInterval: 100, // too low
      };

      expect(() => validateConfig(config)).toThrow(/Invalid plugin configuration:/);

      try {
        validateConfig(config);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toContain('email: Email must be a valid email address');
        expect(msg).toContain('password: Invalid input: expected string, received undefined');
        expect(msg).toContain('region: Invalid option: expected one of \"ru\"|\"kz\"|\"by\"');
        expect(msg).toContain('refreshInterval: Too small: expected number to be >=300');
      }
    });
  });
});
