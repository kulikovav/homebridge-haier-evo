import { DeviceFactory } from '../../src/device-factory';
import { HaierACDevice } from '../../src/devices/haier-ac-device';
import { HaierRefrigeratorDevice } from '../../src/devices/haier-refrigerator-device';
import { HaierDevice } from '../../src/types';

// Mock the device classes
jest.mock('../../src/devices/haier-ac-device');
jest.mock('../../src/devices/haier-refrigerator-device');

const MockHaierACDevice = HaierACDevice as jest.MockedClass<typeof HaierACDevice>;
const MockHaierRefrigeratorDevice = HaierRefrigeratorDevice as jest.MockedClass<typeof HaierRefrigeratorDevice>;

describe('DeviceFactory', () => {
  const mockAPI = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDevice', () => {
    it('should create AC device for air_conditioner type', () => {
      const deviceInfo = {
        id: 'test-ac',
        name: 'Test AC',
        type: 'air_conditioner',
        model: 'TEST-AC',
        mac: 'AA:BB:CC:DD:EE:FF',
        status: 1,
        attributes: []
      };

      const device = DeviceFactory.createDevice(deviceInfo, mockAPI);

      expect(MockHaierACDevice).toHaveBeenCalledWith(deviceInfo, mockAPI);
      expect(device).toBeInstanceOf(MockHaierACDevice);
    });

    it('should create AC device for conditioner type', () => {
      const deviceInfo = {
        id: 'test-conditioner',
        name: 'Test Conditioner',
        type: 'conditioner',
        model: 'TEST-COND',
        mac: 'AA:BB:CC:DD:EE:FF',
        status: 1,
        attributes: []
      };

      const device = DeviceFactory.createDevice(deviceInfo, mockAPI);

      expect(MockHaierACDevice).toHaveBeenCalledWith(deviceInfo, mockAPI);
      expect(device).toBeInstanceOf(MockHaierACDevice);
    });

    it('should create AC device for ac type', () => {
      const deviceInfo = {
        id: 'test-ac-short',
        name: 'Test AC Short',
        type: 'ac',
        model: 'TEST-AC-SHORT',
        mac: 'AA:BB:CC:DD:EE:FF',
        status: 1,
        attributes: []
      };

      const device = DeviceFactory.createDevice(deviceInfo, mockAPI);

      expect(MockHaierACDevice).toHaveBeenCalledWith(deviceInfo, mockAPI);
      expect(device).toBeInstanceOf(MockHaierACDevice);
    });

    it('should create refrigerator device for refrigerator type', () => {
      const deviceInfo = {
        id: 'test-fridge',
        name: 'Test Fridge',
        type: 'refrigerator',
        model: 'TEST-FRIDGE',
        mac: 'AA:BB:CC:DD:EE:FF',
        status: 1,
        attributes: []
      };

      const device = DeviceFactory.createDevice(deviceInfo, mockAPI);

      expect(MockHaierRefrigeratorDevice).toHaveBeenCalledWith(deviceInfo, mockAPI);
      expect(device).toBeInstanceOf(MockHaierRefrigeratorDevice);
    });

    it('should create refrigerator device for fridge type', () => {
      const deviceInfo = {
        id: 'test-fridge-alt',
        name: 'Test Fridge Alt',
        type: 'fridge',
        model: 'TEST-FRIDGE-ALT',
        mac: 'AA:BB:CC:DD:EE:FF',
        status: 1,
        attributes: []
      };

      const device = DeviceFactory.createDevice(deviceInfo, mockAPI);

      expect(MockHaierRefrigeratorDevice).toHaveBeenCalledWith(deviceInfo, mockAPI);
      expect(device).toBeInstanceOf(MockHaierRefrigeratorDevice);
    });

    it('should default to AC device for unknown type', () => {
      const deviceInfo = {
        id: 'test-unknown',
        name: 'Test Unknown',
        type: 'unknown_device',
        model: 'TEST-UNKNOWN',
        mac: 'AA:BB:CC:DD:EE:FF',
        status: 1,
        attributes: []
      };

      const device = DeviceFactory.createDevice(deviceInfo, mockAPI);

      expect(MockHaierACDevice).toHaveBeenCalledWith(deviceInfo, mockAPI);
      expect(device).toBeInstanceOf(MockHaierACDevice);
    });

    it('should handle case-insensitive type matching', () => {
      const deviceInfo = {
        id: 'test-upper',
        name: 'Test Upper',
        type: 'AIR_CONDITIONER',
        model: 'TEST-UPPER',
        mac: 'AA:BB:CC:DD:EE:FF',
        status: 1,
        attributes: []
      };

      const device = DeviceFactory.createDevice(deviceInfo, mockAPI);

      expect(MockHaierACDevice).toHaveBeenCalledWith(deviceInfo, mockAPI);
      expect(device).toBeInstanceOf(MockHaierACDevice);
    });
  });

  describe('isAirConditioner', () => {
    it('should return true for air conditioner devices', () => {
      const mockDevice = {
        device_type: 'air_conditioner'
      } as HaierDevice;

      expect(DeviceFactory.isAirConditioner(mockDevice)).toBe(true);
    });

    it('should return true for conditioner devices', () => {
      const mockDevice = {
        device_type: 'conditioner'
      } as HaierDevice;

      expect(DeviceFactory.isAirConditioner(mockDevice)).toBe(true);
    });

    it('should return true for AC devices', () => {
      const mockDevice = {
        device_type: 'AC'
      } as HaierDevice;

      expect(DeviceFactory.isAirConditioner(mockDevice)).toBe(true);
    });

    it('should return false for non-AC devices', () => {
      const mockDevice = {
        device_type: 'refrigerator'
      } as HaierDevice;

      expect(DeviceFactory.isAirConditioner(mockDevice)).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      const mockDevice = {
        device_type: 'CONDITIONER'
      } as HaierDevice;

      expect(DeviceFactory.isAirConditioner(mockDevice)).toBe(true);
    });
  });

  describe('isRefrigerator', () => {
    it('should return true for refrigerator devices', () => {
      const mockDevice = {
        device_type: 'refrigerator'
      } as HaierDevice;

      expect(DeviceFactory.isRefrigerator(mockDevice)).toBe(true);
    });

    it('should return true for fridge devices', () => {
      const mockDevice = {
        device_type: 'fridge'
      } as HaierDevice;

      expect(DeviceFactory.isRefrigerator(mockDevice)).toBe(true);
    });

    it('should return false for non-refrigerator devices', () => {
      const mockDevice = {
        device_type: 'air_conditioner'
      } as HaierDevice;

      expect(DeviceFactory.isRefrigerator(mockDevice)).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      const mockDevice = {
        device_type: 'REFRIGERATOR'
      } as HaierDevice;

      expect(DeviceFactory.isRefrigerator(mockDevice)).toBe(true);
    });
  });
});
