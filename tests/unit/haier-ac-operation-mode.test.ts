import { HaierACDevice } from '../../src/devices/haier-ac-device';
import { HaierAPI } from '../../src/haier-api';
import { DeviceInfo } from '../../src/types';

describe('HaierACDevice.set_operation_mode', () => {
  const deviceInfo: DeviceInfo = {
    id: 'ac-1',
    name: 'Test AC',
    type: 'air_conditioner',
    model: 'AS50HQJ1HRA-B',
    mac: 'AA:BB:CC:DD:EE:FF',
    status: 0,
    attributes: []
  };

  function createDevice(): { device: HaierACDevice; setDeviceProperty: jest.Mock } {
    const setDeviceProperty = jest.fn(async () => undefined);
    const api = {
      log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      },
      on: jest.fn(),
      removeListener: jest.fn(),
      setDeviceProperty
    } as unknown as HaierAPI;
    const device = new HaierACDevice(deviceInfo, api);
    return { device, setDeviceProperty };
  }

  test('should batch power on and target temperature with mode when device is off', async () => {
    const { device, setDeviceProperty } = createDevice();
    device.status = 0;
    device.target_temperature = 24;
    await device.set_operation_mode('cool');
    expect(setDeviceProperty).toHaveBeenCalledTimes(3);
    expect(setDeviceProperty).toHaveBeenNthCalledWith(1, deviceInfo.mac, '21', true);
    expect(setDeviceProperty).toHaveBeenNthCalledWith(2, deviceInfo.mac, '0', '24.00');
    expect(setDeviceProperty).toHaveBeenNthCalledWith(3, deviceInfo.mac, '2', '1');
    expect(device.status).toBe(1);
    expect(device.mode).toBe('cool');
  });

  test('should send only mode when device is already on', async () => {
    const { device, setDeviceProperty } = createDevice();
    device.status = 1;
    await device.set_operation_mode('cool');
    expect(setDeviceProperty).toHaveBeenCalledTimes(1);
    expect(setDeviceProperty).toHaveBeenCalledWith(deviceInfo.mac, '2', '1');
    expect(device.mode).toBe('cool');
  });

  test('should batch power on for off-to-heat as well', async () => {
    const { device, setDeviceProperty } = createDevice();
    device.status = 0;
    device.target_temperature = 22;
    await device.set_operation_mode('heat');
    expect(setDeviceProperty).toHaveBeenCalledTimes(3);
    expect(setDeviceProperty).toHaveBeenNthCalledWith(1, deviceInfo.mac, '21', true);
    expect(setDeviceProperty).toHaveBeenNthCalledWith(2, deviceInfo.mac, '0', '22.00');
    expect(setDeviceProperty).toHaveBeenNthCalledWith(3, deviceInfo.mac, '2', '4');
    expect(device.status).toBe(1);
    expect(device.mode).toBe('heat');
  });
});
