import { ModelConfigService } from '../../src/models/model-config';

describe('ModelConfigService', () => {
  const svc = ModelConfigService.getInstance();

  test('should match HSU-09HTT103 variants by regex', () => {
    expect(svc.findDefinitionForModel('HSU-09HTT103')).toBeTruthy();
    expect(svc.findDefinitionForModel('HSU-09HTT103/R3(IN)')).toBeTruthy();
  });

  test('should return wrapper command 3 for HSU-09HTT103', () => {
    const cmd = svc.getGroupCommandNameForModel('HSU-09HTT103/R3(IN)');
    expect(cmd).toBe('3');
  });

  test('should map canonical attribute ids for HSU-09HTT103', () => {
    const model = 'HSU-09HTT103/R3(IN)';
    expect(svc.getAttributeId(model, 'current_temperature', '36')).toBe('0');
    expect(svc.getAttributeId(model, 'target_temperature', '0')).toBe('31');
    expect(svc.getAttributeId(model, 'status', '21')).toBe('21');
    expect(svc.getAttributeId(model, 'mode', '2')).toBe('5');
    expect(svc.getAttributeId(model, 'fan_mode', '4')).toBe('6');
  });

  test('should map mode and fan values in/out for HSU-09HTT103', () => {
    const model = 'HSU-09HTT103/R3(IN)';
    // From Haier → canonical
    expect(svc.mapValueFromHaier(model, 'mode', '0')).toBe('auto');
    expect(svc.mapValueFromHaier(model, 'mode', '1')).toBe('cool');
    expect(svc.mapValueFromHaier(model, 'mode', '2')).toBe('dry');
    expect(svc.mapValueFromHaier(model, 'mode', '4')).toBe('heat');
    expect(svc.mapValueFromHaier(model, 'mode', '6')).toBe('fan_only');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '1')).toBe('high');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '2')).toBe('medium');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '3')).toBe('low');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '5')).toBe('auto');
    // To Haier ← canonical
    expect(svc.mapValueToHaier(model, 'mode', 'auto')).toBe('0');
    expect(svc.mapValueToHaier(model, 'mode', 'cool')).toBe('1');
    expect(svc.mapValueToHaier(model, 'mode', 'dry')).toBe('2');
    expect(svc.mapValueToHaier(model, 'mode', 'heat')).toBe('4');
    expect(svc.mapValueToHaier(model, 'mode', 'fan_only')).toBe('6');
    expect(svc.mapValueToHaier(model, 'fan_mode', 'high')).toBe('1');
    expect(svc.mapValueToHaier(model, 'fan_mode', 'medium')).toBe('2');
    expect(svc.mapValueToHaier(model, 'fan_mode', 'low')).toBe('3');
    expect(svc.mapValueToHaier(model, 'fan_mode', 'auto')).toBe('5');
  });
});


