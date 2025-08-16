import { DeviceInfo, HaierDevice, HaierAC, HaierRefrigerator } from './types';
import { HaierACDevice } from './devices/haier-ac-device';
import { HaierRefrigeratorDevice } from './devices/haier-refrigerator-device';

export class DeviceFactory {
  static createDevice(deviceInfo: DeviceInfo, api: any): HaierDevice {
    const deviceType = deviceInfo.type.toLowerCase();

    switch (deviceType) {
      case 'air_conditioner':
      case 'conditioner':
      case 'ac':
        return new HaierACDevice(deviceInfo, api);

      case 'refrigerator':
      case 'fridge':
        return new HaierRefrigeratorDevice(deviceInfo, api);

      default:
        // For unknown device types, try to create a generic device
        // or fall back to AC device as it's the most common
        return new HaierACDevice(deviceInfo, api);
    }
  }

  static isAirConditioner(device: HaierDevice): device is HaierAC {
    return device.device_type.toLowerCase() === 'air_conditioner' ||
           device.device_type.toLowerCase().includes('conditioner') ||
           device.device_type.toLowerCase().includes('ac');
  }

  static isRefrigerator(device: HaierDevice): device is HaierRefrigerator {
    return device.device_type.toLowerCase() === 'refrigerator' ||
           device.device_type.toLowerCase().includes('refrigerator') ||
           device.device_type.toLowerCase().includes('fridge');
  }
}
