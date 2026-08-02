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

  test('should match new AS50HQJ1HRA-B model and map its attributes', () => {
    const model = 'AS50HQJ1HRA-B';
    expect(svc.findDefinitionForModel(model)).toBeTruthy();
    expect(svc.getGroupCommandNameForModel(model)).toBe('4');
    expect(svc.getAttributeId(model, 'current_temperature', '36')).toBe('36');
    expect(svc.getAttributeId(model, 'target_temperature', '0')).toBe('0');
    expect(svc.getAttributeId(model, 'status', '21')).toBe('21');
    expect(svc.getAttributeId(model, 'mode', '2')).toBe('2');
    expect(svc.getAttributeId(model, 'fan_mode', '4')).toBe('4');
    expect(svc.mapValueFromHaier(model, 'mode', '0')).toBe('auto');
    expect(svc.mapValueFromHaier(model, 'mode', '1')).toBe('cool');
    expect(svc.mapValueFromHaier(model, 'mode', '2')).toBe('dry');
    expect(svc.mapValueFromHaier(model, 'mode', '4')).toBe('heat');
    expect(svc.mapValueFromHaier(model, 'mode', '6')).toBe('fan_only');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '1')).toBe('high');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '2')).toBe('medium');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '3')).toBe('low');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '5')).toBe('auto');
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

  test('should fall back to default mappings for completely unknown models', () => {
    const model = 'UNKNOWN-MODEL';
    expect(svc.findDefinitionForModel(model)).toBeUndefined();
    expect(svc.getGroupCommandNameForModel(model)).toBe('4');
    expect(svc.getAttributeId(model, 'current_temperature', '36')).toBe('36');
    expect(svc.mapValueToHaier(model, 'mode', 'cool')).toBe('1');
    expect(svc.mapValueToHaier(model, 'mode', 'heat')).toBe('4');
    expect(svc.mapValueFromHaier(model, 'mode', '1')).toBe('cool');
    expect(svc.mapValueFromHaier(model, 'mode', '4')).toBe('heat');
    expect(svc.mapValueToHaier(model, 'fan_mode', 'high')).toBe('1');
    expect(svc.mapValueToHaier(model, 'fan_mode', 'auto')).toBe('5');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '1')).toBe('high');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '5')).toBe('auto');
    expect(svc.mapValueToHaier(model, 'some_other_attr', 'test')).toBe('test');
    expect(svc.mapValueFromHaier(model, 'some_other_attr', 'test')).toBe('test');
  });

  test('should default-map mode when known model omits mode attribute mappings', () => {
    const model = 'HSU-07HRM203';
    expect(svc.findDefinitionForModel(model)).toBeTruthy();
    expect(svc.mapValueToHaier(model, 'mode', 'cool')).toBe('1');
    expect(svc.mapValueFromHaier(model, 'mode', '1')).toBe('cool');
    expect(svc.mapValueToHaier(model, 'fan_mode', 'auto')).toBe('5');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '5')).toBe('auto');
    expect(svc.mapValueToHaier(model, 'current_temperature', '22.5')).toBe('22.5');
  });

  test('should fall back to defaults for unmapped values on known models', () => {
    const model = 'AS50HQJ1HRA-B';
    expect(svc.mapValueFromHaier(model, 'mode', '99')).toBe('auto');
    expect(svc.mapValueToHaier(model, 'mode', 'unknown_mode')).toBe('unknown_mode');
    expect(svc.mapValueFromHaier(model, 'fan_mode', '99')).toBe('auto');
    expect(svc.mapValueToHaier(model, 'fan_mode', 'unknown_fan')).toBe('unknown_fan');
  });
});
