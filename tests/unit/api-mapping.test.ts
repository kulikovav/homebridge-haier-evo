import { HaierAPI } from '../../src/haier-api';
import { ModelConfigService } from '../../src/models/model-config';

describe('HaierAPI model-based mapping', () => {
  test('convertPropertiesToDeviceStatus respects model config for HSU-09HTT103', () => {
    const api = new HaierAPI({
      email: 'a', password: 'b', region: 'ru', deviceId: 'dev1'
    } as any);

    const svc = ModelConfigService.getInstance();
    expect(svc.getGroupCommandNameForModel('HSU-09HTT103/R3(IN)')).toBe('3');

    // Simulate WS properties per provided logs
    const props = {
      '0': '23.5',   // current temp (per model config)
      '31': '24',    // target temp
      '5': '1',      // mode cool
      '6': '2',      // fan medium
      '21': '1'      // power on
    };

    const status = api['convertPropertiesToDeviceStatus'](props, 'HSU-09HTT103/R3(IN)');
    expect(status.current_temperature).toBeCloseTo(23.5);
    expect(status.target_temperature).toBe(24);
    expect(status.mode).toBe('cool');
    expect(status.fan_mode).toBe('medium');
    expect(status.status).toBe(1);
  });
});


