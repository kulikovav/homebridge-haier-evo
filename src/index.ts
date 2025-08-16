import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { HaierEvoPlatform } from './platform';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

export class HaierEvoHomebridgePlugin implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  private async discoverDevices() {
    try {
      const platform = new HaierEvoPlatform(this, this.config, this.api, this.log);
      await platform.initialize();
    } catch (error) {
      this.log.error('Failed to initialize platform:', error);
    }
  }
}

export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, HaierEvoHomebridgePlugin);
};
