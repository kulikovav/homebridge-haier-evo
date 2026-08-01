import { parseDeviceConfig } from '../../src/validation';

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

  it('should return null if unexpected extra properties are present (due to .strict())', () => {
    const raw = {
      info: { model: 'model-123' },
      extra: 'this should fail',
    };
    const result = parseDeviceConfig(raw);
    expect(result).toBeNull();
  });

  it('should return null if attributes array has invalid items', () => {
    const raw = {
      attributes: [
        {
          name: 'attr1',
          // missing 'id' which is required in deviceAttributeSchema
        },
      ],
    };
    const result = parseDeviceConfig(raw);
    expect(result).toBeNull();
  });
});
