import {
  API_PATH,
  API_LOGIN,
  HVAC_MODES,
  FAN_MODES,
  SWING_MODES
} from '../../src/constants';

describe('Constants', () => {
  describe('API endpoints', () => {
    it('should have correct API base path', () => {
      expect(API_PATH).toBe('https://evo.haieronline.ru');
    });

    it('should have correct login endpoint template', () => {
      expect(API_LOGIN).toBe('v2/{region}/users/auth/sign-in');
    });

    it('should replace region placeholder in login endpoint', () => {
      const endpoint = API_LOGIN.replace('{region}', 'ru');
      expect(endpoint).toBe('v2/ru/users/auth/sign-in');
    });
  });

  describe('HVAC Modes', () => {
    it('should have correct mode mappings', () => {
      expect(HVAC_MODES['0']).toBe('auto');
      expect(HVAC_MODES['1']).toBe('cool');
      expect(HVAC_MODES['2']).toBe('dry');
      expect(HVAC_MODES['4']).toBe('heat');
      expect(HVAC_MODES['6']).toBe('fan_only');
    });

    it('should have all required modes', () => {
      const modes = Object.values(HVAC_MODES);
      expect(modes).toContain('auto');
      expect(modes).toContain('cool');
      expect(modes).toContain('heat');
      expect(modes).toContain('dry');
      expect(modes).toContain('fan_only');
    });
  });

  describe('Fan Modes', () => {
    it('should have correct fan mode mappings', () => {
      expect(FAN_MODES['1']).toBe('high');
      expect(FAN_MODES['2']).toBe('medium');
      expect(FAN_MODES['3']).toBe('low');
      expect(FAN_MODES['5']).toBe('auto');
    });

    it('should have all required fan modes', () => {
      const modes = Object.values(FAN_MODES);
      expect(modes).toContain('high');
      expect(modes).toContain('medium');
      expect(modes).toContain('low');
      expect(modes).toContain('auto');
    });
  });

  describe('Swing Modes', () => {
    it('should have correct swing mode mappings', () => {
      expect(SWING_MODES['0']).toBe('off');
      expect(SWING_MODES['1']).toBe('upper');
      expect(SWING_MODES['8']).toBe('auto');
    });

    it('should have all required swing modes', () => {
      const modes = Object.values(SWING_MODES);
      expect(modes).toContain('off');
      expect(modes).toContain('upper');
      expect(modes).toContain('auto');
    });
  });

});
